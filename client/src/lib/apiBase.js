/**
 * Builds absolute URLs for API `fetch` calls.
 *
 * - **Vite dev:** defaults to `http://localhost:3001` so requests hit Express directly
 *   (avoids 404 when the `/api` proxy is not applied — e.g. wrong cwd or tooling).
 * - **Production / `vite preview`:** same-origin relative `/api/...` (use preview proxy or a reverse proxy).
 *
 * Override anytime: `VITE_API_BASE=http://127.0.0.1:3001` in `client/.env`
 * (empty string is ignored; unset uses the rules above).
 */
const DEFAULT_DEV_API_ORIGIN = 'http://localhost:3001'

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const raw = import.meta.env.VITE_API_BASE?.trim()
  if (raw) {
    return `${raw.replace(/\/$/, '')}${p}`
  }
  if (import.meta.env.DEV) {
    return `${DEFAULT_DEV_API_ORIGIN}${p}`
  }
  return p
}

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}
