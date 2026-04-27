import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DB_DIR?.trim() || path.join(__dirname, 'data')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export const DB_PATH = path.join(DATA_DIR, 'investai.db')
export const DB_DIR = DATA_DIR
const db = new Database(DB_PATH)

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

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT    NOT NULL UNIQUE,
    expires_at  INTEGER NOT NULL,
    used_at     INTEGER,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email       TEXT    NOT NULL,
    token_hash  TEXT    NOT NULL UNIQUE,
    expires_at  INTEGER NOT NULL,
    used_at     INTEGER,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS totp_secrets (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    secret            TEXT    NOT NULL,
    backup_codes_json TEXT    NOT NULL DEFAULT '[]',
    enabled           INTEGER NOT NULL DEFAULT 0,
    created_at        INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_pw_reset_user ON password_reset_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_pw_reset_expires ON password_reset_tokens(expires_at);
  CREATE INDEX IF NOT EXISTS idx_email_verify_user ON email_verification_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_email_verify_expires ON email_verification_tokens(expires_at);
`)

// Idempotent migrations for existing databases
const existingAlertCols = db.pragma('table_info(alerts)').map((c) => c.name)
if (!existingAlertCols.includes('alert_type')) {
  db.exec("ALTER TABLE alerts ADD COLUMN alert_type TEXT NOT NULL DEFAULT 'intraday'")
}
if (!existingAlertCols.includes('cooldown_minutes')) {
  db.exec('ALTER TABLE alerts ADD COLUMN cooldown_minutes INTEGER NOT NULL DEFAULT 60')
}
if (!existingAlertCols.includes('last_fired_at')) {
  db.exec('ALTER TABLE alerts ADD COLUMN last_fired_at INTEGER')
}
// Crossing-state persistence: survive server restarts without losing VWAP/price position
if (!existingAlertCols.includes('last_position')) {
  db.exec('ALTER TABLE alerts ADD COLUMN last_position TEXT')
}
if (!existingAlertCols.includes('last_position_date')) {
  db.exec('ALTER TABLE alerts ADD COLUMN last_position_date TEXT')
}
// Volume confirmation gate: only fire when most-recent bar volume >= X × session avg
if (!existingAlertCols.includes('min_volume_mult')) {
  db.exec('ALTER TABLE alerts ADD COLUMN min_volume_mult REAL')
}
// Time-of-day gate: only fire within first N minutes of the session (9:30 ET)
if (!existingAlertCols.includes('time_window_minutes')) {
  db.exec('ALTER TABLE alerts ADD COLUMN time_window_minutes INTEGER')
}
// Price buffer: expand the trigger level by ±N% to avoid false triggers on thin spikes
if (!existingAlertCols.includes('buffer_pct')) {
  db.exec('ALTER TABLE alerts ADD COLUMN buffer_pct REAL')
}
// Earnings-report alerts: stored next-earnings date / session / consensus EPS,
// plus a "previous date" slot used to surface "Date updated to {new date}" badges.
if (!existingAlertCols.includes('earnings_date')) {
  db.exec('ALTER TABLE alerts ADD COLUMN earnings_date TEXT')
}
if (!existingAlertCols.includes('earnings_session')) {
  db.exec("ALTER TABLE alerts ADD COLUMN earnings_session TEXT NOT NULL DEFAULT 'any'")
}
if (!existingAlertCols.includes('earnings_eps_est')) {
  db.exec('ALTER TABLE alerts ADD COLUMN earnings_eps_est REAL')
}
if (!existingAlertCols.includes('earnings_prev_date')) {
  db.exec('ALTER TABLE alerts ADD COLUMN earnings_prev_date TEXT')
}

const existingUserCols = db.pragma('table_info(users)').map((c) => c.name)
if (!existingUserCols.includes('email_alerts_enabled')) {
  db.exec('ALTER TABLE users ADD COLUMN email_alerts_enabled INTEGER NOT NULL DEFAULT 0')
}
if (!existingUserCols.includes('alert_email')) {
  db.exec('ALTER TABLE users ADD COLUMN alert_email TEXT')
}
if (!existingUserCols.includes('email_digest_enabled')) {
  db.exec('ALTER TABLE users ADD COLUMN email_digest_enabled INTEGER NOT NULL DEFAULT 0')
}
if (!existingUserCols.includes('email_verified')) {
  db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0')
}

export default db
