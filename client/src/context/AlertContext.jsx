import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getAlertWebSocketUrl } from '../lib/apiBase'
import { isQuietHours } from '../lib/prefs'

function conditionLabel(condition, threshold) {
  const orhlM =
    threshold != null && threshold !== '' && Number.isFinite(Number(threshold))
      ? `${Number(threshold)} min`
      : 'OR'
  switch (condition) {
    case 'vwap_above': return 'crossed above VWAP'
    case 'vwap_below': return 'crossed below VWAP'
    case 'price_above': return `crossed above $${Number(threshold).toFixed(2)}`
    case 'price_below': return `crossed below $${Number(threshold).toFixed(2)}`
    case 'orhl_above': return `crossed above OR High (${orhlM})`
    case 'orhl_below': return `crossed below OR Low (${orhlM})`
    case 'earnings_report': return 'reports earnings today'
    default: return condition
  }
}

function playAlertChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime
    // Two-note ascending chime: 880 Hz then 1100 Hz
    ;[880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = now + i * 0.13
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.22, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38)
      osc.start(t)
      osc.stop(t + 0.38)
    })
  } catch {}
}

async function triggerOsNotification(msg) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const title = msg.condition === 'earnings_report'
    ? `${msg.symbol} earnings today`
    : `${msg.symbol} alert fired`
  const body = msg.message
    ? msg.message
    : `${msg.symbol} ${conditionLabel(msg.condition, msg.threshold)} · $${msg.triggeredPrice?.toFixed(2)}`
  const options = {
    body,
    icon: '/favicon.svg',
    tag: `alert-${msg.alertId}`,
  }
  try {
    if ('serviceWorker' in navigator) {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('sw timeout')), 3000)),
      ])
      await reg.showNotification(title, options)
    } else {
      new Notification(title, options)
    }
  } catch {
    try { new Notification(title, options) } catch {}
  }
}

export const AlertContext = createContext(null)

export function AlertProvider({ token, children }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [wsReadyState, setWsReadyState] = useState(/** @type {number | null} */(null))
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

    const url = `${getAlertWebSocketUrl()}?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)
    wsRef.current = ws
    setWsReadyState(WebSocket.CONNECTING)

    ws.onopen = () => {
      attemptsRef.current = 0
      setWsReadyState(WebSocket.OPEN)
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type !== 'alert_fired') return
        const quiet = isQuietHours()
        const n = { ...msg, id: Date.now(), read: false, suppressedByQuietHours: quiet }
        setNotifications((prev) => [n, ...prev].slice(0, 100))
        setUnreadCount((c) => c + 1)
        if (!quiet) {
          playAlertChime()
          triggerOsNotification(msg)
        }
      } catch {}
    }

    ws.onclose = () => {
      setWsReadyState(WebSocket.CLOSED)
      if (!token) return
      const delay = Math.min(30_000, 2_000 * 2 ** attemptsRef.current)
      attemptsRef.current++
      timerRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      setWsReadyState(WebSocket.CLOSED)
      ws.close()
    }
  }, [token])

  useEffect(() => {
    if (!token) {
      clearTimeout(timerRef.current)
      wsRef.current?.close()
      wsRef.current = null
      setWsReadyState(null)
      return
    }
    connect()
    return () => {
      clearTimeout(timerRef.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect, token])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    setUnreadCount(0)
  }, [])

  return (
    <AlertContext.Provider
      value={{
        notifications,
        unreadCount,
        markAllRead,
        clearAll,
        notifPermission,
        requestPermission,
        wsReadyState,
        alertWsUrl: getAlertWebSocketUrl(),
      }}
    >
      {children}
    </AlertContext.Provider>
  )
}

export function useAlerts() {
  const ctx = useContext(AlertContext)
  if (!ctx) throw new Error('useAlerts must be used within AlertProvider')
  return ctx
}
