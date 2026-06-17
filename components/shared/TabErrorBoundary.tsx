"use client";

import { Component, type ReactNode } from "react";

type TabErrorBoundaryProps = {
  name: string;
  children: ReactNode;
};

type TabErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack?: string } | null;
};

export default class TabErrorBoundary extends Component<
  TabErrorBoundaryProps,
  TabErrorBoundaryState
> {
  state: TabErrorBoundaryState = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    console.error(`[TabErrorBoundary:${this.props.name}] Caught error:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV === "development";
      return (
        <div className="liquid-surface text-neutral-950 rounded-[28px] p-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">
            {this.props.name}
          </p>
          <h2 className="mt-2 text-xl font-black">This section needs a refresh</h2>
          <p className="mt-2 text-sm font-semibold text-neutral-500">
            Your saved data is still intact. Try reopening this tab or reload the app.
          </p>
          {this.state.error && (
            <div className="mt-4 p-4 bg-red-500/10 rounded-xl text-left overflow-auto max-h-[200px]">
               <p className="text-xs font-mono font-bold text-red-600">{this.state.error.message}</p>
               {isDev && this.state.errorInfo && (
                 <pre className="mt-2 text-[10px] text-red-500/70 leading-tight">
                   {this.state.errorInfo.componentStack}
                 </pre>
               )}
            </div>
          )}
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            className="mt-4 rounded-2xl bg-black px-4 py-3 text-sm font-black text-white dark:bg-white dark:text-black"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
