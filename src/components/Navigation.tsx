import React, { useEffect } from 'react';
import {
  Home,
  MessageSquare,
  Workflow,
  CheckSquare,
  ShoppingBag,
  Brain,
  Layers,
  Settings,
  HelpCircle,
  Radio,
  ChevronRight,
} from 'lucide-react';

interface NavigationProps {
  activeView: string;
  onNavigate: (view: string) => void;
  unreadCount?: number;
  pendingApprovalCount?: number;
  onOpenOnboarding?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeView,
  onNavigate,
  unreadCount = 0,
  pendingApprovalCount = 0,
  onOpenOnboarding,
}) => {
  const navSections = [
    {
      category: 'Ambient Core',
      items: [
        { id: 'home', label: 'Home', icon: Home, shortcut: '1', description: 'Voice Orb & Hub' },
        {
          id: 'conversations',
          label: 'Conversations',
          icon: MessageSquare,
          shortcut: '2',
          badge: unreadCount,
          badgeColor: 'bg-cyan-500 text-slate-950',
          description: 'Duplex Transcript',
        },
      ],
    },
    {
      category: 'Productivity & Devices',
      items: [
        {
          id: 'workflows',
          label: 'Workflows',
          icon: Workflow,
          shortcut: '3',
          badge: pendingApprovalCount,
          badgeColor: 'bg-amber-500 text-slate-950',
          description: 'Orchestration & HITL',
        },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare, shortcut: '4', description: 'Workspace Actions' },
        { id: 'commerce', label: 'Commerce', icon: ShoppingBag, shortcut: '5', description: 'Alexa+ Orders' },
        { id: 'memory', label: 'Memory', icon: Brain, shortcut: '6', description: 'Context & Habits' },
      ],
    },
    {
      category: 'System & Ecosystem',
      items: [
        { id: 'integrations', label: 'Integrations', icon: Layers, shortcut: '7', description: 'Google Workspace' },
        { id: 'settings', label: 'Settings', icon: Settings, shortcut: '8', description: 'Preferences & Audio' },
      ],
    },
  ];

  // Optional keyboard navigation shortcuts (Alt+1 to Alt+8)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.altKey && e.key >= '1' && e.key <= '8') {
        const allItems = navSections.flatMap((s) => s.items);
        const target = allItems[parseInt(e.key, 10) - 1];
        if (target) {
          e.preventDefault();
          onNavigate(target.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate]);

  return (
    <nav
      aria-label="Main Application Navigation"
      className="w-full border-t border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-[#07090e]/95 backdrop-blur-xl md:border-t-0 md:border-r md:w-64 lg:w-72 md:h-[calc(100vh-4rem)] md:sticky md:top-16 p-2 sm:p-3 md:p-4 shrink-0 transition-colors z-30"
    >
      {/* ========================================================= */}
      {/* MOBILE / SMALL SCREEN HORIZONTAL SCROLLING BAR            */}
      {/* ========================================================= */}
      <div className="flex md:hidden items-center justify-between gap-1 overflow-x-auto no-scrollbar py-1 px-1">
        {navSections.flatMap((s) => s.items).map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`Navigate to ${item.label}`}
              className={`flex flex-col items-center justify-center min-w-[4rem] min-h-[44px] py-1.5 px-2 rounded-xl text-[11px] font-medium transition-all relative shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 font-bold border border-cyan-500/30 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/60'
              }`}
            >
              <div className="relative">
                <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-cyan-500 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400'}`} />
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[9px] font-bold text-white dark:text-slate-950 ring-2 ring-white dark:ring-[#07090e]">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="mt-1 truncate max-w-[4.5rem]">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* DESKTOP SIDEBAR WITH CATEGORIZED ACCESSIBLE SECTIONS       */}
      {/* ========================================================= */}
      <div className="hidden md:flex flex-col h-full justify-between space-y-6">
        <div className="space-y-5">
          {navSections.map((sec) => (
            <div key={sec.category} className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
                {sec.category}
              </div>
              <div className="space-y-1" role="list">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      aria-label={`${item.label}: ${item.description}`}
                      className={`group flex items-center justify-between w-full rounded-xl px-3 py-2.5 text-xs font-semibold transition-all relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-500/15 via-indigo-500/10 to-transparent text-cyan-900 dark:text-cyan-200 border-l-2 border-l-cyan-500 dark:border-l-cyan-400 border-y border-r border-slate-200/60 dark:border-slate-800/60 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-100 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                            isActive
                              ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300'
                              : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 group-hover:bg-cyan-500/10'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="text-left min-w-0">
                          <div className="truncate font-semibold tracking-tight">{item.label}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-normal">
                            {item.description}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0 pl-2">
                        {Boolean(item.badge && item.badge > 0) && (
                          <span
                            className={`flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${
                              item.badgeColor || 'bg-cyan-500 text-slate-950'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                        <span className="hidden lg:inline-block text-[9px] font-mono text-slate-400 dark:text-slate-600 px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 opacity-60 group-hover:opacity-100 transition-opacity">
                          Alt+{item.shortcut}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ========================================================= */}
        {/* BOTTOM UTILITY: ONBOARDING GUIDE & DUPLEX STATUS           */}
        {/* ========================================================= */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
          {onOpenOnboarding && (
            <button
              onClick={onOpenOnboarding}
              aria-label="Open Interactive Onboarding Guide"
              className="flex items-center justify-between w-full rounded-xl px-3 py-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <div className="flex items-center space-x-2">
                <HelpCircle className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <span>Feature Tour</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 opacity-70" />
            </button>
          )}

          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-100/70 dark:bg-slate-900/50 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            <span className="flex items-center space-x-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Alexa+ Core</span>
            </span>
            <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold">Duplex Ready</span>
          </div>
        </div>
      </div>
    </nav>
  );
};
