import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('[DEBUG] index.tsx loaded');

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: { padding: '40px', color: '#ff6b6b', backgroundColor: '#1a1a2e', fontFamily: 'monospace', minHeight: '100vh' }
      },
        React.createElement('h1', null, '⚠️ Application Error'),
        React.createElement('pre', { style: { whiteSpace: 'pre-wrap', marginTop: '20px', color: '#ffa502' } },
          this.state.error?.message
        ),
        React.createElement('pre', { style: { whiteSpace: 'pre-wrap', marginTop: '10px', color: '#747d8c', fontSize: '12px' } },
          this.state.error?.stack
        )
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

console.log('[DEBUG] Mounting React app...');
const root = ReactDOM.createRoot(rootElement);
root.render(
  React.createElement(ErrorBoundary, null,
    React.createElement(React.StrictMode, null,
      React.createElement(App, null)
    )
  )
);
console.log('[DEBUG] React render called');