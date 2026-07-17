use rusqlite::Connection;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct DbState(pub Mutex<Connection>);

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS clipboard_items (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    content_type TEXT NOT NULL,
    app_name TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    char_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_items_created_at ON clipboard_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_type ON clipboard_items(content_type);
CREATE INDEX IF NOT EXISTS idx_items_favorite ON clipboard_items(is_favorite);

CREATE VIRTUAL TABLE IF NOT EXISTS clipboard_items_fts USING fts5(
    content,
    content='clipboard_items',
    content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS clipboard_items_ai AFTER INSERT ON clipboard_items BEGIN
  INSERT INTO clipboard_items_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER IF NOT EXISTS clipboard_items_ad AFTER DELETE ON clipboard_items BEGIN
  INSERT INTO clipboard_items_fts(clipboard_items_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;
CREATE TRIGGER IF NOT EXISTS clipboard_items_au AFTER UPDATE ON clipboard_items BEGIN
  INSERT INTO clipboard_items_fts(clipboard_items_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO clipboard_items_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS collection_items (
    collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL REFERENCES clipboard_items(id) ON DELETE CASCADE,
    PRIMARY KEY (collection_id, item_id)
);
"#;

pub fn init(app_handle: &AppHandle) -> Connection {
    let dir = app_handle
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    std::fs::create_dir_all(&dir).expect("failed to create app data dir");

    let db_path = dir.join("zicopy.db");
    let conn = Connection::open(db_path).expect("failed to open sqlite database");
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
        .expect("failed to set pragmas");
    conn.execute_batch(SCHEMA).expect("failed to run schema");
    conn
}
