// WSN_LAB1/frontend/src/components/Navbar.jsx
import React, { useEffect, useState } from 'react';
import { socket } from '../services/socket';
import { Radio, ShieldAlert, Wifi } from 'lucide-react';

export default function Navbar({ onTriggerFedAvg, isTriggeringFedAvg }) {
  const [health, setHealth] = useState({ total_nodes: 0, online_nodes: 0, mesh_active: false });

  const fetchHealth = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:5000/api/system/health`);
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (err) {
      console.error("Failed to fetch system health", err);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Poll every 3 seconds to keep online/offline counters accurate
    const interval = setInterval(fetchHealth, 3000);

    // Listen to live socket events to update counts instantly
    socket.on('node_status_change', () => fetchHealth());
    socket.on('sensor_update', () => fetchHealth());

    return () => {
      clearInterval(interval);
      socket.off('node_status_change');
      socket.off('sensor_update');
    };
  }, []);

  return (
    <header className="h-16 bg-slate-900/95 border-b border-slate-800 px-6 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
      {/* Left: Mesh Active Status Indicator */}
      <div className="flex items-center gap-3">
        <div className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border font-mono ${health.mesh_active
            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
            : 'bg-amber-950/60 text-amber-400 border-amber-800/60'
          }`}>
          <span className={`w-2 h-2 rounded-full ${health.mesh_active ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
          {health.mesh_active ? 'WSN Mesh Active' : 'Waiting for Nodes'}
        </div>

        {/* Live Node Count Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-slate-950 border border-slate-800 text-slate-300">
          <Wifi className="w-3.5 h-3.5 text-indigo-400" />
          <span>Nodes: <strong className="text-emerald-400">{health.online_nodes}</strong> / {health.total_nodes} Online</span>
        </div>
      </div>

      {/* Right: Quick Action Trigger */}
      <div className="flex items-center gap-3">
        <button
          onClick={onTriggerFedAvg}
          disabled={isTriggeringFedAvg}
          className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isTriggeringFedAvg ? 'Aggregating...' : '⚡ Run FedAvg Round'}
        </button>
      </div>
    </header>
  );
}