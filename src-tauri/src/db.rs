use crate::crypto::{
    decrypt_text, decrypt_with_passphrase, encrypt_text, encrypt_with_passphrase, hash_content,
};
use crate::detector::scan_and_mask;
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipItem {
    pub id: String,
    pub preview_text: String,
    pub masked_content: String,
    pub char_count: usize,
    pub byte_count: usize,
    pub line_count: usize,
    pub is_pinned: bool,
    pub is_secret: bool,
    pub secret_types: Vec<String>,
    pub category_id: String,
    pub tags: Vec<String>,
    pub copy_count: i64,
    pub created_at: i64,
    pub last_copied_at: i64,
    pub auto_purge_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseStats {
    pub total_clips: i64,
    pub secret_clips: i64,
    pub pinned_clips: i64,
    pub total_purged: i64,
    pub db_size_bytes: u64,
}

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
    db_path: PathBuf,
}

impl Database {
    pub fn new_disk() -> Result<Self, String> {
        let base_dir = dirs::data_local_dir()
            .or_else(dirs::home_dir)
            .unwrap_or_else(|| PathBuf::from("."));
        let app_dir = base_dir.join("ClipStash");
        fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create data dir: {e}"))?;

        let db_path = app_dir.join("clipstash.db");
        let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open DB: {e}"))?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
            db_path,
        };
        db.init_schema()?;
        Ok(db)
    }

    pub fn new_memory() -> Result<Self, String> {
        let conn = Connection::open_in_memory()
            .map_err(|e| format!("Failed to open in-memory DB: {e}"))?;
        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
            db_path: PathBuf::from(":memory:"),
        };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS clips (
                id TEXT PRIMARY KEY,
                content_encrypted TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                preview_text TEXT NOT NULL,
                char_count INTEGER NOT NULL,
                byte_count INTEGER NOT NULL,
                line_count INTEGER NOT NULL,
                is_pinned INTEGER NOT NULL DEFAULT 0,
                is_secret INTEGER NOT NULL DEFAULT 0,
                secret_types TEXT NOT NULL DEFAULT '[]',
                masked_content TEXT NOT NULL,
                category_id TEXT NOT NULL DEFAULT 'general',
                tags TEXT NOT NULL DEFAULT '[]',
                copy_count INTEGER NOT NULL DEFAULT 1,
                created_at INTEGER NOT NULL,
                last_copied_at INTEGER NOT NULL,
                auto_purge_at INTEGER
            );

            CREATE INDEX IF NOT EXISTS idx_clips_hash ON clips(content_hash);
            CREATE INDEX IF NOT EXISTS idx_clips_last_copied ON clips(last_copied_at DESC);
            CREATE INDEX IF NOT EXISTS idx_clips_is_pinned ON clips(is_pinned);
            CREATE INDEX IF NOT EXISTS idx_clips_is_secret ON clips(is_secret);
            CREATE INDEX IF NOT EXISTS idx_clips_auto_purge ON clips(auto_purge_at);

            CREATE VIRTUAL TABLE IF NOT EXISTS clips_fts USING fts5(
                id UNINDEXED,
                preview_text,
                masked_content,
                tags
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS telemetry (
                key TEXT PRIMARY KEY,
                counter INTEGER NOT NULL DEFAULT 0
            );

            INSERT OR IGNORE INTO telemetry (key, counter) VALUES ('total_purged', 0);
            ",
        )
        .map_err(|e| format!("Schema initialization error: {e}"))?;

        Ok(())
    }

    pub fn save_clip(
        &self,
        raw_text: &str,
        category: Option<&str>,
        tags: Option<Vec<String>>,
    ) -> Result<ClipItem, String> {
        let trimmed = raw_text.trim();
        if trimmed.is_empty() {
            return Err("Cannot store empty clip".to_string());
        }

        let hash = hash_content(raw_text);
        let now = Utc::now().timestamp();
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        // Deduplication check: if identical clip exists, bump timestamp & increment count
        let existing: Option<(String, i64)> = conn
            .query_row(
                "SELECT id, copy_count FROM clips WHERE content_hash = ?1 LIMIT 1",
                params![hash],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .ok();

        if let Some((existing_id, existing_count)) = existing {
            conn.execute(
                "UPDATE clips SET last_copied_at = ?1, copy_count = ?2 WHERE id = ?3",
                params![now, existing_count + 1, existing_id],
            )
            .map_err(|e| format!("Failed to bump clip: {e}"))?;

            // Retrieve updated item
            return self.get_clip_by_id_internal(&conn, &existing_id);
        }

        // Fresh clip scan and encryption
        let scan = scan_and_mask(raw_text);
        let encrypted = encrypt_text(raw_text)?;
        let id = Uuid::new_v4().to_string();

        let char_count = raw_text.chars().count();
        let byte_count = raw_text.len();
        let line_count = raw_text.lines().count().max(1);
        let category_id = category.unwrap_or("general").to_string();
        let tags_vec = tags.unwrap_or_default();
        let tags_json = serde_json::to_string(&tags_vec).unwrap_or_else(|_| "[]".to_string());
        let secret_types_json =
            serde_json::to_string(&scan.secret_types).unwrap_or_else(|_| "[]".to_string());

        // Default auto-purge: if secret, 60 seconds from now
        let auto_purge_at = if scan.is_secret {
            scan.default_purge_seconds.map(|secs| now + secs)
        } else {
            None
        };

        conn.execute(
            "INSERT INTO clips (
                id, content_encrypted, content_hash, preview_text,
                char_count, byte_count, line_count, is_pinned,
                is_secret, secret_types, masked_content, category_id,
                tags, copy_count, created_at, last_copied_at, auto_purge_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            params![
                id,
                encrypted,
                hash,
                scan.preview_text,
                char_count as i64,
                byte_count as i64,
                line_count as i64,
                0,
                if scan.is_secret { 1 } else { 0 },
                secret_types_json,
                scan.masked_content,
                category_id,
                tags_json,
                1,
                now,
                now,
                auto_purge_at
            ],
        )
        .map_err(|e| format!("Insert clip error: {e}"))?;

        // Sync FTS table
        let _ = conn.execute(
            "INSERT INTO clips_fts (id, preview_text, masked_content, tags) VALUES (?1, ?2, ?3, ?4)",
            params![id, scan.preview_text, scan.masked_content, tags_json],
        );

        Ok(ClipItem {
            id,
            preview_text: scan.preview_text,
            masked_content: scan.masked_content,
            char_count,
            byte_count,
            line_count,
            is_pinned: false,
            is_secret: scan.is_secret,
            secret_types: scan.secret_types,
            category_id,
            tags: tags_vec,
            copy_count: 1,
            created_at: now,
            last_copied_at: now,
            auto_purge_at,
        })
    }

    fn get_clip_by_id_internal(&self, conn: &Connection, id: &str) -> Result<ClipItem, String> {
        conn.query_row(
            "SELECT id, preview_text, masked_content, char_count, byte_count, line_count,
                    is_pinned, is_secret, secret_types, category_id, tags, copy_count,
                    created_at, last_copied_at, auto_purge_at
             FROM clips WHERE id = ?1",
            params![id],
            |row| {
                let secret_types_str: String = row.get(8)?;
                let tags_str: String = row.get(10)?;
                Ok(ClipItem {
                    id: row.get(0)?,
                    preview_text: row.get(1)?,
                    masked_content: row.get(2)?,
                    char_count: row.get::<_, i64>(3)? as usize,
                    byte_count: row.get::<_, i64>(4)? as usize,
                    line_count: row.get::<_, i64>(5)? as usize,
                    is_pinned: row.get::<_, i64>(6)? != 0,
                    is_secret: row.get::<_, i64>(7)? != 0,
                    secret_types: serde_json::from_str(&secret_types_str).unwrap_or_default(),
                    category_id: row.get(9)?,
                    tags: serde_json::from_str(&tags_str).unwrap_or_default(),
                    copy_count: row.get(11)?,
                    created_at: row.get(12)?,
                    last_copied_at: row.get(13)?,
                    auto_purge_at: row.get(14)?,
                })
            },
        )
        .map_err(|e| format!("Clip query error: {e}"))
    }

    pub fn get_clips(
        &self,
        query: Option<&str>,
        category: Option<&str>,
        pinned_only: bool,
        secret_only: bool,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<ClipItem>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let mut sql = String::from(
            "SELECT id, preview_text, masked_content, char_count, byte_count, line_count,
                    is_pinned, is_secret, secret_types, category_id, tags, copy_count,
                    created_at, last_copied_at, auto_purge_at
             FROM clips WHERE 1=1 ",
        );

        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if pinned_only {
            sql.push_str("AND is_pinned = 1 ");
        }

        if secret_only {
            sql.push_str("AND is_secret = 1 ");
        }

        if let Some(cat) = category {
            if !cat.is_empty() && cat != "all" {
                sql.push_str("AND category_id = ? ");
                params_vec.push(Box::new(cat.to_string()));
            }
        }

        if let Some(q) = query {
            let clean_q = q.trim();
            if !clean_q.is_empty() {
                // Try FTS match with fallback to LIKE
                let fts_query = format!("{}*", clean_q.replace('"', "\"\""));
                sql.push_str("AND id IN (SELECT id FROM clips_fts WHERE clips_fts MATCH ? UNION SELECT id FROM clips WHERE preview_text LIKE ? OR masked_content LIKE ?) ");
                params_vec.push(Box::new(fts_query));
                let like_pattern = format!("%{clean_q}%");
                params_vec.push(Box::new(like_pattern.clone()));
                params_vec.push(Box::new(like_pattern));
            }
        }

        sql.push_str("ORDER BY is_pinned DESC, last_copied_at DESC LIMIT ? OFFSET ?");
        params_vec.push(Box::new(limit as i64));
        params_vec.push(Box::new(offset as i64));

        let slice_params: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|b| b.as_ref()).collect();

        let mut stmt = conn.prepare(&sql).map_err(|e| format!("Query prepare error: {e}"))?;
        let rows = stmt
            .query_map(slice_params.as_slice(), |row| {
                let secret_types_str: String = row.get(8)?;
                let tags_str: String = row.get(10)?;
                Ok(ClipItem {
                    id: row.get(0)?,
                    preview_text: row.get(1)?,
                    masked_content: row.get(2)?,
                    char_count: row.get::<_, i64>(3)? as usize,
                    byte_count: row.get::<_, i64>(4)? as usize,
                    line_count: row.get::<_, i64>(5)? as usize,
                    is_pinned: row.get::<_, i64>(6)? != 0,
                    is_secret: row.get::<_, i64>(7)? != 0,
                    secret_types: serde_json::from_str(&secret_types_str).unwrap_or_default(),
                    category_id: row.get(9)?,
                    tags: serde_json::from_str(&tags_str).unwrap_or_default(),
                    copy_count: row.get(11)?,
                    created_at: row.get(12)?,
                    last_copied_at: row.get(13)?,
                    auto_purge_at: row.get(14)?,
                })
            })
            .map_err(|e| format!("Query execution error: {e}"))?;

        let mut result = Vec::new();
        for r in rows {
            if let Ok(item) = r {
                result.push(item);
            }
        }

        Ok(result)
    }

    pub fn get_decrypted_content(&self, id: &str) -> Result<String, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let encrypted: String = conn
            .query_row(
                "SELECT content_encrypted FROM clips WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Clip not found: {e}"))?;

        decrypt_text(&encrypted)
    }

    pub fn toggle_pin(&self, id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let current: i64 = conn
            .query_row(
                "SELECT is_pinned FROM clips WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Clip not found: {e}"))?;

        let new_state = if current == 0 { 1 } else { 0 };
        conn.execute(
            "UPDATE clips SET is_pinned = ?1 WHERE id = ?2",
            params![new_state, id],
        )
        .map_err(|e| format!("Update pin error: {e}"))?;

        Ok(new_state == 1)
    }

    pub fn update_category(&self, id: &str, category_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE clips SET category_id = ?1 WHERE id = ?2",
            params![category_id, id],
        )
        .map_err(|e| format!("Update category error: {e}"))?;
        Ok(())
    }

    pub fn delete_clip(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM clips WHERE id = ?1", params![id])
            .map_err(|e| format!("Delete clip error: {e}"))?;
        let _ = conn.execute("DELETE FROM clips_fts WHERE id = ?1", params![id]);
        Ok(())
    }

    pub fn clear_history(&self, keep_pinned: bool) -> Result<usize, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let count = if keep_pinned {
            conn.execute("DELETE FROM clips WHERE is_pinned = 0", [])
                .map_err(|e| format!("Clear history error: {e}"))?
        } else {
            conn.execute("DELETE FROM clips", [])
                .map_err(|e| format!("Clear all history error: {e}"))?
        };

        let _ = conn.execute("DELETE FROM clips_fts WHERE id NOT IN (SELECT id FROM clips)", []);
        Ok(count)
    }

    pub fn purge_expired_secrets(&self) -> Result<Vec<String>, String> {
        let now = Utc::now().timestamp();
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare("SELECT id FROM clips WHERE auto_purge_at IS NOT NULL AND auto_purge_at <= ?1")
            .map_err(|e| format!("Prepare purge check error: {e}"))?;

        let ids: Vec<String> = stmt
            .query_map(params![now], |row| row.get(0))
            .map_err(|e| format!("Query purge candidates error: {e}"))?
            .filter_map(Result::ok)
            .collect();

        if !ids.is_empty() {
            for id in &ids {
                let _ = conn.execute("DELETE FROM clips WHERE id = ?1", params![id]);
                let _ = conn.execute("DELETE FROM clips_fts WHERE id = ?1", params![id]);
            }
            let _ = conn.execute(
                "UPDATE telemetry SET counter = counter + ?1 WHERE key = 'total_purged'",
                params![ids.len() as i64],
            );
        }

        Ok(ids)
    }

    pub fn get_stats(&self) -> Result<DatabaseStats, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let total_clips: i64 = conn
            .query_row("SELECT COUNT(*) FROM clips", [], |r| r.get(0))
            .unwrap_or(0);

        let secret_clips: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clips WHERE is_secret = 1",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let pinned_clips: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clips WHERE is_pinned = 1",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let total_purged: i64 = conn
            .query_row(
                "SELECT counter FROM telemetry WHERE key = 'total_purged'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let db_size_bytes = if self.db_path.exists() {
            fs::metadata(&self.db_path).map(|m| m.len()).unwrap_or(0)
        } else {
            0
        };

        Ok(DatabaseStats {
            total_clips,
            secret_clips,
            pinned_clips,
            total_purged,
            db_size_bytes,
        })
    }

    pub fn get_setting(&self, key: &str, default: &str) -> String {
        let conn = match self.conn.lock() {
            Ok(c) => c,
            Err(_) => return default.to_string(),
        };

        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| default.to_string())
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )
        .map_err(|e| format!("Save setting error: {e}"))?;
        Ok(())
    }

    pub fn export_vault(&self, passphrase: &str) -> Result<String, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT content_encrypted, is_pinned, category_id, tags, created_at FROM clips ORDER BY created_at ASC",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let enc: String = row.get(0)?;
                let is_pinned: bool = row.get::<_, i64>(1)? == 1;
                let category_id: String = row.get(2)?;
                let tags_json: String = row.get(3)?;
                let created_at: i64 = row.get(4)?;
                Ok((enc, is_pinned, category_id, tags_json, created_at))
            })
            .map_err(|e| e.to_string())?;

        let mut export_records = Vec::new();
        for r in rows {
            let (enc, is_pinned, category_id, tags_json, created_at) =
                r.map_err(|e| e.to_string())?;
            let raw_content = decrypt_text(&enc)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
            export_records.push(VaultExportRecord {
                raw_content,
                is_pinned,
                category_id,
                tags,
                created_at,
            });
        }

        let serialized = serde_json::to_string(&export_records)
            .map_err(|e| format!("Serialization error: {e}"))?;

        encrypt_with_passphrase(&serialized, passphrase)
    }

    pub fn import_vault(&self, passphrase: &str, encrypted_payload: &str) -> Result<usize, String> {
        let decrypted_json = decrypt_with_passphrase(encrypted_payload, passphrase)?;
        let records: Vec<VaultExportRecord> = serde_json::from_str(&decrypted_json)
            .map_err(|e| format!("Invalid vault records JSON: {e}"))?;

        let count = records.len();
        for rec in records {
            let _ = self.save_clip(&rec.raw_content, Some(&rec.category_id), Some(rec.tags));
        }

        Ok(count)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultExportRecord {
    pub raw_content: String,
    pub is_pinned: bool,
    pub category_id: String,
    pub tags: Vec<String>,
    pub created_at: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_save_and_retrieve() {
        let db = Database::new_memory().expect("failed to init db");
        let clip = db
            .save_clip("hello world snippet", None, None)
            .expect("save clip failed");

        assert_eq!(clip.preview_text, "hello world snippet");
        assert!(!clip.is_secret);

        let retrieved = db
            .get_decrypted_content(&clip.id)
            .expect("decryption failed");
        assert_eq!(retrieved, "hello world snippet");
    }

    #[test]
    fn test_db_secret_masking_and_pinning() {
        let db = Database::new_memory().expect("failed to init db");
        let secret = "export GITHUB_TOKEN=ghp_111122223333444455556666777788889999";
        let clip = db.save_clip(secret, None, None).expect("save secret failed");

        assert!(clip.is_secret);
        assert!(clip.masked_content.contains("ghp_••••••••••••"));

        let pinned = db.toggle_pin(&clip.id).expect("toggle pin failed");
        assert!(pinned);

        let clips = db
            .get_clips(None, None, true, false, 10, 0)
            .expect("get clips failed");
        assert_eq!(clips.len(), 1);
        assert_eq!(clips[0].id, clip.id);
    }

    #[test]
    fn test_db_auto_purge() {
        let db = Database::new_memory().expect("failed to init db");
        let secret = "AKIA1234567890ABCDEF";
        let clip = db.save_clip(secret, None, None).expect("save secret failed");

        // Manually alter auto_purge_at to the past
        {
            let conn = db.conn.lock().unwrap();
            conn.execute(
                "UPDATE clips SET auto_purge_at = ?1 WHERE id = ?2",
                params![Utc::now().timestamp() - 10, clip.id],
            )
            .unwrap();
        }

        let purged = db.purge_expired_secrets().expect("purge failed");
        assert_eq!(purged, vec![clip.id]);

        let stats = db.get_stats().expect("get stats failed");
        assert_eq!(stats.total_clips, 0);
        assert_eq!(stats.total_purged, 1);
    }

    #[test]
    fn test_vault_export_and_import() {
        let db = Database::new_memory().expect("failed to init db");
        db.save_clip("snippet-1", None, None).unwrap();
        db.save_clip("snippet-2", None, None).unwrap();

        let pass = "vault-export-passphrase-42";
        let exported = db.export_vault(pass).expect("export failed");
        assert!(exported.contains("clipstash-encrypted-vault"));

        let db2 = Database::new_memory().expect("failed to init db2");
        let imported = db2.import_vault(pass, &exported).expect("import failed");
        assert_eq!(imported, 2);

        let clips = db2.get_clips(None, None, false, false, 10, 0).unwrap();
        assert_eq!(clips.len(), 2);
    }
}
