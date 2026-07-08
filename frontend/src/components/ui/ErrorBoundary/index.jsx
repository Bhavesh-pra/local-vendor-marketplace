import { Component } from 'react';
import { ErrorState } from '../ErrorState/index.jsx';
import './index.css';

/**
 * ErrorBoundary — catches render errors and failed dynamic imports.
 * Prevents the application from crashing to a blank screen.
 *
 * @param {import('react').ReactNode} children
 * @param {import('react').ReactNode} [fallback]  Custom fallback UI
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production, pipe to an error monitoring service
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="error-boundary">
          <ErrorState
            message="This page failed to load. Please try again."
            onRetry={() => window.location.reload()}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
