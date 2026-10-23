/**
 * Nexus AI — Root Application Component
 *
 * Wires the MCP client, REST workflow API, and all UI panels together.
 * Sends real requests to the backend via Vite proxy → nexus-core:3001.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AmbientHeader } from './components/AmbientHeader.js';
import { VoiceAssistantPanel, type ChatMessage } from './components/VoiceAssistantPanel.js';
import { ExecutionTimeline, type WorkflowOperation } from './components/ExecutionTimeline.js';
import { SmartDisplayHub, type ScheduleEvent, type Task, type StagedCart } from './components/SmartDisplayHub.js';

// ─── Types mirrored from nexus-core ──────────────────────────────────────────

interface WorkflowStatus {
  workflowId: string;
  query: string;
  state: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'AWAITING_APPROVAL' | 'FAILED';
  operations: WorkflowOperation[];
  summary: string;
  pendingAction?: {
    type: 'CART_CHECKOUT';
    stageId: string;
    confirmationToken: string;
    description: string;
    amount: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowTimestamp() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function makeMsgId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── App ─────────────────────────────────────────────────────────────────────

export function App() {
  const [serverConnected, setServerConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: makeMsgId(),
      sender: 'assistant',
      text: 'Hello! I\'m Nexus AI. Try: "Prepare my afternoon, check tomorrow\'s schedule, create a reminder for my first meeting, and stage my usual coffee order."',
      timestamp: nowTimestamp(),
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stagedCart, setStagedCart] = useState<StagedCart | null>(null);
  const [operations, setOperations] = useState<WorkflowOperation[]>([]);
  const [workflowState, setWorkflowState] = useState<string>('IDLE');
  const [pendingAction, setPendingAction] = useState<WorkflowStatus['pendingAction'] | undefined>(undefined);

  // ── Server health ping ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        const res = await fetch('/health');
        if (!cancelled) setServerConnected(res.ok);
      } catch {
        if (!cancelled) setServerConnected(false);
      }
    };
    ping();
    const interval = setInterval(ping, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // ── Load initial schedule & tasks ────────────────────────────────────────
  const fetchScheduleAndTasks = useCallback(async () => {
    try {
      const [schedRes, taskRes] = await Promise.all([
        fetch('/api/schedule'),
        fetch('/api/tasks'),
      ]);
      if (schedRes.ok) {
        const data = (await schedRes.json()) as { success: boolean; events: ScheduleEvent[] };
        if (data.success) setEvents(data.events);
      }
      if (taskRes.ok) {
        const data = (await taskRes.json()) as { success: boolean; tasks: Task[] };
        if (data.success) setTasks(data.tasks);
      }
    } catch {
      // silently ignore during startup; server may not be ready
    }
  }, []);

  useEffect(() => {
    fetchScheduleAndTasks();
  }, [fetchScheduleAndTasks]);

  // ── Handle chat message (trigger workflow or MCP) ────────────────────────
  const handleSendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: makeMsgId(),
      sender: 'user',
      text,
      timestamp: nowTimestamp(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsProcessing(true);
    setWorkflowState('RUNNING');
    setOperations([]);

    try {
      const res = await fetch('/api/workflow/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });

      if (!res.ok) {
        throw new Error(`Server responded ${res.status}: ${res.statusText}`);
      }

      const data = (await res.json()) as { success: boolean; result: WorkflowStatus; error?: string };

      if (!data.success) {
        throw new Error(data.error || 'Workflow execution failed');
      }

      const workflow = data.result;
      setOperations(workflow.operations);
      setWorkflowState(workflow.state);
      setPendingAction(workflow.pendingAction);

      // Refresh tasks and schedule to reflect persisted data
      await fetchScheduleAndTasks();

      // Pull the staged cart if one was created
      if (workflow.pendingAction?.stageId) {
        try {
          const cartRes = await fetch(`/api/cart/${workflow.pendingAction.stageId}`);
          if (cartRes.ok) {
            const cartData = (await cartRes.json()) as { success: boolean; cart: StagedCart };
            if (cartData.success) setStagedCart(cartData.cart);
          }
        } catch {
          // cart may not exist yet
        }
      }

      const assistantMsg: ChatMessage = {
        id: makeMsgId(),
        sender: 'assistant',
        text: workflow.summary,
        timestamp: nowTimestamp(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: makeMsgId(),
        sender: 'assistant',
        text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: nowTimestamp(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setWorkflowState('FAILED');
    } finally {
      setIsProcessing(false);
    }
  }, [fetchScheduleAndTasks]);

  // ── Cart confirmation ────────────────────────────────────────────────────
  const handleConfirmCart = useCallback(async (decision: 'APPROVE' | 'REJECT') => {
    if (!pendingAction) return;
    setIsConfirming(true);
    try {
      const res = await fetch('/api/cart/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenOrStageId: pendingAction.stageId,
          decision,
        }),
      });
      const data = (await res.json()) as { success: boolean; message: string; stage?: StagedCart };
      if (data.stage) {
        setStagedCart(data.stage);
      }
      const msg: ChatMessage = {
        id: makeMsgId(),
        sender: 'assistant',
        text: data.message,
        timestamp: nowTimestamp(),
      };
      setMessages((prev) => [...prev, msg]);
      if (decision === 'APPROVE') {
        setWorkflowState('COMPLETED');
      }
    } catch (err) {
      const msg: ChatMessage = {
        id: makeMsgId(),
        sender: 'assistant',
        text: `Confirmation error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: nowTimestamp(),
      };
      setMessages((prev) => [...prev, msg]);
    } finally {
      setIsConfirming(false);
    }
  }, [pendingAction]);

  // ── Toggle task status ───────────────────────────────────────────────────
  const handleToggleTask = useCallback(async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = (await res.json()) as { success: boolean; task: Task };
        if (data.success) {
          setTasks((prev) => prev.map((t) => (t.id === id ? data.task : t)));
        }
      }
    } catch {
      // silently ignore
    }
  }, []);

  // ── Reset session ────────────────────────────────────────────────────────
  const handleResetSession = useCallback(async () => {
    setIsResetting(true);
    try {
      await fetch('/api/reset', { method: 'POST' });
      setMessages([
        {
          id: makeMsgId(),
          sender: 'assistant',
          text: 'Session reset to clean baseline. All tasks, carts, and workflows cleared.',
          timestamp: nowTimestamp(),
        },
      ]);
      setOperations([]);
      setWorkflowState('IDLE');
      setStagedCart(null);
      setPendingAction(undefined);
      await fetchScheduleAndTasks();
    } catch (err) {
      console.error('Reset failed:', err);
    } finally {
      setIsResetting(false);
    }
  }, [fetchScheduleAndTasks]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <AmbientHeader
        serverConnected={serverConnected}
        onResetSession={handleResetSession}
        isResetting={isResetting}
      />

      <main className="main-grid">
        {/* Left: Voice + Chat */}
        <VoiceAssistantPanel
          messages={messages}
          onSendMessage={handleSendMessage}
          isProcessing={isProcessing}
        />

        {/* Center: Execution Timeline */}
        <ExecutionTimeline
          operations={operations}
          isExecuting={isProcessing}
          workflowState={workflowState}
        />

        {/* Right: Smart Display Hub (Schedule + Tasks + Cart) */}
        <SmartDisplayHub
          events={events}
          tasks={tasks}
          stagedCart={stagedCart}
          onToggleTask={handleToggleTask}
          onConfirmCart={handleConfirmCart}
          isConfirming={isConfirming}
        />
      </main>
    </div>
  );
}
