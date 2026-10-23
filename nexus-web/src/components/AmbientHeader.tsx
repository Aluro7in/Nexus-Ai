import React, { useState, useEffect } from 'react';

interface AmbientHeaderProps {
  serverConnected: boolean;
  onResetSession: () => void;
  isResetting: boolean;
}

export const AmbientHeader: React.FC<AmbientHeaderProps> = ({
  serverConnected,
  onResetSession,
  isResetting,
}) => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="ambient-header glass-panel">
      <div className="brand-section">
        <div className="brand-logo-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
        </div>
        <div>
          <div className="brand-title">Nexus AI</div>
          <div className="brand-subtitle">Alexa+ Ambient Assistant & MCP Hub</div>
        </div>
      </div>

      <div className="header-status-group">
        <div
          className="status-badge"
          style={{
            background: serverConnected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)',
            color: serverConnected ? '#34d399' : '#f87171',
            borderColor: serverConnected ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)',
          }}
        >
          <div
            className="status-dot"
            style={{
              background: serverConnected ? '#34d399' : '#f87171',
              boxShadow: serverConnected ? '0 0 8px #34d399' : '0 0 8px #f87171',
            }}
          />
          {serverConnected ? 'MCP Streamable HTTP Connected' : 'Connecting to /mcp...'}
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)' }}>
          {time}
        </div>

        <button
          className="btn-secondary"
          onClick={onResetSession}
          disabled={isResetting}
          title="Reset tasks, carts, and workflows to clean baseline"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
          </svg>
          {isResetting ? 'Resetting...' : 'Reset Session'}
        </button>
      </div>
    </header>
  );
};
