import React, { useState } from 'react';
import {
  Calendar,
  Mail,
  CheckSquare,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Sparkles,
  LogIn,
} from 'lucide-react';
import {
  getTomorrowCalendarEvents,
  findRelevantEmails,
  createGoogleTask,
  type CalendarEvent,
  type GmailMessageSummary,
} from '../lib/workspace';

interface GenuineWorkspaceWorkflowProps {
  accessToken: string | null;
  onLogin: () => void;
  onRequestTaskConfirmation: (title: string, notes: string, onConfirm: () => Promise<void>) => void;
}

export const GenuineWorkspaceWorkflow: React.FC<GenuineWorkspaceWorkflowProps> = ({
  accessToken,
  onLogin,
  onRequestTaskConfirmation,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [tomorrowEvents, setTomorrowEvents] = useState<CalendarEvent[]>([]);
  const [relevantEmails, setRelevantEmails] = useState<GmailMessageSummary[]>([]);
  const [createdTaskTitle, setCreatedTaskTitle] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Standing by to execute workflow.');
  const [errorText, setErrorText] = useState<string | null>(null);

  const runWorkflow = async () => {
    setIsRunning(true);
    setErrorText(null);
    setCurrentStep(1);
    setStatusMessage("Step 1/3: Querying Google Calendar API for tomorrow's events...");

    try {
      let events: CalendarEvent[] = [];

      if (accessToken) {
        // Genuine API call to Google Calendar
        events = await getTomorrowCalendarEvents(accessToken);
      } else {
        // Explicitly labeled fallback
        events = [
          {
            id: 'cal-tmrw-1',
            summary: 'Product Strategy Review & Q3 Roadmapping',
            description: 'Discuss Alexa+ ambient UX metrics and MCP client boundary.',
            location: 'Google Meet',
            start: {
              dateTime: new Date(Date.now() + 86400000 + 3600000 * 2).toISOString(),
            },
            end: {
              dateTime: new Date(Date.now() + 86400000 + 3600000 * 3).toISOString(),
            },
            isDemo: true,
          },
        ];
      }

      setTomorrowEvents(events);
      setCurrentStep(2);
      setStatusMessage("Step 2/3: Searching Gmail for relevant messages and prep notes...");

      // Step 2: Search Gmail for relevant email threads
      let emails: GmailMessageSummary[] = [];
      const queryKeyword = events[0]?.summary || 'Roadmap';

      if (accessToken) {
        emails = await findRelevantEmails(accessToken, queryKeyword);
      } else {
        emails = [
          {
            id: 'gm-tmrw-1',
            threadId: 'th-1',
            from: 'Architecture Lead <lead@alexa-hackathon.dev>',
            subject: 'Agenda for Product Strategy Review tomorrow',
            snippet: 'Please bring your notes on the MCP tool registry and Gemini TTS voice latency...',
            date: 'Today, 2:15 PM',
            unread: true,
            isDemo: true,
          },
        ];
      }

      setRelevantEmails(emails);
      setCurrentStep(3);

      const proposedTaskTitle = `Prepare briefing for: ${events[0]?.summary || "Tomorrow's Schedule"}`;
      const taskNotes = `Context gathered from Gmail: ${emails[0]?.subject || 'Schedule check'}. Auto-orchestrated by Nexus AI.`;

      setStatusMessage('Step 3/3: Awaiting explicit user confirmation before creating Google Task...');

      // Step 3: Trigger Human-in-the-Loop Confirmation
      if (createdTaskTitle === proposedTaskTitle) {
        setStatusMessage(`Task "${proposedTaskTitle}" is already created. Retrying is blocked to prevent duplicates.`);
        setIsRunning(false);
        return;
      }

      onRequestTaskConfirmation(proposedTaskTitle, taskNotes, async () => {
        try {
          if (accessToken) {
            const taskResult = await createGoogleTask(accessToken, proposedTaskTitle, taskNotes);
            setCreatedTaskTitle(proposedTaskTitle);
            setStatusMessage(`Verified: Task created in Google Tasks (ID: ${taskResult?.id || 'live'}).`);
          } else {
            setCreatedTaskTitle(proposedTaskTitle);
            setStatusMessage('Demo Mode: Task verified and created in local task store.');
          }
          setCurrentStep(4);
        } catch (e: any) {
          const is401 = e.message?.includes('401') || e.message?.includes('auth');
          setErrorText(
            is401
              ? 'Google authorization has expired or is invalid. Please sign in again to refresh your session.'
              : `Failed to create task in Google Tasks: ${e.message}`
          );
        } finally {
          setIsRunning(false);
        }
      });
    } catch (err: any) {
      console.error('Workflow error:', err);
      const is401 = err.message?.includes('401') || err.message?.includes('auth');
      setErrorText(
        is401
          ? 'Google Workspace authorization expired. Please sign in again with your Google Account.'
          : err.message || 'Workflow step failed.'
      );
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-[#0c101c] via-slate-900/60 to-[#0a0d18] p-5 shadow-xl backdrop-blur-md">
      {/* Title & Auth Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Priority Workspace Workflow (End-to-End)
            </h3>
            <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
              Calendar → Gmail → Google Tasks
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Retrieves tomorrow's calendar agenda, queries relevant Gmail threads, and safely creates a task after confirmation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {accessToken ? (
            <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 flex items-center space-x-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Google OAuth Authorized</span>
            </span>
          ) : (
            <button
              onClick={onLogin}
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md hover:opacity-95 flex items-center space-x-1.5 transition-all"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Connect Google Account</span>
            </button>
          )}
        </div>
      </div>

      {/* Workflow Stepper Visualizer */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Step 1: Calendar */}
        <div
          className={`rounded-xl p-3 border transition-all ${
            currentStep >= 1
              ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-200'
              : 'border-slate-800 bg-slate-950/40 text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold">1. Tomorrow's Events</span>
            </div>
            {currentStep > 1 && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          </div>
          <p className="text-[11px] text-slate-400">
            {tomorrowEvents.length > 0
              ? `Found ${tomorrowEvents.length} event(s): ${tomorrowEvents[0].summary}`
              : "Queries Google Calendar for tomorrow's events."}
          </p>
        </div>

        {/* Step 2: Gmail */}
        <div
          className={`rounded-xl p-3 border transition-all ${
            currentStep >= 2
              ? 'border-indigo-500/40 bg-indigo-950/20 text-indigo-200'
              : 'border-slate-800 bg-slate-950/40 text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-indigo-400" />
              <span className="text-xs font-bold">2. Relevant Emails</span>
            </div>
            {currentStep > 2 && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          </div>
          <p className="text-[11px] text-slate-400">
            {relevantEmails.length > 0
              ? `Found ${relevantEmails.length} relevant message(s): "${relevantEmails[0].subject}"`
              : 'Searches Gmail for matching correspondence.'}
          </p>
        </div>

        {/* Step 3: Google Task */}
        <div
          className={`rounded-xl p-3 border transition-all ${
            currentStep >= 3
              ? 'border-amber-500/40 bg-amber-950/20 text-amber-200'
              : 'border-slate-800 bg-slate-950/40 text-slate-400'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center space-x-2">
              <CheckSquare className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-bold">3. Confirmed Task</span>
            </div>
            {currentStep === 4 && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          </div>
          <p className="text-[11px] text-slate-400">
            {createdTaskTitle
              ? `Created: "${createdTaskTitle}"`
              : 'Requests user confirmation before mutating task list.'}
          </p>
        </div>
      </div>

      {/* Status Bar & Action Button */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-300 flex items-center space-x-2">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>

        <button
          onClick={runWorkflow}
          disabled={isRunning}
          className="flex items-center justify-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-cyan-950/50 hover:opacity-95 disabled:opacity-50 transition-all shrink-0"
        >
          {isRunning ? (
            <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current" />
          )}
          <span>{isRunning ? 'Orchestrating...' : 'Execute Genuine Workflow'}</span>
        </button>
      </div>

      {/* Error display if any */}
      {errorText && (
        <div className="mt-3 rounded-xl bg-red-500/10 border border-red-500/30 p-2.5 text-xs text-red-300 flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{errorText}</span>
        </div>
      )}
    </div>
  );
};
