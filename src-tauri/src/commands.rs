use crate::clipboard_watcher::SuppressState;
use crate::db::DbState;
use crate::models::{ClipboardItem, Collection, DayCount, Stats, TypeCount};
use rusqlite::{params, Row};
use tauri::{AppHandle, State};
use tauri_plugin_autostart::ManagerExt;

const ITEM_COLUMNS: &str =
    "id, content, content_type, app_name, is_favorite, created_at, char_count";

fn row_to_item(row: &Row) -> rusqlite::Result<ClipboardItem> {
    Ok(ClipboardItem {
        id: row.get(0)?,
        content: row.get(1)?,
        content_type: row.get(2)?,
        app_name: row.get(3)?,
        is_favorite: row.get::<_, i64>(4)? != 0,
        created_at: row.get(5)?,
        char_count: row.get(6)?,
    })
}

/// Turns a raw search string into a safe FTS5 MATCH expression by quoting
/// each token as a literal prefix match, so punctuation in the query never
/// produces an FTS5 syntax error.
fn build_fts_query(raw: &str) -> String {
    raw.split_whitespace()
        .map(|tok| format!("\"{}\"*", tok.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" ")
}

#[tauri::command]
pub fn get_timeline(
    db: State<DbState>,
    cursor: Option<i64>,
    limit: i64,
    content_type: Option<String>,
    favorites_only: Option<bool>,
) -> Result<Vec<ClipboardItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let cursor = cursor.unwrap_or(i64::MAX);
    let favorites_only = favorites_only.unwrap_or(false);

    let mut sql = format!("SELECT {ITEM_COLUMNS} FROM clipboard_items WHERE created_at < ?1");
    if favorites_only {
        sql.push_str(" AND is_favorite = 1");
    }
    if content_type.is_some() {
        sql.push_str(" AND content_type = ?3");
    }
    sql.push_str(" ORDER BY created_at DESC LIMIT ?2");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = if let Some(ref ct) = content_type {
        stmt.query_map(params![cursor, limit, ct], row_to_item)
    } else {
        stmt.query_map(params![cursor, limit], row_to_item)
    }
    .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_items(
    db: State<DbState>,
    query: String,
    limit: i64,
) -> Result<Vec<ClipboardItem>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(vec![]);
    }

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let fts_query = build_fts_query(trimmed);
    let sql = format!(
        "SELECT {ITEM_COLUMNS} FROM clipboard_items
         WHERE rowid IN (SELECT rowid FROM clipboard_items_fts WHERE clipboard_items_fts MATCH ?1)
         ORDER BY created_at DESC LIMIT ?2"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![fts_query, limit], row_to_item)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_favorite(db: State<DbState>, id: String) -> Result<bool, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE clipboard_items SET is_favorite = 1 - is_favorite WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT is_favorite FROM clipboard_items WHERE id = ?1",
        params![id],
        |r| r.get::<_, i64>(0),
    )
    .map(|v| v != 0)
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_item(app: AppHandle, db: State<DbState>, id: String) -> Result<(), String> {
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM clipboard_items WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
    }
    crate::refresh_tray_menu(&app);
    Ok(())
}

#[tauri::command]
pub fn clear_history(app: AppHandle, db: State<DbState>, keep_favorites: bool) -> Result<(), String> {
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let sql = if keep_favorites {
            "DELETE FROM clipboard_items WHERE is_favorite = 0"
        } else {
            "DELETE FROM clipboard_items"
        };
        conn.execute(sql, []).map_err(|e| e.to_string())?;
    }
    crate::refresh_tray_menu(&app);
    Ok(())
}

/// Writes `text` to the OS clipboard and marks it in `suppress` so the
/// watcher thread doesn't re-capture our own write as a new history entry.
/// Shared by the `copy_to_clipboard` command and the tray quick-paste menu.
pub fn write_to_clipboard(suppress: &SuppressState, text: String) -> Result<(), String> {
    {
        let mut guard = suppress.lock().map_err(|e| e.to_string())?;
        *guard = Some(text.clone());
    }

    // On Linux (X11/Wayland), clipboard content is only served for as long as
    // the owning client is around to answer paste requests. A short-lived
    // `Clipboard` that sets text and immediately drops can make the copy
    // "disappear" the moment this command returns. Spawn a background thread
    // that keeps serving the selection until something else overwrites it,
    // matching arboard's documented pattern for this exact scenario.
    #[cfg(target_os = "linux")]
    {
        use arboard::SetExtLinux;
        std::thread::spawn(move || {
            if let Ok(mut clipboard) = arboard::Clipboard::new() {
                let _ = clipboard.set().wait().text(text);
            }
        });
    }

    #[cfg(not(target_os = "linux"))]
    {
        let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
        clipboard.set_text(text).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn copy_to_clipboard(suppress: State<SuppressState>, text: String) -> Result<(), String> {
    write_to_clipboard(&suppress, text)
}

#[tauri::command]
pub fn get_stats(db: State<DbState>) -> Result<Stats, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let total: i64 = conn
        .query_row("SELECT COUNT(*) FROM clipboard_items", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    let favorites: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM clipboard_items WHERE is_favorite = 1",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT content_type, COUNT(*) FROM clipboard_items GROUP BY content_type")
        .map_err(|e| e.to_string())?;
    let by_type = stmt
        .query_map([], |r| {
            Ok(TypeCount {
                content_type: r.get(0)?,
                count: r.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(Stats {
        total,
        favorites,
        by_type,
    })
}

#[tauri::command]
pub fn list_collections(db: State<DbState>) -> Result<Vec<Collection>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.name, c.color, c.created_at, COUNT(ci.item_id)
             FROM collections c
             LEFT JOIN collection_items ci ON ci.collection_id = c.id
             GROUP BY c.id
             ORDER BY c.created_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Collection {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
                item_count: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_collection(
    db: State<DbState>,
    name: String,
    color: Option<String>,
) -> Result<Collection, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "INSERT INTO collections (id, name, color, created_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, name, color, created_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(Collection {
        id,
        name,
        color,
        created_at,
        item_count: 0,
    })
}

#[tauri::command]
pub fn delete_collection(db: State<DbState>, collection_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM collections WHERE id = ?1",
        params![collection_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn add_to_collection(
    db: State<DbState>,
    collection_id: String,
    item_id: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO collection_items (collection_id, item_id) VALUES (?1, ?2)",
        params![collection_id, item_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_from_collection(
    db: State<DbState>,
    collection_id: String,
    item_id: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM collection_items WHERE collection_id = ?1 AND item_id = ?2",
        params![collection_id, item_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|e| e.to_string())
    } else {
        manager.disable().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn get_autostart(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_activity_counts(
    db: State<DbState>,
    year_month: String,
) -> Result<Vec<DayCount>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') as day, COUNT(*)
             FROM clipboard_items
             WHERE strftime('%Y-%m', created_at / 1000, 'unixepoch') = ?1
             GROUP BY day",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![year_month], |r| {
            Ok(DayCount {
                day: r.get(0)?,
                count: r.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_items_by_date(
    db: State<DbState>,
    date: String,
) -> Result<Vec<ClipboardItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let sql = format!(
        "SELECT {ITEM_COLUMNS} FROM clipboard_items
         WHERE strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') = ?1
         ORDER BY created_at DESC"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![date], row_to_item)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_history(db: State<DbState>, path: String) -> Result<usize, String> {
    let items = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let sql = format!("SELECT {ITEM_COLUMNS} FROM clipboard_items ORDER BY created_at ASC");
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], row_to_item)
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };

    let json = serde_json::to_string_pretty(&items).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(items.len())
}

#[tauri::command]
pub fn import_history(db: State<DbState>, path: String) -> Result<usize, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let items: Vec<ClipboardItem> = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut imported = 0usize;
    for item in &items {
        let changed = tx
            .execute(
                "INSERT OR IGNORE INTO clipboard_items
                 (id, content, content_type, app_name, is_favorite, created_at, char_count)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    item.id,
                    item.content,
                    item.content_type,
                    item.app_name,
                    item.is_favorite as i64,
                    item.created_at,
                    item.char_count,
                ],
            )
            .map_err(|e| e.to_string())?;
        imported += changed;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(imported)
}

#[tauri::command]
pub fn get_collection_items(
    db: State<DbState>,
    collection_id: String,
) -> Result<Vec<ClipboardItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let sql = format!(
        "SELECT {ITEM_COLUMNS} FROM clipboard_items i
         JOIN collection_items ci ON ci.item_id = i.id
         WHERE ci.collection_id = ?1
         ORDER BY i.created_at DESC"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![collection_id], row_to_item)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
