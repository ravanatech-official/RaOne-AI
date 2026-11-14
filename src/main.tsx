import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { installAuthenticatedApiFetch } from './utils/authFetch';

try {
  installAuthenticatedApiFetch();
} catch (err) {
  console.warn('Auth fetch wrapper fallback:', err);
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('RaOne Root ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen bg-[#000000] text-[#ECECEC] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#171717] border border-[#2f2f2f] p-6 space-y-4 shadow-2xl">
            <h1 className="text-lg font-semibold text-white">RaOne AI Recovery Mode</h1>
            <p className="text-xs text-[#a3a3a3] leading-relaxed">
              The interface encountered an unexpected runtime error. You can reload or clear cached session data to restore a clean workspace.
            </p>
            <div className="p-3 rounded-xl bg-[#0d0d0d] border border-red-500/30 text-xs font-mono text-red-300 break-words">
              {this.state.errorMessage}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors"
              >
                Reload App
              </button>
              <button
                onClick={() => {
                  try {
                    Object.keys(localStorage)
                      .filter((k) => k.startsWith('raone_'))
                      .forEach((k) => localStorage.removeItem(k));
                  } catch {
                    // ignore storage errors
                  }
                  window.location.reload();
                }}
                className="px-4 py-2 rounded-xl bg-[#262626] text-white text-xs font-medium border border-[#3a3a3a] hover:bg-[#333] transition-colors"
              >
                Reset Local Cache & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    createRoot(rootEl).render(
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    );
    (window as any).__RAONE_BOOTED__ = true;
  } catch (bootErr: any) {
    console.error('RaOne fatal boot error:', bootErr);
    rootEl.textContent = `RaOne AI failed to initialize: ${bootErr?.message || String(bootErr)}`;
  }
}
