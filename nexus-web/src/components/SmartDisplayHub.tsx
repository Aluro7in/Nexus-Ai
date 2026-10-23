import React from 'react';

export interface ScheduleEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  attendees?: string[];
  isFirstMeeting?: boolean;
  source: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt: string;
}

export interface CartItem {
  id: string;
  title: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface StagedCart {
  stageId: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  estimatedTotal: number;
  currency: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'CANCELLED';
  confirmationToken: string;
  safetyDisclaimer: string;
}

interface SmartDisplayHubProps {
  events: ScheduleEvent[];
  tasks: Task[];
  stagedCart: StagedCart | null;
  onToggleTask: (id: string, currentStatus: string) => void;
  onConfirmCart: (decision: 'APPROVE' | 'REJECT') => void;
  isConfirming: boolean;
}

export const SmartDisplayHub: React.FC<SmartDisplayHubProps> = ({
  events,
  tasks,
  stagedCart,
  onToggleTask,
  onConfirmCart,
  isConfirming,
}) => {
  return (
    <div className="display-column">
      {/* 1. Staged Cart & Safety Approval Card */}
      {stagedCart && (
        <div className="hub-card glass-panel" style={{ border: '1px solid rgba(245, 158, 11, 0.35)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="section-title" style={{ color: '#fbbf24' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              Staged Commerce Cart
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                background:
                  stagedCart.status === 'PENDING_APPROVAL'
                    ? 'rgba(245, 158, 11, 0.2)'
                    : stagedCart.status === 'APPROVED'
                    ? 'rgba(16, 185, 129, 0.2)'
                    : 'rgba(244, 63, 94, 0.2)',
                color:
                  stagedCart.status === 'PENDING_APPROVAL'
                    ? '#fbbf24'
                    : stagedCart.status === 'APPROVED'
                    ? '#34d399'
                    : '#f87171',
              }}
            >
              {stagedCart.status === 'PENDING_APPROVAL' ? 'AWAITING APPROVAL' : stagedCart.status}
            </span>
          </div>

          <div className="staged-cart-box">
            {stagedCart.items.map((item) => (
              <div key={item.id} className="cart-item-row">
                <span>
                  <strong>{item.quantity}x</strong> {item.title}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>${item.totalPrice.toFixed(2)}</span>
              </div>
            ))}

            <div className="cart-item-row" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              <span>Estimated Tax (8.25%)</span>
              <span>${stagedCart.tax.toFixed(2)}</span>
            </div>

            <div className="cart-total-row">
              <span>Estimated Total</span>
              <span style={{ color: 'var(--accent-primary)', fontSize: '16px' }}>
                ${stagedCart.estimatedTotal.toFixed(2)}
              </span>
            </div>

            <div className="safety-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              Two-Phase Safety Gate: Held in demo sandbox. Requires explicit voice/click approval.
            </div>

            {stagedCart.status === 'PENDING_APPROVAL' ? (
              <div className="cart-actions">
                <button
                  type="button"
                  className="btn-approve"
                  onClick={() => onConfirmCart('APPROVE')}
                  disabled={isConfirming}
                >
                  {isConfirming ? 'Authorizing...' : 'Approve & Place Order'}
                </button>
                <button
                  type="button"
                  className="btn-reject"
                  onClick={() => onConfirmCart('REJECT')}
                  disabled={isConfirming}
                >
                  Cancel
                </button>
              </div>
            ) : stagedCart.status === 'APPROVED' ? (
              <div
                style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  fontSize: '12px',
                  fontWeight: 500,
                  textAlign: 'center',
                }}
              >
                ✓ Order Approved and Recorded in Audit Store.
              </div>
            ) : (
              <div
                style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(244, 63, 94, 0.15)',
                  color: '#f87171',
                  fontSize: '12px',
                  textAlign: 'center',
                }}
              >
                ✕ Order was Cancelled.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Tomorrow's Schedule Card */}
      <div className="hub-card glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Tomorrow’s Calendar
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sample Adapter</span>
        </div>

        {events.length === 0 ? (
          <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            No upcoming events found.
          </div>
        ) : (
          events.map((evt) => (
            <div key={evt.id} className="event-item">
              <div className="event-time-pill">
                {evt.start.split('T')[1].substring(0, 5)}
              </div>
              <div className="event-info">
                <div className="event-title">{evt.title}</div>
                <div className="event-meta">
                  {evt.location || 'Virtual Sync'} • {evt.attendees?.length || 1} participant(s)
                </div>
              </div>
              {evt.isFirstMeeting && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--accent-cyan)',
                    background: 'rgba(6, 182, 212, 0.15)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  FIRST
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* 3. Persistent Tasks Card */}
      <div className="hub-card glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Persistent Tasks
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {tasks.filter((t) => t.status === 'COMPLETED').length}/{tasks.length} Completed
          </span>
        </div>

        {tasks.length === 0 ? (
          <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            No tasks registered.
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="task-item">
              <div className="task-checkbox-group">
                <input
                  type="checkbox"
                  className="task-checkbox"
                  checked={task.status === 'COMPLETED'}
                  onChange={() => onToggleTask(task.id, task.status)}
                />
                <span className={`task-title ${task.status === 'COMPLETED' ? 'completed' : ''}`}>
                  {task.title}
                </span>
              </div>
              <span className={`task-priority-badge ${task.priority.toLowerCase()}`}>
                {task.priority}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
