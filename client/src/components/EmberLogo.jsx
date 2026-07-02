import { useId } from 'react'

const SIZES = {
  xs: { box: 36, mark: 21, name: 15, tracking: '0.06em' },
  sm: { box: 48, mark: 28, name: 17, tracking: '0.06em' },
  md: { box: 72, mark: 43, name: 22, tracking: '0.07em' },
  lg: { box: 96, mark: 57, name: 30, tracking: '0.07em' },
}

/**
 * Icon mark: horseshoe arc + teardrop flame.
 * All coordinates in a 32×32 viewBox.
 *
 * Arc: a single cubic bezier with stroke-linecap="round" — this produces
 *   the characteristic round dot caps at each endpoint automatically.
 *
 * Flame: classic pointed-top teardrop. Widest point sits ~60% down the
 *   body so it reads as fire rather than a water drop.
 */
function EmberMark({ size, uid }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        {/*
          Flame gradient: bright orange-red at the pointed tip fading to
          a deep red-brown at the rounded base — warm fire colours,
          not the yellow-gold that reads as water.
        */}
        <radialGradient
          id={`emf-${uid}`}
          cx="50%" cy="30%"
          r="70%"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0%"   stopColor="#ff7830" />
          <stop offset="40%"  stopColor="#e84420" />
          <stop offset="100%" stopColor="#a82408" />
        </radialGradient>
      </defs>

      {/*
        Horseshoe arc — opens upward, curves down and around.
        The symmetric cubic bezier (both control points directly below
        their respective endpoints) makes a clean U.
        stroke-linecap="round" grows a half-circle cap at each end,
        giving the two characteristic dots without any extra markup.
      */}
      <path
        d="M 5.2 19.5 C 5.2 31 26.8 31 26.8 19.5"
        stroke="#c83412"
        strokeWidth="4.6"
        strokeLinecap="round"
        fill="none"
      />

      {/*
        Flame — teardrop with the widest point lower than the midpoint
        so it tapers more sharply at the tip (fire) instead of being
        symmetric (water drop).
        Tip: (16, 4)   Widest: ±6 units at y ≈ 16   Base: (16, 22)
      */}
      <path
        d="M 16 4
           C 19.5 8.5 22.2 13 22.2 16.5
           C 22.2 19.8 19.4 22.2 16 22.2
           C 12.6 22.2 9.8 19.8 9.8 16.5
           C 9.8 13 12.5 8.5 16 4 Z"
        fill={`url(#emf-${uid})`}
      />
    </svg>
  )
}

function IconTile({ s, uid }) {
  const r = Math.round(s.box * 0.24)
  return (
    <div
      className="ember-logo-tile"
      style={{
        width: s.box,
        height: s.box,
        background: '#0e0b0a',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: r,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.5)',
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
        fontWeight: 500,
        color: '#ede8e2',
        letterSpacing: s.tracking,
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
