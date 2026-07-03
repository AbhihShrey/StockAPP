import { Search } from 'lucide-react'

/**
 * Shared table chrome. Wraps a <table> with a titled header, optional search,
 * and the standard `.tbl` scroll container.
 */
export function TableShell({ title, subtitle, search, setSearch, children, rightSlot }) {
  const hasSearch = typeof setSearch === 'function'
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-line p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold text-ink" style={{ fontStretch: '108%' }}>
            {title}
          </h2>
          {subtitle ? <p className="text-sm text-ink-3">{subtitle}</p> : null}
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
        {hasSearch ? (
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              value={search ?? ''}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="input pl-9"
            />
          </div>
        ) : null}
      </div>
      <div className="tbl rounded-none border-0 bg-transparent">{children}</div>
    </section>
  )
}
