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
    // eslint-disable-next-line no-console
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
      <div className="min-h-dvh bg-zinc-950 p-6 text-zinc-100">
        <div className="mx-auto max-w-3xl space-y-4">
          <h1 className="text-xl font-semibold text-rose-400">Something crashed.</h1>
          <p className="text-sm text-zinc-400">
            The React tree threw an exception. Copy this and send it back so it can be fixed.
          </p>
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
            <p className="font-mono text-sm text-rose-200">{message}</p>
          </div>
          {stack ? (
            <details open className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">Stack</summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-400">{stack}</pre>
            </details>
          ) : null}
          {componentStack ? (
            <details className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">Component stack</summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-400">{componentStack}</pre>
            </details>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-zinc-950 hover:brightness-110"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-white/[0.08]"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    )
  }
}
