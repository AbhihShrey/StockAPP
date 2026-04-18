export function DashboardCard({ title, action, children, className = '', ...rest }) {
  return (
    <section
      className={[
        'flex h-full flex-col rounded-xl border border-white/10 bg-neutral-900/50 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.55)]',
        className,
      ].join(' ')}
      {...rest}
    >
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100">{title}</h2>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 px-5 py-5">{children}</div>
    </section>
  )
}

