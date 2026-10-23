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
  CornerDownLeft,
} from 'lucide-react';
import type { ConversationMessage } from '../../types';

interface ConversationsViewProps {
  messages: ConversationMessage[];
  onSendMessage: (text: string) => void;
  onClearHistory: () => void;
  onPlaySpeech: (text: string) => void;
}

type ParticipantFilter = 'all' | 'user' | 'assistant' | 'tools';
type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom';

export const ConversationsView: React.FC<ConversationsViewProps> = ({
  messages,
  onSendMessage,
  onClearHistory,
  onPlaySpeech,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [participantFilter, setParticipantFilter] = useState<ParticipantFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customDate, setCustomDate] = useState<string>('');
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Press "/" to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Helper to parse or match relative dates
  const matchesDate = (createdAt: string, filter: DateFilter, customDay?: string): boolean => {
    if (filter === 'all') return true;

    const lower = (createdAt || '').toLowerCase();
    const now = new Date();

    if (filter === 'today') {
      if (lower.includes('today') || lower.includes('just now') || lower.includes('min') || lower.includes('sec')) {
        return true;
      }
      // Check if createdAt matches today's date string
      const todayISO = now.toISOString().slice(0, 10);
      return lower.includes(todayISO);
    }

    if (filter === 'week') {
      if (lower.includes('today') || lower.includes('yesterday') || lower.includes('just now') || lower.includes('days ago')) {
        return true;
      }
      // Check if within 7 days
      const parsed = Date.parse(createdAt);
      if (!isNaN(parsed)) {
        const diffDays = (now.getTime() - parsed) / (1000 * 60 * 60 * 24);
        return diffDays <= 7;
      }
      return true;
    }

    if (filter === 'month') {
      const parsed = Date.parse(createdAt);
      if (!isNaN(parsed)) {
        const diffDays = (now.getTime() - parsed) / (1000 * 60 * 60 * 24);
        return diffDays <= 30;
      }
      return true;
    }

    if (filter === 'custom' && customDay) {
      if (lower.includes(customDay)) return true;
      const parsed = Date.parse(createdAt);
      if (!isNaN(parsed)) {
        const dateStr = new Date(parsed).toISOString().slice(0, 10);
        return dateStr === customDay;
      }
      return false;
    }

    return true;
  };

  // Participant counter stats
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

  // Comprehensive message filtering
  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return messages.filter((m) => {
      // 1. Participant Filter
      if (participantFilter === 'user' && m.role !== 'user') return false;
      if (participantFilter === 'assistant' && m.role !== 'assistant') return false;
      if (participantFilter === 'tools' && (!m.toolCalls || m.toolCalls.length === 0)) return false;

      // 2. Date Filter
      if (!matchesDate(m.createdAt, dateFilter, customDate)) return false;

      // 3. Keyword / Search Query
      if (!q) return true;

      const contentMatch = (m.content || '').toLowerCase().includes(q);
      const roleMatch = (m.role || '').toLowerCase().includes(q);
      const dateMatch = (m.createdAt || '').toLowerCase().includes(q);

      // Search inside tool calls as well
      const toolMatch = m.toolCalls?.some(
        (tc) =>
          tc.name.toLowerCase().includes(q) ||
          JSON.stringify(tc.args || {}).toLowerCase().includes(q) ||
          JSON.stringify(tc.result || {}).toLowerCase().includes(q)
      );

      return contentMatch || roleMatch || dateMatch || toolMatch;
    });
  }, [messages, searchQuery, participantFilter, dateFilter, customDate]);

  // Copy text handler
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
    setDateFilter('all');
    setCustomDate('');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    participantFilter !== 'all' ||
    dateFilter !== 'all' ||
    customDate !== '';

  // Text highlighter helper function
  const highlightMatches = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
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

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <span>Voice & Conversation Logs</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Searchable transcript of voice interactions, tool executions, and assistant responses.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
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
            <span>Clear History</span>
          </button>
        </div>
      </div>

      {/* Main Search Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/70 p-4 shadow-sm dark:shadow-inner backdrop-blur-md space-y-3.5 transition-colors">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keywords, queries, tools, actions... (Press '/' to focus)"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 pl-10 pr-10 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              title="Clear search text"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Bar Controls (Always visible or expandable on mobile) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          {/* Participant Filter Pills */}
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
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
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

          {/* Date Filter Selector */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
              <Calendar className="h-3 w-3 inline text-slate-400" />
              <span>Date:</span>
            </span>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">Past 7 Days</option>
              <option value="month">Past 30 Days</option>
              <option value="custom">Custom Date...</option>
            </select>

            {dateFilter === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            )}
          </div>
        </div>

        {/* Active Filters Summary Bar */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
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
              {dateFilter !== 'all' && (
                <span className="rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-[11px]">
                  Date: {dateFilter === 'custom' ? customDate || 'Selected Day' : dateFilter}
                </span>
              )}
            </div>

            <button
              onClick={clearAllFilters}
              className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline flex items-center space-x-1"
            >
              <X className="h-3 w-3" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Messages List */}
      <div className="space-y-4 min-h-[420px]">
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
            <MessageSquare className="h-9 w-9 text-slate-400 dark:text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {hasActiveFilters ? 'No matching messages found' : 'No conversations recorded'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {hasActiveFilters
                ? 'Try broadening your search query or clearing participant/date filters.'
                : 'Start an ambient conversation through the central voice orb or send a query below.'}
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
            return (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition-colors ${
                    isUser
                      ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 shadow-xs'
                      : 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40 shadow-xs'
                  }`}
                >
                  {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                <div
                  className={`max-w-2xl w-full rounded-2xl p-4 shadow-sm transition-all ${
                    isUser
                      ? 'bg-gradient-to-r from-cyan-50 to-white dark:from-cyan-950/40 dark:to-slate-900 border border-cyan-200 dark:border-cyan-500/30 text-slate-900 dark:text-slate-100'
                      : 'bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between space-x-4 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                      {isUser ? 'Voice / User' : 'Nexus AI'}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{msg.createdAt}</span>
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                    {highlightMatches(msg.content, searchQuery)}
                  </p>

                  {/* Tool Call / Action Trace */}
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center space-x-1">
                        <Sparkles className="h-3 w-3" />
                        <span>Tool Invocation</span>
                      </div>
                      {msg.toolCalls.map((tc, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg bg-slate-50 dark:bg-slate-950/70 p-2 font-mono text-[10px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
                        >
                          <div>
                            <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
                              {tc.name}
                            </span>
                            ({JSON.stringify(tc.args || {})})
                          </div>
                          {tc.result && (
                            <div className="mt-1 text-emerald-600 dark:text-emerald-400 truncate">
                              → {JSON.stringify(tc.result)}
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
                      title="Copy text"
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
                        onClick={() => onPlaySpeech(msg.content)}
                        className="flex items-center space-x-1 text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors py-1 px-1.5 rounded-md hover:bg-purple-50 dark:hover:bg-purple-950/40"
                        title="Play with Gemini Voice"
                      >
                        <Volume2 className="h-3 w-3" />
                        <span>Speak</span>
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
          placeholder="Type a message or command for Nexus AI..."
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
