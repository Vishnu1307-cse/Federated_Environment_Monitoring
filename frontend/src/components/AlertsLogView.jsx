// WSN_LAB1/frontend/src/components/AlertsLogView.jsx
import React, { useEffect, useState } from 'react';
import { ShieldAlert, Activity, Cpu } from 'lucide-react';

export default function AlertsLogView() {
  const [alerts, setAlerts] = useState([]);
  const [packets, setPackets] = useState([]);
  const [fedHistory, setFedHistory] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('alerts'); // 'alerts' | 'packets' | 'audit'

  const fetchLogs = async () => {
    try {
      const aRes = await fetch(`http://${window.location.hostname}:5000/api/history/alerts`);
      if (aRes.ok) setAlerts(await aRes.json());

      const pRes = await fetch(`http://${window.location.hostname}:5000/api/history/packets`);
      if (pRes.ok) setPackets(await pRes.json());

      const fRes = await fetch(`http://${window.location.hostname}:5000/api/history/fedavg`);
      if (fRes.ok) setFedHistory(await fRes.json());
    } catch (err) {
      console.error("Error fetching logs", err);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-100 space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">System Logs & FL Audit Trail</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time anomaly alerts, full telemetry packet history, and federated learning impact logs.</p>
        </div>
        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button onClick={() => setActiveSubTab('alerts')} className={`px-4 py-1.5 rounded text-xs font-semibold transition-all ${activeSubTab === 'alerts' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            Alerts ({alerts.length})
          </button>
          <button onClick={() => setActiveSubTab('packets')} className={`px-4 py-1.5 rounded text-xs font-semibold transition-all ${activeSubTab === 'packets' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            Packet History ({packets.length})
          </button>
          <button onClick={() => setActiveSubTab('audit')} className={`px-4 py-1.5 rounded text-xs font-semibold transition-all ${activeSubTab === 'audit' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            FL Impact Audit ({fedHistory.length})
          </button>
        </div>
      </div>

      {/* TAB 1: ALERTS */}
      {activeSubTab === 'alerts' && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-12 rounded-xl text-center text-slate-500">No anomaly alerts triggered yet.</div>
          ) : (
            alerts.map((alert, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldAlert className={`w-5 h-5 ${alert.severity === 'critical' ? 'text-rose-500 animate-pulse' : 'text-amber-400'}`} />
                  <div>
                    <p className="text-sm font-bold text-white">{alert.message}</p>
                    <p className="text-xs text-slate-500 font-mono">Node ID: {alert.node_id}</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-400">{alert.timestamp}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 2: FULL PACKET HISTORY */}
      {activeSubTab === 'packets' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="border-b border-slate-800 text-xs uppercase text-slate-400 font-mono">
              <tr>
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Node ID</th>
                <th className="pb-3">Sensor Type</th>
                <th className="pb-3">Raw Value</th>
                <th className="pb-3">Prediction</th>
                <th className="pb-3">Confidence</th>
                <th className="pb-3">Global Model Ver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
              {packets.length === 0 ? (
                <tr><td colSpan="7" className="py-4 text-center text-slate-500">No telemetry packets recorded yet.</td></tr>
              ) : (
                packets.map((pkt, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 text-slate-400">{pkt.timestamp}</td>
                    <td className="py-2.5 font-bold text-white">{pkt.node_id}</td>
                    <td className="py-2.5 text-indigo-400">{pkt.type}</td>
                    <td className="py-2.5 text-slate-200">{pkt.value}</td>
                    <td className="py-2.5 text-emerald-400">{pkt.prediction}</td>
                    <td className="py-2.5 text-teal-400">{(pkt.confidence * 100).toFixed(1)}%</td>
                    <td className="py-2.5 text-indigo-300">v{pkt.version}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: FEDERATED LEARNING IMPACT AUDIT TRAIL */}
      {activeSubTab === 'audit' && (
        <div className="space-y-4">
          {fedHistory.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 p-12 rounded-xl text-center text-slate-500">No FedAvg aggregation rounds executed yet. Click "Run FedAvg Round" on top.</div>
          ) : (
            fedHistory.map((round, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-teal-400" />
                    <h3 className="text-base font-bold text-white">Aggregation Round #{round.round}</h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{round.timestamp}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-mono">
                  <div className="bg-slate-950 p-3 rounded border border-slate-800">
                    <span className="text-slate-400 text-xs block">New Global Accuracy:</span>
                    <span className="text-emerald-400 font-bold text-lg">{round.accuracy}%</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded border border-slate-800">
                    <span className="text-slate-400 text-xs block">Global Training Loss:</span>
                    <span className="text-indigo-400 font-bold text-lg">{round.loss}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded border border-slate-800">
                    <span className="text-slate-400 text-xs block">Updated Global Weights:</span>
                    <span className="text-teal-400 font-bold text-xs">[{round.new_weights.join(', ')}]</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Participating Node Contributions:</p>
                  <div className="flex flex-wrap gap-2">
                    {round.participating_nodes.map((nodeSummary, i) => (
                      <span key={i} className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-indigo-300 font-mono">
                        {nodeSummary}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}