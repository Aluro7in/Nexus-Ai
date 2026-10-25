import React, { useState } from 'react';
import {
  Sparkles,
  Mic,
  Calendar,
  Mail,
  CheckSquare,
  Workflow,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  Radio,
  Volume2,
  Key,
  Laptop,
  CheckCircle2,
  Play,
  RotateCcw,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import { AudioWaveformVisualizer } from './AudioWaveformVisualizer';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  user: FirebaseUser | null;
  hasGoogleToken: boolean;
  onLogin: () => void;
  onSampleVoicePrompt: (prompt: string) => void;
  audioStatus: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
  isListening: boolean;
  onToggleListening: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  user,
  hasGoogleToken,
  onLogin,
  onSampleVoicePrompt,
  audioStatus,
  isListening,
  onToggleListening,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 4;

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const samplePrompts = [
    {
      label: 'Google Calendar Agenda',
      text: 'What meetings and events do I have on Google Calendar today?',
      category: 'Calendar',
    },
    {
      label: 'Gmail Inbox Summary',
      text: 'Summarize my unread Gmail messages and priority notifications.',
      category: 'Gmail',
    },
    {
      label: 'Alexa+ Hackathon Checklist',
      text: 'Review the Amazon Alexa+ Hackathon submission checklist and tasks.',
      category: 'Tasks',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto transition-all"
    >
      <div className="relative w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-cyan-500/20 bg-white dark:bg-[#090d18] shadow-2xl shadow-cyan-950/40 overflow-hidden flex flex-col my-auto transition-colors">
        {/* Subtle Top Ambient Gradient Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-500/20">
              <Radio className="h-4 w-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white font-['Plus_Jakarta_Sans']">
                  NEXUS AI
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">
                  Welcome & Onboarding
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Step {currentStep} of {totalSteps}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors px-2 py-1"
            >
              Skip
            </button>
            <button
              onClick={onClose}
              aria-label="Close onboarding modal"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Step Progress Indicators */}
        <div className="px-6 pt-4 pb-1">
          <div className="grid grid-cols-4 gap-2">
            {[
              { num: 1, label: 'Core Features' },
              { num: 2, label: 'Voice Model' },
              { num: 3, label: 'Workspace Sync' },
              { num: 4, label: 'Launch OS' },
            ].map((step) => {
              const isPast = currentStep > step.num;
              const isCurrent = currentStep === step.num;
              return (
                <button
                  key={step.num}
                  onClick={() => setCurrentStep(step.num)}
                  className="flex flex-col text-left group transition-all"
                >
                  <div
                    className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                      isPast
                        ? 'bg-cyan-500'
                        : isCurrent
                        ? 'bg-gradient-to-r from-cyan-500 to-indigo-500'
                        : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  />
                  <span
                    className={`mt-1.5 text-[11px] font-medium truncate ${
                      isCurrent
                        ? 'text-cyan-600 dark:text-cyan-400 font-semibold'
                        : isPast
                        ? 'text-slate-700 dark:text-slate-300'
                        : 'text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    0{step.num}. {step.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto max-h-[65vh]">
          {/* STEP 1: Core Features Introduction */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <h3
                  id="onboarding-title"
                  className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight"
                >
                  01. The Ambient Operating System for Alexa+
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Nexus AI is an ambient operating system combining Gemini 3.8 Flash intelligence, real-time voice synthesis, multimodal display hub glanceability, and real Google Workspace synchronization.
                </p>
              </div>

              {/* 4 Feature Pillars Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4 transition-all hover:border-cyan-500/40">
                  <div className="flex items-center space-x-2.5 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400">
                      <Mic className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Voice-First Interaction
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Speech synthesis & waveforms
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Speak naturally without wake words. View animated SVG waveforms in real time and interrupt the assistant with zero latency.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4 transition-all hover:border-indigo-500/40">
                  <div className="flex items-center space-x-2.5 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Google Workspace 1P Sync
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Calendar, Gmail & Tasks
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Live schedule synchronization, inbox triage, and automated action task generation with strict in-memory token safety.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4 transition-all hover:border-purple-500/40">
                  <div className="flex items-center space-x-2.5 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                      <Workflow className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Agentic Workflows
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Multi-step automation
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Orchestrates morning briefings, pantry replenishment, and Matter smart lighting scenes across connected services.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4 transition-all hover:border-emerald-500/40">
                  <div className="flex items-center space-x-2.5 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        Human-in-the-Loop Safety
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Strict confirmation gates
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Consequential operations—such as staging commerce orders or sending emails—always require explicit user approval.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Voice Interaction Model */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  02. The Voice Interaction Model
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Nexus AI offers a natural, voice-driven experience designed for ambient smart displays and keyboard-driven desktops.
                </p>
              </div>

              {/* 3 Interaction Pillars */}
              <div className="space-y-3">
                <div className="flex items-start space-x-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5">
                    <Mic className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      1. Push to Talk or Tap the Voice Orb
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
                      Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono font-semibold">Space</kbd> on your keyboard or tap the center orb to start listening. Active listening is indicated with luminous cyan frequency bars.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5">
                    <Volume2 className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      2. Real-Time Speech Synthesis (Zephyr Voice)
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
                      Responses are audibly generated via Gemini 3.8 Flash Lite TTS, shifting the waveform to purple frequency bars.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      3. Speech Interruption & Barge-In
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
                      Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono font-semibold">Escape</kbd> or click the Stop button to immediately silence audio output and issue your next command.
                    </p>
                  </div>
                </div>
              </div>

              {/* Interactive Audio Waveform Sandbox */}
              <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                    <Radio className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                    <span>Interactive Waveform Tester</span>
                  </span>
                  <span className="font-mono text-[11px] text-cyan-400 uppercase">
                    Status: {audioStatus}
                  </span>
                </div>

                <div className="h-16 w-full rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-center px-2">
                  <AudioWaveformVisualizer
                    status={audioStatus}
                    variant="banner"
                    barCount={26}
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Try a sample voice command:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {samplePrompts.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => onSampleVoicePrompt(p.text)}
                        className="flex items-center space-x-1.5 rounded-lg border border-slate-800 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-300 transition-colors"
                      >
                        <Play className="h-3 w-3 text-cyan-400" />
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Connect First Google Service */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  03. Connect Your Google Workspace
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Link Google Calendar, Gmail, and Google Tasks to allow Nexus AI to query schedules, summarize unread mail, and draft actionable tasks.
                </p>
              </div>

              {/* Service Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3.5 space-y-1.5">
                  <div className="flex items-center space-x-2 text-cyan-600 dark:text-cyan-400 font-bold text-xs">
                    <Calendar className="h-4 w-4" />
                    <span>Google Calendar</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Live 24-hr schedule bounds, conflict detection, and agenda briefings.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3.5 space-y-1.5">
                  <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                    <Mail className="h-4 w-4" />
                    <span>Gmail Inbox</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Triage unread messages and extract action items into your daily plan.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3.5 space-y-1.5">
                  <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    <CheckSquare className="h-4 w-4" />
                    <span>Google Tasks</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Draft, organize, and prioritize tasks with explicit user confirmation.
                  </p>
                </div>
              </div>

              {/* Connection Status Box */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Workspace Connection Status:
                      </span>
                      {hasGoogleToken && user ? (
                        <span className="flex items-center space-x-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Connected</span>
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          Not Connected (Running Demo Data)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {hasGoogleToken && user
                        ? `Signed in as ${user.displayName || user.email} with active in-memory OAuth token.`
                        : 'Connect your Google account to grant read-only Calendar and Gmail scopes.'}
                    </p>
                  </div>

                  {hasGoogleToken && user ? (
                    <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                      <Check className="h-4 w-4" />
                      <span>Workspace Ready</span>
                    </div>
                  ) : (
                    <button
                      onClick={onLogin}
                      className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 hover:opacity-95 transition-all"
                    >
                      <Key className="h-3.5 w-3.5" />
                      <span>Connect Google Account</span>
                    </button>
                  )}
                </div>

                {/* Privacy & Security Disclaimer */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 flex items-start space-x-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>In-Memory Token Safety:</strong> Google OAuth tokens are held only in browser memory during your active session. Tokens are never written to local storage, cookies, or public repositories.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Ready to Launch Ambient OS */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in duration-200 text-center py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-indigo-600 to-purple-600 text-white shadow-xl shadow-cyan-500/25">
                <Check className="h-8 w-8 stroke-[2.5]" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  04. Nexus AI Is Ready
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Your ambient operating system is configured. You can now command workflows, interact via voice, and monitor your schedule in real time.
                </p>
              </div>

              {/* Ready Checklist */}
              <div className="max-w-md mx-auto text-left rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 p-4 space-y-2.5 text-xs">
                <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Voice assistant initialized with Zephyr speech synthesis</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Ambient Echo Show mode ready on the Home glance hub</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Human-in-the-loop confirmation gates active for all write tools</span>
                </div>
                <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Replay this onboarding guide anytime from Navigation or Settings</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/60">
          <div>
            {currentStep > 1 ? (
              <button
                onClick={handlePrev}
                className="flex items-center space-x-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Previous</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              >
                Skip Walkthrough
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {currentStep < totalSteps ? (
              <button
                onClick={handleNext}
                className="flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 hover:opacity-95 transition-all"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={onComplete}
                className="flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 hover:opacity-95 transition-all"
              >
                <span>Launch Ambient OS</span>
                <Sparkles className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
