const SIZES = {
  xs: { box: 36, svg: 20, name: 15, spacing: -0.2, lineW: 24 },
  sm: { box: 48, svg: 26, name: 17, spacing: -0.2, lineW: 32 },
  md: { box: 72, svg: 38, name: 22, spacing: -0.3, lineW: 40 },
  lg: { box: 96, svg: 52, name: 30, spacing: -0.4, lineW: 54 },
}

function FlameSvg({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30">
      <path
        d="M 15 5 C 18 10, 21.5 13.5, 21.5 18.5 C 21.5 22.8, 18.5 25.5, 15 25.5 C 11.5 25.5, 8.5 22.8, 8.5 18.5 C 8.5 14.8, 12 11.5, 14 8 Z"
        fill="var(--color-accent)"
      />
    </svg>
  )
}

function IconTile({ s }) {
  return (
    <div
      className="ember-logo-tile"
      style={{
        width: s.box,
        height: s.box,
        background: '#0a0a0a',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: Math.round(s.box * 0.30),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <FlameSvg size={s.svg} />
    </div>
  )
}

function Wordmark({ s }) {
  return (
    <div
      className="ember-logo-wordmark"
      style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: s.name,
        fontWeight: 500,
        color: '#fafafa',
        letterSpacing: s.spacing,
        userSelect: 'none',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      Ember Finances
    </div>
  )
}

/**
 * EmberLogo — reusable brand component.
 *
 * Props:
 *   size        'xs' | 'sm' | 'md' | 'lg'   — scales everything proportionally
 *   layout      'vertical' | 'horizontal'    — stacked (default) or side-by-side
 *   iconOnly    boolean                       — renders just the icon tile
 *   showTagline boolean                       — renders nothing (tagline retired)
 *   className   string
 */
export function EmberLogo({
  size = 'md',
  layout = 'vertical',
  iconOnly = false,
  showTagline = false,
  className,
}) {
  const s = SIZES[size] ?? SIZES.md
  const tile = <IconTile s={s} />

  if (iconOnly) {
    return <div className={className}>{tile}</div>
  }

  if (layout === 'horizontal') {
    return (
      <div
        className={className}
        style={{ display: 'flex', alignItems: 'center', gap: 10 }}
      >
        {tile}
        <Wordmark s={s} />
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
    >
      {tile}
      <Wordmark s={s} />
    </div>
  )
}
