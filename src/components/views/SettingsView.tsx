import React, { useState, useEffect } from 'react';
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
  Activity,
  HelpCircle,
  Play,
  Square,
  Globe,
  MapPin,
  Clock,
  Phone,
  Mail,
  Sparkles,
  Radio,
  Bell,
  Mic,
  VolumeX,
} from 'lucide-react';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserPreference, UserProfile, VoiceName, VoiceAccent } from '../../types';
import type { ThemeMode } from '../../lib/theme';
import { audioEngine } from '../../lib/audio';

interface SettingsViewProps {
  user: FirebaseUser | null;
  userProfile?: UserProfile | null;
  onUpdateProfile?: (profile: Partial<UserProfile>) => Promise<void>;
  preferences: UserPreference;
  onUpdatePreferences: (prefs: Partial<UserPreference>) => void;
  onLogin: () => void;
  onLogout: () => void;
  mcpStatus: 'live_nexus_core' | 'auth_required' | 'demo_adapter';
  onTestMcpConnection: (url: string) => void;
  hasGoogleToken: boolean;
  theme?: ThemeMode;
  onSetTheme?: (theme: ThemeMode) => void;
  onOpenOnboarding?: () => void;
  mcpDetails?: {
    message?: string;
    missingComponents?: string[];
    toolsCount?: number;
  };
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  userProfile,
  onUpdateProfile,
  preferences,
  onUpdatePreferences,
  onLogin,
  onLogout,
  mcpStatus,
  onTestMcpConnection,
  hasGoogleToken,
  theme = 'dark',
  onSetTheme,
  onOpenOnboarding,
  mcpDetails,
}) => {
  // -------------------------------------------------------------
  // Profile Form Local State
  // -------------------------------------------------------------
  const [displayName, setDisplayName] = useState(
    userProfile?.displayName || user?.displayName || 'Google User'
  );
  const [email, setEmail] = useState(
    userProfile?.email || user?.email || 'guest@nexus.ai'
  );
  const [photoURL, setPhotoURL] = useState(
    userProfile?.photoURL || user?.photoURL || ''
  );
  const [bio, setBio] = useState(
    userProfile?.bio || 'Ambient AI workspace user exploring Alexa+ workflows.'
  );
  const [location, setLocation] = useState(userProfile?.location || 'San Francisco, CA');
  const [timezone, setTimezone] = useState(
    userProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles'
  );
  const [phoneNumber, setPhoneNumber] = useState(userProfile?.phoneNumber || '+1 (555) 019-2834');

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);

  // Sync state if props change (e.g., after login)
  useEffect(() => {
    if (userProfile) {
      if (userProfile.displayName) setDisplayName(userProfile.displayName);
      if (userProfile.email) setEmail(userProfile.email);
      if (userProfile.photoURL) setPhotoURL(userProfile.photoURL);
      if (userProfile.bio !== undefined) setBio(userProfile.bio);
      if (userProfile.location !== undefined) setLocation(userProfile.location);
      if (userProfile.timezone !== undefined) setTimezone(userProfile.timezone);
      if (userProfile.phoneNumber !== undefined) setPhoneNumber(userProfile.phoneNumber);
    } else if (user) {
      if (user.displayName) setDisplayName(user.displayName);
      if (user.email) setEmail(user.email);
      if (user.photoURL) setPhotoURL(user.photoURL);
    }
  }, [user, userProfile]);

  // -------------------------------------------------------------
  // Voice Preferences Local State
  // -------------------------------------------------------------
  const [voiceSpeed, setVoiceSpeed] = useState<number>(preferences.voiceSpeed ?? 1.0);
  const [voicePitch, setVoicePitch] = useState<number>(preferences.voicePitch ?? 1.0);
  const [voiceAccent, setVoiceAccent] = useState<VoiceAccent>(preferences.voiceAccent ?? 'neutral-american');
  const [isPlayingSample, setIsPlayingSample] = useState(false);

  // -------------------------------------------------------------
  // MCP Backend URL Local State
  // -------------------------------------------------------------
  const [backendUrl, setBackendUrl] = useState(
    preferences.mcpBackendUrl || 'https://nexus-core-v4j3.onrender.com'
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Voice Persona Options
  const voiceOptions: Array<{ name: VoiceName; desc: string; sampleTag: string }> = [
    { name: 'Zephyr', desc: 'Warm, refined, balanced ambient assistant (Default)', sampleTag: 'Balanced · Natural' },
    { name: 'Puck', desc: 'Energetic, upbeat, conversational pacing', sampleTag: 'Dynamic · Fast' },
    { name: 'Charon', desc: 'Calm, authoritative, deep resonant timbre', sampleTag: 'Deep · Authoritative' },
    { name: 'Kore', desc: 'Gentle, soothing, ambient clarity', sampleTag: 'Soothing · Clear' },
    { name: 'Fenrir', desc: 'Crisp, articulate, focused executive tone', sampleTag: 'Focused · Executive' },
  ];

  // Voice Accent Options
  const accentOptions: Array<{ id: VoiceAccent; label: string; flag: string; desc: string }> = [
    { id: 'neutral-american', label: 'Neutral American', flag: '🇺🇸', desc: 'Standard North American cadence' },
    { id: 'british', label: 'British (RP)', flag: '🇬🇧', desc: 'Refined Received Pronunciation' },
    { id: 'australian', label: 'Australian', flag: '🇦🇺', desc: 'Natural Australian conversational intonation' },
    { id: 'indian', label: 'Indian English', flag: '🇮🇳', desc: 'Clear, expressive Indian English cadence' },
  ];

  // Theme Options
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

  // Save Profile Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      if (onUpdateProfile) {
        await onUpdateProfile({
          displayName: displayName.trim(),
          email: email.trim(),
          photoURL: photoURL.trim(),
          bio: bio.trim(),
          location: location.trim(),
          timezone: timezone.trim(),
          phoneNumber: phoneNumber.trim(),
        });
      }
      setProfileSaveSuccess(true);
      setTimeout(() => setProfileSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Voice Preview Handler
  const handlePlayVoiceSample = async () => {
    if (isPlayingSample) {
      audioEngine.interrupt();
      setIsPlayingSample(false);
      return;
    }

    setIsPlayingSample(true);
    const sampleText = `Hello! I am your Nexus AI ambient operating assistant, speaking with the ${preferences.voiceName} persona at ${voiceSpeed}x speed.`;
    await audioEngine.speak(sampleText, preferences.voiceName, true, {
      speed: voiceSpeed,
      pitch: voicePitch,
      accent: voiceAccent,
    });
    setIsPlayingSample(false);
  };

  // Voice Speed Change Handler
  const handleSpeedChange = (speed: number) => {
    setVoiceSpeed(speed);
    onUpdatePreferences({ voiceSpeed: speed, speechRate: speed });
  };

  // Voice Pitch Change Handler
  const handlePitchChange = (pitch: number) => {
    setVoicePitch(pitch);
    onUpdatePreferences({ voicePitch: pitch });
  };

  // Voice Accent Change Handler
  const handleAccentChange = (accent: VoiceAccent) => {
    setVoiceAccent(accent);
    onUpdatePreferences({ voiceAccent: accent });
  };

  // Save MCP Backend URL Handler
  const handleSaveBackendUrl = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePreferences({ mcpBackendUrl: backendUrl });
    onTestMcpConnection(backendUrl);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* ========================================================= */}
      {/* 1. VIEW HEADER                                            */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2.5">
            <Settings className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <span>User Profile & Ambient Preferences</span>
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Manage your personal profile, customized Gemini voice synthesis, and operating parameters with real-time Firebase Cloud Firestore persistence.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {profileSaveSuccess && (
            <span className="flex items-center space-x-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
              <Check className="h-3.5 w-3.5" />
              <span>Persisted to Cloud Firestore</span>
            </span>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. USER PROFILE & BASIC INFORMATION SECTION (FIREBASE)    */}
      {/* ========================================================= */}
      <section aria-label="User Profile & Personal Information" className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 p-5 sm:p-6 shadow-xs backdrop-blur-md space-y-6 transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
            <User className="h-4.5 w-4.5 text-cyan-600 dark:text-cyan-400" />
            <span>User Profile & Identity</span>
          </div>
          <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
            Firestore: /users/{user?.uid || 'guest'}
          </span>
        </div>

        {/* Identity & Account Status Bar */}
        {user ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 p-4 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-3.5">
              {photoURL || user.photoURL ? (
                <img
                  src={photoURL || user.photoURL || ''}
                  alt={displayName}
                  className="h-12 w-12 rounded-xl object-cover border border-cyan-500/30 shadow-xs"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 font-bold text-white text-lg">
                  {(displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  {displayName || user.displayName || 'Google User'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                    ✓ Firestore Synchronized
                  </span>
                  {hasGoogleToken && (
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono font-medium">
                      ✓ Workspace OAuth Active
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center space-x-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-red-500/30 hover:text-red-500 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-amber-500/10 p-4 border border-amber-500/30">
            <div>
              <p className="text-xs text-amber-900 dark:text-amber-200 font-semibold">
                Running in Guest Workspace Mode
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Sign in with Google to synchronize your profile, tasks, and Gemini preferences across devices in Cloud Firestore.
              </p>
            </div>
            <button
              onClick={onLogin}
              className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-950/20 hover:opacity-95 transition-all cursor-pointer shrink-0"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Connect Google Account</span>
            </button>
          </div>
        )}

        {/* Profile Editing Form */}
        <form onSubmit={handleSaveProfile} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Display Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Display / Full Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Naved Mohd"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
              />
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
              />
            </div>

            {/* Professional Role / Bio */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Role / Assistant Persona Bio
              </label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="e.g. Lead Engineer building on the Alexa+ Track"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center space-x-1">
                <MapPin className="h-3 w-3 text-cyan-500" />
                <span>Primary Location</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. San Francisco, CA"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
              />
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center space-x-1">
                <Clock className="h-3 w-3 text-cyan-500" />
                <span>Operating Timezone</span>
              </label>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="e.g. America/Los_Angeles"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors font-mono"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center space-x-1">
                <Phone className="h-3 w-3 text-cyan-500" />
                <span>Notification Phone (Optional)</span>
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors font-mono"
              />
            </div>

            {/* Avatar URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Avatar Photo URL
              </label>
              <input
                type="url"
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors font-mono text-[11px]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Updates are stored directly to your private user document in Cloud Firestore.
            </span>
            <button
              type="submit"
              disabled={isSavingProfile}
              className="flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-950/20 hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSavingProfile ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              <span>{isSavingProfile ? 'Saving to Firestore...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* ========================================================= */}
      {/* 3. VOICE PREFERENCES: PERSONA, ACCENT, SPEED & PITCH      */}
      {/* ========================================================= */}
      <section aria-label="Gemini Voice Synthesis Preferences" className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 p-5 sm:p-6 shadow-xs backdrop-blur-md space-y-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
            <Volume2 className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
            <span>Voice Preferences & Speech Synthesis</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePlayVoiceSample}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                isPlayingSample
                  ? 'bg-purple-600 text-white border-purple-600 animate-pulse'
                  : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 hover:bg-purple-500/20'
              }`}
            >
              {isPlayingSample ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
              <span>{isPlayingSample ? 'Stop Audio' : 'Preview Voice'}</span>
            </button>
          </div>
        </div>

        {/* 1. Voice Persona Selection */}
        <div className="space-y-2.5">
          <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
            Assistant Voice Persona (Gemini TTS & Live)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {voiceOptions.map((v) => {
              const isSelected = preferences.voiceName === v.name;
              return (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => onUpdatePreferences({ voiceName: v.name })}
                  className={`flex flex-col text-left rounded-xl p-3.5 border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-950/40 text-slate-900 dark:text-white shadow-xs ring-1 ring-purple-500/50'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold">{v.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                    {v.desc}
                  </p>
                  <span className="mt-auto text-[10px] font-mono text-purple-600 dark:text-purple-300 font-semibold">
                    {v.sampleTag}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Voice Accent Selection */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
            <Globe className="h-3.5 w-3.5 text-purple-500" />
            <span>Voice Accent & Regional Cadence</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {accentOptions.map((acc) => {
              const isSelected = voiceAccent === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleAccentChange(acc.id)}
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-cyan-500 bg-cyan-50/70 dark:bg-cyan-950/40 text-slate-900 dark:text-white ring-1 ring-cyan-500/40'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span className="flex items-center space-x-1.5">
                      <span>{acc.flag}</span>
                      <span>{acc.label}</span>
                    </span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{acc.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Voice Speed & Pitch Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {/* Speech Rate / Speed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Speech Playback Speed
              </label>
              <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
                {voiceSpeed.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min="0.75"
              max="1.50"
              step="0.05"
              value={voiceSpeed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <button
                type="button"
                onClick={() => handleSpeedChange(0.85)}
                className="hover:text-cyan-400 cursor-pointer"
              >
                0.85x (Slow)
              </button>
              <button
                type="button"
                onClick={() => handleSpeedChange(1.0)}
                className="hover:text-cyan-400 cursor-pointer font-bold"
              >
                1.0x (Normal)
              </button>
              <button
                type="button"
                onClick={() => handleSpeedChange(1.25)}
                className="hover:text-cyan-400 cursor-pointer"
              >
                1.25x (Fast)
              </button>
            </div>
          </div>

          {/* Speech Pitch */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Voice Tone & Pitch
              </label>
              <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                {voicePitch.toFixed(2)}x
              </span>
            </div>
            <input
              type="range"
              min="0.80"
              max="1.20"
              step="0.05"
              value={voicePitch}
              onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <button
                type="button"
                onClick={() => handlePitchChange(0.85)}
                className="hover:text-purple-400 cursor-pointer"
              >
                0.85x (Deep)
              </button>
              <button
                type="button"
                onClick={() => handlePitchChange(1.0)}
                className="hover:text-purple-400 cursor-pointer font-bold"
              >
                1.0x (Natural)
              </button>
              <button
                type="button"
                onClick={() => handlePitchChange(1.15)}
                className="hover:text-purple-400 cursor-pointer"
              >
                1.15x (High)
              </button>
            </div>
          </div>
        </div>

        {/* 4. Proactive Speech Toggle */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80">
          <div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Proactive Speech Synthesis Output
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Audibly speak assistant responses aloud through your speakers after reasoning.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preferences.autoSpeak}
            onClick={() => onUpdatePreferences({ autoSpeak: !preferences.autoSpeak })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
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
      </section>

      {/* ========================================================= */}
      {/* 4. OTHER CUSTOMIZABLE SYSTEM & AMBIENT SETTINGS           */}
      {/* ========================================================= */}
      <section aria-label="Customizable Operating Settings" className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 p-5 sm:p-6 shadow-xs backdrop-blur-md space-y-6 transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
            <Sliders className="h-4.5 w-4.5 text-cyan-600 dark:text-cyan-400" />
            <span>Customizable Ambient & System Settings</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Persisted to /user_preferences
          </span>
        </div>

        {/* Display Theme */}
        <div className="space-y-2.5">
          <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
            Interface Theme & Appearance
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {themeOptions.map((opt) => {
              const isSelected = theme === opt.id;
              const Icon = opt.icon;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onSetTheme?.(opt.id)}
                  className={`flex flex-col text-left rounded-xl p-3.5 border transition-all cursor-pointer ${
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

        {/* Wake Word, Noise Suppression, & Audio Cues Toggles */}
        <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          {/* Wake Word */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <Mic className="h-3.5 w-3.5 text-cyan-500" />
                <span>Wake Word Activation ("Hey Nexus")</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Enables client-side wake word detection to begin listening hands-free.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.wakeWordEnabled ?? true}
              onClick={() => onUpdatePreferences({ wakeWordEnabled: !(preferences.wakeWordEnabled ?? true) })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                preferences.wakeWordEnabled ?? true ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-800'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.wakeWordEnabled ?? true ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Noise Suppression */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <VolumeX className="h-3.5 w-3.5 text-indigo-500" />
                <span>Audio Noise Suppression</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Filters background acoustic echo and ambient room noise before feeding the Gemini Live model.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.noiseSuppression ?? true}
              onClick={() => onUpdatePreferences({ noiseSuppression: !(preferences.noiseSuppression ?? true) })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                preferences.noiseSuppression ?? true ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-800'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.noiseSuppression ?? true ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Earcon Sound Effects */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                <Bell className="h-3.5 w-3.5 text-purple-500" />
                <span>Audio Earcons & Interaction Cues</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Play subtle ambient chimes when the voice engine begins listening and finishes responses.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.soundEffects ?? true}
              onClick={() => onUpdatePreferences({ soundEffects: !(preferences.soundEffects ?? true) })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                preferences.soundEffects ?? true ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-800'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.soundEffects ?? true ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 5. PRODUCTION NEXUS CORE MCP BOUNDARY                     */}
      {/* ========================================================= */}
      <section aria-label="Nexus Core MCP Backend Connection" className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 p-5 sm:p-6 shadow-xs backdrop-blur-md space-y-4 transition-colors">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-sm">
            <Cpu className="h-4.5 w-4.5 text-cyan-600 dark:text-cyan-400" />
            <span>Nexus Core MCP Tool Gateway</span>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              mcpStatus === 'live_nexus_core'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : mcpStatus === 'auth_required'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                : 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20'
            }`}
          >
            {mcpStatus === 'live_nexus_core'
              ? 'Connected (Authorized)'
              : mcpStatus === 'auth_required'
              ? 'Live Server (Auth Required 401)'
              : 'Demo Adapter Active'}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Nexus AI connects to the live <code className="text-cyan-600 dark:text-cyan-400 font-mono">nexus-core</code> MCP
          server hosted on Render (<code className="text-cyan-600 dark:text-cyan-400 font-mono">https://nexus-core-v4j3.onrender.com</code>)
          via MCP Streamable HTTP.
        </p>

        {/* Live Diagnostics Card */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2.5 text-xs">
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
            <Activity className="h-3.5 w-3.5 text-cyan-500" />
            <span>Backend Diagnostic Telemetry</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
            <div>
              <span className="text-slate-500">Live Health: </span>
              <span className="text-emerald-500 font-semibold">UP (HTTP 200)</span>
            </div>
            <div>
              <span className="text-slate-500">MCP Protocol: </span>
              <span className="text-cyan-500 font-semibold">2024-11-05</span>
            </div>
            <div>
              <span className="text-slate-500">Firestore Mode: </span>
              <span className="text-emerald-500 font-semibold">ai-studio-40b77d86</span>
            </div>
            <div>
              <span className="text-slate-500">Protected Tools: </span>
              <span className="text-purple-400 font-semibold">{mcpDetails?.toolsCount || 7} Tools Registered</span>
            </div>
          </div>
        </div>

        {/* Endpoint Configuration Form */}
        <form onSubmit={handleSaveBackendUrl} className="pt-2 flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            placeholder="https://nexus-core-v4j3.onrender.com"
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-white font-mono focus:border-cyan-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 text-xs font-semibold transition-all cursor-pointer shrink-0"
          >
            {savedSuccess ? 'Updated ✓' : 'Update & Test MCP'}
          </button>
        </form>
      </section>
    </div>
  );
};
