import { Clock, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiUrl, authHeaders } from '../lib/apiBase'

const RECENTS_KEY = 'recent_search_symbols'
const MAX_RECENTS = 5
const MAX_RESULTS = 8
const DEBOUNCE_MS = 200

function loadRecents() {
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string').slice(0, MAX_RECENTS) : []
  } catch {
    return []
  }
}

function saveRecent(symbol) {
  try {
    const sym = String(symbol).toUpperCase()
    const cur = loadRecents().filter((s) => s !== sym)
    const next = [sym, ...cur].slice(0, MAX_RECENTS)
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {}
}

export function CommandPaletteProvider({ children }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e) {
      const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')
      if (!isCmdK) return
      e.preventDefault()
      setOpen((v) => !v)
    }
    document.addEventListener('keydown', onKeyDown)
    window.__openCommandPalette = () => setOpen(true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      delete window.__openCommandPalette
    }
  }, [])

  return (
    <>
      {children}
      {open && <CommandPalette onClose={() => setOpen(false)} />}
    </>
  )
}

export function openCommandPalette() {
  if (typeof window !== 'undefined' && typeof window.__openCommandPalette === 'function') {
    window.__openCommandPalette()
  }
}

function CommandPalette({ onClose }) {
  const { token } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const reqIdRef = useRef(0)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [active, setActive] = useState(0)
  const [recents] = useState(() => loadRecents())

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const items = useMemo(() => {
    if (query.trim().length === 0) {
      return recents.map((sym) => ({ kind: 'recent', symbol: sym }))
    }
    return results.slice(0, MAX_RESULTS).map((r) => ({ kind: 'result', ...r }))
  }, [query, recents, results])

  useEffect(() => {
    setActive(0)
  }, [items.length])

  useEffect(() => {
    const q = query.trim()
    if (q.length === 0) {
      setResults([])
      setError(false)
      setLoading(false)
      return
    }
    const myId = ++reqIdRef.current
    setLoading(true)
    setError(false)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/search?q=${encodeURIComponent(q)}&limit=${MAX_RESULTS}`), {
          headers: authHeaders(token),
        })
        const json = await res.json()
        if (myId !== reqIdRef.current) return
        if (!res.ok || !json.ok) {
          setError(true)
          setResults([])
        } else {
          setResults(Array.isArray(json.results) ? json.results : [])
        }
      } catch {
        if (myId !== reqIdRef.current) return
        setError(true)
        setResults([])
      } finally {
        if (myId === reqIdRef.current) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, token])

  const select = useCallback((item) => {
    if (!item) return
    const sym = String(item.symbol).toUpperCase()
    saveRecent(sym)
    onClose()
    navigate(`/analysis/${encodeURIComponent(sym)}`)
  }, [navigate, onClose])

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (items.length === 0) return
      setActive((i) => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (items.length === 0) return
      setActive((i) => (i - 1 + items.length) % items.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (items[active]) select(items[active])
    }
  }

  const showingRecents = query.trim().length === 0
  const showEmpty = !showingRecents && !loading && !error && items.length === 0
  const showError = !showingRecents && error

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/55 backdrop-blur-sm pt-24 sm:pt-32"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Search stocks"
    >
      <div
        className="glass-bar w-full max-w-[560px] mx-4 overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/60"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search className="size-4 shrink-0 text-zinc-500" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search stocks by symbol or company…"
            className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="hidden shrink-0 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 sm:inline">
            ESC to close
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 sm:hidden"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {showingRecents && items.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-zinc-600">
              Start typing to search stocks. Recent searches will appear here.
            </p>
          )}

          {showingRecents && items.length > 0 && (
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
              Recent
            </div>
          )}

          {items.map((item, i) => {
            const highlighted = i === active
            const Icon = item.kind === 'recent' ? Clock : null
            return (
              <button
                key={`${item.kind}-${item.symbol}-${i}`}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => select(item)}
                className={[
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left transition',
                  highlighted ? 'bg-accent/10' : 'hover:bg-white/5',
                ].join(' ')}
              >
                {Icon ? <Icon className="size-3.5 shrink-0 text-zinc-600" aria-hidden /> : <span className="size-3.5 shrink-0" />}
                <span className="w-16 shrink-0 font-semibold text-zinc-100">{item.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-400">{item.name || ''}</span>
                {item.exchange && (
                  <span className="shrink-0 rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-500 ring-1 ring-white/10">
                    {item.exchange}
                  </span>
                )}
              </button>
            )
          })}

          {loading && !showingRecents && items.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-zinc-600">Searching…</p>
          )}

          {showEmpty && (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">
              No results for &ldquo;{query.trim()}&rdquo;
            </p>
          )}

          {showError && (
            <p className="px-4 py-6 text-center text-sm text-rose-400">
              Search unavailable — check your connection
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
