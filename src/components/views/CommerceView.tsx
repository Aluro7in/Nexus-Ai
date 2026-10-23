import React, { useState } from 'react';
import {
  ShoppingBag,
  Plus,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  Package,
} from 'lucide-react';
import type { CommerceOrder, OrderItem } from '../../types';

interface CommerceViewProps {
  orders: CommerceOrder[];
  activeCart: OrderItem[];
  onAddToCart: (item: OrderItem) => void;
  onRemoveFromCart: (itemId: string) => void;
  onRequestCheckout: () => void;
}

export const CommerceView: React.FC<CommerceViewProps> = ({
  orders,
  activeCart,
  onAddToCart,
  onRemoveFromCart,
  onRequestCheckout,
}) => {
  const catalog: OrderItem[] = [
    {
      id: 'cat-1',
      name: 'Nespresso Vertuo Intenso Coffee Pods (30ct)',
      price: 36.5,
      quantity: 1,
      category: 'Pantry / Routine',
    },
    {
      id: 'cat-2',
      name: 'Philips Hue Smart Ambient Lightbulb (White & Color)',
      price: 49.99,
      quantity: 1,
      category: 'Smart Home / Lighting',
    },
    {
      id: 'cat-3',
      name: 'Brite Air Purifier Replacement HEPA Filter',
      price: 24.0,
      quantity: 1,
      category: 'Home Wellness',
    },
    {
      id: 'cat-4',
      name: 'Matter-Compatible WiFi Smart Plug (4-Pack)',
      price: 29.99,
      quantity: 1,
      category: 'Smart Home / Energy',
    },
  ];

  const cartTotal = activeCart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <ShoppingBag className="h-5 w-5 text-cyan-400" />
            <span>Alexa+ Voice Commerce & Orders</span>
          </h2>
          <p className="text-xs text-slate-400">
            Voice-assisted product discovery and cart staging with mandatory explicit approval gates.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400 flex items-center space-x-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Human-in-the-Loop Safe</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Staged Cart & Product Catalog */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Staged Cart */}
          <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/60 p-5 backdrop-blur-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <ShoppingBag className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Staged Commerce Cart</h3>
                <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[11px] font-bold text-cyan-300">
                  {activeCart.length} items
                </span>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Total: <span className="text-white font-bold">${cartTotal.toFixed(2)}</span>
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {activeCart.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Your cart is empty. Add recommended items below or say: "Order coffee pods".
                </div>
              ) : (
                activeCart.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3 border border-slate-800/80"
                  >
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200">{item.name}</h4>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Qty: {item.quantity} • {item.category}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-bold text-slate-100 font-mono">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                      <button
                        onClick={() => onRemoveFromCart(item.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {activeCart.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center space-x-2 text-xs text-amber-300">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Purchases require your explicit confirmation modal.</span>
                </div>

                <button
                  onClick={onRequestCheckout}
                  className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-950/50 hover:opacity-95 transition-all"
                >
                  Authorize Checkout (${cartTotal.toFixed(2)})
                </button>
              </div>
            )}
          </div>

          {/* Catalog discovery */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md">
            <h3 className="text-sm font-bold text-white mb-3">Ambient Voice Discovery</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {catalog.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-xl bg-slate-950/40 p-3.5 border border-slate-800/60 hover:border-cyan-500/30 transition-all"
                >
                  <div>
                    <span className="text-[10px] text-slate-500 font-mono uppercase">
                      {item.category}
                    </span>
                    <h4 className="text-xs font-semibold text-slate-200 mt-1">{item.name}</h4>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/50">
                    <span className="text-xs font-bold text-cyan-400 font-mono">
                      ${item.price.toFixed(2)}
                    </span>
                    <button
                      onClick={() => onAddToCart(item)}
                      className="flex items-center space-x-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-cyan-500 hover:text-cyan-300 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Stage</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Order History */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 backdrop-blur-md">
            <div className="flex items-center space-x-2 text-slate-300 pb-3 border-b border-slate-800">
              <Package className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Order History</h3>
            </div>

            <div className="mt-4 space-y-3">
              {orders.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No previous orders found.</p>
              ) : (
                orders.map((ord) => (
                  <div
                    key={ord.id}
                    className="rounded-xl bg-slate-950/50 p-3 border border-slate-800/60"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-200 truncate max-w-[150px]">
                        {ord.title}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {ord.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Total: ${ord.totalAmount.toFixed(2)}</span>
                      <span>{ord.createdAt}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
