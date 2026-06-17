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
    console.error(`[TabErrorBoundary:${this.props.name}] Caught error:`, error);
    console.error(errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="liquid-surface text-neutral-950 rounded-[28px] p-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">
            {this.props.name} (Error)
          </p>
          <h2 className="mt-2 text-xl font-black">This section needs a refresh</h2>
          <p className="mt-2 text-sm font-semibold text-neutral-500">
            Your saved data is still intact. Try reopening this tab or reload the app.
          </p>
          {this.state.error && (
            <div className="mt-4 p-4 bg-red-500/10 rounded-xl text-left overflow-auto max-h-[600px] border border-red-500/30">
               <p className="text-sm font-mono font-black text-red-600">Message: {this.state.error.message}</p>
               <div className="mt-2">
                 <p className="text-[10px] font-bold uppercase text-red-500 opacity-70">Stack Trace:</p>
                 <pre className="mt-1 text-[10px] text-red-500/80 leading-tight whitespace-pre-wrap break-words">
                   {this.state.error.stack}
                 </pre>
               </div>
               {this.state.errorInfo && (
                 <div className="mt-4 border-t border-red-500/20 pt-2">
                   <p className="text-[10px] font-bold uppercase text-red-700 opacity-70">Component Stack:</p>
                   <pre className="mt-1 text-[10px] text-red-700/70 leading-tight whitespace-pre-wrap break-words">
                     {this.state.errorInfo.componentStack}
                   </pre>
                 </div>
               )}
               <div className="mt-4 text-[10px] text-neutral-400 font-mono italic">
                 Environment: expense-ecru-kappa.vercel.app
               </div>
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
