use crate::clipboard::ClipboardMonitor;
use crate::db::{ClipItem, Database, DatabaseStats};
use std::sync::Arc;
use tauri::State;

pub struct AppState {
    pub db: Database,
    pub monitor: Arc<ClipboardMonitor>,
}

#[tauri::command]
pub fn get_clips(
    state: State<AppState>,
    search: Option<String>,
    category: Option<String>,
    pinned_only: Option<bool>,
    secret_only: Option<bool>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<ClipItem>, String> {
    state.db.get_clips(
        search.as_deref(),
        category.as_deref(),
        pinned_only.unwrap_or(false),
        secret_only.unwrap_or(false),
        limit.unwrap_or(50),
        offset.unwrap_or(0),
    )
}

#[tauri::command]
pub fn get_clip_content(state: State<AppState>, id: String) -> Result<String, String> {
    state.db.get_decrypted_content(&id)
}

#[tauri::command]
pub fn copy_clip(state: State<AppState>, id: String) -> Result<(), String> {
    let plain = state.db.get_decrypted_content(&id)?;
    state.monitor.copy_text_programmatic(&plain)
}

#[tauri::command]
pub fn copy_custom_text(state: State<AppState>, text: String) -> Result<(), String> {
    state.monitor.copy_text_programmatic(&text)
}

#[tauri::command]
pub fn toggle_pin(state: State<AppState>, id: String) -> Result<bool, String> {
    state.db.toggle_pin(&id)
}

#[tauri::command]
pub fn update_category(
    state: State<AppState>,
    id: String,
    category_id: String,
) -> Result<(), String> {
    state.db.update_category(&id, &category_id)
}

#[tauri::command]
pub fn delete_clip(state: State<AppState>, id: String) -> Result<(), String> {
    state.db.delete_clip(&id)
}

#[tauri::command]
pub fn burn_secret_now(state: State<AppState>, id: String) -> Result<(), String> {
    state.db.delete_clip(&id)
}

#[tauri::command]
pub fn clear_history(state: State<AppState>, keep_pinned: bool) -> Result<usize, String> {
    state.db.clear_history(keep_pinned)
}

#[tauri::command]
pub fn toggle_pause(state: State<AppState>) -> Result<bool, String> {
    Ok(state.monitor.toggle_pause())
}

#[tauri::command]
pub fn is_paused(state: State<AppState>) -> Result<bool, String> {
    Ok(state.monitor.is_paused())
}

#[tauri::command]
pub fn get_stats(state: State<AppState>) -> Result<DatabaseStats, String> {
    state.db.get_stats()
}

#[tauri::command]
pub fn add_manual_clip(
    state: State<AppState>,
    content: String,
    category: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<ClipItem, String> {
    state.db.save_clip(&content, category.as_deref(), tags)
}

#[tauri::command]
pub fn get_setting(
    state: State<AppState>,
    key: String,
    default_value: String,
) -> Result<String, String> {
    Ok(state.db.get_setting(&key, &default_value))
}

#[tauri::command]
pub fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    state.db.set_setting(&key, &value)
}

#[tauri::command]
pub fn export_encrypted_vault(state: State<AppState>, passphrase: String) -> Result<String, String> {
    state.db.export_vault(&passphrase)
}

#[tauri::command]
pub fn import_encrypted_vault(
    state: State<AppState>,
    passphrase: String,
    payload: String,
) -> Result<usize, String> {
    state.db.import_vault(&passphrase, &payload)
}

#[tauri::command]
pub fn is_bypass_sensitive_apps(state: State<AppState>) -> Result<bool, String> {
    Ok(state.monitor.is_bypass_sensitive_apps())
}

#[tauri::command]
pub fn set_bypass_sensitive_apps(state: State<AppState>, bypass: bool) -> Result<(), String> {
    state.monitor.set_bypass_sensitive_apps(bypass);
    let _ = state
        .db
        .set_setting("bypass_sensitive_apps", if bypass { "true" } else { "false" });
    Ok(())
}
