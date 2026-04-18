import { Search } from 'lucide-react'

/**
 * Shared table chrome (copied from the Dashboard "Top 20 Most Active" styling).
 * Use this wrapper to standardize table visuals across pages.
 */
export function TableShell({ title, subtitle, search, setSearch, children, rightSlot }) {
  const hasSearch = typeof setSearch === 'function'
  return (
    <section className="rounded-2xl border border-border-subtle bg-gradient-to-b from-surface-1/80 to-surface-1/55 shadow-xl shadow-black/20">
      <div className="flex flex-col gap-4 border-b border-border-subtle p-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-zinc-100">{title}</h2>
          {subtitle ? <p className="text-sm text-zinc-500">{subtitle}</p> : null}
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
        {hasSearch ? (
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={search ?? ''}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-xl border border-border-subtle bg-surface-0/35 py-2 pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none ring-0 transition focus:border-white/15 focus:bg-surface-0/45"
            />
          </div>
        ) : null}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}

