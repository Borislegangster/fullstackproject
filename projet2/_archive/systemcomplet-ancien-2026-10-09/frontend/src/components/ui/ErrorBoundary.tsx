import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI to show instead of the default error card. */
  fallback?: ReactNode;
  /** Optional callback when an error occurs. */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Global error boundary for the application.
 * Catches JavaScript errors anywhere in its child component tree,
 * logs them, and displays a fallback UI instead of crashing.
 *
 * @example
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-200 p-8 text-center">
            {/* Error Icon */}
            <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            <h1 className="text-xl font-bold text-gray-800 mb-2 font-montserrat">
              Une erreur est survenue
            </h1>
            <p className="text-gray-500 text-sm mb-6 font-opensans">
              L'application a rencontré un problème inattendu. Essayez de recharger la page.
            </p>

            {/* Error Details (dev only) */}
            {this.state.error && (
              <details className="text-left mb-6 bg-gray-50 rounded-lg p-3">
                <summary className="cursor-pointer text-xs font-semibold text-gray-500 select-none">
                  Détails techniques
                </summary>
                <pre className="mt-2 text-xs text-red-600 whitespace-pre-wrap break-words overflow-auto max-h-32 font-mono">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-center">
              <button
                id="btn-error-go-home"
                onClick={this.handleGoHome}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors font-opensans"
              >
                Accueil
              </button>
              <button
                id="btn-error-reload"
                onClick={this.handleReload}
                className="px-4 py-2 bg-globus-blue-dark text-white rounded-lg text-sm hover:bg-globus-blue transition-colors font-opensans font-medium"
              >
                Recharger la page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
