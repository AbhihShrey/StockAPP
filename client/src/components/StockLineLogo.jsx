import { useState } from 'react'

const SIZES = {
  xs: { box: 36, svg: 17, name: 11, spacing: 2, lineW: 24 },
  sm: { box: 48, svg: 22, name: 14, spacing: 2.5, lineW: 32 },
  md: { box: 72, svg: 34, name: 20, spacing: 4, lineW: 40 },
  lg: { box: 96, svg: 46, name: 28, spacing: 5, lineW: 54 },
}

function IconTile({ s, hovered, onEnter, onLeave }) {
  const boxShadow = hovered
    ? '0 0 0 1px #00ff8855, 0 0 50px #00ff8835, inset 0 0 24px #00ff8818'
    : '0 0 0 1px #00ff8822, 0 0 30px #00ff8818, inset 0 0 20px #00ff8808'
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="stockline-logo-tile"
      style={{
        width: s.box,
        height: s.box,
        background: 'linear-gradient(135deg, #0d0d0d, #000)',
        border: '1px solid #1a1a1a',
        borderRadius: Math.round(s.box * 0.27),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow,
        transition: 'box-shadow 0.4s ease',
        flexShrink: 0,
      }}
    >
      <svg
        width={s.svg}
        height={s.svg}
        viewBox="0 0 30 30"
        fill="none"
        style={{ filter: 'drop-shadow(0 0 6px #00ff88) drop-shadow(0 0 14px #00ff8866)' }}
      >
        <polyline
          points="4,22 11,13 17,17 26,7"
          stroke="#00ff88"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="20,7 26,7 26,13"
          stroke="#00ff88"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

function Wordmark({ s }) {
  return (
    <div
      className="stockline-logo-wordmark"
      style={{
        fontFamily: "'Orbitron', monospace",
        fontSize: s.name,
        fontWeight: 900,
        color: '#fff',
        letterSpacing: s.spacing,
        userSelect: 'none',
        lineHeight: 1,
      }}
    >
      STOCK
      <span style={{ color: '#00ff88', textShadow: '0 0 12px #00ff88cc' }}>L</span>
      INE
    </div>
  )
}

/**
 * StockLineLogo — reusable brand component.
 *
 * Props:
 *   size        'xs' | 'sm' | 'md' | 'lg'   — scales everything proportionally
 *   layout      'vertical' | 'horizontal'    — stacked (default) or side-by-side
 *   iconOnly    boolean                       — renders just the icon tile
 *   showTagline boolean                       — show "Stock Analytics" (vertical only)
 *   className   string
 */
export function StockLineLogo({
  size = 'md',
  layout = 'vertical',
  iconOnly = false,
  showTagline = true,
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

  // vertical (default)
  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
    >
      {tile}
      <Wordmark s={s} />
      <div
        style={{
          width: s.lineW,
          height: 1,
          background: 'linear-gradient(90deg, transparent, #00ff88, transparent)',
          boxShadow: '0 0 8px #00ff88',
        }}
      />
      {showTagline && (
        <div
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 8,
            letterSpacing: 5,
            color: '#1e3d2a',
            textTransform: 'uppercase',
            userSelect: 'none',
          }}
        >
          Stock Analytics
        </div>
      )}
    </div>
  )
}
