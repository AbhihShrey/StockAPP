import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../db.js'

const SALT_ROUNDS = 10
const TOKEN_TTL = '7d'

function jwtSecret() {
  const s = process.env.JWT_SECRET?.trim()
  if (!s) throw new Error('JWT_SECRET env var is not set')
  if (process.env.NODE_ENV === 'production' && s.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production. Generate one with: openssl rand -hex 32')
  }
  return s
}

export async function createUser(email, password) {
  const em = email.trim().toLowerCase()
  if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    return { ok: false, error: 'Enter a valid email address.' }
  }
  if (!password || password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' }
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(em)
  if (existing) {
    return { ok: false, error: 'An account with this email already exists. Sign in instead.' }
  }
  const hash = await bcrypt.hash(password, SALT_ROUNDS)
  const { lastInsertRowid: id } = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(em, hash)
  const token = jwt.sign({ sub: id, email: em }, jwtSecret(), { expiresIn: TOKEN_TTL })
  return { ok: true, token, user: { id, email: em } }
}

export async function authenticateUser(email, password) {
  const em = email.trim().toLowerCase()
  if (!em || !password) {
    return { ok: false, error: 'Email and password are required.' }
  }
  const row = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(em)
  if (!row) {
    return { ok: false, error: 'Invalid email or password.' }
  }
  const match = await bcrypt.compare(password, row.password_hash)
  if (!match) {
    return { ok: false, error: 'Invalid email or password.' }
  }
  const token = jwt.sign({ sub: row.id, email: row.email }, jwtSecret(), { expiresIn: TOKEN_TTL })
  return { ok: true, token, user: { id: row.id, email: row.email } }
}

export async function changePassword(userId, currentPassword, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: 'New password must be at least 8 characters.' }
  }
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId)
  if (!row) return { ok: false, error: 'User not found.' }
  const match = await bcrypt.compare(currentPassword, row.password_hash)
  if (!match) return { ok: false, error: 'Current password is incorrect.' }
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS)
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId)
  return { ok: true }
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, jwtSecret())
  } catch {
    return null
  }
}

export async function deleteUserAccount(userId, currentPassword) {
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId)
  if (!row) return { ok: false, error: 'User not found.' }
  const match = await bcrypt.compare(currentPassword || '', row.password_hash)
  if (!match) return { ok: false, error: 'Incorrect password.' }
  // FK cascades drop watchlists, alerts, alert_history, screener_filters, and any
  // future per-user rows declared with ON DELETE CASCADE.
  db.prepare('DELETE FROM users WHERE id = ?').run(userId)
  return { ok: true }
}
