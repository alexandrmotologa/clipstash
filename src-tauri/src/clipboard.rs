use crate::crypto::hash_content;
use crate::db::Database;
use arboard::Clipboard;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub struct ClipboardMonitor {
    is_paused: Arc<AtomicBool>,
    ignore_hash: Arc<Mutex<Option<String>>>,
    database: Database,
}

impl ClipboardMonitor {
    pub fn new(database: Database) -> Self {
        Self {
            is_paused: Arc::new(AtomicBool::new(false)),
            ignore_hash: Arc::new(Mutex::new(None)),
            database,
        }
    }

    pub fn is_paused(&self) -> bool {
        self.is_paused.load(Ordering::Relaxed)
    }

    pub fn toggle_pause(&self) -> bool {
        let current = self.is_paused.load(Ordering::Relaxed);
        let next = !current;
        self.is_paused.store(next, Ordering::Relaxed);
        next
    }

    pub fn set_paused(&self, paused: bool) {
        self.is_paused.store(paused, Ordering::Relaxed);
    }

    pub fn copy_text_programmatic(&self, text: &str) -> Result<(), String> {
        let hash = hash_content(text);
        if let Ok(mut lock) = self.ignore_hash.lock() {
            *lock = Some(hash);
        }

        let mut clipboard =
            Clipboard::new().map_err(|e| format!("Failed to open clipboard: {e}"))?;
        clipboard
            .set_text(text)
            .map_err(|e| format!("Failed to write to clipboard: {e}"))?;

        Ok(())
    }

    pub fn start_monitoring(&self, app_handle: AppHandle) {
        let is_paused = Arc::clone(&self.is_paused);
        let ignore_hash = Arc::clone(&self.ignore_hash);
        let db = self.database.clone();

        thread::spawn(move || {
            let mut last_seen_hash = String::new();
            let mut purge_tick = 0u32;

            loop {
                thread::sleep(Duration::from_millis(400));

                // 1. Periodically purge expired secrets every ~4 seconds (10 ticks)
                purge_tick += 1;
                if purge_tick >= 10 {
                    purge_tick = 0;
                    if let Ok(purged_ids) = db.purge_expired_secrets() {
                        if !purged_ids.is_empty() {
                            let _ = app_handle.emit("clips-purged", purged_ids);
                        }
                    }
                }

                // 2. If monitoring is paused, continue
                if is_paused.load(Ordering::Relaxed) {
                    continue;
                }

                // 3. Read clipboard text
                let mut clipboard = match Clipboard::new() {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                let text = match clipboard.get_text() {
                    Ok(t) => t,
                    Err(_) => continue,
                };

                let trimmed = text.trim();
                if trimmed.is_empty() {
                    continue;
                }

                let current_hash = hash_content(&text);

                // Check if this was a programmatic copy from ClipStash itself
                if let Ok(mut ignore_lock) = ignore_hash.lock() {
                    if let Some(ignored) = ignore_lock.as_ref() {
                        if *ignored == current_hash {
                            *ignore_lock = None;
                            last_seen_hash = current_hash;
                            continue;
                        }
                    }
                }

                // If identical to the last seen clipboard item, skip
                if current_hash == last_seen_hash {
                    continue;
                }

                last_seen_hash = current_hash;

                // Save to database
                match db.save_clip(&text, None, None) {
                    Ok(saved_clip) => {
                        let _ = app_handle.emit("clip-added", saved_clip);
                    }
                    Err(e) => {
                        log::error!("Failed to record clipboard item: {e}");
                    }
                }
            }
        });
    }
}
