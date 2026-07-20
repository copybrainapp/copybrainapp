mod clipboard_watcher;
mod commands;
mod content_type;
mod db;
mod models;

use db::DbState;
use std::sync::{Arc, Mutex};
use tauri::menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{Emitter, Manager, WindowEvent, Wry};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const TRAY_RECENT_LIMIT: i64 = 8;
const TRAY_LABEL_MAX_CHARS: usize = 46;

fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

/// Secrets stay masked in the tray menu too — anyone glancing at your screen
/// shouldn't be able to read a password off the menu bar.
fn tray_item_label(content: &str, content_type: &str) -> String {
    if content_type == "secret" {
        return "🔑 •••••••• (secret)".to_string();
    }
    let flattened = content.split_whitespace().collect::<Vec<_>>().join(" ");
    if flattened.is_empty() {
        return "(empty)".to_string();
    }
    let char_count = flattened.chars().count();
    if char_count > TRAY_LABEL_MAX_CHARS {
        let truncated: String = flattened.chars().take(TRAY_LABEL_MAX_CHARS).collect();
        format!("{truncated}…")
    } else {
        flattened
    }
}

/// Rebuilds the tray menu with the most recent clipboard items on top so it
/// always reflects current history — called both right before the menu is
/// shown (macOS/Windows) and after every new capture (keeps Linux, where the
/// pre-show event isn't emitted, from going stale).
fn refresh_tray_menu(app: &tauri::AppHandle) {
    let Some(tray) = app.try_state::<TrayIcon<Wry>>() else {
        return;
    };

    let recent: Vec<(String, String, String)> = {
        let db = app.state::<DbState>();
        let conn = match db.0.lock() {
            Ok(c) => c,
            Err(_) => return,
        };
        let mut stmt = match conn.prepare(
            "SELECT id, content, content_type FROM clipboard_items ORDER BY created_at DESC LIMIT ?1",
        ) {
            Ok(s) => s,
            Err(_) => return,
        };
        let rows = stmt.query_map(rusqlite::params![TRAY_RECENT_LIMIT], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        });
        match rows {
            Ok(rows) => rows.filter_map(|r| r.ok()).collect(),
            Err(_) => return,
        }
    };

    let mut owned_items: Vec<Box<dyn IsMenuItem<Wry>>> = Vec::new();

    if recent.is_empty() {
        if let Ok(placeholder) =
            MenuItem::with_id(app, "noop", "No items yet", false, None::<&str>)
        {
            owned_items.push(Box::new(placeholder));
        }
    } else {
        for (id, content, content_type) in &recent {
            let label = tray_item_label(content, content_type);
            if let Ok(item) =
                MenuItem::with_id(app, format!("paste:{id}"), label, true, None::<&str>)
            {
                owned_items.push(Box::new(item));
            }
        }
    }

    if let Ok(sep) = PredefinedMenuItem::separator(app) {
        owned_items.push(Box::new(sep));
    }
    if let Ok(show_item) = MenuItem::with_id(app, "show", "Show CopyBrain", true, None::<&str>) {
        owned_items.push(Box::new(show_item));
    }
    if let Ok(about_item) =
        MenuItem::with_id(app, "about", "About CopyBrain", true, None::<&str>)
    {
        owned_items.push(Box::new(about_item));
    }
    if let Ok(sep) = PredefinedMenuItem::separator(app) {
        owned_items.push(Box::new(sep));
    }
    if let Ok(quit_item) = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>) {
        owned_items.push(Box::new(quit_item));
    }

    let refs: Vec<&dyn IsMenuItem<Wry>> = owned_items.iter().map(|i| i.as_ref()).collect();
    if let Ok(menu) = Menu::with_items(app, &refs) {
        let _ = tray.set_menu(Some(menu));
    }
}

/// Copies a tray-menu item's full content to the clipboard by id. Errors are
/// swallowed deliberately — a stale menu entry from a since-deleted item
/// should just no-op rather than surface anywhere.
fn paste_from_tray(app: &tauri::AppHandle, item_id: &str) {
    let content: Option<String> = {
        let db = app.state::<DbState>();
        let Ok(conn) = db.0.lock() else { return };
        conn.query_row(
            "SELECT content FROM clipboard_items WHERE id = ?1",
            rusqlite::params![item_id],
            |row| row.get(0),
        )
        .ok()
    };

    if let Some(content) = content {
        let suppress = app.state::<clipboard_watcher::SuppressState>();
        let _ = commands::write_to_clipboard(&suppress, content);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            let handle = app.handle().clone();

            let conn = db::init(&handle);
            app.manage(DbState(Mutex::new(conn)));

            let suppress: clipboard_watcher::SuppressState = Arc::new(Mutex::new(None));
            app.manage(suppress.clone());
            clipboard_watcher::spawn(handle.clone(), suppress);

            // macOS only: run as a pure menu-bar utility (no Dock icon), matching
            // apps like Trackabi/CCleaner. Windows/Linux have no Dock concept —
            // hiding the window already removes them from the taskbar, so nothing
            // extra is needed there.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let show_item = MenuItem::with_id(app, "show", "Show CopyBrain", true, None::<&str>)?;
            let about_item = MenuItem::with_id(app, "about", "About CopyBrain", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let tray_menu = Menu::with_items(
                app,
                &[&show_item, &about_item, &separator, &quit_item],
            )?;

            let tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .show_menu_on_left_click(true)
                // Deliberately no .on_tray_icon_event() rebuild-on-click here:
                // on_tray_icon_event fires on the main thread, and menu
                // construction (MenuItem::with_id / Menu::with_items) blocks
                // on a main-thread round-trip internally — calling it from
                // here deadlocks the whole app right as the menu should
                // open. The menu is kept fresh instead by refreshing after
                // every DB mutation (new capture, delete, clear), which run
                // off the main thread and don't have this problem.
                .on_menu_event(|app, event| {
                    let id = event.id.as_ref();
                    if let Some(item_id) = id.strip_prefix("paste:") {
                        paste_from_tray(app, item_id);
                        return;
                    }
                    match id {
                        "show" => toggle_main_window(app),
                        "about" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                            let _ = app.emit("show-about", ());
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .build(app)?;
            app.manage(tray);
            refresh_tray_menu(&handle);

            let toggle_handle = handle.clone();
            app.global_shortcut().on_shortcut(
                "CmdOrCtrl+Shift+V",
                move |_app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_main_window(&toggle_handle);
                    }
                },
            )?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_timeline,
            commands::search_items,
            commands::toggle_favorite,
            commands::delete_item,
            commands::clear_history,
            commands::copy_to_clipboard,
            commands::get_stats,
            commands::list_collections,
            commands::create_collection,
            commands::delete_collection,
            commands::add_to_collection,
            commands::remove_from_collection,
            commands::get_collection_items,
            commands::set_autostart,
            commands::get_autostart,
            commands::get_activity_counts,
            commands::get_items_by_date,
            commands::export_history,
            commands::import_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
