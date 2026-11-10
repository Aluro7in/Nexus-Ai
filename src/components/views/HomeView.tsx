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
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  Activity,
  Layers,
  Terminal,
  Calendar,
  Mail,
  CheckSquare,
  ShoppingBag,
  Zap,
  Sliders,
  Sun,
  Moon,
  Home as HomeIcon,
  HelpCircle,
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

  // Next calendar event
  const nextEvent = events[0];
  // Next priority unread message
  const priorityMessage = messages.find((m) => m.unread) || messages[0];
  // Next pending task
  const pendingTask = tasks.find((t) => t.status === 'needsAction') || tasks[0];

  // Compute workflow progress percentage
  const totalSteps = activeWorkflowSteps.length;
  const completedSteps = activeWorkflowSteps.filter((s) => s.status === 'completed').length;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto">
      {/* ========================================================= */}
      {/* 1. TOP AMBIENT STATUS BANNER                              */}
      {/* ========================================================= */}
      <section
        aria-label="Ambient System Overview"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-gradient-to-r dark:from-[#0b0f19] dark:via-[#090d18] dark:to-[#07090e] p-4 sm:p-5 shadow-lg backdrop-blur-md"
      >
        <div className="flex items-center space-x-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 shadow-sm">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-wide">
                Nexus AI Ambient Operating System
              </h1>
              <span className="text-slate-400 dark:text-slate-600">·</span>
              <span className="text-[11px] font-mono font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                Alexa+ Track
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Natural speech duplex with <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">gemini-3.8-live</span>, ambient workspace synchronization, & multi-turn execution.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {onOpenOnboarding && (
            <button
              onClick={onOpenOnboarding}
              aria-label="Open Feature Tour & Onboarding Guide"
              className="flex items-center space-x-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 transition-all font-medium cursor-pointer"
            >
              <Cpu className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
              <span>Feature Tour</span>
            </button>
          )}

          <div className="flex items-center space-x-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/90 px-3 py-1.5 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Duplex Live: Ready</span>
          </div>

          <button
            onClick={() => onNavigate('integrations')}
            className="flex items-center space-x-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 transition-all font-medium cursor-pointer"
          >
            <span>Workspace</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. CENTRAL VOICE ORB, MICROPHONE CONTROLS & TRANSCRIPT     */}
      {/* ========================================================= */}
      <section aria-label="Voice Assistant Interaction Area">
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
      </section>

      {/* ========================================================= */}
      {/* 3. CONTEXTUAL INTELLIGENCE & WORKSPACE CARDS SECTION      */}
      {/* ========================================================= */}
      <section aria-label="Contextual Intelligence Cards" className="space-y-3.5">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            <h2 className="text-sm font-bold tracking-wide text-slate-900 dark:text-white uppercase font-mono">
              Contextual Intelligence & Workspace Cards
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Real-time Telemetry & Quick Action Gates
          </span>
        </div>

        {/* Responsive Grid of Contextual Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Today's Agenda & Next Up (Calendar) */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-gradient-to-b dark:from-[#0b0f19] dark:to-[#080b12] p-4 sm:p-5 shadow-sm hover:border-cyan-500/40 transition-all">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center space-x-2 text-cyan-600 dark:text-cyan-400">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider font-mono">Next Agenda</span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {hasGoogleToken ? 'Google Synced' : 'Demo Mode'}
                </span>
              </div>

              <div className="mt-3 space-y-1.5">
                {nextEvent ? (
                  <>
                    <div className="flex items-center space-x-1.5 text-xs text-cyan-600 dark:text-cyan-300 font-medium">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {nextEvent.start.dateTime
                          ? new Date(nextEvent.start.dateTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Today'}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                      {nextEvent.summary}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {nextEvent.description || nextEvent.location || 'Calendar event scheduled on primary agenda.'}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 italic">No upcoming calendar events found.</p>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
              <button
                onClick={() => onQuickPrompt('What is next on my schedule and are there any conflicts?')}
                className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 transition-colors cursor-pointer flex items-center space-x-1"
              >
                <span>Voice Briefing</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onNavigate('integrations')}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                View Agenda
              </button>
            </div>
          </div>

          {/* Card 2: Priority Communication (Gmail) */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-gradient-to-b dark:from-[#0b0f19] dark:to-[#080b12] p-4 sm:p-5 shadow-sm hover:border-cyan-500/40 transition-all">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
                  <Mail className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider font-mono">Priority Mail</span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  {messages.filter((m) => m.unread).length} Unread
                </span>
              </div>

              <div className="mt-3 space-y-1.5">
                {priorityMessage ? (
                  <>
                    <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 truncate">
                      From: {priorityMessage.from}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                      {priorityMessage.subject}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {priorityMessage.snippet}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 italic">No unread priority emails in inbox.</p>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
              <button
                onClick={() => onQuickPrompt('Summarize my high priority unread Gmail messages.')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors cursor-pointer flex items-center space-x-1"
              >
                <span>Summarize Inbox</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onNavigate('conversations')}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Open Messages
              </button>
            </div>
          </div>

          {/* Card 3: Action Task & Reversible Action (Tasks + Undo) */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-gradient-to-b dark:from-[#0b0f19] dark:to-[#080b12] p-4 sm:p-5 shadow-sm hover:border-cyan-500/40 transition-all">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
                  <CheckSquare className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider font-mono">Action Task</span>
                </div>
                <button
                  onClick={() => onQuickPrompt('Undo last action')}
                  title="Revert the most recent task creation or workflow execution"
                  className="flex items-center space-x-1 text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Undo Last Action</span>
                </button>
              </div>

              <div className="mt-3 space-y-1.5">
                {pendingTask ? (
                  <>
                    <div className="flex items-center space-x-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span>Pending Workspace Action</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
                      {pendingTask.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {pendingTask.notes || 'Synthesized task ready for Google Tasks synchronization.'}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 italic">All workspace action items completed.</p>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
              <button
                onClick={() => onQuickPrompt('Create task Prepare quarterly product demo')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 transition-colors cursor-pointer flex items-center space-x-1"
              >
                <span>Add Task</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onNavigate('tasks')}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                View Tasks
              </button>
            </div>
          </div>

          {/* Card 4: Ambient Smart Home & Matter Scene */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-gradient-to-b dark:from-[#0b0f19] dark:to-[#080b12] p-4 sm:p-5 shadow-sm hover:border-cyan-500/40 transition-all">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
                  <Sliders className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider font-mono">Ambient Scene</span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Matter Bridge</span>
              </div>

              <div className="mt-3 space-y-2">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Active Preset: <span className="text-slate-900 dark:text-white font-semibold">Focus Glow (5500K)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onSceneActivate('Focus Glow')}
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-cyan-500/50 hover:text-cyan-400 transition-all cursor-pointer"
                  >
                    <Sun className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Focus Glow</span>
                  </button>
                  <button
                    onClick={() => onSceneActivate('Warm Evening')}
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-amber-500/50 hover:text-amber-400 transition-all cursor-pointer"
                  >
                    <Moon className="h-3.5 w-3.5 text-amber-400" />
                    <span>Warm Sunset</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Lighting & Scene Control</span>
              <button
                onClick={() => onQuickPrompt('Execute morning ambient briefing and activate lighting.')}
                className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-500 transition-colors cursor-pointer"
              >
                Trigger Briefing
              </button>
            </div>
          </div>

          {/* Card 5: Predictive Commerce & Low Stock Replenishment */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-gradient-to-b dark:from-[#0b0f19] dark:to-[#080b12] p-4 sm:p-5 shadow-sm hover:border-cyan-500/40 transition-all">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
                  <ShoppingBag className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider font-mono">Commerce Safety</span>
                </div>
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-semibold">
                  Pending Auth
                </span>
              </div>

              <div className="mt-3 space-y-1.5">
                <div className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-1">
                  Nespresso Vertuo Intenso (30ct)
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Smart pantry sensor detected low inventory (&lt; 5 pods remaining). Total: $36.50.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
              <button
                onClick={() => onNavigate('commerce')}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-500 transition-colors cursor-pointer flex items-center space-x-1"
              >
                <span>Review Order</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onQuickPrompt('Check smart pantry telemetry and order coffee pods.')}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Auto-Order
              </button>
            </div>
          </div>

          {/* Card 6: Alexa+ Multi-Turn Routine & Orchestration */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-gradient-to-b dark:from-[#0b0f19] dark:to-[#080b12] p-4 sm:p-5 shadow-sm hover:border-cyan-500/40 transition-all">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400">
                  <Terminal className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider font-mono">Alexa+ Routine</span>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                  Autonomous
                </span>
              </div>

              <div className="mt-3 space-y-1.5">
                <div className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-1">
                  Morning Briefing & Scene Orchestration
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sequential 4-step execution across Calendar, Priority Gmail, Matter Lighting, and Task sync.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
              <button
                onClick={() => onTriggerWorkflow?.('wf-briefing')}
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-500 transition-colors cursor-pointer flex items-center space-x-1"
              >
                <RotateCw className="h-3 w-3" />
                <span>Execute Routine</span>
              </button>
              <button
                onClick={() => onNavigate('workflows')}
                className="text-[11px] text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                All Workflows
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. WORKFLOW PROGRESS TIMELINE (Interactive Stepper)       */}
      {/* ========================================================= */}
      <section
        aria-label="Live Workflow Progress Updates"
        className="rounded-3xl border border-slate-200/90 dark:border-slate-800/80 bg-white/95 dark:bg-gradient-to-b dark:from-[#0b0f19] dark:via-[#090d18] dark:to-[#07090e] p-5 sm:p-6 shadow-xl backdrop-blur-md"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <Terminal className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">
                Live Workflow Progress Updates
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  workflowStatus === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                    : workflowStatus === 'running'
                    ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 animate-pulse'
                    : workflowStatus === 'pending_approval'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 animate-pulse'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                }`}
              >
                {workflowStatus.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Executive Morning Briefing & Environmental Scene Automation
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onTriggerWorkflow?.('wf-briefing')}
              className="flex items-center space-x-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-3.5 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 transition-all cursor-pointer"
            >
              <RotateCw className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Trigger Routine</span>
            </button>
            <button
              onClick={() => onNavigate('workflows')}
              className="flex items-center space-x-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Live Progress Bar Indicator */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-2">
              <Activity className="h-3.5 w-3.5 text-cyan-500 dark:text-cyan-400" />
              <span>Execution Progress</span>
            </span>
            <span className="font-mono text-cyan-600 dark:text-cyan-300 font-bold">
              {completedSteps} / {totalSteps} Steps Complete ({progressPercent}%)
            </span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800">
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

            return (
              <div
                key={step.id}
                onClick={() => setExpandedStepId(expandedStepId === step.id ? null : step.id)}
                className={`relative rounded-2xl p-4 border transition-all cursor-pointer ${
                  isCompleted
                    ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/10 hover:border-emerald-500/50'
                    : isRunning
                    ? 'border-cyan-500/50 bg-cyan-50/50 dark:bg-cyan-950/20 shadow-md shadow-cyan-950/30'
                    : isApproval
                    ? 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 shadow-md shadow-amber-950/30'
                    : 'border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                      ) : isRunning ? (
                        <div className="h-4.5 w-4.5 rounded-full border-2 border-cyan-500 dark:border-cyan-400 border-t-transparent animate-spin" />
                      ) : isApproval ? (
                        <ShieldAlert className="h-5 w-5 text-amber-500 dark:text-amber-400 animate-bounce" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[9px] text-slate-600 dark:text-slate-400 font-mono">
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">
                        {step.title}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-1 shrink-0">
                    <span className="rounded bg-slate-200 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 font-mono text-[9px] text-slate-700 dark:text-slate-300 uppercase">
                      {step.service}
                    </span>
                    {step.durationMs && (
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                        {step.durationMs}ms
                      </span>
                    )}
                  </div>
                </div>

                {/* Output Details Accordion */}
                {step.output && expandedStepId === step.id && (
                  <div className="mt-3 rounded-xl bg-slate-900 dark:bg-slate-950/90 p-2.5 font-mono text-[10px] text-cyan-300 border border-slate-800">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(step.output, null, 2)}</pre>
                  </div>
                )}

                {/* Human-in-the-Loop Approval Action */}
                {isApproval && (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-500/15 p-2.5 border border-amber-500/40">
                    <div className="flex items-center space-x-1.5 text-xs text-amber-800 dark:text-amber-200 font-medium">
                      <ShieldAlert className="h-4 w-4 text-amber-500 dark:text-amber-300 shrink-0" />
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
      </section>

      {/* ========================================================= */}
      {/* 5. GENUINE GOOGLE WORKSPACE WORKFLOW CARD                 */}
      {/* ========================================================= */}
      <section aria-label="Genuine Google Workspace Workflow">
        <GenuineWorkspaceWorkflow
          accessToken={accessToken}
          onLogin={onLogin}
          onRequestTaskConfirmation={onRequestTaskConfirmation}
        />
      </section>

      {/* ========================================================= */}
      {/* 6. SMART DISPLAY GLANCE HUB (Echo Show Ambient Mode)      */}
      {/* ========================================================= */}
      <section aria-label="Smart Display Glance Hub" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
            Ambient Glance Hub (Smart Display Mode)
          </h3>
          <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono">Live Google Sync</span>
        </div>
        <SmartDisplayHub
          events={events}
          messages={messages}
          tasks={tasks}
          hasGoogleToken={hasGoogleToken}
          onNavigate={onNavigate}
          onSceneActivate={onSceneActivate}
        />
      </section>
    </div>
  );
};
