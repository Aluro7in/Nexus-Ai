import React from 'react';
import { VoiceAssistantPanel } from '../VoiceAssistantPanel';
import { SmartDisplayHub } from '../SmartDisplayHub';
import { ExecutionTimeline } from '../ExecutionTimeline';
import { GenuineWorkspaceWorkflow } from '../GenuineWorkspaceWorkflow';
import type { CalendarEvent, GmailMessageSummary, GoogleTaskItem } from '../../lib/workspace';
import type { WorkflowStep } from '../../types';
import { Sparkles, ShieldCheck, Cpu, ArrowUpRight } from 'lucide-react';

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
}) => {
  return (
    <div className="space-y-6">
      {/* Welcome Banner & System Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-cyan-200 dark:border-cyan-500/20 bg-gradient-to-r from-cyan-50/80 via-white to-indigo-50/80 dark:from-cyan-950/30 dark:via-slate-900/40 dark:to-indigo-950/30 p-4 shadow-xs backdrop-blur-md transition-colors">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
              Nexus AI Ambient Digital OS
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Voice-first Alexa+ hackathon prototype. Powered by Gemini 3.8 Flash & Google Workspace.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-2.5 py-1 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
            Gemini 3.8 Flash: Active
          </span>
          <button
            onClick={() => onNavigate('integrations')}
            className="flex items-center space-x-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 transition-colors"
          >
            <span>Workspace</span>
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Main Voice Assistant Panel */}
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

      {/* Priority 3: Genuine Google Workspace Workflow Card */}
      <GenuineWorkspaceWorkflow
        accessToken={accessToken}
        onLogin={onLogin}
        onRequestTaskConfirmation={onRequestTaskConfirmation}
      />

      {/* Smart Display Widgets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Ambient Glance Hub (Echo Show Mode)
          </h3>
          <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono">Live Sync</span>
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

      {/* Active Workflow Execution Timeline */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Orchestrated Action Timeline
        </h3>
        <ExecutionTimeline
          steps={activeWorkflowSteps}
          status={workflowStatus}
          onApproveStep={onApproveStep}
        />
      </div>
    </div>
  );
};
