// WSN_LAB1/frontend/src/components/Sidebar.jsx
import React from 'react';
import {
  LayoutDashboard,
  Cpu,
  ShieldAlert,
  Network,
  Zap,
  Server
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard (Overview)', icon: LayoutDashboard, category: 'Main' },
  { id: 'live-nodes', label: 'Live Nodes Overview', icon: Server, category: 'Edge Nodes' },
  { id: 'fedavg', label: 'Federated Learning', icon: Cpu, category: 'Intelligence' },
  { id: 'qos', label: 'QoS & System Health', icon: Network, category: 'Telemetry' },
  { id: 'alerts', label: 'Alerts Log', icon: ShieldAlert, category: 'Telemetry', badge: true },
];

export default function Sidebar({ activeTab, setActiveTab, alertCount = 0 }) {
  // Group nav items by category
  const categories = ['Main', 'Edge Nodes', 'Intelligence', 'Telemetry'];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900/95 border-r border-slate-800 flex flex-col z-30 backdrop-blur-md">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
        <div className="relative">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Zap className="w-5 h-5 text-slate-950 font-bold" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-slate-900 animate-pulse"></span>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-base tracking-wider bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
              FedShield
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              v1.2
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Smart Manufacturing WSN</p>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {categories.map((category) => {
          const items = NAV_ITEMS.filter((item) => item.category === category);
          if (!items.length) return null;

          return (
            <div key={category} className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
                {category}
              </div>
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 group ${isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10 font-semibold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={`w-4 h-4 transition-colors ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-300'
                          }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && alertCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono animate-pulse">
                        {alertCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer Edge Protocol Card */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-mono text-slate-300">ESP32 TinyML Mesh</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">802.11 b/g/n</span>
        </div>
      </div>
    </aside>
  );
}