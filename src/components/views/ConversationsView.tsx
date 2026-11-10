import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Search,
  Volume2,
  Trash2,
  Bot,
  User,
  Sparkles,
  Calendar,
  Send,
  X,
  Filter,
  Check,
  Copy,
  Clock,
  ArrowUpDown,
  Download,
  FileText,
  SlidersHorizontal,
  ChevronDown,
  Wrench,
  Radio,
  Share2,
} from 'lucide-react';
import type { ConversationMessage } from '../../types';

interface ConversationsViewProps {
  messages: ConversationMessage[];
  onSendMessage: (text: string) => void;
  onClearHistory: () => void;
  onDeleteMessage?: (id: string) => void;
  onPlaySpeech: (text: string) => void;
}

export type ParticipantFilter = 'all' | 'user' | 'assistant' | 'tools';
export type DatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';
export type SortOrder = 'desc' | 'asc';

export const QUICK_SEARCH_CHIPS = [
  'Calendar',
  'Gmail',
  'Shopping',
  'Tasks',
  'Undo',
  'Workflow',
  'Weather',
  'Voice',
];

export const ConversationsView: React.FC<ConversationsViewProps> = ({
  messages,
  onSendMessage,
  onClearHistory,
  onDeleteMessage,
  onPlaySpeech,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [participantFilter, setParticipantFilter] = useState<ParticipantFilter>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [toolsOnly, setToolsOnly] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Press "/" to focus search input; "Esc" to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper: check if a message matches date criteria
  const matchesDateFilter = (
    createdAt: string,
    preset: DatePreset,
    start?: string,
    end?: string
  ): boolean => {
    if (preset === 'all') return true;

    const lower = (createdAt || '').toLowerCase();
    const now = new Date();

    if (preset === 'today') {
      if (
        lower.includes('today') ||
        lower.includes('just now') ||
        lower.includes('min') ||
        lower.includes('sec')
      ) {
        return true;
      }
      const todayISO = now.toISOString().slice(0, 10);
      return lower.includes(todayISO);
    }

    if (preset === 'yesterday') {
      if (lower.includes('yesterday')) return true;
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayISO = yesterday.toISOString().slice(0, 10);
      return lower.includes(yesterdayISO);
    }

    if (preset === 'week') {
      if (
        lower.includes('today') ||
        lower.includes('yesterday') ||
        lower.includes('just now') ||
        lower.includes('days ago') ||
        lower.includes('day ago')
      ) {
        return true;
      }
      const parsed = Date.parse(createdAt);
      if (!isNaN(parsed)) {
        const diffDays = (now.getTime() - parsed) / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      }
      return true;
    }

    if (preset === 'month') {
      const parsed = Date.parse(createdAt);
      if (!isNaN(parsed)) {
        const diffDays = (now.getTime() - parsed) / (1000 * 60 * 60 * 24);
        return diffDays <= 30;
      }
      return true;
    }

    if (preset === 'custom') {
      if (!start && !end) return true;
      const parsed = Date.parse(createdAt);
      if (isNaN(parsed)) {
        // If string representation contains the start or end string
        if (start && lower.includes(start)) return true;
        if (end && lower.includes(end)) return true;
        return true;
      }
      const msgDate = new Date(parsed);
      msgDate.setHours(0, 0, 0, 0);

      if (start) {
        const startDateObj = new Date(start);
        startDateObj.setHours(0, 0, 0, 0);
        if (msgDate < startDateObj) return false;
      }

      if (end) {
        const endDateObj = new Date(end);
        endDateObj.setHours(23, 59, 59, 999);
        if (msgDate > endDateObj) return false;
      }

      return true;
    }

    return true;
  };

  // Participant counter breakdown
  const participantCounts = useMemo(() => {
    let userCount = 0;
    let assistantCount = 0;
    let toolsCount = 0;

    messages.forEach((m) => {
      if (m.role === 'user') userCount++;
      if (m.role === 'assistant') assistantCount++;
      if (m.toolCalls && m.toolCalls.length > 0) toolsCount++;
    });

    return {
      all: messages.length,
      user: userCount,
      assistant: assistantCount,
      tools: toolsCount,
    };
  }, [messages]);

  // Comprehensive Search & Filter pipeline
  const filteredMessages = useMemo(() => {
    const rawTokens = searchQuery
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    const result = messages.filter((m) => {
      // 1. Participant Filter
      if (participantFilter === 'user' && m.role !== 'user') return false;
      if (participantFilter === 'assistant' && m.role !== 'assistant') return false;
      if (participantFilter === 'tools' && (!m.toolCalls || m.toolCalls.length === 0)) return false;

      // 2. Specific toolsOnly toggle
      if (toolsOnly && (!m.toolCalls || m.toolCalls.length === 0)) return false;

      // 3. Date Preset & Range
      if (!matchesDateFilter(m.createdAt, datePreset, startDate, endDate)) return false;

      // 4. Keyword tokens search (matches if all or any tokens hit)
      if (rawTokens.length > 0) {
        const searchableText = [
          m.content || '',
          m.role || '',
          m.createdAt || '',
          ...(m.toolCalls?.map(
            (tc) =>
              `${tc.name} ${JSON.stringify(tc.args || {})} ${JSON.stringify(tc.result || {})}`
          ) || []),
        ]
          .join(' ')
          .toLowerCase();

        // Every token in search query must be present
        const matchesAllTokens = rawTokens.every((token) => searchableText.includes(token));
        if (!matchesAllTokens) return false;
      }

      return true;
    });

    // Sort order: default desc (newest first) or asc (oldest first)
    if (sortOrder === 'asc') {
      return [...result].reverse();
    }
    return result;
  }, [
    messages,
    searchQuery,
    participantFilter,
    datePreset,
    startDate,
    endDate,
    toolsOnly,
    sortOrder,
  ]);

  // Highlight matching keyword tokens in text
  const highlightMatches = (text: string, query: string) => {
    if (!query.trim()) return text;
    const tokens = query
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (tokens.length === 0) return text;
    const regex = new RegExp(`(${tokens.join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          className="bg-cyan-500/30 text-cyan-200 dark:bg-cyan-500/40 dark:text-cyan-100 rounded px-1 py-0.5 font-semibold"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePlayVoice = (id: string, text: string) => {
    setActiveSpeechId(id);
    onPlaySpeech(text);
    setTimeout(() => setActiveSpeechId(null), 3000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setParticipantFilter('all');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setToolsOnly(false);
    setSortOrder('desc');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    participantFilter !== 'all' ||
    datePreset !== 'all' ||
    startDate !== '' ||
    endDate !== '' ||
    toolsOnly;

  // Export filtered logs to JSON file
  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(filteredMessages, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `nexus_conversation_history_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setExportNotice('Exported conversation logs as JSON');
    setTimeout(() => setExportNotice(null), 3000);
  };

  // Export filtered logs to Text/Markdown report
  const handleExportMarkdown = () => {
    const lines = [
      `# Nexus AI Conversation History Log`,
      `Exported: ${new Date().toLocaleString()}`,
      `Total Messages: ${filteredMessages.length}`,
      `Filters Applied: ${hasActiveFilters ? 'Yes' : 'None'}`,
      `----------------------------------------`,
      '',
    ];

    filteredMessages.forEach((m, idx) => {
      lines.push(`### [${m.createdAt}] ${m.role.toUpperCase()}`);
      lines.push(m.content);
      if (m.toolCalls && m.toolCalls.length > 0) {
        lines.push(`*Tool Invocations:*`);
        m.toolCalls.forEach((tc) => {
          lines.push(`- ${tc.name}: ${JSON.stringify(tc.args || {})}`);
        });
      }
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute(
      'download',
      `nexus_conversation_log_${new Date().toISOString().slice(0, 10)}.md`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);

    setExportNotice('Exported conversation log as Markdown');
    setTimeout(() => setExportNotice(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <span>Searchable Conversation History</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Full-text keyword search and multi-criteria audit trail of past voice, chat, and tool executions.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {/* Export Menu */}
          <div className="relative inline-block text-left">
            <button
              onClick={handleExportJSON}
              title="Export filtered conversation logs as JSON"
              className="flex items-center space-x-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span> JSON
            </button>
          </div>

          <button
            onClick={handleExportMarkdown}
            title="Export filtered conversation logs as Markdown document"
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span> MD
          </button>

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center space-x-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              showAdvancedFilters || hasActiveFilters
                ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={onClearHistory}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-red-500/40 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Export feedback toast notice */}
      {exportNotice && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2 text-xs text-emerald-700 dark:text-emerald-300 transition-all">
          <div className="flex items-center space-x-2">
            <Check className="h-4 w-4 text-emerald-500" />
            <span>{exportNotice}</span>
          </div>
          <button
            onClick={() => setExportNotice(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:opacity-75"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Search Input & Quick Filter Controls Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/70 p-4 shadow-sm dark:shadow-inner backdrop-blur-md space-y-3.5 transition-colors">
        {/* Main Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keywords, topics, actions, tool invocations... (Press '/' to search, 'Esc' to clear)"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 pl-10 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              title="Clear search text (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Quick Search Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mr-1 flex items-center space-x-1">
            <span>Quick search:</span>
          </span>
          {QUICK_SEARCH_CHIPS.map((chip) => {
            const isActive = searchQuery.toLowerCase() === chip.toLowerCase();
            return (
              <button
                key={chip}
                onClick={() => setSearchQuery(isActive ? '' : chip)}
                className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'bg-cyan-500 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>

        {/* Primary Filter Rows: Participant & Date Presets */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {/* Participant Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1 flex items-center space-x-1">
              <User className="h-3 w-3 inline text-slate-400" />
              <span>Participant:</span>
            </span>

            {[
              { id: 'all', label: 'All', count: participantCounts.all },
              { id: 'user', label: 'User / Voice', count: participantCounts.user },
              { id: 'assistant', label: 'Nexus AI', count: participantCounts.assistant },
              { id: 'tools', label: 'Tool Traces', count: participantCounts.tools },
            ].map((p) => {
              const isSelected = participantFilter === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setParticipantFilter(p.id as ParticipantFilter)}
                  className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <span>{p.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono tabular-nums ${
                      isSelected
                        ? 'bg-cyan-500 text-white dark:bg-cyan-400 dark:text-slate-950 font-bold'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {p.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Date Preset Selector & Sort Toggle */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
              <Calendar className="h-3 w-3 inline text-slate-400" />
              <span>Date:</span>
            </span>

            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="week">Past 7 Days</option>
              <option value="month">Past 30 Days</option>
              <option value="custom">Custom Date Range...</option>
            </select>

            {/* Sort Toggle */}
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              title={`Sort messages: currently ${sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}`}
              className="flex items-center space-x-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs text-slate-700 dark:text-slate-300 hover:border-cyan-500/40"
            >
              <ArrowUpDown className="h-3 w-3 text-slate-400" />
              <span>{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
            </button>
          </div>
        </div>

        {/* Advanced Filters Expandable Drawer */}
        {(showAdvancedFilters || datePreset === 'custom') && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Custom Date Range Picker */}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (datePreset !== 'custom') setDatePreset('custom');
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    if (datePreset !== 'custom') setDatePreset('custom');
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Special Attributes Toggle */}
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Attributes
                </label>
                <label className="flex items-center space-x-2 mt-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={toolsOnly}
                    onChange={(e) => setToolsOnly(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    Tool invocations only
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Active Filters Summary Bar */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Found {filteredMessages.length} of {messages.length} message
                {filteredMessages.length === 1 ? '' : 's'}
              </span>
              {searchQuery && (
                <span className="rounded-md bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 px-2 py-0.5 text-[11px]">
                  Keyword: "{searchQuery}"
                </span>
              )}
              {participantFilter !== 'all' && (
                <span className="rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-2 py-0.5 text-[11px]">
                  Participant: {participantFilter}
                </span>
              )}
              {datePreset !== 'all' && (
                <span className="rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[11px]">
                  Date: {datePreset === 'custom' ? `${startDate || 'Start'} to ${endDate || 'Now'}` : datePreset}
                </span>
              )}
              {toolsOnly && (
                <span className="rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 text-[11px]">
                  With tools only
                </span>
              )}
            </div>

            <button
              onClick={clearAllFilters}
              className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline flex items-center space-x-1"
            >
              <X className="h-3 w-3" />
              <span>Reset All Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Messages List Area */}
      <div className="space-y-4 min-h-[420px]">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
            <MessageSquare className="h-9 w-9 text-slate-400 dark:text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {hasActiveFilters ? 'No matching conversation messages found' : 'No conversations recorded'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {hasActiveFilters
                ? 'Try broadening your keyword query or resetting participant and date range filters.'
                : 'Start a voice session through the central voice orb or enter a command below.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="mt-3.5 rounded-xl bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950 font-semibold px-4 py-1.5 text-xs hover:opacity-90 transition-opacity"
              >
                Clear All Search Filters
              </button>
            )}
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isUser = msg.role === 'user';
            const isSystem = msg.role === 'system';
            const isPlaying = activeSpeechId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                {/* Speaker Avatar */}
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                    isUser
                      ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 shadow-xs'
                      : isSystem
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 shadow-xs'
                      : 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40 shadow-xs'
                  }`}
                >
                  {isUser ? <User className="h-4 w-4" /> : isSystem ? <Wrench className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-2xl w-full rounded-2xl p-4 shadow-sm transition-all ${
                    isUser
                      ? 'bg-gradient-to-r from-cyan-50 to-white dark:from-cyan-950/40 dark:to-slate-900 border border-cyan-200 dark:border-cyan-500/30 text-slate-900 dark:text-slate-100'
                      : isSystem
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-slate-800 dark:text-slate-200'
                      : 'bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {/* Message Header: Speaker & Timestamp (Zero-Pill Discipline) */}
                  <div className="flex items-center justify-between space-x-4 mb-1.5 text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                        {isUser ? 'User / Voice' : isSystem ? 'System Gate' : 'Nexus AI'}
                      </span>
                      <span className="text-slate-400 dark:text-slate-600">·</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center space-x-1 tabular-nums">
                        <Clock className="h-3 w-3" />
                        <span>{msg.createdAt}</span>
                      </span>
                    </div>

                    {/* Delete Message Action */}
                    {onDeleteMessage && (
                      <button
                        onClick={() => onDeleteMessage(msg.id)}
                        className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-0.5 rounded transition-colors"
                        title="Delete this message"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Message Content with Highlighted Matches */}
                  <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                    {highlightMatches(msg.content, searchQuery)}
                  </p>

                  {/* Tool Call / Action Trace */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center space-x-1">
                        <Sparkles className="h-3 w-3" />
                        <span>Tool Invocation Trace</span>
                      </div>
                      {msg.toolCalls.map((tc, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg bg-slate-50 dark:bg-slate-950/70 p-2 font-mono text-[10px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
                        >
                          <div>
                            <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                              {highlightMatches(tc.name, searchQuery)}
                            </span>
                            <span className="text-slate-500 ml-1">
                              ({highlightMatches(JSON.stringify(tc.args || {}), searchQuery)})
                            </span>
                          </div>
                          {tc.result && (
                            <div className="mt-1 text-emerald-600 dark:text-emerald-400 truncate">
                              → {highlightMatches(JSON.stringify(tc.result), searchQuery)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions Bar (Copy & TTS) */}
                  <div className="mt-3 flex items-center justify-end space-x-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors py-1 px-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Copy message to clipboard"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span className="text-emerald-500 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    {!isUser && (
                      <button
                        onClick={() => handlePlayVoice(msg.id, msg.content)}
                        className={`flex items-center space-x-1 text-[11px] transition-colors py-1 px-1.5 rounded-md ${
                          isPlaying
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold'
                            : 'text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40'
                        }`}
                        title="Play with Gemini Voice"
                      >
                        <Volume2 className={`h-3 w-3 ${isPlaying ? 'animate-bounce' : ''}`} />
                        <span>{isPlaying ? 'Speaking...' : 'Speak'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Manual Input Bar */}
      <form
        onSubmit={handleSend}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-2.5 shadow-sm backdrop-blur-md flex items-center space-x-2 transition-colors"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a voice command or question for Nexus AI..."
          className="flex-1 bg-transparent px-3 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md shadow-cyan-950/20 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-95 transition-all"
          title="Send query"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};
