use crate::content_type::detect_content_type;
use crate::db::DbState;
use arboard::Clipboard;
use chrono::Utc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

/// Holds the text this app just wrote to the system clipboard, so the
/// watcher can skip re-capturing its own writes as new history entries.
pub type SuppressState = Arc<Mutex<Option<String>>>;

pub fn spawn(app_handle: AppHandle, suppress: SuppressState) {
    thread::spawn(move || {
        let mut clipboard = match Clipboard::new() {
            Ok(c) => c,
            Err(err) => {
                eprintln!("zicopy: failed to initialize clipboard watcher: {err}");
                return;
            }
        };

        let mut last_seen: Option<String> = clipboard.get_text().ok();

        loop {
            thread::sleep(Duration::from_millis(600));

            let text = match clipboard.get_text() {
                Ok(t) => t,
                Err(_) => continue,
            };

            if text.trim().is_empty() || last_seen.as_deref() == Some(text.as_str()) {
                continue;
            }
            last_seen = Some(text.clone());

            {
                let mut guard = suppress.lock().unwrap();
                if guard.as_deref() == Some(text.as_str()) {
                    *guard = None;
                    continue;
                }
            }

            let content_type = detect_content_type(&text);
            let id = Uuid::new_v4().to_string();
            let created_at = Utc::now().timestamp_millis();
            let char_count = text.chars().count() as i64;

            let inserted = {
                let state = app_handle.state::<DbState>();
                let conn = state.0.lock().unwrap();
                conn.execute(
                    "INSERT INTO clipboard_items (id, content, content_type, app_name, is_favorite, created_at, char_count)
                     VALUES (?1, ?2, ?3, NULL, 0, ?4, ?5)",
                    rusqlite::params![id, text, content_type, created_at, char_count],
                )
                .is_ok()
            };

            if inserted {
                let _ = app_handle.emit("clipboard://new-item", &id);
            }
        }
    });
}
