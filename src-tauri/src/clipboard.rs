use crate::crypto::hash_content;
use crate::db::Database;
use crate::detector::is_sensitive_process;
use arboard::Clipboard;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[cfg(target_os = "windows")]
pub mod platform {
    use std::ffi::c_void;
    use std::path::Path;

    type HWND = *mut c_void;
    type HANDLE = *mut c_void;
    type DWORD = u32;
    type BOOL = i32;

    const PROCESS_QUERY_LIMITED_INFORMATION: DWORD = 0x1000;

    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetForegroundWindow() -> HWND;
        fn GetWindowThreadProcessId(hWnd: HWND, lpdwProcessId: *mut DWORD) -> DWORD;
    }

    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn OpenProcess(dwDesiredAccess: DWORD, bInheritHandle: BOOL, dwProcessId: DWORD) -> HANDLE;
        fn QueryFullProcessImageNameW(
            hProcess: HANDLE,
            dwFlags: DWORD,
            lpExeName: *mut u16,
            lpdwSize: *mut DWORD,
        ) -> BOOL;
        fn CloseHandle(hObject: HANDLE) -> BOOL;
    }

    pub fn get_active_process_name() -> Option<String> {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.is_null() {
                return None;
            }

            let mut process_id: DWORD = 0;
            GetWindowThreadProcessId(hwnd, &mut process_id);
            if process_id == 0 {
                return None;
            }

            let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id);
            if handle.is_null() {
                return None;
            }

            let mut buffer = [0u16; 1024];
            let mut size = buffer.len() as DWORD;

            let success = QueryFullProcessImageNameW(handle, 0, buffer.as_mut_ptr(), &mut size);
            CloseHandle(handle);

            if success != 0 && size > 0 {
                let full_path = String::from_utf16_lossy(&buffer[..size as usize]);
                let file_name = Path::new(&full_path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map(|s| s.to_lowercase());
                return file_name;
            }

            None
        }
    }
}

#[cfg(not(target_os = "windows"))]
pub mod platform {
    pub fn get_active_process_name() -> Option<String> {
        None
    }
}

pub struct ClipboardMonitor {
    is_paused: Arc<AtomicBool>,
    bypass_sensitive_apps: Arc<AtomicBool>,
    ignore_hash: Arc<Mutex<Option<String>>>,
    database: Database,
}

impl ClipboardMonitor {
    pub fn new(database: Database) -> Self {
        Self {
            is_paused: Arc::new(AtomicBool::new(false)),
            bypass_sensitive_apps: Arc::new(AtomicBool::new(true)),
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

    pub fn is_bypass_sensitive_apps(&self) -> bool {
        self.bypass_sensitive_apps.load(Ordering::Relaxed)
    }

    pub fn set_bypass_sensitive_apps(&self, bypass: bool) {
        self.bypass_sensitive_apps.store(bypass, Ordering::Relaxed);
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
        let bypass_sensitive = Arc::clone(&self.bypass_sensitive_apps);
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

                // 3. Sensitive App Privacy Guard:
                // Check if current active foreground window is a known password manager
                if bypass_sensitive.load(Ordering::Relaxed) {
                    if let Some(active_proc) = platform::get_active_process_name() {
                        if is_sensitive_process(&active_proc) {
                            // User copied from password manager, bypass capturing!
                            continue;
                        }
                    }
                }

                // 4. Read clipboard text
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
