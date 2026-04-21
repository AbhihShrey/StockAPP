import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

function wsUrl() {
  const base = import.meta.env.VITE_API_BASE?.trim()
  if (base) return base.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws'
  if (import.meta.env.DEV) return 'ws://localhost:3001/ws'
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws`
}

function conditionLabel(condition, threshold) {
  switch (condition) {
    case 'vwap_above': return 'crossed above VWAP'
    case 'vwap_below': return 'crossed below VWAP'
    case 'price_above': return `crossed above $${Number(threshold).toFixed(2)}`
    case 'price_below': return `crossed below $${Number(threshold).toFixed(2)}`
    case 'orhl_above': return `crossed above OR High (${threshold}min)`
    case 'orhl_below': return `crossed below OR Low (${threshold}min)`
    default: return condition
  }
}

function triggerOsNotification(msg) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    new Notification(`${msg.symbol} alert fired`, {
      body: `${msg.symbol} ${conditionLabel(msg.condition, msg.threshold)} · $${msg.triggeredPrice?.toFixed(2)}`,
      icon: '/favicon.ico',
      tag: `alert-${msg.alertId}`,
    })
  } catch {}
}

export const AlertContext = createContext(null)

export function AlertProvider({ token, children }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifPermission, setNotifPermission] = useState(
    'Notification' in window ? Notification.permission : 'unsupported',
  )
  const wsRef = useRef(null)
  const attemptsRef = useRef(0)
  const timerRef = useRef(null)

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'unsupported'
    const result = await Notification.requestPermission()
    setNotifPermission(result)
    return result
  }, [])

  const connect = useCallback(() => {
    if (!token) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(`${wsUrl()}?token=${encodeURIComponent(token)}`)
    wsRef.current = ws

    ws.onopen = () => { attemptsRef.current = 0 }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type !== 'alert_fired') return
        const n = { ...msg, id: Date.now(), read: false }
        setNotifications((prev) => [n, ...prev].slice(0, 100))
        setUnreadCount((c) => c + 1)
        triggerOsNotification(msg)
      } catch {}
    }

    ws.onclose = () => {
      if (!token) return
      const delay = Math.min(30_000, 2_000 * 2 ** attemptsRef.current)
      attemptsRef.current++
      timerRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => ws.close()
  }, [token])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(timerRef.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    setUnreadCount(0)
  }, [])

  return (
    <AlertContext.Provider value={{ notifications, unreadCount, markAllRead, clearAll, notifPermission, requestPermission }}>
      {children}
    </AlertContext.Provider>
  )
}

export function useAlerts() {
  const ctx = useContext(AlertContext)
  if (!ctx) throw new Error('useAlerts must be used within AlertProvider')
  return ctx
}
