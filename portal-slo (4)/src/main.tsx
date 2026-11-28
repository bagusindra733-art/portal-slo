import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

/** Mencegah layar kosong total: bila ada error tampilan, tampilkan pesan & tombol muat ulang. */
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: Error | null}> {
  state = {error: null as Error | null};
  static getDerivedStateFromError(error: Error) {
    return {error};
  }
  componentDidCatch(error: Error) {
    console.error('Portal SLO error:', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{minHeight: '100vh', background: '#0B1221', color: '#fff', padding: 24, fontFamily: 'sans-serif'}}>
        <h2 style={{fontSize: 18, fontWeight: 700}}>Terjadi kesalahan pada tampilan</h2>
        <p style={{opacity: 0.8, margin: '8px 0 16px'}}>{String(this.state.error.message || this.state.error)}</p>
        <button
          onClick={() => window.location.reload()}
          style={{padding: '8px 16px', borderRadius: 8, background: '#1E3A8A', color: '#fff', border: 0, cursor: 'pointer'}}
        >
          Muat ulang
        </button>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
