import { Component, type ErrorInfo, type ReactNode } from "react";
import { logger } from "../utils/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("Uncaught render error", {
      err: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  private handleReload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-base-100 text-base-content">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-sm text-base-content/60 max-w-md text-center">
          An unexpected error occurred. The error has been logged.
        </p>
        {this.state.error && (
          <pre className="text-xs bg-base-200 p-3 rounded-lg max-w-lg overflow-auto max-h-40">
            {this.state.error.message}
          </pre>
        )}
        <button type="button" className="btn btn-primary btn-sm" onClick={this.handleReload}>
          Reload Application
        </button>
      </div>
    );
  }
}
