import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const SESSION_KEY = 'investaiv1_session_v1'
const ACCOUNTS_KEY = 'investaiv1_accounts_v1'

/** @returns {{ email: string } | null} */
function readSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const j = JSON.parse(raw)
    const email = typeof j?.email === 'string' ? j.email.trim().toLowerCase() : ''
    return email ? { email } : null
  } catch {
    return null
  }
}

/** @returns {Record<string, string>} email -> encoded secret (demo local store only) */
function readAccounts() {
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY)
    const j = raw ? JSON.parse(raw) : null
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {}
  } catch {
    return {}
  }
}

function writeAccounts(acc) {
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(acc))
}

function writeSession(email) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ email: email.trim().toLowerCase() }))
}

function clearSession() {
  window.localStorage.removeItem(SESSION_KEY)
}

function encodeSecret(password) {
  try {
    return window.btoa(unescape(encodeURIComponent(password)))
  } catch {
    return ''
  }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readSession())

  const login = useCallback((email, password) => {
    const em = String(email ?? '')
      .trim()
      .toLowerCase()
    if (!em || !password) return { ok: false, error: 'Email and password are required.' }
    const accounts = readAccounts()
    if (accounts[em] !== encodeSecret(password)) {
      return { ok: false, error: 'Invalid email or password.' }
    }
    writeSession(em)
    setUser({ email: em })
    return { ok: true }
  }, [])

  const signup = useCallback((email, password) => {
    const em = String(email ?? '')
      .trim()
      .toLowerCase()
    if (!em || !password) return { ok: false, error: 'Email and password are required.' }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return { ok: false, error: 'Enter a valid email address.' }
    }
    if (password.length < 8) {
      return { ok: false, error: 'Password must be at least 8 characters.' }
    }
    const accounts = readAccounts()
    if (accounts[em]) {
      return { ok: false, error: 'An account with this email already exists. Sign in instead.' }
    }
    accounts[em] = encodeSecret(password)
    writeAccounts(accounts)
    writeSession(em)
    setUser({ email: em })
    return { ok: true }
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user?.email),
      login,
      signup,
      logout,
    }),
    [user, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
