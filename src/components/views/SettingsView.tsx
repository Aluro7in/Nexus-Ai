import React, { useState } from 'react';
import {
  Settings,
  User,
  Volume2,
  Cpu,
  Shield,
  Palette,
  Check,
  RefreshCw,
  LogOut,
  LogIn,
  Sliders,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserPreference, VoiceName } from '../../types';
import type { ThemeMode } from '../../lib/theme';

interface SettingsViewProps {
  user: FirebaseUser | null;
  preferences: UserPreference;
  onUpdatePreferences: (prefs: Partial<UserPreference>) => void;
  onLogin: () => void;
  onLogout: () => void;
  mcpStatus: 'live_nexus_core' | 'demo_adapter';
  onTestMcpConnection: (url: string) => void;
  hasGoogleToken: boolean;
  theme?: ThemeMode;
  onSetTheme?: (theme: ThemeMode) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  preferences,
  onUpdatePreferences,
  onLogin,
  onLogout,
  mcpStatus,
  onTestMcpConnection,
  hasGoogleToken,
  theme = 'dark',
  onSetTheme,
}) => {
  const [backendUrl, setBackendUrl] = useState(
    preferences.mcpBackendUrl || 'http://localhost:8080/mcp'
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  const voiceOptions: Array<{ name: VoiceName; desc: string }> = [
    { name: 'Zephyr', desc: 'Warm, refined, balanced ambient assistant (Default)' },
    { name: 'Puck', desc: 'Energetic, upbeat, conversational' },
    { name: 'Charon', desc: 'Calm, authoritative, deep resonance' },
    { name: 'Kore', desc: 'Gentle, soothing, ambient clarity' },
    { name: 'Fenrir', desc: 'Crisp, articulate, focused executive tone' },
  ];

  const themeOptions: Array<{
    id: ThemeMode;
    label: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'dark',
      label: 'Ambient Dark',
      desc: 'Deep cyberpunk midnight with high-contrast cyan glow. Default for ambient displays.',
      icon: Moon,
    },
    {
      id: 'light',
      label: 'Daylight Light',
      desc: 'Clean, airy daylight workspace with sharp slate contrast and soft shadows.',
      icon: Sun,
    },
    {
      id: 'system',
      label: 'System Sync',
      desc: 'Automatically synchronizes with your device OS dark or light appearance.',
      icon: Laptop,
    },
  ];

  const handleSaveBackendUrl = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePreferences({ mcpBackendUrl: backendUrl });
    onTestMcpConnection(backendUrl);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
          <Settings className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          <span>System, Theme & Voice Preferences</span>
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Configure appearance, Gemini voice personas, Antigravity MCP core connection, and privacy controls.
        </p>
      </div>

      {/* 1. Theme & Appearance Section */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 p-5 shadow-xs backdrop-blur-md space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
            <Palette className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span>Theme & Display Appearance</span>
          </div>
          <span className="text-xs font-mono text-cyan-600 dark:text-cyan-300 capitalize">
            Current: {theme} mode
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Choose between ambient dark mode, crisp daylight mode, or automatic operating system synchronization.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themeOptions.map((opt) => {
            const isSelected = theme === opt.id;
            const Icon = opt.icon;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSetTheme?.(opt.id)}
                className={`flex flex-col text-left rounded-xl p-3.5 border transition-all ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/40 text-slate-900 dark:text-white shadow-xs ring-1 ring-cyan-500/50'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`p-1.5 rounded-lg ${
                        isSelected
                          ? 'bg-cyan-500 text-white dark:text-slate-950'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-bold">{opt.label}</span>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Account & Identity */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 p-5 shadow-xs backdrop-blur-md space-y-4 transition-colors">
        <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
          <User className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <span>User Authentication & Profile</span>
        </div>

        {user ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="h-10 w-10 rounded-xl object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 font-bold text-white">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div>
                <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                  {user.displayName || 'Google User'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                    ✓ Firestore Persisted
                  </span>
                  {hasGoogleToken && (
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono">
                      ✓ Workspace Token Active
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center space-x-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-red-500/30 hover:text-red-500 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-800 dark:text-slate-300 font-medium">
                No Google account connected.
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Sign in with Google to enable real Google Calendar, Gmail, Drive, and Tasks sync.
              </p>
            </div>
            <button
              onClick={onLogin}
              className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-950/20 hover:opacity-95 transition-all"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Connect Google Account</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Voice Persona Selection (Gemini TTS) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 p-5 shadow-xs backdrop-blur-md space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
            <Volume2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span>Gemini Live Voice Persona</span>
          </div>
          <span className="text-xs font-mono text-purple-600 dark:text-purple-300">
            gemini-3.8-flash-lite-tts
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {voiceOptions.map((v) => {
            const isSelected = preferences.voiceName === v.name;
            return (
              <button
                key={v.name}
                onClick={() => onUpdatePreferences({ voiceName: v.name })}
                className={`flex flex-col text-left rounded-xl p-3 border transition-all ${
                  isSelected
                    ? 'border-purple-500/60 bg-purple-50/80 dark:bg-purple-950/30 text-slate-900 dark:text-white shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">{v.name}</span>
                  {isSelected && <Check className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{v.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Auto-speak toggle */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800/60">
          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Proactive Speech Output
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Audibly synthesize assistant responses using natural Gemini TTS.
            </p>
          </div>
          <button
            onClick={() => onUpdatePreferences({ autoSpeak: !preferences.autoSpeak })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              preferences.autoSpeak ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-800'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                preferences.autoSpeak ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 4. Antigravity nexus-core MCP Connection */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 p-5 shadow-xs backdrop-blur-md space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
            <Cpu className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <span>Antigravity Nexus-Core Backend Boundary</span>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              mcpStatus === 'live_nexus_core'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20'
            }`}
          >
            {mcpStatus === 'live_nexus_core' ? 'Connected' : 'Demo Adapter Active'}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Nexus AI interfaces with the <code className="text-cyan-600 dark:text-cyan-400 font-mono">nexus-core</code> Node.js MCP
          server developed in Google Antigravity via MCP Streamable HTTP (spec version{' '}
          <code className="text-purple-600 dark:text-purple-400 font-mono">2025-11-25</code>).
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          <strong>Port & Network Note:</strong> In this hosted environment, port 8080 is reserved by the container's
          internal proxy. Run your external <code className="text-cyan-600 dark:text-cyan-400">nexus-core</code> server on an independent port
          (e.g., <code className="text-cyan-600 dark:text-cyan-400">http://localhost:3001/mcp</code>) or an HTTPS tunnel URL. The app uses a
          server-side relay to bypass browser mixed-content restrictions.
        </p>

        <form onSubmit={handleSaveBackendUrl} className="flex items-center space-x-2">
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="http://localhost:3001/mcp"
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
          />
          <button
            type="submit"
            className="flex items-center space-x-1.5 rounded-xl bg-slate-800 text-white dark:bg-slate-800 dark:text-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-700 transition-colors shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Connect & Test</span>
          </button>
        </form>

        {savedSuccess && (
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            ✓ Backend URL updated. Initializing MCP Streamable HTTP handshake...
          </div>
        )}
      </div>

      {/* 5. Privacy & Ethical AI Safety */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 p-5 shadow-xs backdrop-blur-md space-y-3 transition-colors">
        <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
          <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>AI Ethics, Governance & Human-in-the-Loop</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Nexus AI is designed for the Amazon Developer Hackathon with strict ethical boundaries:
        </p>
        <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 list-disc list-inside">
          <li>
            <strong className="text-slate-900 dark:text-white">Explicit Confirmation:</strong> Never sends emails or executes
            purchases without an explicit confirmation modal.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-white">Client Token In-Memory Only:</strong> Google Workspace OAuth access
            tokens are held in memory during the browser session and never stored in persistent local storage.
          </li>
          <li>
            <strong className="text-slate-900 dark:text-white">Server-Side Gemini Keys:</strong> Permanent API keys remain safely on
            the backend service; the client utilizes scoped proxy endpoints.
          </li>
        </ul>
      </div>
    </div>
  );
};
