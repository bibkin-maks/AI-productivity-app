import React from 'react';
import NetworkErrorRetry from './NetworkErrorRetry';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service here
        console.error("Uncaught error:", error, errorInfo);
    }

    handleRetry = () => {
        // Prepare for retry - could be a simple state reset or a full reload
        // For chunk load errors, a reload is essentially required
        if (this.state.error?.message?.includes('Failed to fetch dynamically imported module')) {
            window.location.reload();
        } else {
            this.setState({ hasError: false, error: null });
        }
    };

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return this.props.fallback ? (
                this.props.fallback
            ) : (
                <div className="min-h-screen w-full flex items-center justify-center bg-[#0f1115]">
                    <NetworkErrorRetry error={this.state.error} onRetry={this.handleRetry} />
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
