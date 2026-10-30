import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  Square,
  Radio,
  FileAudio,
  Activity,
  RotateCcw,
  Copy,
  Check,
  Zap,
  AlertCircle,
  Clock,
  Layers,
  Flame,
} from 'lucide-react';
import { AudioWaveformVisualizer } from './AudioWaveformVisualizer';
import { GeminiLiveClient } from '../lib/geminiLiveClient';
import { audioRecorder } from '../lib/audioRecorder';
import { transcribeAudio } from '../lib/gemini';

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';

interface VoiceAssistantPanelProps {
  audioStatus: VoiceState;
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
  // Mode selection: 'live' (Gemini 3.8 Live API) | 'ambient' (Gemini 3.8 Flash) | 'transcribe' (Gemini 3.5 Transcribe)
  const [activeMode, setActiveMode] = useState<'live' | 'ambient' | 'transcribe'>('live');
  const [inputText, setInputText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [micAudioLevel, setMicAudioLevel] = useState(0);

  // -------------------------------------------------------------
  // 1. Gemini Live API (gemini-3.8-live) State
  // -------------------------------------------------------------
  const [liveStatus, setLiveStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error'
  >('disconnected');
  const [liveTranscriptHistory, setLiveTranscriptHistory] = useState<
    Array<{ role: 'user' | 'model'; text: string; time: string }>
  >([
    {
      role: 'model',
      text: 'Nexus AI initialized. Connected to Gemini 3.8 Live API. Speak naturally or tap the orb to interact.',
      time: 'Just now',
    },
  ]);
  const [liveError, setLiveError] = useState<string | null>(null);
  const liveClientRef = useRef<GeminiLiveClient | null>(null);
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

  // Initialize live client with callbacks
  useEffect(() => {
    const client = new GeminiLiveClient({
      onStatusChange: (status) => {
        setLiveStatus(status);
        if (status === 'error') {
          setLiveError('Live stream error. Re-authenticating with ephemeral token...');
        }
      },
      onAudioLevel: (level) => {
        setMicAudioLevel(level);
      },
      onTranscript: (text, isModel) => {
        setLiveTranscriptHistory((prev) => {
          // If the last message was from the same role within 2 seconds, append text
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          if (prev.length > 0 && prev[prev.length - 1].role === (isModel ? 'model' : 'user')) {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            // If the chunk doesn't duplicate, combine
            if (!last.text.endsWith(text)) {
              last.text = `${last.text} ${text}`.trim();
              last.time = nowStr;
            }
            return updated;
          }
          return [
            ...prev,
            {
              role: isModel ? 'model' : 'user',
              text,
              time: nowStr,
            },
          ];
        });
      },
      onError: (err) => setLiveError(err),
      onInterrupted: () => {
        console.log('[Live] Barge-in triggered: speech playback cancelled');
      },
    });
    liveClientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, []);

  // Auto-scroll transcript container on new dialogue
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [liveTranscriptHistory, transcript, assistantReply]);

  const handleToggleLiveSession = async () => {
    if (!liveClientRef.current) return;

    if (liveStatus === 'listening' || liveStatus === 'speaking') {
      liveClientRef.current.stopMicrophone();
      setLiveStatus('connected');
    } else {
      setLiveError(null);
      try {
        await liveClientRef.current.connect();
        await liveClientRef.current.startMicrophone();
      } catch (err: any) {
        setLiveError(err.message || 'Microphone access denied or Live session unavailable');
      }
    }
  };

  const handleBargeIn = () => {
    if (activeMode === 'live' && liveClientRef.current) {
      liveClientRef.current.interrupt();
    } else {
      onInterrupt();
    }
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      if (activeMode === 'live' && liveClientRef.current) {
        liveClientRef.current.stopMicrophone();
      }
    } else {
      if (activeMode === 'live' && liveClientRef.current) {
        liveClientRef.current.startMicrophone().catch(console.warn);
      }
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
    setActiveMode('live');
  };

  // -------------------------------------------------------------
  // Effective voice state resolution
  // -------------------------------------------------------------
  const effectiveVoiceState: VoiceState =
    activeMode === 'live'
      ? liveStatus === 'speaking'
        ? 'speaking'
        : liveStatus === 'listening'
        ? 'listening'
        : liveStatus === 'connecting'
        ? 'thinking'
        : liveStatus === 'error'
        ? 'error'
        : 'idle'
      : audioStatus;

  // Text submit handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      if (activeMode === 'live' && liveClientRef.current && (liveStatus === 'listening' || liveStatus === 'connected')) {
        liveClientRef.current.sendText(inputText.trim());
      } else {
        onSendMessage(inputText.trim());
      }
      setInputText('');
    }
  };

  const quickPrompts = [
    { label: 'Review my agenda', query: 'What meetings and events do I have on Google Calendar today?' },
    { label: 'Summarize unread emails', query: 'Summarize my high priority unread Gmail messages.' },
    { label: 'Check low inventory', query: 'Check smart pantry telemetry and order coffee pods.' },
    { label: 'Trigger morning scene', query: 'Execute morning ambient briefing and activate lighting.' },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#0b0f19] via-[#090d18] to-[#07090e] p-6 shadow-2xl shadow-cyan-950/20 sm:p-8 transition-colors">
      {/* Background ambient lighting effects */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-80 w-[28rem] rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-72 w-80 rounded-full bg-purple-500/10 blur-3xl" />

      {/* Top Capability Mode Selector */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-800/80">
        <div className="flex items-center space-x-1 sm:space-x-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveMode('live')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeMode === 'live'
                ? 'bg-purple-500/20 text-purple-300 shadow-sm border border-purple-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
            <span>Gemini Live API</span>
            <span className="text-[10px] bg-purple-500/30 text-purple-200 px-1.5 py-0.5 rounded-md font-mono">
              gemini-3.8-live
            </span>
          </button>

          <button
            onClick={() => setActiveMode('ambient')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeMode === 'ambient'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Ambient Assistant</span>
            <span className="text-[10px] bg-cyan-500/30 text-cyan-200 px-1.5 py-0.5 rounded-md font-mono">
              3.8 Flash
            </span>
          </button>

          <button
            onClick={() => setActiveMode('transcribe')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeMode === 'transcribe'
                ? 'bg-emerald-500/20 text-emerald-300 shadow-sm border border-emerald-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileAudio className="h-3.5 w-3.5 text-emerald-400" />
            <span>Transcribe Audio</span>
            <span className="text-[10px] bg-emerald-500/30 text-emerald-200 px-1.5 py-0.5 rounded-md font-mono">
              gemini-3.5-transcribe
            </span>
          </button>
        </div>

        {/* Security & Credentials Pill */}
        <div className="flex items-center space-x-2 text-xs font-mono text-slate-300 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-slate-300">Live API: Ephemeral Authenticated</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CENTRAL INTERACTIVE VOICE ORB & CONTROLS                  */}
      {/* ========================================================= */}
      <div className="relative flex flex-col items-center justify-center py-6 sm:py-8">
        {/* Animated Concentric Aura & Ripple Rings */}
        <div className="relative flex items-center justify-center">
          {effectiveVoiceState === 'listening' && (
            <>
              <div className="absolute h-52 w-52 rounded-full border border-cyan-400/30 animate-ping opacity-60" />
              <div className="absolute h-44 w-44 rounded-full border border-teal-400/40 animate-pulse" />
              <div className="absolute h-36 w-36 rounded-full bg-cyan-500/10 blur-xl animate-pulse" />
            </>
          )}

          {effectiveVoiceState === 'thinking' && (
            <>
              <div className="absolute h-48 w-48 rounded-full border border-amber-400/40 animate-spin-slow" />
              <div className="absolute h-40 w-40 rounded-full bg-amber-500/15 blur-xl animate-pulse" />
            </>
          )}

          {effectiveVoiceState === 'speaking' && (
            <>
              <div className="absolute h-52 w-52 rounded-full border border-purple-400/40 animate-ping opacity-75" />
              <div className="absolute h-44 w-44 rounded-full border border-pink-500/30 animate-pulse" />
              <div className="absolute h-36 w-36 rounded-full bg-purple-500/20 blur-xl animate-pulse" />
            </>
          )}

          {effectiveVoiceState === 'error' && (
            <div className="absolute h-44 w-44 rounded-full border border-rose-500/40 animate-pulse bg-rose-500/10 blur-md" />
          )}

          {/* Master Glowing Interactive Sphere */}
          <button
            onClick={
              effectiveVoiceState === 'speaking'
                ? handleBargeIn
                : activeMode === 'live'
                ? handleToggleLiveSession
                : onToggleListening
            }
            aria-label={`Voice Orb: state is ${effectiveVoiceState}`}
            className={`group relative flex h-32 w-32 sm:h-36 sm:w-36 items-center justify-center rounded-full transition-all duration-500 cursor-pointer ${
              effectiveVoiceState === 'listening'
                ? 'scale-105 shadow-[0_0_60px_rgba(6,182,212,0.65)]'
                : effectiveVoiceState === 'speaking'
                ? 'scale-105 shadow-[0_0_60px_rgba(168,85,247,0.7)]'
                : effectiveVoiceState === 'thinking'
                ? 'shadow-[0_0_45px_rgba(245,158,11,0.55)]'
                : effectiveVoiceState === 'error'
                ? 'shadow-[0_0_45px_rgba(244,63,94,0.55)]'
                : 'hover:scale-105 shadow-[0_0_35px_rgba(6,182,212,0.25)]'
            }`}
          >
            {/* Multi-layered orb gradient shells */}
            <div
              className={`absolute inset-0 rounded-full transition-all duration-700 ${
                effectiveVoiceState === 'listening'
                  ? 'bg-gradient-to-tr from-cyan-600 via-teal-400 to-cyan-300 animate-spin-slow'
                  : effectiveVoiceState === 'speaking'
                  ? 'bg-gradient-to-tr from-purple-600 via-indigo-500 to-pink-400 animate-pulse'
                  : effectiveVoiceState === 'thinking'
                  ? 'bg-gradient-to-tr from-amber-500 via-orange-400 to-amber-300 animate-spin-slow'
                  : effectiveVoiceState === 'error'
                  ? 'bg-gradient-to-tr from-rose-600 via-red-500 to-rose-400 animate-pulse'
                  : 'bg-gradient-to-tr from-cyan-700 via-indigo-700 to-purple-900 opacity-90 group-hover:opacity-100'
              }`}
            />

            {/* Inner glass sphere */}
            <div className="relative flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-full bg-[#07090e]/80 backdrop-blur-md border border-white/20 shadow-inner">
              {effectiveVoiceState === 'speaking' ? (
                <div className="flex flex-col items-center">
                  <Square className="h-8 w-8 text-purple-300 fill-current animate-pulse" />
                  <span className="text-[10px] font-bold text-purple-200 mt-1 uppercase tracking-wider">
                    Stop / Barge-in
                  </span>
                </div>
              ) : effectiveVoiceState === 'listening' ? (
                <div className="flex flex-col items-center">
                  <Mic className="h-9 w-9 text-cyan-300 animate-bounce" />
                  <span className="text-[10px] font-bold text-cyan-200 mt-1 uppercase tracking-wider">
                    Listening
                  </span>
                </div>
              ) : effectiveVoiceState === 'thinking' ? (
                <div className="flex flex-col items-center">
                  <Activity className="h-8 w-8 text-amber-300 animate-spin" />
                  <span className="text-[10px] font-bold text-amber-200 mt-1 uppercase tracking-wider">
                    Reasoning
                  </span>
                </div>
              ) : effectiveVoiceState === 'error' ? (
                <div className="flex flex-col items-center">
                  <AlertCircle className="h-8 w-8 text-rose-300" />
                  <span className="text-[10px] font-bold text-rose-200 mt-1 uppercase tracking-wider">
                    Tap to Retry
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Mic className="h-8 w-8 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-bold text-slate-200 mt-1 uppercase tracking-wider">
                    {activeMode === 'live' ? 'Start Live' : 'Tap to speak'}
                  </span>
                </div>
              )}
            </div>
          </button>
        </div>

        {/* Status description badge */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center space-x-2 rounded-full border border-cyan-500/30 bg-cyan-950/50 px-4 py-1.5 shadow-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                effectiveVoiceState === 'listening'
                  ? 'bg-cyan-400 animate-ping'
                  : effectiveVoiceState === 'speaking'
                  ? 'bg-purple-400 animate-pulse'
                  : effectiveVoiceState === 'thinking'
                  ? 'bg-amber-400 animate-pulse'
                  : effectiveVoiceState === 'error'
                  ? 'bg-rose-400 animate-ping'
                  : 'bg-slate-500'
              }`}
            />
            <span className="text-xs font-semibold text-cyan-200">
              {effectiveVoiceState === 'listening'
                ? activeMode === 'live'
                  ? 'Streaming Live Audio at 16kHz PCM (gemini-3.8-live)...'
                  : 'Listening to ambient voice input...'
                : effectiveVoiceState === 'thinking'
                ? 'Reasoning with Gemini Live model...'
                : effectiveVoiceState === 'speaking'
                ? 'Synthesizing voice response at 24kHz PCM...'
                : effectiveVoiceState === 'error'
                ? liveError || 'Voice engine connection issue'
                : activeMode === 'live'
                ? 'Gemini 3.8 Live API standing by — tap orb to start voice stream'
                : 'Nexus ambient listener standing by'}
            </span>
          </div>
        </div>

        {/* SVG Audio Waveform & Frequency Bar Visualizer */}
        <div className="mt-4 w-full max-w-xl h-20 flex items-center justify-center px-4">
          <AudioWaveformVisualizer status={effectiveVoiceState} variant="banner" barCount={32} />
        </div>

        {/* Dedicated Microphone & Voice Controls Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {/* Mute/Unmute Mic Toggle */}
          <button
            onClick={handleToggleMute}
            className={`flex items-center space-x-2 rounded-xl px-3.5 py-1.5 text-xs font-medium border transition-all ${
              isMuted
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-cyan-500/50'
            }`}
          >
            {isMuted ? <MicOff className="h-4 w-4 text-rose-400" /> : <Mic className="h-4 w-4 text-cyan-400" />}
            <span>{isMuted ? 'Microphone Muted' : 'Microphone Live'}</span>
          </button>

          {/* Barge-in / Interrupt AI button */}
          {effectiveVoiceState === 'speaking' && (
            <button
              onClick={handleBargeIn}
              className="flex items-center space-x-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold bg-purple-500/20 text-purple-200 border border-purple-500/40 hover:bg-purple-500/30 transition-all animate-pulse"
            >
              <Zap className="h-3.5 w-3.5 text-purple-300" />
              <span>Barge-in / Interrupt</span>
            </button>
          )}

          {/* Audio Input Level Meter */}
          {effectiveVoiceState === 'listening' && (
            <div className="flex items-center space-x-1.5 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-mono text-slate-400">Mic Level:</span>
              <div className="flex items-center space-x-0.5 h-3">
                {[0.2, 0.4, 0.6, 0.8, 1.0].map((threshold, idx) => (
                  <div
                    key={idx}
                    className={`w-1 rounded-sm transition-all duration-75 ${
                      micAudioLevel >= threshold ? 'bg-cyan-400 h-3' : 'bg-slate-800 h-1.5'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Live Error / Microphone Permission Advisory Banner */}
        {liveError && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-3.5 text-xs text-amber-200 max-w-xl w-full">
            <div className="flex items-center space-x-2.5">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>{liveError}</span>
            </div>
            {/permission/i.test(liveError) && (
              <button
                onClick={async () => {
                  setLiveError(null);
                  try {
                    await navigator.mediaDevices?.getUserMedia({ audio: true });
                    if (liveClientRef.current) {
                      await liveClientRef.current.startMicrophone();
                    }
                  } catch (e: any) {
                    setLiveError('Microphone permission was not granted. Please check your browser address bar icon to allow access.');
                  }
                }}
                className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3 py-1 font-semibold text-slate-950 shadow-sm shrink-0 cursor-pointer"
              >
                Grant Mic
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* CONVERSATIONAL TRANSCRIPT & REAL-TIME LOG                 */}
      {/* ========================================================= */}
      <div className="mt-4 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 sm:p-5 backdrop-blur-md">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs font-semibold text-slate-400">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            <span className="text-white font-bold tracking-wide">Live Conversational Transcript</span>
            <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-[10px] font-mono text-purple-300 border border-purple-500/30">
              {activeMode === 'live' ? 'gemini-3.8-live' : 'gemini-3.8-flash'}
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Bidirectional Duplex</span>
        </div>

        {/* Scrolling Transcript Area */}
        <div
          ref={transcriptScrollRef}
          role="log"
          aria-live="polite"
          className="mt-3 max-h-56 overflow-y-auto space-y-3 pr-1 text-xs sm:text-sm"
        >
          {activeMode === 'live' ? (
            liveTranscriptHistory.map((msg, idx) => (
              <div key={idx} className="flex items-start space-x-3">
                <span
                  className={`rounded-lg px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                    msg.role === 'model'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  }`}
                >
                  {msg.role === 'model' ? 'Nexus' : 'You'}
                </span>
                <div className="flex-1">
                  <p className="text-slate-100 font-medium leading-relaxed">{msg.text}</p>
                </div>
                <span className="text-[10px] text-slate-500 font-mono shrink-0">{msg.time}</span>
              </div>
            ))
          ) : (
            <>
              {transcript && (
                <div className="flex items-start space-x-3">
                  <span className="rounded-lg bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-cyan-300 border border-cyan-500/30 uppercase shrink-0">
                    You
                  </span>
                  <p className="text-slate-100 font-medium leading-relaxed italic">"{transcript}"</p>
                </div>
              )}
              <div className="flex items-start space-x-3">
                <span className="rounded-lg bg-purple-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-300 border border-purple-500/30 uppercase shrink-0 flex items-center space-x-1">
                  <Sparkles className="h-3 w-3" />
                  <span>Nexus</span>
                </span>
                <p className="text-slate-200 font-medium leading-relaxed">
                  {assistantReply ||
                    'Ambient assistant active. Ask me about your Google Calendar events, Gmail summary, Google Tasks, or trigger multi-step ambient routines.'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Text Input / Fallback Command Box */}
        <form onSubmit={handleSubmit} className="mt-4 flex items-center space-x-2 pt-3 border-t border-slate-800">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Speak or type a voice request (e.g., 'What is on my calendar today?')..."
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 transition-all focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/60"
            />
          </div>
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 transition-all hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Send className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

        {/* Suggested Ambient Voice Commands */}
        <div className="mt-3.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Suggested Ambient Voice Commands
          </div>
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (activeMode === 'live' && liveClientRef.current) {
                    liveClientRef.current.sendText(p.query);
                  } else {
                    onQuickPrompt(p.query);
                  }
                }}
                className="rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1 text-xs text-slate-300 hover:border-cyan-500/40 hover:bg-cyan-950/30 hover:text-cyan-200 transition-all shadow-xs cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODE 3: TRANSCRIBE AUDIO (gemini-3.5-transcribe) OVERLAY  */}
      {/* ========================================================= */}
      {activeMode === 'transcribe' && (
        <div className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-800/40">
            <div>
              <h4 className="text-sm font-bold text-emerald-300 flex items-center space-x-2">
                <FileAudio className="h-4 w-4 text-emerald-400" />
                <span>Microphone Audio Transcription</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-200 px-1.5 py-0.5 rounded font-mono">
                  gemini-3.5-transcribe
                </span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Record high-fidelity microphone clips for accurate speech-to-text with Gemini 3.5 Transcribe.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {!isRecordingTranscribe ? (
                <button
                  onClick={handleStartTranscribeRecord}
                  disabled={isTranscribing}
                  className="flex items-center space-x-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Mic className="h-3.5 w-3.5" />
                  <span>Start Recording</span>
                </button>
              ) : (
                <button
                  onClick={handleStopAndTranscribe}
                  className="flex items-center space-x-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-rose-600/30 animate-pulse transition-all cursor-pointer"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  <span>Stop & Transcribe ({recordTimer}s)</span>
                </button>
              )}
            </div>
          </div>

          {isTranscribing && (
            <div className="flex items-center justify-center space-x-2 py-4 text-xs text-emerald-300">
              <Activity className="h-4 w-4 animate-spin" />
              <span>Transcribing audio with gemini-3.5-transcribe...</span>
            </div>
          )}

          {transcribeResult && (
            <div className="rounded-xl bg-slate-900/90 p-4 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-400 flex items-center space-x-1.5">
                  <Check className="h-3.5 w-3.5" />
                  <span>Transcription Complete ({transcribeResult.model})</span>
                </span>
                <button
                  onClick={handleCopyTranscript}
                  className="flex items-center space-x-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {copiedTranscript ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedTranscript ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <p className="text-sm text-slate-100 font-medium leading-relaxed italic">
                "{transcribeResult.text}"
              </p>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  onClick={handleStartTranscribeRecord}
                  className="flex items-center space-x-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Record Again</span>
                </button>
                <button
                  onClick={handleExecuteTranscribe}
                  className="flex items-center space-x-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 cursor-pointer"
                >
                  <Send className="h-3 w-3" />
                  <span>Execute in Nexus</span>
                </button>
              </div>
            </div>
          )}

          {transcribeError && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
              {transcribeError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
