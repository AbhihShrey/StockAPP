import { useId } from 'react'

const SIZES = {
  xs: { box: 36, mark: 26, name: 15 },
  sm: { box: 48, mark: 34, name: 17 },
  md: { box: 72, mark: 52, name: 22 },
  lg: { box: 96, mark: 68, name: 30 },
}

/** Tile background — the notch and arrow are "cut" in this same color */
const TILE_BG = '#0b0b0b'

/**
 * Icon mark: flame with a rising chart arrow, per the brand reference.
 * All coordinates in a 64×64 viewBox.
 *
 * Layers, bottom to top:
 *   1. Flame body — one outline with two tips: tall main tip right, shorter
 *      tongue left, and a jagged valley opening from the top between them.
 *   2. Cream core — rounded blob filling the lower half.
 *   3. Chart arrow — tile-colored zigzag rising up-right with an arrowhead,
 *      reading as a cutout through core and flame.
 */
function EmberMark({ size, uid }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={`emf-${uid}`} x1="32" y1="3.5" x2="32" y2="60.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f19238" />
          <stop offset="60%" stopColor="#e65a22" />
          <stop offset="100%" stopColor="#d33f16" />
        </linearGradient>
      </defs>

      {/* Flame body — two tips with a jagged valley between them */}
      <path
        d="M 40 4.5
           C 41.5 11 47 16.5 50.8 23.2
           C 53.8 28.6 55.5 33.8 55.5 39.2
           C 55.5 51.2 45.5 59.5 32 59.5
           C 18.5 59.5 8.5 51.2 8.5 39.2
           C 8.5 32.4 11.6 26.6 15.8 22
           C 18.9 18.6 21.9 16 23.8 12.5
           C 25.1 15.9 25.9 19.8 25.6 23
           L 28.2 24
           C 29.8 19.5 32.2 15.8 34.6 12.4
           C 36.5 9.7 38.4 7.3 40 4.5 Z"
        fill={`url(#emf-${uid})`}
      />

      {/* Cream core */}
      <path
        d="M 32 28.5
           C 38.2 34 44.2 38.6 44.2 44.9
           C 44.2 51.6 39 55.8 32 55.8
           C 25 55.8 19.8 51.6 19.8 44.9
           C 19.8 38.6 25.8 34 32 28.5 Z"
        fill="#f5ca6a"
      />

      {/* Chart arrow */}
      <path
        d="M 18 47 L 26.6 38.4 L 31.2 43 L 42.6 31.6"
        stroke={TILE_BG}
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M 46.4 27.9 L 45.1 33.4 L 40.9 29.2 Z" fill={TILE_BG} />
    </svg>
  )
}

function IconTile({ s, uid }) {
  const r = Math.round(s.box * 0.26)
  return (
    <div
      className="ember-logo-tile"
      style={{
        width: s.box,
        height: s.box,
        background: TILE_BG,
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: r,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 10px rgba(0,0,0,0.45)',
      }}
    >
      <EmberMark size={s.mark} uid={uid} />
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
        fontWeight: 700,
        letterSpacing: '-0.02em',
        userSelect: 'none',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: '#e2652c' }}>ember</span>
      <span style={{ color: '#f4f1ea' }}>finances</span>
    </div>
  )
}

/**
 * EmberLogo — reusable brand component.
 *
 * Props:
 *   size        'xs' | 'sm' | 'md' | 'lg'
 *   layout      'vertical' | 'horizontal'
 *   iconOnly    boolean
 *   showTagline boolean (retired, accepted but unused)
 *   className   string
 */
export function EmberLogo({
  size = 'md',
  layout = 'vertical',
  iconOnly = false,
  showTagline = false,
  className,
}) {
  const uid = useId().replace(/:/g, 'x')
  const s = SIZES[size] ?? SIZES.md
  const tile = <IconTile s={s} uid={uid} />

  if (iconOnly) return <div className={className}>{tile}</div>

  if (layout === 'horizontal') {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {tile}
        <Wordmark s={s} />
      </div>
    )
  }

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      {tile}
      <Wordmark s={s} />
    </div>
  )
}
