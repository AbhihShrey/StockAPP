import { Flame } from 'lucide-react'

export function FlameSpinner({ size = 22, className = '' }) {
  return (
    <Flame
      className={`flame-spinner ${className}`.trim()}
      size={size}
      strokeWidth={2}
      aria-hidden="true"
    />
  )
}
