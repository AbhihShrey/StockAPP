export function DashboardCard({ title, action, children, className = '', ...rest }) {
  return (
    <section className={['panel panel-hover flex h-full flex-col', className].join(' ')} {...rest}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <h2 className="eyebrow">{title}</h2>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 px-5 py-5 sm:px-6 sm:py-6">{children}</div>
    </section>
  )
}
