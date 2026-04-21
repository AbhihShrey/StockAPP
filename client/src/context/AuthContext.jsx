import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { apiUrl } from '../lib/apiBase'

const TOKEN_KEY = 'investaiv1_token_v2'

function readStoredToken() {
  try { return window.localStorage.getItem(TOKEN_KEY) ?? null } catch { return null }
}

function writeToken(token) {
  try { window.localStorage.setItem(TOKEN_KEY, token) } catch {}
}

function clearToken() {
  try { window.localStorage.removeItem(TOKEN_KEY) } catch {}
}

function parseJwtPayload(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64))
    if (payload.exp && Date.now() / 1000 > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

function readSession() {
  const token = readStoredToken()
  if (!token) return { user: null, token: null }
  const payload = parseJwtPayload(token)
  if (!payload) { clearToken(); return { user: null, token: null } }
  return { user: { id: payload.sub, email: payload.email }, token }
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => readSession())

  const login = useCallback(async (email, password) => {
    const em = String(email ?? '').trim().toLowerCase()
    if (!em || !password) return { ok: false, error: 'Email and password are required.' }
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, password }),
      })
      const json = await res.json()
      if (!res.ok) return { ok: false, error: json.message ?? 'Sign in failed.' }
      writeToken(json.token)
      setState({ user: json.user, token: json.token })
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error. Please try again.' }
    }
  }, [])

  const signup = useCallback(async (email, password) => {
    const em = String(email ?? '').trim().toLowerCase()
    if (!em || !password) return { ok: false, error: 'Email and password are required.' }
    try {
      const res = await fetch(apiUrl('/api/auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, password }),
      })
      const json = await res.json()
      if (!res.ok) return { ok: false, error: json.message ?? 'Sign up failed.' }
      writeToken(json.token)
      setState({ user: json.user, token: json.token })
      return { ok: true }
    } catch {
      return { ok: false, error: 'Network error. Please try again.' }
    }
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setState({ user: null, token: null })
  }, [])

  const value = useMemo(
    () => ({
      user: state.user,
      token: state.token,
      isAuthenticated: Boolean(state.user),
      login,
      signup,
      logout,
    }),
    [state, login, signup, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
