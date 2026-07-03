/** Ember arc loading spinner (name kept for existing call sites). */
export function FlameSpinner({ size = 22, className = '' }) {
  return (
    <span
      className={`ember-spinner inline-block ${className}`.trim()}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  )
}
