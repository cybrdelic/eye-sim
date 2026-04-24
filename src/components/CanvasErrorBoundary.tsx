import React from 'react';

type CanvasErrorBoundaryProps = {
  children: React.ReactNode;
};

type CanvasErrorBoundaryState = {
  hasError: boolean;
};

export default class CanvasErrorBoundary extends React.Component<CanvasErrorBoundaryProps, CanvasErrorBoundaryState> {
  state: CanvasErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[canvas-error-boundary] rendering failed', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 grid place-items-center bg-neutral-950 text-white">
          <div className="rounded-2xl border border-white/10 bg-black/40 px-6 py-5 text-center backdrop-blur-md">
            <h2 className="text-lg font-semibold">Scene fallback active</h2>
            <p className="mt-2 text-sm text-white/70">A rendering resource failed to load. Refresh the page to retry.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
