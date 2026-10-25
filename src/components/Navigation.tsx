import React from 'react';
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
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'conversations', label: 'Conversations', icon: MessageSquare, badge: unreadCount },
    { id: 'workflows', label: 'Workflows', icon: Workflow, badge: pendingApprovalCount },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'commerce', label: 'Commerce', icon: ShoppingBag },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'integrations', label: 'Integrations', icon: Layers },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="w-full border-t border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#07090e]/90 backdrop-blur-xl md:border-t-0 md:border-r md:w-64 md:h-[calc(100vh-4rem)] md:sticky md:top-16 p-2 md:p-4 shrink-0 transition-colors">
      <div className="flex flex-row md:flex-col justify-around md:justify-start space-x-1 md:space-x-0 md:space-y-1.5 overflow-x-auto md:overflow-visible">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex items-center space-x-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all relative shrink-0 ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/15 to-indigo-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon
                className={`h-4 w-4 ${
                  isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'
                }`}
              />
              <span className="hidden md:inline">{item.label}</span>

              {Boolean(item.badge && item.badge > 0) && (
                <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-bold text-white dark:text-slate-950">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Onboarding Walkthrough Trigger */}
        {onOpenOnboarding && (
          <div className="pt-2 md:pt-4 md:mt-auto md:border-t border-slate-200 dark:border-slate-800/80">
            <button
              onClick={onOpenOnboarding}
              className="flex items-center space-x-3 w-full rounded-xl px-3 py-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20 transition-all shrink-0"
            >
              <HelpCircle className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <span className="hidden md:inline">Onboarding Guide</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
