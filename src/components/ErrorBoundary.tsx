import { Component, type ErrorInfo, type ReactNode } from 'react'
import { saveCrashState } from '@/lib/recovery'
import { logger } from '@/lib/logger'
import { c, tint } from '@/shared/rivals-tokens'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

/**
 * Simple error boundary that saves app state before crashes
 *
 * Automatically saves crash data to recovery files for debugging
 * Shows a user-friendly error message instead of a blank screen
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Application crashed', {
      error: error.message,
      stack: error.stack,
    })

    this.setState({ errorInfo })

    // Save crash state asynchronously (don't block error UI)
    this.saveCrashData(error, errorInfo)
  }

  private async saveCrashData(error: Error, errorInfo: ErrorInfo) {
    try {
      // Get basic app state - extend this based on your app's needs
      const appState = {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        // Add more app state here as needed:
        // currentUser: getCurrentUser(),
        // activeFeatures: getActiveFeatures(),
        // etc.
      }

      await saveCrashState(appState, {
        error: error.message,
        stack: error.stack || 'No stack trace available',
        componentStack: errorInfo.componentStack || undefined,
      })
    } catch (saveError) {
      // Don't throw from error boundary - just log
      logger.error('Failed to save crash data', { saveError })
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  private handleCopy = () => {
    const { error, errorInfo } = this.state
    const text = [
      `${error?.name}: ${error?.message}`,
      error?.stack || '',
      errorInfo?.componentStack || '',
    ].join('\n\n')
    void navigator.clipboard.writeText(text)
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center p-8"
          style={{ background: c.bg }}
        >
          <div
            className="w-full max-w-lg overflow-hidden"
            style={{
              background: c.panel,
              border: `1px solid ${c.line2}`,
              borderRadius: 16,
              boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.6)',
              animation: 'metadata-fade-in 350ms ease-out both',
            }}
          >
            <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${c.err}, transparent)` }} />
            <div className="text-center" style={{ padding: '34px 32px 30px' }}>
              <div
                className="mx-auto grid place-items-center"
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: 20,
                  background: tint(c.err, 12),
                  border: `1px solid ${tint(c.err, 35)}`,
                  color: c.err,
                  marginBottom: 20,
                  animation: 'icon-pop-in 400ms ease-out 100ms both',
                }}
              >
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <p
                className="rivals-mono"
                style={{ color: c.err, fontSize: 11, fontWeight: 600, letterSpacing: '0.28em', textTransform: 'uppercase' }}
              >
                Unexpected Error
              </p>
              <h1
                className="rivals-display"
                style={{ color: c.ink, fontSize: 30, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 6 }}
              >
                Something went wrong
              </h1>
              <p style={{ color: c.ink3, fontFamily: c.font, fontSize: 13.5, marginTop: 10, lineHeight: 1.55 }}>
                The application hit an unexpected error. Your data has been saved
                automatically, and reloading usually fixes it.
              </p>

              {this.state.error && (
                <div
                  className="rivals-mono text-left break-words"
                  style={{
                    marginTop: 18,
                    padding: '10px 14px',
                    borderRadius: 9,
                    background: c.bg,
                    border: `1px solid ${c.line2}`,
                    color: c.ink3,
                    fontSize: 11.5,
                    maxHeight: 96,
                    overflow: 'auto',
                  }}
                >
                  {this.state.error.name}: {this.state.error.message}
                </div>
              )}

              <div className="flex items-center justify-center gap-2.5" style={{ marginTop: 22 }}>
                <button
                  onClick={this.handleCopy}
                  className="btn-outline cursor-pointer"
                  style={{ padding: '10px 16px', borderRadius: 9, background: 'transparent', color: c.ink3, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
                >
                  Copy Error
                </button>
                <button
                  onClick={this.handleReset}
                  className="btn-outline cursor-pointer"
                  style={{ padding: '10px 16px', borderRadius: 9, background: 'transparent', color: c.ink2, border: `1px solid ${c.line2}`, fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
                >
                  Try Again
                </button>
                <button
                  onClick={this.handleReload}
                  className="btn-primary cursor-pointer"
                  style={{ padding: '10px 18px', borderRadius: 9, background: c.accent, color: c.onAccent, border: 'none', fontFamily: c.font, fontSize: 13, fontWeight: 600 }}
                >
                  Reload Application
                </button>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error?.stack && (
                <details className="mt-5 text-left">
                  <summary
                    className="cursor-pointer rivals-mono"
                    style={{ color: c.ink3, fontSize: 11 }}
                  >
                    Stack trace (development only)
                  </summary>
                  <pre
                    className="rivals-mono whitespace-pre-wrap overflow-auto"
                    style={{ marginTop: 8, padding: 12, borderRadius: 9, background: c.bg, border: `1px solid ${c.line}`, color: c.ink3, fontSize: 10.5, maxHeight: 200 }}
                  >
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
