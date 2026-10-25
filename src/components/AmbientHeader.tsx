import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Radio,
  Mic,
  MicOff,
  Volume2,
  Cpu,
  LogIn,
  LogOut,
  Layers,
  ShieldCheck,
  Sun,
  Moon,
  HelpCircle,
} from 'lucide-react';
import { AudioWaveformVisualizer } from './AudioWaveformVisualizer';
import type { User } from 'firebase/auth';

interface AmbientHeaderProps {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  audioStatus: 'idle' | 'listening' | 'thinking' | 'speaking' | 'error';
  isMuted: boolean;
  onToggleMute: () => void;
  mcpStatus: 'live_nexus_core' | 'auth_required' | 'demo_adapter';
  activeView: string;
  onNavigate: (view: string) => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
  onOpenOnboarding?: () => void;
}

export const AmbientHeader: React.FC<AmbientHeaderProps> = ({
  user,
  onLogin,
  onLogout,
  audioStatus,
  isMuted,
  onToggleMute,
  mcpStatus,
  isDark = true,
  onToggleTheme,
  onOpenOnboarding,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setCurrentDate(
        now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-cyan-500/10 bg-white/85 dark:bg-[#07090e]/85 backdrop-blur-xl transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Ambient Status */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-500 via-indigo-600 to-purple-600 p-[1.5px] shadow-lg shadow-cyan-500/20">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-100 dark:bg-[#090c15]">
                <Radio className="h-4 w-4 text-cyan-500 dark:text-cyan-400 animate-pulse" />
              </div>
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white font-['Plus_Jakarta_Sans']">
                NEXUS{' '}
                <span className="bg-gradient-to-r from-cyan-500 to-indigo-500 dark:from-cyan-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  AI
                </span>
              </span>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-cyan-700 dark:text-cyan-300 uppercase">
                Alexa+ OS
              </span>
            </div>
            <div className="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:flex items-center space-x-2">
              <span className="flex items-center space-x-1">
                <Cpu className="h-3 w-3 text-cyan-500 dark:text-cyan-400/80" />
                <span>
                  MCP:{' '}
                  {mcpStatus === 'live_nexus_core'
                    ? 'Nexus Core Live'
                    : mcpStatus === 'auth_required'
                    ? 'Auth Required (401)'
                    : 'Demo Adapter'}
                </span>
              </span>
              <span>•</span>
              <span className="text-slate-500 dark:text-slate-400">Ambient OS</span>
            </div>
          </div>
        </div>

        {/* Ambient Clock & Status indicators */}
        <div className="hidden md:flex items-center space-x-6 text-center">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/50 px-4 py-1.5 shadow-xs">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 tracking-wider font-mono">
              {currentTime || '--:--:--'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {currentDate}
            </div>
          </div>

          {/* Audio Engine Live Indicator & Mini Frequency Bars */}
          <div className="flex items-center space-x-2 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/50 px-3 py-1">
            <span
              className={`h-2 w-2 rounded-full ${
                audioStatus === 'listening'
                  ? 'bg-cyan-400 animate-ping'
                  : audioStatus === 'speaking'
                  ? 'bg-purple-400 animate-bounce'
                  : audioStatus === 'thinking'
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-slate-400 dark:bg-slate-600'
              }`}
            />
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {audioStatus}
            </span>
            {(audioStatus === 'listening' || audioStatus === 'speaking') && (
              <AudioWaveformVisualizer status={audioStatus} variant="compact" className="ml-1" />
            )}
          </div>
        </div>

        {/* Actions & Profile */}
        <div className="flex items-center space-x-2.5">
          {/* Onboarding Guide & Walkthrough */}
          {onOpenOnboarding && (
            <button
              onClick={onOpenOnboarding}
              aria-label="Open Nexus AI Onboarding Guide"
              title="Nexus AI Onboarding Guide & Feature Tour"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:border-cyan-500/50 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all shadow-xs"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          )}

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to daylight theme' : 'Switch to ambient dark theme'}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:border-cyan-500/50 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all shadow-xs"
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400 hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="h-4 w-4 text-indigo-600 hover:-rotate-12 transition-transform" />
            )}
          </button>

          {/* Mute/Unmute */}
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
              isMuted
                ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:text-cyan-400'
            }`}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          {/* User Sign In / Profile */}
          {user ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-1 pl-2">
                <span className="hidden text-xs font-medium text-slate-700 dark:text-slate-300 sm:inline-block max-w-[120px] truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="h-7 w-7 rounded-lg object-cover border border-cyan-500/20"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 text-xs font-bold text-white">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
              </div>
              <button
                onClick={onLogout}
                title="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 hover:border-red-500/30 hover:text-red-500 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="flex items-center space-x-2 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 px-3.5 py-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-300 hover:border-cyan-500/60 hover:bg-cyan-500/20 transition-all shadow-xs"
            >
              <LogIn className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>Connect Google</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
