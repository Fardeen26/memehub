import React, { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { MemeEditorProps } from '@/types/editor';

// Dynamically import MemeEditor to enable code splitting
const MemeEditor = lazy(() => import('./MemeEditor'));

// Error boundary component
const MemeEditorError = ({ error, resetError }: { error: Error; resetError: () => void }) => (
    <motion.div
        className="space-y-4 min-h-[65vh] max-sm:min-h-[75vh] flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
    >
        <div className="text-center space-y-4">
            <div className="text-white/80">
                <h3 className="text-lg font-semibold mb-2">Failed to load editor</h3>
                <p className="text-sm text-white/60">
                    {error.message || 'An unexpected error occurred'}
                </p>
            </div>
            <button
                onClick={resetError}
                className="px-4 py-2 bg-[#6a7bd1] hover:bg-[#6975b3] text-white rounded-md transition-colors"
            >
                Try Again
            </button>
        </div>
    </motion.div>
);

// Enhanced Suspense wrapper with error boundary
interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback: React.ComponentType<{ error: Error; resetError: () => void }>;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class MemeEditorErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('MemeEditor Error:', error, errorInfo);
    }

    resetError = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError && this.state.error) {
            const FallbackComponent = this.props.fallback;
            return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
        }

        return this.props.children;
    }
}

export default function DynamicMemeEditor(props: MemeEditorProps) {
    return (
        <MemeEditorErrorBoundary fallback={MemeEditorError}>
            <Suspense fallback={null}>
                <MemeEditor {...props} />
            </Suspense>
        </MemeEditorErrorBoundary>
    );
} 