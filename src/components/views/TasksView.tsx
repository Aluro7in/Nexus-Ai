import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Tag,
  CheckCircle,
  Clock,
  Sparkles,
  ArrowUpDown,
  Filter,
  Search,
  Flag,
  Flame,
  ChevronDown,
  X,
} from 'lucide-react';
import type { TaskItem, Priority, TaskStatus } from '../../types';

interface TasksViewProps {
  tasks: TaskItem[];
  onAddTask: (task: Omit<TaskItem, 'id' | 'createdAt'>) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdatePriority?: (taskId: string, newPriority: Priority) => void;
  onSyncGoogleTasks: () => void;
  hasGoogleToken: boolean;
}

type SortOption = 'priority-desc' | 'priority-asc' | 'due-date' | 'newest' | 'title';

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onUpdatePriority,
  onSyncGoogleTasks,
  hasGoogleToken,
}) => {
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('priority-desc');
  const [isAdding, setIsAdding] = useState(false);
  const [openPriorityMenuId, setOpenPriorityMenuId] = useState<string | null>(null);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newCategory, setNewCategory] = useState<TaskItem['category']>('workspace');
  const [newDueDate, setNewDueDate] = useState('');

  // Priority weight mapping for sorting
  const priorityWeights: Record<Priority, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  // Metrics computation
  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const pending = total - completed;
    const urgentOrHigh = tasks.filter(
      (t) => t.status !== 'completed' && (t.priority === 'urgent' || t.priority === 'high')
    ).length;

    const counts: Record<string, number> = {
      all: total,
      urgent: tasks.filter((t) => t.priority === 'urgent').length,
      high: tasks.filter((t) => t.priority === 'high').length,
      medium: tasks.filter((t) => t.priority === 'medium').length,
      low: tasks.filter((t) => t.priority === 'low').length,
    };

    return { total, completed, pending, urgentOrHigh, counts };
  }, [tasks]);

  // Filtered and Sorted Tasks
  const processedTasks = useMemo(() => {
    // 1. Filter
    const filtered = tasks.filter((t) => {
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterStatus === 'pending' && t.status === 'completed') return false;
      if (filterStatus === 'completed' && t.status !== 'completed') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = t.title.toLowerCase().includes(q);
        const descMatch = (t.description || '').toLowerCase().includes(q);
        const catMatch = (t.category || '').toLowerCase().includes(q);
        const prioMatch = t.priority.toLowerCase().includes(q);
        return titleMatch || descMatch || catMatch || prioMatch;
      }
      return true;
    });

    // 2. Sort
    return [...filtered].sort((a, b) => {
      // Completed items go down if sorting pending tasks
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;

      switch (sortBy) {
        case 'priority-desc':
          return (priorityWeights[b.priority] || 0) - (priorityWeights[a.priority] || 0);
        case 'priority-asc':
          return (priorityWeights[a.priority] || 0) - (priorityWeights[b.priority] || 0);
        case 'due-date':
          return (a.dueDate || 'ZZZ').localeCompare(b.dueDate || 'ZZZ');
        case 'newest':
          return (b.id || '').localeCompare(a.id || '');
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
  }, [tasks, filterPriority, filterStatus, searchQuery, sortBy]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onAddTask({
      userId: 'current-user',
      title: newTitle.trim(),
      description: newDescription.trim(),
      priority: newPriority,
      status: 'pending',
      category: newCategory,
      dueDate: newDueDate || 'Today',
    });
    setNewTitle('');
    setNewDescription('');
    setNewDueDate('');
    setIsAdding(false);
  };

  const getPriorityStyle = (p: Priority) => {
    switch (p) {
      case 'urgent':
        return {
          badge:
            'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/40 hover:bg-red-500/25',
          dot: 'bg-red-500',
          label: 'Urgent',
          icon: Flame,
        };
      case 'high':
        return {
          badge:
            'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/25',
          dot: 'bg-amber-500',
          label: 'High',
          icon: AlertCircle,
        };
      case 'medium':
        return {
          badge:
            'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/40 hover:bg-cyan-500/25',
          dot: 'bg-cyan-500',
          label: 'Medium',
          icon: Flag,
        };
      case 'low':
        return {
          badge:
            'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/40 hover:bg-slate-500/25',
          dot: 'bg-slate-400',
          label: 'Low',
          icon: Tag,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <CheckSquare className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            <span>Tasks & Reminders</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Prioritized task manager synchronized with Google Tasks and ambient voice capture.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onSyncGoogleTasks}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:text-cyan-300 transition-colors shadow-xs"
          >
            <span>{hasGoogleToken ? 'Sync Google Tasks' : 'Sync (Demo Adapter)'}</span>
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-cyan-950/20 hover:opacity-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 p-3.5 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Items</div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{stats.total}</div>
        </div>
        <div className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-950/20 p-3.5 shadow-xs">
          <div className="text-[11px] font-medium text-red-600 dark:text-red-400 flex items-center space-x-1">
            <Flame className="h-3 w-3" />
            <span>Urgent / High</span>
          </div>
          <div className="text-xl font-bold text-red-600 dark:text-red-400 mt-0.5">
            {stats.urgentOrHigh}
          </div>
        </div>
        <div className="rounded-2xl border border-cyan-200 dark:border-cyan-500/20 bg-cyan-50/50 dark:bg-cyan-950/20 p-3.5 shadow-xs">
          <div className="text-[11px] font-medium text-cyan-700 dark:text-cyan-400">Pending Actions</div>
          <div className="text-xl font-bold text-cyan-700 dark:text-cyan-300 mt-0.5">
            {stats.pending}
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 shadow-xs">
          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Completed</div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {stats.completed}
          </div>
        </div>
      </div>

      {/* New Task Inline Form */}
      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-cyan-500/40 bg-white dark:bg-slate-900/90 p-5 shadow-lg backdrop-blur-md space-y-4 transition-all"
        >
          <div className="font-semibold text-sm text-cyan-600 dark:text-cyan-300 flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Create New Prioritized Action Item</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Task Title (e.g. 'Submit Hackathon Entry')"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
              required
            />
            <input
              type="text"
              placeholder="Due Date / Time (e.g. 'Tomorrow, 5:00 PM')"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <textarea
            placeholder="Context, notes or sub-tasks..."
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-cyan-500 focus:outline-none"
          />

          {/* Priority Selection Pills */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Assign Priority Level:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { level: 'urgent', label: 'Urgent', desc: 'Critical blocker' },
                  { level: 'high', label: 'High', desc: 'Important today' },
                  { level: 'medium', label: 'Medium', desc: 'Standard task' },
                  { level: 'low', label: 'Low', desc: 'Backlog / low rush' },
                ] as const
              ).map((p) => {
                const isSelected = newPriority === p.level;
                const style = getPriorityStyle(p.level);
                return (
                  <button
                    key={p.level}
                    type="button"
                    onClick={() => setNewPriority(p.level)}
                    className={`flex flex-col text-left p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? `${style.badge} ring-1 ring-cyan-500 shadow-sm font-semibold`
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-1.5">
                      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                      <span className="text-xs font-bold">{p.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5">{p.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center space-x-2 text-xs">
              <label className="text-slate-500 dark:text-slate-400">Category:</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
              >
                <option value="workspace">Workspace</option>
                <option value="personal">Personal</option>
                <option value="home">Home</option>
                <option value="commerce">Commerce</option>
                <option value="meeting">Meeting</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-cyan-600 text-white dark:bg-cyan-500 dark:text-slate-950 px-4 py-1.5 text-xs font-semibold hover:opacity-90 shadow-sm"
              >
                Save Task
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Toolbar: Search, Filters & Priority Sorting */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 p-4 shadow-sm backdrop-blur-md space-y-3.5 transition-colors">
        {/* Top row: Search input + Sorting selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks, categories, context..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80 pl-9 pr-8 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-cyan-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sort By Priority & Others */}
          <div className="flex items-center space-x-2 shrink-0">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none"
            >
              <option value="priority-desc">Priority: High to Low</option>
              <option value="priority-asc">Priority: Low to High</option>
              <option value="due-date">Due Date</option>
              <option value="newest">Newest First</option>
              <option value="title">Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Priority Filter Pills */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1 flex items-center space-x-1">
              <Flag className="h-3 w-3 inline text-slate-400" />
              <span>Priority:</span>
            </span>

            {[
              { id: 'all', label: 'All', count: stats.counts.all, dot: 'bg-slate-400' },
              { id: 'urgent', label: 'Urgent', count: stats.counts.urgent, dot: 'bg-red-500' },
              { id: 'high', label: 'High', count: stats.counts.high, dot: 'bg-amber-500' },
              { id: 'medium', label: 'Medium', count: stats.counts.medium, dot: 'bg-cyan-500' },
              { id: 'low', label: 'Low', count: stats.counts.low, dot: 'bg-slate-400' },
            ].map((p) => {
              const isSelected = filterPriority === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setFilterPriority(p.id)}
                  className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
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

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Status:
            </span>
            {(['all', 'pending', 'completed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`rounded-lg px-2.5 py-1 capitalize font-medium transition-colors ${
                  filterStatus === s
                    ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {processedTasks.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 text-xs bg-slate-50/50 dark:bg-slate-900/20">
            No tasks match your selected filter criteria.
          </div>
        ) : (
          processedTasks.map((t) => {
            const isDone = t.status === 'completed';
            const priorityInfo = getPriorityStyle(t.priority);
            const isMenuOpen = openPriorityMenuId === t.id;

            return (
              <div
                key={t.id}
                className={`flex items-start justify-between rounded-2xl border p-4 transition-all relative ${
                  isDone
                    ? 'border-slate-200 dark:border-slate-800/40 bg-slate-50/60 dark:bg-slate-950/30 opacity-70'
                    : 'border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 hover:border-cyan-500/40 shadow-xs'
                }`}
              >
                <div className="flex items-start space-x-3.5 flex-1 pr-2">
                  <button
                    onClick={() => onToggleTask(t.id)}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      isDone
                        ? 'border-emerald-500 bg-emerald-500 text-white dark:text-slate-950'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:border-cyan-500'
                    }`}
                    title={isDone ? 'Mark pending' : 'Mark completed'}
                  >
                    {isDone && <CheckCircle className="h-3.5 w-3.5 stroke-[3]" />}
                  </button>

                  <div className="flex-1">
                    <h4
                      className={`text-xs sm:text-sm font-semibold ${
                        isDone
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {t.title}
                    </h4>
                    {t.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                        {t.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-2.5">
                      {/* Interactive Priority Badge Dropdown */}
                      <div className="relative inline-block">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenPriorityMenuId(isMenuOpen ? null : t.id)
                          }
                          className={`flex items-center space-x-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all ${priorityInfo.badge}`}
                          title="Click to change task priority"
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${priorityInfo.dot}`} />
                          <span>{t.priority}</span>
                          <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
                        </button>

                        {/* Dropdown Menu for Quick Priority Change */}
                        {isMenuOpen && (
                          <div className="absolute left-0 mt-1 z-30 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-xl">
                            <div className="text-[10px] font-semibold text-slate-400 px-2 py-1">
                              Set Priority:
                            </div>
                            {(['urgent', 'high', 'medium', 'low'] as const).map((p) => {
                              const pStyle = getPriorityStyle(p);
                              return (
                                <button
                                  key={p}
                                  type="button"
                                  onClick={() => {
                                    onUpdatePriority?.(t.id, p);
                                    setOpenPriorityMenuId(null);
                                  }}
                                  className={`w-full flex items-center space-x-2 rounded-lg px-2 py-1.5 text-xs text-left transition-colors ${
                                    t.priority === p
                                      ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-white'
                                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                  }`}
                                >
                                  <span className={`h-2 w-2 rounded-full ${pStyle.dot}`} />
                                  <span className="capitalize">{p}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Category Tag */}
                      <span className="rounded-md bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                        {t.category}
                      </span>

                      {/* Due Date */}
                      {t.dueDate && (
                        <span className="flex items-center space-x-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span>{t.dueDate}</span>
                        </span>
                      )}

                      {/* Google Tasks Sync Indicator */}
                      {t.googleTaskId && (
                        <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono flex items-center space-x-1">
                          <span>• Google Task Linked</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteTask(t.id)}
                  title="Delete task"
                  className="text-slate-400 hover:text-red-500 p-1.5 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
