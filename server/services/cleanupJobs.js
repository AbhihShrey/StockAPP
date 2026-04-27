import fs from 'node:fs'
import path from 'node:path'
import cron from 'node-cron'
import db, { DB_DIR, DB_PATH } from '../db.js'
import { pruneExpiredTokens } from './tokenService.js'

const BACKUP_RETENTION_DAYS = 30
const ALERT_HISTORY_PER_USER_CAP = 1000

function todayStamp() {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return fmt.format(now)
}

function backupDir() {
  return path.join(DB_DIR, 'backups')
}

export function backupDatabase() {
  const dir = backupDir()
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, `app-${todayStamp()}.db`)
  db.prepare('VACUUM INTO ?').run(dest)
  return dest
}

export function pruneOldBackups() {
  const dir = backupDir()
  if (!fs.existsSync(dir)) return 0
  const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000
  let deleted = 0
  for (const name of fs.readdirSync(dir)) {
    if (!/^app-\d{4}-\d{2}-\d{2}\.db$/.test(name)) continue
    const full = path.join(dir, name)
    try {
      if (fs.statSync(full).mtimeMs < cutoff) {
        fs.unlinkSync(full)
        deleted++
      }
    } catch { /* ignore */ }
  }
  return deleted
}

export function pruneAlertHistory() {
  const userIds = db.prepare(
    'SELECT DISTINCT user_id FROM alert_history',
  ).all().map((r) => r.user_id)

  let totalDeleted = 0
  const stmt = db.prepare(`
    DELETE FROM alert_history
    WHERE user_id = ?
      AND id NOT IN (
        SELECT id FROM alert_history
        WHERE user_id = ?
        ORDER BY triggered_at DESC, id DESC
        LIMIT ?
      )
  `)
  for (const uid of userIds) {
    const r = stmt.run(uid, uid, ALERT_HISTORY_PER_USER_CAP)
    totalDeleted += r.changes
  }
  return totalDeleted
}

async function runDailyCleanup() {
  try {
    const dest = backupDatabase()
    console.log(`[cleanup] db backup written → ${dest}`)
  } catch (err) {
    console.error('[cleanup] backup error:', err.message)
  }

  try {
    const removed = pruneOldBackups()
    if (removed > 0) console.log(`[cleanup] pruned ${removed} old backup(s)`)
  } catch (err) {
    console.error('[cleanup] backup prune error:', err.message)
  }

  try {
    const tokens = pruneExpiredTokens()
    if (tokens.passwordResetDeleted || tokens.emailVerifyDeleted) {
      console.log(
        `[cleanup] expired tokens pruned — pw_reset:${tokens.passwordResetDeleted} email_verify:${tokens.emailVerifyDeleted}`,
      )
    }
  } catch (err) {
    console.error('[cleanup] token prune error:', err.message)
  }

  try {
    const trimmed = pruneAlertHistory()
    if (trimmed > 0) console.log(`[cleanup] trimmed ${trimmed} old alert history row(s)`)
  } catch (err) {
    console.error('[cleanup] alert history prune error:', err.message)
  }
}

export function startCleanupJobs() {
  cron.schedule('0 3 * * *', () => {
    runDailyCleanup().catch((err) => console.error('[cleanup] cron error:', err.message))
  }, { timezone: 'America/New_York' })

  console.log(`[cleanup] daily job scheduled at 03:00 ET — backups dir: ${backupDir()}`)
}

export { runDailyCleanup, DB_PATH }
