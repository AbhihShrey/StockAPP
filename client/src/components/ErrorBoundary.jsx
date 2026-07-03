import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    // Make it impossible to miss in the dev console
    console.error('[ErrorBoundary] Render crash:', error, info?.componentStack)
  }

  reset = () => this.setState({ error: null, info: null })

  render() {
    if (!this.state.error) return this.props.children
    const err = this.state.error
    const message = err?.message ?? String(err)
    const stack = err?.stack ?? ''
    const componentStack = this.state.info?.componentStack ?? ''
    return (
      <div className="min-h-dvh bg-bg p-6 text-ink">
        <div className="mx-auto max-w-3xl space-y-4 py-8">
          <header>
            <p className="eyebrow">Error · Render crash</p>
            <h1 className="display mt-2 text-2xl text-down sm:text-3xl">Something crashed.</h1>
            <div className="ember-rule mt-4" aria-hidden />
          </header>
          <p className="text-sm leading-relaxed text-ink-2">
            The React tree threw an exception. Copy this and send it back so it can be fixed.
          </p>
          <div className="panel border-down/25 p-4">
            <p className="num text-sm text-down">{message}</p>
          </div>
          {stack ? (
            <details open className="panel panel-pad">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-3">Stack</summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-ink-2">{stack}</pre>
            </details>
          ) : null}
          {componentStack ? (
            <details className="panel panel-pad">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-ink-3">Component stack</summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-ink-2">{componentStack}</pre>
            </details>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="btn-primary"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-ghost"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    )
  }
}
