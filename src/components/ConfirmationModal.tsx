import React from 'react';
import { ShieldAlert, AlertTriangle, Check, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  actionLabel?: string;
  isDestructive?: boolean;
  itemDetails?: Record<string, any>;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  description,
  actionLabel = 'Confirm Action',
  isDestructive = false,
  itemDetails,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 dark:border-cyan-500/30 bg-white dark:bg-[#0d121f] p-6 shadow-2xl shadow-slate-950/20 dark:shadow-cyan-950/50 transition-colors">
        <div className="flex items-start space-x-3.5">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isDestructive
                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            }`}
          >
            {isDestructive ? <AlertTriangle className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {itemDetails && (
          <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 border border-slate-200 dark:border-slate-800 text-xs font-mono text-cyan-700 dark:text-cyan-300">
            <pre className="whitespace-pre-wrap">{JSON.stringify(itemDetails, null, 2)}</pre>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end space-x-3">
          <button
            onClick={onCancel}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span>Cancel</span>
          </button>
          <button
            onClick={onConfirm}
            className={`flex items-center space-x-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-md transition-all ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-500 shadow-red-950/30'
                : 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:opacity-95 shadow-cyan-950/30'
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            <span>{actionLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
