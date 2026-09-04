// WSN_LAB1/frontend/src/components/SensorNodeView.jsx
import React, { useEffect, useState } from 'react';
import { socket } from '../services/socket';
import { Activity, Cpu, Radio, ShieldCheck, Wifi, WifiOff } from 'lucide-react';

export default function SensorNodeView() {
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    const apiUrl = `http://${window.location.hostname}:5000/api/nodes`;

    // Fetch initial active nodes state
    fetch(apiUrl)
      .then(res => res.json())
      .then(data => setNodes(data))
      .catch(err => console.error("Error fetching nodes:", err));

    // Listen for real-time sensor updates via WebSocket
    socket.on('sensor_update', (data) => {
      setNodes(prevNodes => {
        const nodeExists = prevNodes.find(n => n.node_id === data.node_id);
        if (nodeExists) {
          return prevNodes.map(n => n.node_id === data.node_id ? { ...n, ...data, status: 'online' } : n);
        }
        return [...prevNodes, { ...data, status: 'online' }];
      });
    });

    // Listen for dynamic node connections/disconnections
    socket.on('node_status_change', (data) => {
      setNodes(prevNodes => {
        const nodeExists = prevNodes.find(n => n.node_id === data.node_id);
        if (nodeExists) {
          return prevNodes.map(n => n.node_id === data.node_id ? { ...n, status: data.status } : n);
        }
        return [...prevNodes, data];
      });
    });

    return () => {
      socket.off('sensor_update');
      socket.off('node_status_change');
    };
  }, []);

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-100 space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-teal-950 text-teal-400 border border-teal-800">
              EDGE TELEMETRY
            </span>
            <span className="text-xs text-slate-400">Decentralized Hardware Nodes</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Live Node In-Depth Monitoring</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time streaming telemetry, local model inference states, and parameter weights from all active microcontrollers.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800 text-xs font-mono text-slate-300">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          Active Nodes: <span className="text-emerald-400 font-bold">{nodes.filter(n => n.status === 'online').length}</span>
        </div>
      </div>

      {/* Nodes Grid */}
      {nodes.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
          <Cpu className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-400 animate-bounce" />
          <p className="text-lg font-medium text-slate-300">No hardware nodes detected</p>
          <p className="text-sm text-slate-500 mt-1">Waiting for ESP32 boards to transmit over the local network...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {nodes.map((node) => {
            const isOnline = node.status === 'online';
            const confidenceVal = node.confidence || 0.85;

            return (
              <div key={node.node_id} className={`bg-slate-900 border rounded-xl p-5 shadow-md flex flex-col justify-between transition-all ${isOnline ? 'border-slate-800 hover:border-indigo-500/50' : 'border-red-900/40 opacity-75'
                }`}>
                <div>
                  {/* Card Top Title & Status */}
                  <div className="flex justify-between items-start border-b border-slate-800 pb-3 mb-4">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        {node.node_id}
                      </h3>
                      <span className="text-xs font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900">
                        Type: {node.type}
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm ${isOnline
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-red-950 text-red-400 border border-red-800'
                      }`}>
                      {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      {node.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Telemetry Metrics */}
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center bg-slate-950/50 px-3 py-2 rounded border border-slate-800/60">
                      <span className="text-slate-400">Raw Sensor Reading:</span>
                      <span className="font-mono font-bold text-white">{node.value}</span>
                    </div>

                    <div className="flex justify-between items-center bg-slate-950/50 px-3 py-2 rounded border border-slate-800/60">
                      <span className="text-slate-400">Local TFLite Prediction:</span>
                      <span className={`font-semibold ${node.prediction === 'Clear' || node.prediction === 'Normal' || node.prediction === 'No Person' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {node.prediction || 'Evaluating...'}
                      </span>
                    </div>

                    <div className="bg-slate-950/50 px-3 py-2.5 rounded border border-slate-800/60 space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Inference Confidence:</span>
                        <span className="text-indigo-400 font-bold font-mono">{(confidenceVal * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${confidenceVal * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Stats (Samples & Training Metrics) */}
                <div className="mt-5 pt-3 border-t border-slate-800/60 flex justify-between items-center text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-teal-400" />
                    Samples: <strong className="text-slate-200 font-mono">{node.samples || 0}</strong>
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    Local Acc: <strong className="text-slate-200 font-mono">{(node.local_accuracy || (confidenceVal * 100)).toFixed(1)}%</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}