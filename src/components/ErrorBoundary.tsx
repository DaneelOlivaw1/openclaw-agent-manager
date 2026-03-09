import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-6 m-4 border border-destructive/50 rounded-lg bg-destructive/5">
            <h3 className="font-semibold text-destructive mb-2">Something went wrong</h3>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-3 text-sm underline text-primary hover:text-primary/80"
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
