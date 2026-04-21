import { verifyToken } from '../services/authService.js'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    res.status(401).json({ ok: false, error: 'unauthorized', message: 'Authentication required.' })
    return
  }
  const payload = verifyToken(token)
  if (!payload) {
    res.status(401).json({ ok: false, error: 'unauthorized', message: 'Invalid or expired token.' })
    return
  }
  req.user = { id: payload.sub, email: payload.email }
  next()
}
