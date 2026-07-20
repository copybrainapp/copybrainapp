use rusqlite::functions::FunctionFlags;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct DbState(pub Mutex<Connection>);

// Clipboard content (especially links copied from tools like Jira) often
// contains literal, undecoded percent-escapes (e.g. "OFMN-949%20penting").
// Left as-is, the FTS5 tokenizer glues the digits before "%20" to the word
// after it into one unsearchable token ("20penting"), so search indexes a
// decoded copy instead — the raw `content` column is never touched, so
// copy/paste fidelity is unaffected.
fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

// Operates on raw bytes (never slices the &str) so a stray "%" ahead of
// multi-byte UTF-8 text can't panic on a non-char-boundary slice.
fn url_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(hi), Some(lo)) = (hex_val(bytes[i + 1]), hex_val(bytes[i + 2])) {
                out.push(hi * 16 + lo);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

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

// Kept separate from SCHEMA (which uses IF NOT EXISTS everywhere) and
// unconditionally dropped/recreated on every launch, since these triggers
// call url_decode() — an app-registered function whose behavior can change
// between builds, so "IF NOT EXISTS" would silently keep a stale trigger
// body from an older version around.
const FTS_TRIGGERS: &str = r#"
DROP TRIGGER IF EXISTS clipboard_items_ai;
DROP TRIGGER IF EXISTS clipboard_items_ad;
DROP TRIGGER IF EXISTS clipboard_items_au;

CREATE TRIGGER clipboard_items_ai AFTER INSERT ON clipboard_items BEGIN
  INSERT INTO clipboard_items_fts(rowid, content) VALUES (new.rowid, url_decode(new.content));
END;
CREATE TRIGGER clipboard_items_ad AFTER DELETE ON clipboard_items BEGIN
  INSERT INTO clipboard_items_fts(clipboard_items_fts, rowid, content) VALUES('delete', old.rowid, url_decode(old.content));
END;
CREATE TRIGGER clipboard_items_au AFTER UPDATE ON clipboard_items BEGIN
  INSERT INTO clipboard_items_fts(clipboard_items_fts, rowid, content) VALUES('delete', old.rowid, url_decode(old.content));
  INSERT INTO clipboard_items_fts(rowid, content) VALUES (new.rowid, url_decode(new.content));
END;
"#;

pub fn init(app_handle: &AppHandle) -> Connection {
    let dir = app_handle
        .path()
        .app_data_dir()
        .expect("failed to resolve app data dir");
    std::fs::create_dir_all(&dir).expect("failed to create app data dir");

    let db_path = dir.join("copybrain.db");
    let conn = Connection::open(db_path).expect("failed to open sqlite database");
    conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
        .expect("failed to set pragmas");

    conn.create_scalar_function(
        "url_decode",
        1,
        FunctionFlags::SQLITE_UTF8 | FunctionFlags::SQLITE_DETERMINISTIC,
        |ctx| {
            let text: String = ctx.get(0)?;
            Ok(url_decode(&text))
        },
    )
    .expect("failed to register url_decode function");

    conn.execute_batch(SCHEMA).expect("failed to run schema");
    conn.execute_batch(FTS_TRIGGERS)
        .expect("failed to (re)install fts triggers");

    // One-time reindex so items captured before url_decode() existed become
    // searchable too — 'rebuild' can't be used here since it re-derives the
    // index straight from the raw content column, bypassing our triggers.
    let user_version: i64 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .unwrap_or(0);
    if user_version < 1 {
        conn.execute_batch(
            "DELETE FROM clipboard_items_fts;
             INSERT INTO clipboard_items_fts(rowid, content)
               SELECT rowid, url_decode(content) FROM clipboard_items;
             PRAGMA user_version = 1;",
        )
        .expect("failed to reindex fts with decoded content");
    }

    conn
}
