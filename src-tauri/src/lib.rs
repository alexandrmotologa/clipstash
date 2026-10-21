pub mod clipboard;
pub mod commands;
pub mod crypto;
pub mod db;
pub mod detector;

use clipboard::ClipboardMonitor;
use commands::*;
use db::Database;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

pub fn run() {
    let database = match Database::new_disk() {
        Ok(db) => db,
        Err(e) => {
            eprintln!("Failed to initialize database: {e}");
            Database::new_memory().expect("Fallback in-memory DB failed")
        }
    };

    let monitor = Arc::new(ClipboardMonitor::new(database.clone()));

    tauri::Builder::default()
        .manage(AppState {
            db: database,
            monitor: Arc::clone(&monitor),
        })
        .invoke_handler(tauri::generate_handler![
            get_clips,
            get_clip_content,
            copy_clip,
            copy_custom_text,
            toggle_pin,
            update_category,
            delete_clip,
            burn_secret_now,
            clear_history,
            toggle_pause,
            is_paused,
            get_stats,
            add_manual_clip,
            get_setting,
            set_setting,
            export_encrypted_vault,
            import_encrypted_vault,
            is_bypass_sensitive_apps,
            set_bypass_sensitive_apps,
        ])
        .setup(move |app| {
            // Start background clipboard listener thread
            monitor.start_monitoring(app.handle().clone());

            // Build Tray Menu
            let quit_i = MenuItem::with_id(app, "quit", "Quit ClipStash", true, None::<&str>)?;
            let toggle_i = MenuItem::with_id(app, "toggle", "Show / Hide", true, None::<&str>)?;
            let clear_i = MenuItem::with_id(app, "clear", "Clear Unpinned History", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle_i, &clear_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "toggle" => {
                        if let Some(window) = app.get_webview_window("main") {
                            if let Ok(is_visible) = window.is_visible() {
                                if is_visible {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    }
                    "clear" => {
                        let state = app.state::<AppState>();
                        let _ = state.db.clear_history(true);
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running clipstash application");
}
