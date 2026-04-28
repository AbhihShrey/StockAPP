import { useState } from 'react'

const SIZES = {
  xs: { box: 36, svg: 20, name: 11, spacing: 1, lineW: 24 },
  sm: { box: 48, svg: 26, name: 14, spacing: 1, lineW: 32 },
  md: { box: 72, svg: 38, name: 20, spacing: 1.5, lineW: 40 },
  lg: { box: 96, svg: 52, name: 28, spacing: 2, lineW: 54 },
}

function FlameSvg({ size, hovered }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 30 30"
      style={{
        transform: hovered ? 'scale(1.06)' : 'scale(1)',
        transition: 'transform 0.4s ease',
      }}
    >
      <path
        d="M 15 4 C 18 9, 22 13, 22 18 C 22 23, 18 26, 15 26 C 12 26, 8 23, 8 18 C 8 14, 12 11, 14 7 Z"
        fill="var(--color-ember-outer, #c2421e)"
      />
      <path
        d="M 15 9 C 18 13, 20 16, 20 20 C 20 24, 17 25, 15 25 C 13 25, 10 24, 10 20 C 10 16, 12 13, 14 10 Z"
        fill="var(--color-ember-mid, #ff8a3d)"
      />
      <path
        d="M 15 14 C 17 16, 18 19, 17 22 C 16 24, 14 24, 13 22 C 12 19, 13 17, 15 14 Z"
        fill="var(--color-ember-hot, #ffe0a8)"
        style={{
          opacity: hovered ? 1 : 0.9,
          transition: 'opacity 0.4s ease',
        }}
      />
    </svg>
  )
}

function IconTile({ s, hovered, onEnter, onLeave }) {
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="ember-logo-tile"
      style={{
        width: s.box,
        height: s.box,
        background: 'linear-gradient(135deg, #0d0d0d, #000)',
        border: '1px solid #1a1a1a',
        borderRadius: Math.round(s.box * 0.27),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <FlameSvg size={s.svg} hovered={hovered} />
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
  const [hovered, setHovered] = useState(false)
  const s = SIZES[size] ?? SIZES.md

  const tile = (
    <IconTile
      s={s}
      hovered={hovered}
      onEnter={() => setHovered(true)}
      onLeave={() => setHovered(false)}
    />
  )

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
