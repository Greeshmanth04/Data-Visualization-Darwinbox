import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface EBProps { children: React.ReactNode }
interface EBState { hasError: boolean; error: Error | null }

class ErrorBoundary extends React.Component<EBProps, EBState> {
  declare state: EBState;
  declare props: Readonly<EBProps>;

  constructor(props: EBProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }
  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', color: '#ff6b6b', backgroundColor: '#1a1a2e', fontFamily: 'monospace', minHeight: '100vh' }}>
          <h1>⚠️ Application Error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: '20px', color: '#ffa502' }}>
            {this.state.error?.message}
          </pre>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: '10px', color: '#747d8c', fontSize: '12px' }}>
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <ErrorBoundary>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </ErrorBoundary>
);