/**
 * Ember Finance v2 brand mark — "the ember tick".
 * A rising trajectory whose final segment ignites, with a glowing ember at the apex.
 *
 * Props (stable API):
 *   size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
 *   iconOnly: render just the mark
 *   layout: 'horizontal' | 'stacked'
 *   showTagline: show the tagline under the wordmark
 */

const SIZES = {
  xs: { icon: 26, word: 'text-[15px]', sub: 'text-[8.5px]', tag: 'text-[10px]' },
  sm: { icon: 32, word: 'text-lg', sub: 'text-[9.5px]', tag: 'text-[11px]' },
  md: { icon: 40, word: 'text-2xl', sub: 'text-[11px]', tag: 'text-xs' },
  lg: { icon: 52, word: 'text-3xl', sub: 'text-[13px]', tag: 'text-sm' },
  xl: { icon: 68, word: 'text-5xl', sub: 'text-base', tag: 'text-base' },
}

export function EmberMark({ size = 40, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="em-trend" x1="10" y1="34" x2="38" y2="14" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#837A6F" />
          <stop offset="0.55" stopColor="#C2410C" />
          <stop offset="0.8" stopColor="#FF6B2C" />
          <stop offset="1" stopColor="#FFA53D" />
        </linearGradient>
        <radialGradient id="em-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFA53D" stopOpacity="0.5" />
          <stop offset="1" stopColor="#FFA53D" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="12" fill="#14110E" />
      <rect x="1" y="1" width="46" height="46" rx="12" stroke="rgba(244,232,216,0.14)" strokeWidth="1" />
      <path
        d="M10 34 L19 25 L24 30 L38 14"
        stroke="url(#em-trend)"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="38" cy="14" r="8" fill="url(#em-glow)" />
      <circle cx="38" cy="14" r="3" fill="#FFA53D" />
    </svg>
  )
}

export function EmberLogo({
  size = 'md',
  iconOnly = false,
  layout = 'horizontal',
  showTagline = false,
  className = '',
}) {
  const s = SIZES[size] ?? SIZES.md

  if (iconOnly) {
    return <EmberMark size={s.icon} className={className} />
  }

  const wordmark = (
    <span className={layout === 'horizontal' ? 'flex min-w-0 flex-col justify-center' : 'flex flex-col items-center'}>
      <span
        className={`font-display font-bold leading-none text-ink ${s.word}`}
        style={{ letterSpacing: '-0.02em' }}
      >
        Ember
      </span>
      <span
        className={`font-sans mt-1 font-semibold uppercase leading-none text-flame ${s.sub}`}
        style={{ letterSpacing: '0.34em' }}
      >
        Finance
      </span>
      {showTagline ? (
        <span className={`mt-1.5 leading-none text-ink-3 ${s.tag}`}>Live market intelligence</span>
      ) : null}
    </span>
  )

  return (
    <span
      className={[
        'inline-flex select-none',
        layout === 'horizontal' ? 'items-center gap-2.5' : 'flex-col items-center gap-2 text-center',
        className,
      ].join(' ')}
    >
      <EmberMark size={s.icon} />
      {wordmark}
    </span>
  )
}
