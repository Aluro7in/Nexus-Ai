import React from 'react';

export interface WorkflowOperation {
  step: number;
  tool: string;
  name: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'SUCCESS' | 'FAILED' | 'PENDING_APPROVAL';
  timestamp: string;
  error?: string;
}

interface ExecutionTimelineProps {
  operations: WorkflowOperation[];
  isExecuting: boolean;
  workflowState: string;
}

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({
  operations,
  isExecuting,
  workflowState,
}) => {
  return (
    <div className="timeline-panel glass-panel">
      <div className="timeline-header">
        <div className="section-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          Live Tool Execution Timeline
        </div>
        <div
          style={{
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            background:
              workflowState === 'AWAITING_APPROVAL'
                ? 'rgba(245, 158, 11, 0.15)'
                : workflowState === 'COMPLETED'
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(255, 255, 255, 0.05)',
            color:
              workflowState === 'AWAITING_APPROVAL'
                ? 'var(--accent-amber)'
                : workflowState === 'COMPLETED'
                ? 'var(--accent-emerald)'
                : 'var(--text-secondary)',
          }}
        >
          {isExecuting ? 'ORCHESTRATING...' : `STATE: ${workflowState || 'IDLE'}`}
        </div>
      </div>

      {operations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
          No tool operations recorded yet. Trigger the demo prompt or send a voice command to see real-time MCP orchestration.
        </div>
      ) : (
        <div className="timeline-steps">
          {operations.map((op) => (
            <div key={op.step} className="timeline-step">
              <div
                className={`step-indicator ${
                  op.status === 'SUCCESS' ? 'success' : op.status === 'PENDING_APPROVAL' ? 'pending' : 'failed'
                }`}
              >
                {op.status === 'SUCCESS' ? '✓' : op.status === 'PENDING_APPROVAL' ? '⏳' : '✕'}
              </div>

              <div className="step-content">
                <div className="step-top">
                  <span className="step-name">{op.name}</span>
                  <span className="step-tool-badge">{op.tool}</span>
                </div>

                <div className="step-details">
                  {op.output && (
                    <div style={{ marginTop: '4px', color: '#cbd5e1' }}>
                      {Object.entries(op.output).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', gap: '8px', fontSize: '11px', lineHeight: '1.4' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{k}:</span>
                          <span>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {op.error && (
                    <div style={{ color: 'var(--accent-rose)', marginTop: '4px' }}>
                      Error: {op.error}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <span>Status: {op.status}</span>
                  <span>{new Date(op.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
