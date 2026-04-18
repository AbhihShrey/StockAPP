/**
 * Tiny line chart for recent closes (oldest → newest, left → right).
 */
export function MiniSparkline({ values, className = '' }) {
  const w = 72
  const h = 22
  const pad = 2
  if (!Array.isArray(values) || values.length < 2) {
    return <div className={['h-[22px] w-[72px]', className].join(' ')} aria-hidden />
  }
  const clean = values.map((v) => Number(v)).filter((n) => Number.isFinite(n))
  if (clean.length < 2) {
    return <div className={['h-[22px] w-[72px]', className].join(' ')} aria-hidden />
  }
  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const span = max - min || 1e-9
  const first = clean[0]
  const last = clean[clean.length - 1]
  const up = last >= first
  const stroke = up ? 'rgba(52,211,153,0.95)' : 'rgba(251,113,133,0.95)'

  const pts = clean
    .map((v, i) => {
      const x = pad + (i / (clean.length - 1)) * (w - 2 * pad)
      const y = pad + (1 - (v - min) / span) * (h - 2 * pad)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={['shrink-0', className].join(' ')}
      aria-hidden
    >
      <polyline fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  )
}
