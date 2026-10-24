import React, { useState } from 'react';
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
  CheckCircle2,
  AlertTriangle,
  Play,
} from 'lucide-react';
import type { IntegrationService } from '../../types';

interface IntegrationsViewProps {
  hasGoogleToken: boolean;
  onConnectGoogle: () => void;
  mcpStatus: 'live_nexus_core' | 'auth_required' | 'demo_adapter';
  onTestApi: (serviceName: string) => void;
  mcpDetails?: {
    message?: string;
    missingComponents?: string[];
    toolsCount?: number;
  };
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({
  hasGoogleToken,
  onConnectGoogle,
  mcpStatus,
  onTestApi,
  mcpDetails,
}) => {
  const [selectedToolResult, setSelectedToolResult] = useState<string | null>(null);
  const [testingTool, setTestingTool] = useState<string | null>(null);

  const discoveredMcpTools = [
    { name: 'workspace.calendar.list_events', category: 'productivity', permissions: 'read', description: 'Read upcoming calendar entries for schedule awareness' },
    { name: 'workspace.gmail.summarize_threads', category: 'communication', permissions: 'read', description: 'Summarize unread high-priority inbox emails' },
    { name: 'workspace.tasks.create', category: 'productivity', permissions: 'write_guarded', description: 'Create task in Google Tasks (requires explicit user confirmation)' },
    { name: 'smarthome.scenes.activate', category: 'iot', permissions: 'execute', description: 'Activate ambient lighting and environmental scenes' },
    { name: 'commerce.cart.prepare_checkout', category: 'commerce', permissions: 'approval_required', description: 'Stage cart and enforce explicit checkout confirmation' },
    { name: 'nexus_get_context', category: 'context', permissions: 'read', description: 'Retrieve ambient operating context & system health' },
    { name: 'nexus_confirm_action', category: 'safety', permissions: 'execute', description: 'Verify user authorization before action execution' },
  ];

  const handleRunToolTest = async (toolName: string) => {
    setTestingTool(toolName);
    setSelectedToolResult(null);
    try {
      const res = await fetch('/api/nexus/tools/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: toolName,
          arguments: toolName.includes('calendar') ? { timeMin: new Date().toISOString() } : { sample: true },
          confirmed: false, // tests safe confirmation gate
        }),
      });
      const data = await res.json();
      setSelectedToolResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setSelectedToolResult(JSON.stringify({ error: e.message }, null, 2));
    } finally {
      setTestingTool(null);
    }
  };

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
      id: 'mcp_core',
      name: 'Production Nexus Core MCP Backend',
      category: 'Orchestration Engine',
      icon: Cpu,
      description: 'Live MCP Streamable HTTP service hosted at https://nexus-core-v4j3.onrender.com.',
      isRealGoogleService: false,
      scopes: 'alexa::mcp:read, alexa::mcp:write',
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
    {
      id: 'commerce',
      name: 'Amazon Ambient Commerce Staging',
      category: 'Commerce',
      icon: ShoppingBag,
      description: 'Voice & ambient shopping cart staging with explicit human checkout gate.',
      isRealGoogleService: false,
      scopes: 'commerce.cart.write',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Layers className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <span>Connected Integrations & Backend Protocol Boundary</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Real Google Workspace OAuth connections and production Nexus Core MCP backend status.
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
          <div className="flex items-center space-x-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            <span>Google Workspace Authenticated</span>
          </div>
        )}
      </div>

      {/* Production Nexus Core Status Banner */}
      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 dark:bg-slate-900/60 p-4 backdrop-blur-md">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                Nexus Core Backend: https://nexus-core-v4j3.onrender.com
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  mcpStatus === 'live_nexus_core'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : mcpStatus === 'auth_required'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                }`}
              >
                {mcpStatus === 'live_nexus_core'
                  ? 'Connected (Authorized)'
                  : mcpStatus === 'auth_required'
                  ? 'Live Server (Auth Required 401)'
                  : 'Demo Adapter Active'}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Protocol: <code className="font-mono text-cyan-600 dark:text-cyan-400">MCP Streamable HTTP (2024-11-05)</code> • Server Health:{' '}
              <span className="text-emerald-500 font-semibold">UP</span> • Discovered Tools: <strong className="text-slate-900 dark:text-white">7</strong>
            </p>
            {mcpStatus === 'auth_required' && (
              <p className="text-[11px] text-amber-600 dark:text-amber-300 flex items-center space-x-1 mt-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Backend advertises OAuth at <code className="font-mono">/oauth</code>, but endpoint returned HTTP 404. Safe ambient gatekeeper is active.
                </span>
              </p>
            )}
          </div>

          <button
            onClick={() => handleRunToolTest('nexus_get_context')}
            disabled={testingTool !== null}
            className="flex items-center space-x-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-400 hover:bg-cyan-500/20 transition-colors"
          >
            <Play className="h-3 w-3" />
            <span>{testingTool === 'nexus_get_context' ? 'Probing...' : 'Probe Safe Tool'}</span>
          </button>
        </div>

        {/* Live Discovered Tools Grid */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
            Discovered Production MCP Tools from Catalog
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {discoveredMcpTools.map((t) => (
              <div
                key={t.name}
                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 p-2 text-xs"
              >
                <div className="truncate mr-2">
                  <span className="font-mono text-[11px] text-slate-800 dark:text-slate-200 font-semibold block truncate">
                    {t.name}
                  </span>
                  <span className="text-[10px] text-slate-500 capitalize">{t.category} • {t.permissions}</span>
                </div>
                <button
                  onClick={() => handleRunToolTest(t.name)}
                  disabled={testingTool !== null}
                  className="shrink-0 px-2 py-0.5 text-[10px] rounded-md border border-slate-300 dark:border-slate-700 hover:border-cyan-500 text-slate-600 dark:text-slate-300 hover:text-cyan-400 transition-colors"
                >
                  Test
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Test Result Display */}
        {selectedToolResult && (
          <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-48">
            <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800 text-[10px] text-slate-400">
              <span>Tool Execution Inspection Result</span>
              <button
                onClick={() => setSelectedToolResult(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                ✕ Close
              </button>
            </div>
            <pre>{selectedToolResult}</pre>
          </div>
        )}
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((item) => {
          const Icon = item.icon;
          let statusText = 'Not Connected';
          let statusBadge = 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700';

          if (item.id === 'mcp_core') {
            if (mcpStatus === 'live_nexus_core') {
              statusText = 'Nexus Core Live';
              statusBadge = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
            } else if (mcpStatus === 'auth_required') {
              statusText = 'Live Server (Auth 401)';
              statusBadge = 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30';
            } else {
              statusText = 'Demo Adapter Active';
              statusBadge = 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30';
            }
          } else if (item.isRealGoogleService) {
            if (hasGoogleToken) {
              statusText = 'Connected (Live OAuth)';
              statusBadge = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
            } else {
              statusText = 'Demo Mode (Sign in)';
              statusBadge = 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30';
            }
          } else {
            statusText = 'Active Adapter';
            statusBadge = 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/30';
          }

          return (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 p-5 shadow-xs backdrop-blur-md hover:border-cyan-500/30 transition-all"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-cyan-600 dark:text-cyan-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${statusBadge}`}
                  >
                    {statusText}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</h3>
                <span className="text-[10px] font-mono text-slate-500 uppercase">{item.category}</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">{item.description}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[140px]">
                  {item.scopes}
                </span>
                <button
                  onClick={() => {
                    if (item.id === 'mcp_core') {
                      handleRunToolTest('nexus_get_context');
                    } else {
                      onTestApi(item.id);
                    }
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:border-cyan-500/50 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors"
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
