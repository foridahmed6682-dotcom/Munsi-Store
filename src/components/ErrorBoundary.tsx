import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReload = () => {
    try {
      // Clear non-critical cache keys while preserving authentication if possible
      sessionStorage.clear();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-6 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold text-slate-800 mb-2">
              সাময়িক যান্ত্রিক ত্রুটি দেখা দিয়েছে
            </h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              অ্যাপ্লিকেশনে একটি অপ্রত্যাশিত ত্রুটি ঘটেছে। আপনার ডেটা সুরক্ষিত রয়েছে। অনুগ্রহ করে রিলোড দিন অথবা ক্যাশ ক্লিয়ার করে আবার চেষ্টা করুন।
            </p>

            {this.state.error && (
              <div className="bg-slate-100 rounded-lg p-3 text-left mb-6 overflow-hidden">
                <p className="text-xs font-mono text-slate-700 truncate">
                  {this.state.error.message || 'Unknown error'}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition shadow-sm active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                পেজ রিলোড দিন
              </button>

              <button
                onClick={this.handleClearCacheAndReload}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition active:scale-95 text-sm"
              >
                <Trash2 className="w-4 h-4" />
                টেম্পোরারি ক্যাশ ক্লিয়ার করে রিলোড
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 text-slate-500 hover:text-slate-800 rounded-xl transition text-sm"
              >
                <Home className="w-4 h-4" />
                মূল পাতায় ফিরে যান
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
