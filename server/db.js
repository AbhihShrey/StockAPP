import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const db = new Database(path.join(DATA_DIR, 'investai.db'))

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    email                 TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash         TEXT    NOT NULL,
    email_alerts_enabled  INTEGER NOT NULL DEFAULT 0,
    alert_email           TEXT,
    created_at            INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS watchlists (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol    TEXT    NOT NULL COLLATE NOCASE,
    added_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(user_id, symbol)
  );

  CREATE TABLE IF NOT EXISTS screener_filters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    filters    TEXT    NOT NULL DEFAULT '{}',
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol           TEXT    NOT NULL COLLATE NOCASE,
    condition        TEXT    NOT NULL,
    threshold        REAL,
    is_active        INTEGER NOT NULL DEFAULT 1,
    cooldown_minutes INTEGER NOT NULL DEFAULT 60,
    last_fired_at    INTEGER,
    created_at       INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS alert_history (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id         INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    user_id          INTEGER NOT NULL,
    symbol           TEXT    NOT NULL,
    condition        TEXT    NOT NULL,
    threshold        REAL,
    triggered_price  REAL,
    vwap_at_trigger  REAL,
    triggered_at     INTEGER NOT NULL DEFAULT (unixepoch())
  );
`)

// Idempotent migrations for existing databases
const existingAlertCols = db.pragma('table_info(alerts)').map((c) => c.name)
if (!existingAlertCols.includes('cooldown_minutes')) {
  db.exec('ALTER TABLE alerts ADD COLUMN cooldown_minutes INTEGER NOT NULL DEFAULT 60')
}
if (!existingAlertCols.includes('last_fired_at')) {
  db.exec('ALTER TABLE alerts ADD COLUMN last_fired_at INTEGER')
}
const existingUserCols = db.pragma('table_info(users)').map((c) => c.name)
if (!existingUserCols.includes('email_alerts_enabled')) {
  db.exec('ALTER TABLE users ADD COLUMN email_alerts_enabled INTEGER NOT NULL DEFAULT 0')
}
if (!existingUserCols.includes('alert_email')) {
  db.exec('ALTER TABLE users ADD COLUMN alert_email TEXT')
}

export default db
