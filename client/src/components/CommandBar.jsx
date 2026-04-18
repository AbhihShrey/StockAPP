import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

function normalize(s) {
  return String(s ?? '').trim()
}

function isLikelyTicker(q) {
  const s = normalize(q).toUpperCase()
  return /^[A-Z.\-]{1,8}$/.test(s)
}

export function CommandBar({ items }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    function onKeyDown(e) {
      const key = String(e.key ?? '').toLowerCase()
      const k = (e.metaKey || e.ctrlKey) && key === 'k'
      if (k) {
        e.preventDefault()
        setOpen(true)
      } else if (key === 'escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  useEffect(() => {
    // close on route change
    if (!open) return
    setOpen(false)
  }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    const query = normalize(q).toLowerCase()
    const base = Array.isArray(items) ? items : []
    if (!query) return base.slice(0, 8)
    return base
      .filter((it) => it.label.toLowerCase().includes(query))
      .slice(0, 8)
  }, [items, q])

  const tickerAction = useMemo(() => {
    if (!q) return null
    if (!isLikelyTicker(q)) return null
    const sym = normalize(q).toUpperCase()
    return { label: `Open ${sym} chart`, to: `/analysis/${encodeURIComponent(sym)}` }
  }, [q])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden w-[min(42rem,60vw)] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-zinc-400 hover:bg-white/10 lg:flex"
        aria-label="Open command bar"
      >
        <Search className="size-4 opacity-70" aria-hidden />
        <span className="flex-1">Search…</span>
        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
          ⌘K
        </span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-label="Close command bar"
      />
      <div className="absolute left-1/2 top-20 w-[min(46rem,92vw)] -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/90 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <Search className="size-4 text-zinc-500" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to a page or ticker (AAPL)…"
            className="w-full bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
          />
          <span className="text-[11px] text-zinc-600">Esc</span>
        </div>

        <div className="p-2">
          {tickerAction ? (
            <button
              type="button"
              onClick={() => navigate(tickerAction.to)}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-200 hover:bg-white/5"
            >
              <span className="font-medium">{tickerAction.label}</span>
              <span className="text-[11px] text-zinc-600">Enter</span>
            </button>
          ) : null}

          {results.map((it) => (
            <button
              key={it.to}
              type="button"
              onClick={() => navigate(it.to)}
              className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-200 hover:bg-white/5"
            >
              <span className="font-medium">{it.label}</span>
              <span className="text-[11px] text-zinc-600">{it.shortcut ?? ''}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

