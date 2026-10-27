// Storage & Privacy Module
// SQLite-backed session persistence (optional, local-only, zero audio stored)

use anyhow::{Context, Result};
use log::info;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRecord {
    pub id: i64,
    pub title: String,
    pub created_at: String,
    pub duration_seconds: i64,
    pub transcript_count: i64,
    pub questions_detected: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTranscriptEntry {
    pub session_id: i64,
    pub timestamp_ms: i64,
    pub text_en: String,
    pub text_vi: String,
}

pub struct StorageManager {
    db_conn: Mutex<Option<Connection>>,
    history_enabled: Mutex<bool>,
}

impl StorageManager {
    pub fn new() -> Self {
        StorageManager {
            db_conn: Mutex::new(None),
            history_enabled: Mutex::new(false), // Privacy default: Disabled
        }
    }

    pub fn init_db(&self, db_path: PathBuf) -> Result<()> {
        let conn = Connection::open(&db_path)
            .context("Failed to open SQLite database")?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                duration_seconds INTEGER DEFAULT 0,
                transcript_count INTEGER DEFAULT 0,
                questions_detected INTEGER DEFAULT 0
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS transcripts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER,
                timestamp_ms INTEGER,
                text_en TEXT NOT NULL,
                text_vi TEXT NOT NULL,
                FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
            )",
            [],
        )?;

        let mut lock = self.db_conn.lock().unwrap();
        *lock = Some(conn);
        info!("SQLite database initialized at: {:?}", db_path);
        Ok(())
    }

    pub fn set_history_enabled(&self, enabled: bool) {
        let mut lock = self.history_enabled.lock().unwrap();
        *lock = enabled;
        info!("Session history persistence set to: {}", enabled);
    }

    pub fn is_history_enabled(&self) -> bool {
        *self.history_enabled.lock().unwrap()
    }

    pub fn save_session(&self, title: &str, duration_secs: i64, transcripts: &[SessionTranscriptEntry], question_count: i64) -> Result<Option<i64>> {
        if !self.is_history_enabled() {
            return Ok(None);
        }

        let mut lock = self.db_conn.lock().unwrap();
        if let Some(ref mut conn) = *lock {
            let tx = conn.transaction()?;
            tx.execute(
                "INSERT INTO sessions (title, duration_seconds, transcript_count, questions_detected) VALUES (?1, ?2, ?3, ?4)",
                params![title, duration_secs, transcripts.len() as i64, question_count],
            )?;

            let session_id = tx.last_insert_rowid();

            for entry in transcripts {
                tx.execute(
                    "INSERT INTO transcripts (session_id, timestamp_ms, text_en, text_vi) VALUES (?1, ?2, ?3, ?4)",
                    params![session_id, entry.timestamp_ms, entry.text_en, entry.text_vi],
                )?;
            }

            tx.commit()?;
            Ok(Some(session_id))
        } else {
            Ok(None)
        }
    }

    pub fn get_sessions(&self) -> Result<Vec<SessionRecord>> {
        let lock = self.db_conn.lock().unwrap();
        if let Some(ref conn) = *lock {
            let mut stmt = conn.prepare(
                "SELECT id, title, created_at, duration_seconds, transcript_count, questions_detected FROM sessions ORDER BY id DESC"
            )?;

            let rows = stmt.query_map([], |row| {
                Ok(SessionRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    duration_seconds: row.get(3)?,
                    transcript_count: row.get(4)?,
                    questions_detected: row.get(5)?,
                })
            })?;

            let mut list = Vec::new();
            for r in rows {
                if let Ok(rec) = r {
                    list.push(rec);
                }
            }
            Ok(list)
        } else {
            Ok(Vec::new())
        }
    }

    pub fn delete_session(&self, id: i64) -> Result<()> {
        let lock = self.db_conn.lock().unwrap();
        if let Some(ref conn) = *lock {
            conn.execute("DELETE FROM transcripts WHERE session_id = ?1", params![id])?;
            conn.execute("DELETE FROM sessions WHERE id = ?1", params![id])?;
        }
        Ok(())
    }

    pub fn clear_all(&self) -> Result<()> {
        let lock = self.db_conn.lock().unwrap();
        if let Some(ref conn) = *lock {
            conn.execute("DELETE FROM transcripts", [])?;
            conn.execute("DELETE FROM sessions", [])?;
        }
        info!("All session history cleared for privacy.");
        Ok(())
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_disabled_by_default() {
        let storage = StorageManager::new();
        assert!(!storage.is_history_enabled(), "History must be disabled by default for privacy");
        let result = storage.save_session("Test", 60, &[], 0).unwrap();
        assert_eq!(result, None, "No data stored when disabled");
    }

    #[test]
    fn test_storage_in_memory() {
        let storage = StorageManager::new();
        // In-memory sqlite
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE sessions (id INTEGER PRIMARY KEY, title TEXT, created_at TEXT, duration_seconds INTEGER, transcript_count INTEGER, questions_detected INTEGER)",
            [],
        ).unwrap();
        *storage.db_conn.lock().unwrap() = Some(conn);
        storage.set_history_enabled(true);

        let sessions = storage.get_sessions().unwrap();
        assert_eq!(sessions.len(), 0);
    }
}
