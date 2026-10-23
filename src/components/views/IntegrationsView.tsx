import React from 'react';
import {
  Layers,
  Calendar,
  Mail,
  HardDrive,
  CheckSquare,
  FileSpreadsheet,
  FileText,
  MessageCircle,
  Video,
  Bookmark,
  Users,
  Search,
  Cpu,
  Home,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  LogIn,
} from 'lucide-react';
import type { IntegrationService } from '../../types';

interface IntegrationsViewProps {
  hasGoogleToken: boolean;
  onConnectGoogle: () => void;
  mcpStatus: 'live_nexus_core' | 'demo_adapter';
  onTestApi: (serviceName: string) => void;
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({
  hasGoogleToken,
  onConnectGoogle,
  mcpStatus,
  onTestApi,
}) => {
  const integrations: Array<{
    id: string;
    name: string;
    category: string;
    icon: any;
    description: string;
    isRealGoogleService: boolean;
    scopes: string;
  }> = [
    {
      id: 'calendar',
      name: 'Google Calendar',
      category: 'Productivity',
      icon: Calendar,
      description: 'Reads agenda events, schedules meetings, checks availability.',
      isRealGoogleService: true,
      scopes: 'calendar.events, calendar.readonly',
    },
    {
      id: 'gmail',
      name: 'Gmail',
      category: 'Communication',
      icon: Mail,
      description: 'Analyzes priority inbox threads, generates draft replies, safe sending.',
      isRealGoogleService: true,
      scopes: 'gmail.readonly, gmail.send, gmail.compose',
    },
    {
      id: 'drive',
      name: 'Google Drive',
      category: 'Knowledge & Files',
      icon: HardDrive,
      description: 'Searches documents, presentation briefs, and storage assets.',
      isRealGoogleService: true,
      scopes: 'drive.readonly, drive.file',
    },
    {
      id: 'tasks',
      name: 'Google Tasks',
      category: 'Productivity',
      icon: CheckSquare,
      description: 'Syncs voice reminders into user to-do lists and default lists.',
      isRealGoogleService: true,
      scopes: 'tasks',
    },
    {
      id: 'sheets',
      name: 'Google Sheets',
      category: 'Productivity',
      icon: FileSpreadsheet,
      description: 'Structured data querying, household budgets, and metrics.',
      isRealGoogleService: true,
      scopes: 'spreadsheets.readonly',
    },
    {
      id: 'forms',
      name: 'Google Forms',
      category: 'Productivity',
      icon: FileText,
      description: 'Surveys and form submission workflows.',
      isRealGoogleService: true,
      scopes: 'forms.body.readonly',
    },
    {
      id: 'chat',
      name: 'Google Chat',
      category: 'Communication',
      icon: MessageCircle,
      description: 'Team spaces and real-time conversation notifications.',
      isRealGoogleService: true,
      scopes: 'chat.spaces.readonly, chat.messages.readonly',
    },
    {
      id: 'meet',
      name: 'Google Meet',
      category: 'Communication',
      icon: Video,
      description: 'Video conferences and space link generation.',
      isRealGoogleService: true,
      scopes: 'meetings.space.readonly',
    },
    {
      id: 'contacts',
      name: 'Google Contacts',
      category: 'People',
      icon: Users,
      description: 'Authorized contact lookup for emails, phone numbers, and relations.',
      isRealGoogleService: true,
      scopes: 'contacts.readonly',
    },
    {
      id: 'keep',
      name: 'Google Keep',
      category: 'Notes',
      icon: Bookmark,
      description: 'Ambient notes, quick memo dictation, and shopping lists.',
      isRealGoogleService: false,
      scopes: 'keep (Roadmap)',
    },
    {
      id: 'mcp_core',
      name: 'Antigravity Nexus MCP Core',
      category: 'Orchestration Engine',
      icon: Cpu,
      description: 'Streamable HTTP MCP tool registry, multi-step orchestration protocol.',
      isRealGoogleService: false,
      scopes: 'mcp://tools/*',
    },
    {
      id: 'smarthome',
      name: 'Alexa+ Smart Home Matter Bridge',
      category: 'IoT & Environment',
      icon: Home,
      description: 'Controls ambient lighting scenes, thermostats, and smart plugs.',
      isRealGoogleService: false,
      scopes: 'matter.devices.control',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Layers className="h-5 w-5 text-cyan-400" />
            <span>Connected Integrations & Capabilities</span>
          </h2>
          <p className="text-xs text-slate-400">
            Real Google Workspace OAuth connections and extensible Antigravity MCP Core adapters.
          </p>
        </div>

        {!hasGoogleToken ? (
          <button
            onClick={onConnectGoogle}
            className="flex items-center space-x-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-950/40 hover:opacity-95 transition-all"
          >
            <LogIn className="h-4 w-4" />
            <span>Sign In to Google Workspace</span>
          </button>
        ) : (
          <div className="flex items-center space-x-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            <span>Google Workspace Authenticated</span>
          </div>
        )}
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((item) => {
          const Icon = item.icon;
          let statusText = 'Not Connected';
          let statusBadge = 'bg-slate-800 text-slate-400 border-slate-700';

          if (item.id === 'mcp_core') {
            if (mcpStatus === 'live_nexus_core') {
              statusText = 'Nexus Core Live';
              statusBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
            } else {
              statusText = 'Demo Adapter Active';
              statusBadge = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
            }
          } else if (item.isRealGoogleService) {
            if (hasGoogleToken) {
              statusText = 'Connected (Live OAuth)';
              statusBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
            } else {
              statusText = 'Demo Mode (Sign in to activate)';
              statusBadge = 'bg-amber-500/10 text-amber-300 border-amber-500/30';
            }
          } else {
            statusText = 'Active Adapter';
            statusBadge = 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30';
          }

          return (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md hover:border-cyan-500/30 transition-all"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 border border-slate-800 text-cyan-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${statusBadge}`}
                  >
                    {statusText}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white">{item.name}</h3>
                <span className="text-[10px] font-mono text-slate-500 uppercase">{item.category}</span>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">{item.description}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]">
                  {item.scopes}
                </span>
                <button
                  onClick={() => onTestApi(item.id)}
                  className="rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
                >
                  Test Query
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
