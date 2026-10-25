import React, { useState, useEffect, useRef } from 'react';
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
  Radio,
  FileAudio,
  Activity,
  Play,
  RotateCcw,
  Copy,
  Check,
  Zap,
} from 'lucide-react';
import { AudioWaveformVisualizer } from './AudioWaveformVisualizer';
import { GeminiLiveClient } from '../lib/geminiLiveClient';
import { audioRecorder } from '../lib/audioRecorder';
import { transcribeAudio } from '../lib/gemini';

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
  // Mode selection: 'ambient' | 'live' | 'transcribe'
  const [activeMode, setActiveMode] = useState<'ambient' | 'live' | 'transcribe'>('ambient');
  const [inputText, setInputText] = useState('');

  // -------------------------------------------------------------
  // 1. Live API (gemini-3.8-live) State
  // -------------------------------------------------------------
  const [liveStatus, setLiveStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error'
  >('disconnected');
  const [liveTranscriptHistory, setLiveTranscriptHistory] = useState<
    Array<{ role: 'user' | 'model'; text: string; time: string }>
  >([]);
  const [liveError, setLiveError] = useState<string | null>(null);
  const liveClientRef = useRef<GeminiLiveClient | null>(null);

  // Initialize live client once
  useEffect(() => {
    const client = new GeminiLiveClient({
      onStatusChange: (status) => setLiveStatus(status),
      onTranscript: (text, isModel) => {
        setLiveTranscriptHistory((prev) => [
          ...prev,
          {
            role: isModel ? 'model' : 'user',
            text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          },
        ]);
      },
      onError: (err) => setLiveError(err),
      onInterrupted: () => console.log('[Live] Interrupted by user'),
    });
    liveClientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, []);

  const handleToggleLiveSession = async () => {
    if (!liveClientRef.current) return;

    if (liveStatus === 'listening' || liveStatus === 'speaking' || liveStatus === 'connected') {
      liveClientRef.current.stopMicrophone();
      liveClientRef.current.disconnect();
      setLiveStatus('disconnected');
    } else {
      setLiveError(null);
      try {
        await liveClientRef.current.connect();
        await liveClientRef.current.startMicrophone();
      } catch (err: any) {
        setLiveError(err.message || 'Could not start Live Voice session');
      }
    }
  };

  const handleLiveBargeIn = () => {
    if (liveClientRef.current) {
      liveClientRef.current.interrupt();
    }
  };

  // -------------------------------------------------------------
  // 2. Audio Transcription (gemini-3.5-transcribe) State
  // -------------------------------------------------------------
  const [isRecordingTranscribe, setIsRecordingTranscribe] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeResult, setTranscribeResult] = useState<{
    text: string;
    model: string;
    status: string;
  } | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (isRecordingTranscribe) {
      setRecordTimer(0);
      timerRef.current = setInterval(() => {
        setRecordTimer((t) => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecordingTranscribe]);

  const handleStartTranscribeRecord = async () => {
    setTranscribeError(null);
    setTranscribeResult(null);
    try {
      await audioRecorder.start();
      setIsRecordingTranscribe(true);
    } catch (err: any) {
      setTranscribeError(err.message || 'Microphone access denied');
    }
  };

  const handleStopAndTranscribe = async () => {
    if (!audioRecorder.isRecording()) return;

    setIsRecordingTranscribe(false);
    setIsTranscribing(true);
    setTranscribeError(null);

    try {
      const audioBlob = await audioRecorder.stop();
      const res = await transcribeAudio(audioBlob, 'Transcribe this voice command accurately.');
      setTranscribeResult(res);
    } catch (err: any) {
      setTranscribeError(err.message || 'Failed to transcribe audio clip');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopyTranscript = () => {
    if (!transcribeResult?.text) return;
    navigator.clipboard.writeText(transcribeResult.text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const handleExecuteTranscribe = () => {
    if (!transcribeResult?.text) return;
    onSendMessage(transcribeResult.text);
    setActiveMode('ambient');
  };

  // -------------------------------------------------------------
  // 3. Ambient Assistant Controls
  // -------------------------------------------------------------
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

      {/* Top Capability Navigation Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200 dark:border-slate-800/80">
          <button
            onClick={() => setActiveMode('ambient')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeMode === 'ambient'
                ? 'bg-white dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 shadow-xs border border-slate-200 dark:border-cyan-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
            <span>Ambient Assistant</span>
          </button>

          <button
            onClick={() => setActiveMode('live')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeMode === 'live'
                ? 'bg-white dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 shadow-xs border border-slate-200 dark:border-purple-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Radio className="h-3.5 w-3.5 text-purple-500 animate-pulse" />
            <span>Live Voice</span>
            <span className="text-[10px] bg-purple-500/20 text-purple-600 dark:text-purple-300 px-1 rounded font-mono">
              gemini-3.8-live
            </span>
          </button>

          <button
            onClick={() => setActiveMode('transcribe')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeMode === 'transcribe'
                ? 'bg-white dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 shadow-xs border border-slate-200 dark:border-emerald-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileAudio className="h-3.5 w-3.5 text-emerald-500" />
            <span>Transcribe Audio</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 px-1 rounded font-mono">
              gemini-3.5-transcribe
            </span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center space-x-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Server Verified</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODE 1: AMBIENT ASSISTANT (Default)                      */}
      {/* ========================================================= */}
      {activeMode === 'ambient' && (
        <>
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
        </>
      )}

      {/* ========================================================= */}
      {/* MODE 2: LIVE VOICE CONVERSATIONS (gemini-3.8-live)        */}
      {/* ========================================================= */}
      {activeMode === 'live' && (
        <div className="py-4 space-y-6">
          <div className="flex flex-col items-center justify-center text-center">
            {/* Live Status indicator */}
            <div className="inline-flex items-center space-x-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 py-1 text-xs text-purple-700 dark:text-purple-300 font-mono mb-4">
              <span
                className={`h-2 w-2 rounded-full ${
                  liveStatus === 'speaking'
                    ? 'bg-pink-400 animate-ping'
                    : liveStatus === 'listening'
                    ? 'bg-purple-400 animate-pulse'
                    : liveStatus === 'connected'
                    ? 'bg-emerald-400'
                    : 'bg-slate-400'
                }`}
              />
              <span className="font-semibold uppercase tracking-wider">
                Model: gemini-3.8-live &bull; {liveStatus}
              </span>
            </div>

            {/* Central Live Button */}
            <button
              onClick={handleToggleLiveSession}
              className={`group relative flex h-32 w-32 items-center justify-center rounded-full transition-all duration-500 cursor-pointer ${
                liveStatus === 'listening' || liveStatus === 'speaking'
                  ? 'scale-105 shadow-[0_0_55px_rgba(168,85,247,0.7)]'
                  : 'hover:scale-105 shadow-[0_0_35px_rgba(168,85,247,0.3)]'
              }`}
            >
              <div
                className={`absolute inset-0 rounded-full transition-all duration-700 ${
                  liveStatus === 'speaking'
                    ? 'bg-gradient-to-tr from-purple-600 via-pink-500 to-indigo-400 animate-pulse'
                    : liveStatus === 'listening'
                    ? 'bg-gradient-to-tr from-purple-600 via-indigo-500 to-cyan-400 animate-spin-slow'
                    : 'bg-gradient-to-tr from-purple-700 via-slate-800 to-purple-900'
                }`}
              />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white/90 dark:bg-[#07090e]/80 backdrop-blur-md border border-purple-400/40 shadow-inner">
                {liveStatus === 'listening' || liveStatus === 'speaking' ? (
                  <div className="flex flex-col items-center">
                    <Square className="h-8 w-8 text-purple-600 dark:text-purple-300 fill-current animate-pulse" />
                    <span className="text-[10px] font-bold text-purple-700 dark:text-purple-200 mt-1 uppercase tracking-wider">
                      Disconnect
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Radio className="h-8 w-8 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 mt-1 uppercase tracking-wider">
                      Start Live
                    </span>
                  </div>
                )}
              </div>
            </button>

            {/* Live Audio Visualizer */}
            <div className="mt-4 w-full max-w-lg h-20 flex items-center justify-center px-4">
              <AudioWaveformVisualizer
                status={
                  liveStatus === 'speaking'
                    ? 'speaking'
                    : liveStatus === 'listening'
                    ? 'listening'
                    : liveStatus === 'connected'
                    ? 'listening'
                    : 'idle'
                }
                variant="banner"
                barCount={32}
              />
            </div>

            {/* Barge-in / Interruption Action */}
            {liveStatus === 'speaking' && (
              <button
                onClick={handleLiveBargeIn}
                className="mt-2 inline-flex items-center space-x-1.5 rounded-full border border-pink-500/40 bg-pink-500/10 px-4 py-1.5 text-xs font-semibold text-pink-600 dark:text-pink-300 hover:bg-pink-500/20 transition-all"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Barge-in / Interrupt AI</span>
              </button>
            )}

            {liveError && (
              <div className="mt-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg max-w-md">
                {liveError}
              </div>
            )}
          </div>

          {/* Real-time Streaming Transcript */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-4 max-h-60 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="flex items-center space-x-1.5">
                <Activity className="h-3.5 w-3.5 text-purple-500" />
                <span>Live Audio Stream Log (/api/live-stream)</span>
              </span>
              <span className="text-[11px] font-mono">24kHz PCM Duplex</span>
            </div>

            {liveTranscriptHistory.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4 italic">
                Connect and speak naturally. Real-time conversational audio streamed directly with gemini-3.8-live.
              </p>
            ) : (
              liveTranscriptHistory.map((item, idx) => (
                <div key={idx} className="flex items-start space-x-2 text-xs">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                      item.role === 'model'
                        ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
                        : 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                    }`}
                  >
                    {item.role === 'model' ? 'Gemini 3.8 Live' : 'You'}
                  </span>
                  <p className="text-slate-800 dark:text-slate-200 flex-1 leading-relaxed">{item.text}</p>
                  <span className="text-[10px] text-slate-400 font-mono">{item.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODE 3: TRANSCRIBE AUDIO (gemini-3.5-transcribe)          */}
      {/* ========================================================= */}
      {activeMode === 'transcribe' && (
        <div className="py-4 space-y-6">
          <div className="flex flex-col items-center justify-center text-center">
            {/* Status indicator */}
            <div className="inline-flex items-center space-x-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs text-emerald-700 dark:text-emerald-300 font-mono mb-4">
              <span
                className={`h-2 w-2 rounded-full ${
                  isRecordingTranscribe ? 'bg-rose-500 animate-ping' : 'bg-emerald-400'
                }`}
              />
              <span className="font-semibold uppercase tracking-wider">
                Model: gemini-3.5-transcribe &bull;{' '}
                {isRecordingTranscribe ? `Recording (${recordTimer}s)` : isTranscribing ? 'Transcribing...' : 'Ready'}
              </span>
            </div>

            {/* Central Record Button */}
            <div className="flex items-center space-x-4">
              {!isRecordingTranscribe ? (
                <button
                  onClick={handleStartTranscribeRecord}
                  disabled={isTranscribing}
                  className="group relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 p-1 shadow-lg shadow-emerald-500/30 hover:scale-105 transition-all cursor-pointer disabled:opacity-50"
                >
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white dark:bg-[#07090e] border border-emerald-400/30">
                    <div className="flex flex-col items-center">
                      <Mic className="h-8 w-8 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mt-1 uppercase tracking-wider">
                        Record
                      </span>
                    </div>
                  </div>
                </button>
              ) : (
                <button
                  onClick={handleStopAndTranscribe}
                  className="group relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-tr from-rose-600 to-orange-500 p-1 shadow-lg shadow-rose-500/40 scale-105 animate-pulse transition-all cursor-pointer"
                >
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white dark:bg-[#07090e] border border-rose-400/40">
                    <div className="flex flex-col items-center">
                      <Square className="h-7 w-7 text-rose-600 dark:text-rose-400 fill-current" />
                      <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 mt-1 uppercase tracking-wider">
                        Stop ({recordTimer}s)
                      </span>
                    </div>
                  </div>
                </button>
              )}
            </div>

            <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 max-w-sm">
              Speak a complex task, memo, or query. Microphone audio will be recorded and transcribed with{' '}
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                gemini-3.5-transcribe
              </span>
              .
            </p>

            {transcribeError && (
              <div className="mt-3 text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg max-w-md">
                {transcribeError}
              </div>
            )}
          </div>

          {/* Transcription Results Card */}
          {transcribeResult && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span>Transcription Result ({transcribeResult.model})</span>
                </span>
                <button
                  onClick={handleCopyTranscript}
                  className="flex items-center space-x-1 text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  {copiedTranscript ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedTranscript ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="rounded-xl bg-white dark:bg-slate-900/80 p-3.5 border border-emerald-200 dark:border-emerald-800/60">
                <p className="text-sm text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
                  "{transcribeResult.text}"
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  onClick={handleStartTranscribeRecord}
                  className="flex items-center space-x-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Record Again</span>
                </button>
                <button
                  onClick={handleExecuteTranscribe}
                  className="flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-500/20 hover:opacity-95"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Execute in Nexus</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
