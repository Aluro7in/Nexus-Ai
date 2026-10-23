import React, { useState } from 'react';
import { Brain, Plus, Trash2, Sparkles, Tag, ShieldCheck, Info } from 'lucide-react';
import type { MemoryItem } from '../../types';

interface MemoryViewProps {
  memories: MemoryItem[];
  onAddMemory: (memory: Omit<MemoryItem, 'id' | 'createdAt'>) => void;
  onDeleteMemory: (memoryId: string) => void;
}

export const MemoryView: React.FC<MemoryViewProps> = ({
  memories,
  onAddMemory,
  onDeleteMemory,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryItem['category']>('preference');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;
    onAddMemory({
      userId: 'current-user',
      category: newCategory,
      key: newKey.trim(),
      value: newValue.trim(),
      confidence: 0.95,
    });
    setNewKey('');
    setNewValue('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Brain className="h-5 w-5 text-cyan-400" />
            <span>Ambient Personalized Memory</span>
          </h2>
          <p className="text-xs text-slate-400">
            Explicitly reviewable personal preferences, routines, and ambient context that guide Nexus AI.
          </p>
        </div>

        <button
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center space-x-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-cyan-950/40 hover:opacity-95 transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>Add Memory</span>
        </button>
      </div>

      {/* Info notice on ethical AI & privacy */}
      <div className="flex items-start space-x-3 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-xs text-cyan-200">
        <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">Transparent Ambient Memory:</span> All context items
          are 100% transparent and editable by you. Nexus AI uses this context to personalize calendar
          scheduling, lighting preferences, and proactive briefings without storing private secrets.
        </div>
      </div>

      {/* Add Memory Form */}
      {isAdding && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-5 shadow-lg backdrop-blur-md space-y-4"
        >
          <div className="font-semibold text-sm text-cyan-300">Teach Nexus New Context</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Memory Key (e.g. 'Coffee Preference', 'Commute Route')"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
              required
            />
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as any)}
              className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200"
            >
              <option value="preference">Preference</option>
              <option value="schedule">Schedule & Routine</option>
              <option value="family">Family & Contacts</option>
              <option value="home">Home & Environment</option>
              <option value="dietary">Dietary / Nutrition</option>
              <option value="work">Work & Projects</option>
            </select>
          </div>
          <textarea
            placeholder="Details (e.g. 'Prefers dark roast oat milk latte with half sugar; order when pantry runs below 5 pods.')"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
            required
          />
          <div className="flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
            >
              Save Context
            </button>
          </div>
        </form>
      )}

      {/* Memory items grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {memories.map((m) => (
          <div
            key={m.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 backdrop-blur-md hover:border-cyan-500/30 transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase text-cyan-400">
                  {m.category}
                </span>
                <span className="text-[10px] text-slate-500">
                  {Math.round(m.confidence * 100)}% match
                </span>
              </div>
              <h4 className="text-xs font-bold text-white">{m.key}</h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{m.value}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
              <span>Saved {m.createdAt}</span>
              <button
                onClick={() => onDeleteMemory(m.id)}
                className="text-slate-500 hover:text-red-400 transition-colors p-1"
                title="Forget this memory"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
