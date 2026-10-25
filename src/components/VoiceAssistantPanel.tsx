import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
  Square,
  CornerDownLeft,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { AudioWaveformVisualizer } from './AudioWaveformVisualizer';

interface VoiceAssistantPanelProps {
  audioStatus: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
  transcript: string;
  assistantReply: string;
  isListening: boolean;
  onToggleListening: () => void;
  onInterrupt: () => void;
  onSendMessage: (text: string) => void;
  onQuickPrompt: (prompt: string) => void;
}

export const VoiceAssistantPanel: React.FC<VoiceAssistantPanelProps> = ({
  audioStatus,
  transcript,
  assistantReply,
  isListening,
  onToggleListening,
  onInterrupt,
  onSendMessage,
  onQuickPrompt,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const quickPrompts = [
    { label: 'Review my agenda', query: 'What meetings and events do I have on Google Calendar today?' },
    { label: 'Check unread emails', query: 'Summarize my unread Gmail messages and critical updates.' },
    { label: 'Add priority task', query: 'Add a high priority task to review the Alexa+ Hackathon demo.' },
    { label: 'Order espresso pods', query: 'Stage an order for Nespresso Vertuo pods in my commerce cart.' },
    { label: 'Trigger morning scene', query: 'Execute my morning ambient workflow and adjust lighting.' },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-cyan-500/20 bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-[#0b0f19] dark:via-[#090d18] dark:to-[#07090e] p-6 shadow-xl dark:shadow-2xl shadow-slate-200/50 dark:shadow-cyan-950/30 sm:p-8 transition-colors">
      {/* Background ambient glow effect */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-96 rounded-full bg-cyan-500/10 dark:bg-cyan-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-64 w-80 rounded-full bg-purple-500/10 blur-3xl" />

      {/* Central Interactive Voice Orb */}
      <div className="relative flex flex-col items-center justify-center py-6">
        <div className="relative flex items-center justify-center">
          {/* Animated concentric ripples during speech/listening */}
          {(audioStatus === 'listening' || audioStatus === 'speaking' || audioStatus === 'thinking') && (
            <>
              <div className="absolute h-48 w-48 rounded-full border border-cyan-400/30 animate-ping" />
              <div className="absolute h-40 w-40 rounded-full border border-indigo-500/30 animate-pulse" />
            </>
          )}

          {/* Main glowing sphere button */}
          <button
            onClick={audioStatus === 'speaking' ? onInterrupt : onToggleListening}
            className={`group relative flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-full transition-all duration-500 cursor-pointer ${
              audioStatus === 'listening'
                ? 'scale-105 shadow-[0_0_50px_rgba(6,182,212,0.6)]'
                : audioStatus === 'speaking'
                ? 'scale-105 shadow-[0_0_50px_rgba(168,85,247,0.6)]'
                : audioStatus === 'thinking'
                ? 'shadow-[0_0_40px_rgba(245,158,11,0.5)]'
                : 'hover:scale-105 shadow-[0_0_35px_rgba(6,182,212,0.25)]'
            }`}
          >
            {/* Multi-layered orb gradients */}
            <div
              className={`absolute inset-0 rounded-full transition-all duration-700 ${
                audioStatus === 'listening'
                  ? 'bg-gradient-to-tr from-cyan-600 via-teal-400 to-cyan-300 animate-spin-slow'
                  : audioStatus === 'speaking'
                  ? 'bg-gradient-to-tr from-purple-600 via-indigo-500 to-pink-400 animate-pulse'
                  : audioStatus === 'thinking'
                  ? 'bg-gradient-to-tr from-amber-500 via-orange-400 to-cyan-400 animate-pulse'
                  : 'bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-800 opacity-90 group-hover:opacity-100'
              }`}
            />

            {/* Inner glass sphere */}
            <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full bg-white/80 dark:bg-[#07090e]/70 backdrop-blur-md border border-white/40 dark:border-white/20 shadow-inner">
              {audioStatus === 'speaking' ? (
                <div className="flex flex-col items-center">
                  <Square className="h-7 w-7 text-purple-600 dark:text-purple-300 fill-current animate-pulse" />
                  <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-200 mt-1 uppercase tracking-wider">
                    Stop
                  </span>
                </div>
              ) : isListening ? (
                <div className="flex flex-col items-center">
                  <Mic className="h-8 w-8 text-cyan-600 dark:text-cyan-300 animate-bounce" />
                  <span className="text-[10px] font-semibold text-cyan-700 dark:text-cyan-200 mt-1 uppercase tracking-wider">
                    Listening
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Mic className="h-7 w-7 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 mt-1 uppercase tracking-wider">
                    Tap to speak
                  </span>
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Ambient status description */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center space-x-2 rounded-full border border-slate-200 dark:border-cyan-500/20 bg-slate-100 dark:bg-cyan-950/40 px-3 py-1 shadow-xs">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                audioStatus === 'listening'
                  ? 'bg-cyan-400 animate-ping'
                  : audioStatus === 'speaking'
                  ? 'bg-purple-400 animate-pulse'
                  : audioStatus === 'thinking'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-slate-400 dark:bg-slate-500'
              }`}
            />
            <span className="text-xs font-medium text-slate-800 dark:text-cyan-300">
              {audioStatus === 'listening'
                ? 'Listening to natural voice...'
                : audioStatus === 'thinking'
                ? 'Reasoning with Gemini 3.8 Flash...'
                : audioStatus === 'speaking'
                ? 'Synthesizing voice response...'
                : 'Nexus ambient listener standing by'}
            </span>
          </div>
        </div>

        {/* Enhanced SVG Audio Waveform & Frequency Bar Visualizer */}
        <div className="mt-4 w-full max-w-lg h-20 flex items-center justify-center px-4">
          <AudioWaveformVisualizer status={audioStatus} variant="banner" barCount={28} />
        </div>
      </div>

      {/* Transcript & Response Area */}
      <div className="mt-2 space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 p-4 shadow-xs backdrop-blur-md transition-colors">
        {transcript && (
          <div className="flex items-start space-x-3 text-xs sm:text-sm">
            <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-700 dark:text-cyan-400 uppercase">
              You
            </span>
            <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed italic">
              "{transcript}"
            </p>
          </div>
        )}

        <div className="flex items-start space-x-3 text-xs sm:text-sm">
          <span className="rounded-md bg-purple-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase flex items-center space-x-1">
            <Sparkles className="h-3 w-3" />
            <span>Nexus</span>
          </span>
          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
            {assistantReply ||
              'Standing by. Ask me about your Google Calendar schedule, Gmail inbox summaries, Google Tasks, or trigger multi-step ambient workflows.'}
          </p>
        </div>
      </div>

      {/* Fallback Text Input Form */}
      <form onSubmit={handleSubmit} className="mt-4 flex items-center space-x-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a voice command or request (e.g., 'Summarize my inbox')..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-all focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/60"
          />
        </div>
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 transition-all hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Execute</span>
        </button>
      </form>

      {/* Quick Prompts */}
      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Suggested Ambient Commands
        </div>
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => onQuickPrompt(p.query)}
              className="rounded-lg border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:border-cyan-500/40 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 hover:text-cyan-700 dark:hover:text-cyan-300 transition-all shadow-xs"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
