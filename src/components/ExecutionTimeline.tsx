import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  RotateCw,
  ShieldAlert,
  ArrowRight,
  Terminal,
} from 'lucide-react';
import type { WorkflowStep } from '../types';

interface ExecutionTimelineProps {
  workflowTitle?: string;
  steps: WorkflowStep[];
  status: 'idle' | 'running' | 'completed' | 'failed' | 'pending_approval';
  onApproveStep?: (stepId: string) => void;
  onRetryWorkflow?: () => void;
}

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({
  workflowTitle = 'Daily Ambient Briefing & Action Orchestration',
  steps,
  status,
  onApproveStep,
  onRetryWorkflow,
}) => {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <Terminal className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">Execution Timeline</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                status === 'completed'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : status === 'running'
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 animate-pulse'
                  : status === 'pending_approval'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{workflowTitle}</p>
        </div>

        {onRetryWorkflow && (
          <button
            onClick={onRetryWorkflow}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
          >
            <RotateCw className="h-3 w-3" />
            <span>Rerun</span>
          </button>
        )}
      </div>

      {/* Steps List */}
      <div className="mt-5 space-y-4">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <div key={step.id} className="relative flex items-start space-x-3">
              {/* Vertical connector line */}
              {!isLast && (
                <div
                  className={`absolute left-3.5 top-7 -bottom-4 w-0.5 ${
                    step.status === 'completed' ? 'bg-emerald-500/40' : 'bg-slate-800'
                  }`}
                />
              )}

              {/* Status Icon */}
              <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950 border">
                {step.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : step.status === 'running' ? (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                ) : step.status === 'approval_required' ? (
                  <ShieldAlert className="h-4 w-4 text-amber-400 animate-bounce" />
                ) : step.status === 'failed' ? (
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-slate-600" />
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 rounded-xl bg-slate-950/40 p-3 border border-slate-800/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">{step.title}</span>
                  <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400 font-mono">
                      {step.service}
                    </span>
                    {step.durationMs && <span>{step.durationMs}ms</span>}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mt-1">{step.description}</p>

                {/* Output preview */}
                {step.output && (
                  <div className="mt-2 rounded-lg bg-slate-900/90 p-2 font-mono text-[10px] text-cyan-300 border border-slate-800">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(step.output, null, 2)}</pre>
                  </div>
                )}

                {/* Approval required banner */}
                {step.status === 'approval_required' && onApproveStep && (
                  <div className="mt-2.5 flex items-center justify-between rounded-lg bg-amber-500/10 p-2.5 border border-amber-500/30">
                    <div className="flex items-center space-x-1.5 text-xs text-amber-300 font-medium">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      <span>Explicit approval required before proceeding</span>
                    </div>
                    <button
                      onClick={() => onApproveStep(step.id)}
                      className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors shadow-sm"
                    >
                      Authorize Action
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
