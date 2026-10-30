import React, { useState } from 'react';
import { VoiceAssistantPanel } from '../VoiceAssistantPanel';
import { SmartDisplayHub } from '../SmartDisplayHub';
import { GenuineWorkspaceWorkflow } from '../GenuineWorkspaceWorkflow';
import type { CalendarEvent, GmailMessageSummary, GoogleTaskItem } from '../../lib/workspace';
import type { WorkflowStep } from '../../types';
import {
  Sparkles,
  ShieldCheck,
  Cpu,
  ArrowUpRight,
  Play,
  RotateCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  Activity,
  Layers,
  Terminal,
} from 'lucide-react';

interface HomeViewProps {
  audioStatus: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
  transcript: string;
  assistantReply: string;
  isListening: boolean;
  onToggleListening: () => void;
  onInterrupt: () => void;
  onSendMessage: (text: string) => void;
  onQuickPrompt: (prompt: string) => void;
  events: CalendarEvent[];
  messages: GmailMessageSummary[];
  tasks: GoogleTaskItem[];
  hasGoogleToken: boolean;
  accessToken: string | null;
  onLogin: () => void;
  activeWorkflowSteps: WorkflowStep[];
  workflowStatus: 'idle' | 'running' | 'completed' | 'failed' | 'pending_approval';
  onApproveStep: (stepId: string) => void;
  onRequestTaskConfirmation: (title: string, notes: string, onConfirm: () => Promise<void>) => void;
  onNavigate: (view: string) => void;
  onSceneActivate: (sceneName: string) => void;
  onOpenOnboarding?: () => void;
  onTriggerWorkflow?: (workflowId: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  audioStatus,
  transcript,
  assistantReply,
  isListening,
  onToggleListening,
  onInterrupt,
  onSendMessage,
  onQuickPrompt,
  events,
  messages,
  tasks,
  hasGoogleToken,
  accessToken,
  onLogin,
  activeWorkflowSteps,
  workflowStatus,
  onApproveStep,
  onRequestTaskConfirmation,
  onNavigate,
  onSceneActivate,
  onOpenOnboarding,
  onTriggerWorkflow,
}) => {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  // Compute workflow progress percentage
  const totalSteps = activeWorkflowSteps.length;
  const completedSteps = activeWorkflowSteps.filter((s) => s.status === 'completed').length;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* 1. WELCOME BANNER & AMBIENT TELEMETRY                     */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-purple-950/40 p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-center space-x-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-sm shadow-cyan-500/20">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-white tracking-wide">
                Nexus AI Ambient Operating System
              </h2>
              <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-[10px] font-mono font-semibold text-purple-300 border border-purple-500/30">
                Alexa+ Track
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Live duplex voice with <span className="font-mono text-cyan-400">gemini-3.8-live</span>, ambient workspace orchestration, & commerce safety.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {onOpenOnboarding && (
            <button
              onClick={onOpenOnboarding}
              className="flex items-center space-x-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-indigo-300 hover:bg-indigo-500/25 transition-all font-medium cursor-pointer"
            >
              <Cpu className="h-3.5 w-3.5 text-indigo-400" />
              <span>Feature Tour</span>
            </button>
          )}

          <div className="flex items-center space-x-1.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-slate-300 font-mono text-[11px]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Duplex Live: Ready</span>
          </div>

          <button
            onClick={() => onNavigate('integrations')}
            className="flex items-center space-x-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-cyan-300 hover:bg-cyan-500/25 transition-all font-medium cursor-pointer"
          >
            <span>Workspace</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. MAIN VOICE ASSISTANT & ANIMATED VOICE ORB              */}
      {/* ========================================================= */}
      <VoiceAssistantPanel
        audioStatus={audioStatus}
        transcript={transcript}
        assistantReply={assistantReply}
        isListening={isListening}
        onToggleListening={onToggleListening}
        onInterrupt={onInterrupt}
        onSendMessage={onSendMessage}
        onQuickPrompt={onQuickPrompt}
      />

      {/* ========================================================= */}
      {/* 3. WORKFLOW PROGRESS UPDATES (Real-time Orchestration)   */}
      {/* ========================================================= */}
      <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#0b0f19] via-[#090d18] to-[#07090e] p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <Terminal className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">
                Live Workflow Progress Updates
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  workflowStatus === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : workflowStatus === 'running'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
                    : workflowStatus === 'pending_approval'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {workflowStatus.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Executive Morning Briefing & Environmental Scene Automation
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onTriggerWorkflow?.('wf-briefing')}
              className="flex items-center space-x-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-3.5 py-1.5 text-xs font-semibold text-cyan-300 transition-all cursor-pointer"
            >
              <RotateCw className="h-3.5 w-3.5 text-cyan-400" />
              <span>Trigger Routine</span>
            </button>
            <button
              onClick={() => onNavigate('workflows')}
              className="flex items-center space-x-1 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Live Progress Bar Indicator */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center space-x-2">
              <Activity className="h-3.5 w-3.5 text-cyan-400" />
              <span>Execution Progress</span>
            </span>
            <span className="font-mono text-cyan-300 font-bold">
              {completedSteps} / {totalSteps} Steps Complete ({progressPercent}%)
            </span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-900 border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-indigo-500 transition-all duration-700 shadow-sm shadow-cyan-500/50"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Real-time Step Progression Cards */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {activeWorkflowSteps.map((step, idx) => {
            const isCompleted = step.status === 'completed';
            const isRunning = step.status === 'running';
            const isApproval = step.status === 'approval_required';
            const isPending = step.status === 'pending';

            return (
              <div
                key={step.id}
                onClick={() => setExpandedStepId(expandedStepId === step.id ? null : step.id)}
                className={`relative rounded-2xl p-4 border transition-all cursor-pointer ${
                  isCompleted
                    ? 'border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50'
                    : isRunning
                    ? 'border-cyan-500/50 bg-cyan-950/20 shadow-md shadow-cyan-950/30'
                    : isApproval
                    ? 'border-amber-500/50 bg-amber-950/20 shadow-md shadow-amber-950/30'
                    : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      ) : isRunning ? (
                        <div className="h-4.5 w-4.5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                      ) : isApproval ? (
                        <ShieldAlert className="h-5 w-5 text-amber-400 animate-bounce" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center text-[9px] text-slate-400 font-mono">
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white tracking-wide">
                        {step.title}
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-1 shrink-0">
                    <span className="rounded bg-slate-800/90 border border-slate-700 px-1.5 py-0.5 font-mono text-[9px] text-slate-300 uppercase">
                      {step.service}
                    </span>
                    {step.durationMs && (
                      <span className="text-[10px] font-mono text-slate-400">
                        {step.durationMs}ms
                      </span>
                    )}
                  </div>
                </div>

                {/* Output Details Accordion */}
                {step.output && expandedStepId === step.id && (
                  <div className="mt-3 rounded-xl bg-slate-950/90 p-2.5 font-mono text-[10px] text-cyan-300 border border-slate-800">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(step.output, null, 2)}</pre>
                  </div>
                )}

                {/* Human-in-the-Loop Approval Action */}
                {isApproval && (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-500/15 p-2.5 border border-amber-500/40">
                    <div className="flex items-center space-x-1.5 text-xs text-amber-200 font-medium">
                      <ShieldAlert className="h-4 w-4 text-amber-300 shrink-0" />
                      <span>Explicit approval required</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onApproveStep(step.id);
                      }}
                      className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1 text-xs font-bold text-slate-950 transition-colors shadow-sm cursor-pointer"
                    >
                      Authorize
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. GENUINE GOOGLE WORKSPACE WORKFLOW CARD                 */}
      {/* ========================================================= */}
      <GenuineWorkspaceWorkflow
        accessToken={accessToken}
        onLogin={onLogin}
        onRequestTaskConfirmation={onRequestTaskConfirmation}
      />

      {/* ========================================================= */}
      {/* 5. SMART DISPLAY GLANCE HUB (Echo Show Mode)              */}
      {/* ========================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Ambient Glance Hub (Smart Display Mode)
          </h3>
          <span className="text-[11px] text-cyan-400 font-mono">Live Google Sync</span>
        </div>
        <SmartDisplayHub
          events={events}
          messages={messages}
          tasks={tasks}
          hasGoogleToken={hasGoogleToken}
          onNavigate={onNavigate}
          onSceneActivate={onSceneActivate}
        />
      </div>
    </div>
  );
};
