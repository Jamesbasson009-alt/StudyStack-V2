import React from 'react';

/** Full-screen spinner shown while the solver runs (generation and any setting change). */
export function GeneratingOverlay({ show, label }) {
  if (!show) return null;
  return (
    <div
      className="generating-overlay"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.35)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: 'var(--bg, #fff)',
          borderRadius: 14,
          padding: '28px 36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.18)',
          minWidth: 220,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: '3px solid var(--bg-subtle, #e5e7eb)',
            borderTopColor: '#0e3868',
            animation: 'generating-spin 0.7s linear infinite',
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted, #475569)' }}>{label}</span>
      </div>
      <style>{`
        @keyframes generating-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
