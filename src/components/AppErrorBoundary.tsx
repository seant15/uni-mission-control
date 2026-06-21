import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

type Props = { children: ReactNode }

type State = { error: Error | null }

/**
 * 顶层错误边界 — 任意子树 render 抛错时避免整页白屏/假死，提供可恢复 UI。
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleTryAgain = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full uni-card p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Something went wrong</h1>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              The dashboard hit an unexpected error. You can try again or reload the page.
            </p>
          </div>
          {import.meta.env.DEV && (
            <pre className="text-left text-xs text-red-800 bg-red-50 border border-red-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
              {error.message}
            </pre>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={this.handleTryAgain}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-800 hover:bg-gray-50"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--brand-600)] text-white hover:opacity-95"
            >
              <RefreshCw size={14} />
              Reload page
            </button>
          </div>
        </div>
      </div>
    )
  }
}
