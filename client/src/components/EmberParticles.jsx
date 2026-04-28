import { useMemo } from 'react'
import { useFireMotionEnabled } from '../lib/useFireMotionEnabled'

const PARTICLE_COUNT = 55

function buildParticles(count) {
  const list = []
  for (let i = 0; i < count; i += 1) {
    list.push({
      id: i,
      x: Math.random() * 100,
      duration: 3 + Math.random() * 6,
      delay: Math.random() * 6,
      size: 3 + Math.random() * 6,
      drift: -60 + Math.random() * 120,
      opacity: 0.5 + Math.random() * 0.5,
    })
  }
  return list
}

export function EmberParticles({ density = PARTICLE_COUNT }) {
  const motion = useFireMotionEnabled()
  const particles = useMemo(
    () => buildParticles(motion === 'reduced' ? Math.max(6, Math.floor(density / 3)) : density),
    [density, motion],
  )

  if (motion === 'static') return null

  return (
    <div className="ember-particles" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="ember-particle"
          style={{
            '--p-x': `${p.x}%`,
            '--p-duration': `${p.duration}s`,
            '--p-delay': `${p.delay}s`,
            '--p-size': `${p.size}px`,
            '--p-drift': `${p.drift}px`,
            '--p-opacity': p.opacity,
          }}
        />
      ))}
    </div>
  )
}
