"use client";

import { Component, type ReactNode } from "react";

type TabErrorBoundaryProps = {
  name: string;
  children: ReactNode;
};

type TabErrorBoundaryState = {
  hasError: boolean;
};

export default class TabErrorBoundary extends Component<
  TabErrorBoundaryProps,
  TabErrorBoundaryState
> {
  state: TabErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="liquid-surface rounded-[28px] p-6 text-center">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-500">
            {this.props.name}
          </p>
          <h2 className="mt-2 text-xl font-black">This section needs a refresh</h2>
          <p className="mt-2 text-sm font-semibold text-neutral-500">
            Your saved data is still intact. Try reopening this tab or reload the app.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
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
