import React from 'react';

const NetworkErrorRetry = ({ onRetry, error }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-[#0f1115]/50 backdrop-blur-md rounded-2xl border border-white/10 m-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6 text-red-400">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">Something went wrong</h3>

            <p className="text-slate-400 mb-6 max-w-md text-sm leading-relaxed">
                {error?.message?.includes('Failed to fetch dynamically imported module')
                    ? "We couldn't load this part of the application. This is usually caused by a network interruption or a new deployment."
                    : "An unexpected error occurred while loading this page."}
            </p>

            <button
                onClick={onRetry || (() => window.location.reload())}
                className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-900/20 transition-all transform hover:scale-105 active:scale-95"
            >
                Reload Application
            </button>

            {import.meta.env.DEV && error && (
                <div className="mt-8 p-4 bg-black/50 rounded-lg text-left w-full overflow-auto max-h-48 border border-white/5">
                    <p className="text-[10px] text-red-300 font-mono whitespace-pre-wrap">
                        Error: {error.toString()}
                    </p>
                    {error.componentStack && (
                        <pre className="text-[9px] text-slate-500 mt-2 font-mono">
                            {error.componentStack}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
};

export default NetworkErrorRetry;
