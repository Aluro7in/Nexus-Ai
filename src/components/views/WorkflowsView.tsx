import React from 'react';
import {
  Workflow,
  Play,
  RotateCw,
  Clock,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { WorkflowExecution } from '../../types';
import { GenuineWorkspaceWorkflow } from '../GenuineWorkspaceWorkflow';

interface WorkflowsViewProps {
  workflows: WorkflowExecution[];
  onTriggerWorkflow: (workflowId: string) => void;
  onApproveStep: (stepId: string) => void;
  accessToken: string | null;
  onLogin: () => void;
  onRequestTaskConfirmation: (title: string, notes: string, onConfirm: () => Promise<void>) => void;
}

export const WorkflowsView: React.FC<WorkflowsViewProps> = ({
  workflows,
  onTriggerWorkflow,
  onApproveStep,
  accessToken,
  onLogin,
  onRequestTaskConfirmation,
}) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Workflow className="h-5 w-5 text-cyan-400" />
            <span>Ambient Autonomous Workflows</span>
          </h2>
          <p className="text-xs text-slate-400">
            Multi-step execution plans coordinating Google Workspace, Smart Home, and Commerce.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-300">
            {workflows.length + 1} Available Workflows
          </span>
        </div>
      </div>

      {/* Priority 3: Genuine Google Workspace Workflow */}
      <GenuineWorkspaceWorkflow
        accessToken={accessToken}
        onLogin={onLogin}
        onRequestTaskConfirmation={onRequestTaskConfirmation}
      />

      {/* Workflows List */}
      <div className="space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Scheduled & Multi-Modal Routine Workflows
        </h3>
        {workflows.map((wf) => {
          return (
            <div
              key={wf.id}
              className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                <div>
                  <div className="flex items-center space-x-2.5">
                    <h3 className="text-sm font-bold text-white">{wf.title}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        wf.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : wf.status === 'running'
                          ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 animate-pulse'
                          : wf.status === 'pending_approval'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {wf.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-3 mt-1 text-xs text-slate-400">
                    <span className="capitalize">Trigger: {wf.triggerType.replace('_', ' ')}</span>
                    <span>•</span>
                    <span>{wf.steps.length} Steps</span>
                    <span>•</span>
                    <span>Updated {wf.updatedAt}</span>
                  </div>
                </div>

                <button
                  onClick={() => onTriggerWorkflow(wf.id)}
                  disabled={wf.status === 'running'}
                  className="flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-950/40 hover:opacity-95 disabled:opacity-40 transition-all"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>{wf.status === 'running' ? 'Executing...' : 'Trigger Workflow'}</span>
                </button>
              </div>

              {/* Steps Progress */}
              <div className="mt-4 space-y-3">
                {wf.steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className="flex items-start justify-between rounded-xl bg-slate-950/40 p-3 border border-slate-800/60"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 border border-slate-800">
                        {step.status === 'completed' ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : step.status === 'running' ? (
                          <div className="h-3 w-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                        ) : step.status === 'approval_required' ? (
                          <ShieldAlert className="h-4 w-4 text-amber-400 animate-pulse" />
                        ) : (
                          <span className="text-[10px] font-bold text-slate-500">{idx + 1}</span>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold text-slate-200">{step.title}</span>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                            {step.service}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{step.description}</p>
                      </div>
                    </div>

                    {step.status === 'approval_required' && (
                      <button
                        onClick={() => onApproveStep(step.id)}
                        className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors shadow-sm ml-2 shrink-0"
                      >
                        Approve Action
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
