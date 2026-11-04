'use client'
import * as React from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

/* ══════════════════════════════════════════════════════════════
   Per-widget error boundary.

   The dashboard is a grid of independent widgets. One widget blowing
   up — a malformed graph, a missing embedding, a payload the browser
   chokes on — must not take the whole page with it. Each widget gets
   its own boundary that shows a small, recoverable error instead.
   ══════════════════════════════════════════════════════════════ */

interface Props {
  children: React.ReactNode
  /** Shown in the fallback so the user knows what went wrong. */
  label?: string
}

interface State {
  error: Error | null
}

export class WidgetErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[shelf] widget failed:', this.props.label ?? 'widget', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 px-4 py-6 text-center">
        <AlertTriangle className="size-4 text-warn" />
        <p className="text-[12.5px] font-medium text-fg">
          {this.props.label ? `${this.props.label} could not be shown` : 'This widget could not be shown'}
        </p>
        <p className="max-w-[280px] text-[11.5px] leading-relaxed text-faint">{error.message}</p>
        <button
          onClick={this.reset}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-line/10 px-2.5 py-1 text-[11.5px] text-muted transition hover:border-accent/30 hover:text-fg"
        >
          <RotateCcw className="size-3" />
          Try again
        </button>
      </div>
    )
  }
}
