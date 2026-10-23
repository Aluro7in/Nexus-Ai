import React from 'react';
import {
  Calendar,
  Mail,
  CheckSquare,
  Sun,
  CloudRain,
  Moon,
  Home,
  Sliders,
  ShoppingBag,
  ExternalLink,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { CalendarEvent, GmailMessageSummary, GoogleTaskItem } from '../lib/workspace';

interface SmartDisplayHubProps {
  events: CalendarEvent[];
  messages: GmailMessageSummary[];
  tasks: GoogleTaskItem[];
  hasGoogleToken: boolean;
  onNavigate: (view: string) => void;
  onSceneActivate: (sceneName: string) => void;
}

export const SmartDisplayHub: React.FC<SmartDisplayHubProps> = ({
  events,
  messages,
  tasks,
  hasGoogleToken,
  onNavigate,
  onSceneActivate,
}) => {
  const nextEvent = events[0];
  const pendingTasks = tasks.filter((t) => t.status === 'needsAction');
  const unreadMessages = messages.filter((m) => m.unread);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {/* 1. Schedule & Calendar Widget */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md hover:border-cyan-500/30 transition-all flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-cyan-400">
              <Calendar className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Calendar & Schedule</span>
            </div>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                hasGoogleToken
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
              }`}
            >
              {hasGoogleToken ? 'Google Synced' : 'Demo Mode'}
            </span>
          </div>

          <div className="mt-4">
            {nextEvent ? (
              <div>
                <div className="flex items-center space-x-1.5 text-xs text-cyan-300/80 mb-1">
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
                <h4 className="text-sm font-semibold text-white truncate">{nextEvent.summary}</h4>
                {nextEvent.location && (
                  <p className="text-xs text-slate-400 mt-1 truncate">{nextEvent.location}</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No upcoming meetings scheduled.</p>
            )}
          </div>

          {events.length > 1 && (
            <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-2">
              <div className="text-[11px] text-slate-400 font-medium">Up next:</div>
              {events.slice(1, 3).map((e) => (
                <div key={e.id} className="flex items-center justify-between text-xs text-slate-300">
                  <span className="truncate max-w-[170px]">{e.summary}</span>
                  <span className="text-[10px] text-slate-500">
                    {e.start.dateTime
                      ? new Date(e.start.dateTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Later'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onNavigate('integrations')}
          className="mt-4 text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center space-x-1"
        >
          <span>View calendar integration</span>
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* 2. Communication & Inbox Brief */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md hover:border-cyan-500/30 transition-all flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-indigo-400">
              <Mail className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Gmail Inbox</span>
            </div>
            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-medium">
              {unreadMessages.length} Unread
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {messages.slice(0, 2).map((m) => (
              <div key={m.id} className="rounded-xl bg-slate-950/40 p-2.5 border border-slate-800/60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-indigo-300 truncate max-w-[150px]">
                    {m.from.split('<')[0]}
                  </span>
                  <span className="text-[10px] text-slate-500">{m.date}</span>
                </div>
                <div className="text-xs font-medium text-slate-200 truncate">{m.subject}</div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{m.snippet}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => onNavigate('integrations')}
          className="mt-4 text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
        >
          <span>Open inbox assistant</span>
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>

      {/* 3. Ambient Home & Scenes */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md hover:border-cyan-500/30 transition-all flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-amber-400">
              <Home className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Smart Home Scenes</span>
            </div>
            <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
              Matter Ready
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { id: 'focus', name: 'Focus Glow', icon: Sun, color: 'text-amber-400' },
              { id: 'cinema', name: 'Cinema Mode', icon: Moon, color: 'text-purple-400' },
              { id: 'ambient', name: 'Ambient Chill', icon: Sparkles, color: 'text-cyan-400' },
              { id: 'night', name: 'Goodnight', icon: Moon, color: 'text-blue-400' },
            ].map((scene) => {
              const Icon = scene.icon;
              return (
                <button
                  key={scene.id}
                  onClick={() => onSceneActivate(scene.name)}
                  className="flex items-center space-x-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 hover:border-cyan-500/40 hover:bg-slate-800/60 transition-all text-left group"
                >
                  <Icon className={`h-4 w-4 ${scene.color} group-hover:scale-110 transition-transform`} />
                  <span className="text-xs font-medium text-slate-300 group-hover:text-white">
                    {scene.name}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl bg-slate-950/40 p-2.5 border border-slate-800/60 flex items-center justify-between text-xs text-slate-300">
            <span>Climate: 71°F • Eco Mode</span>
            <span className="text-emerald-400 text-[11px] font-semibold">Active</span>
          </div>
        </div>

        <button
          onClick={() => onNavigate('tasks')}
          className="mt-4 text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center space-x-1"
        >
          <span>Manage home devices</span>
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
