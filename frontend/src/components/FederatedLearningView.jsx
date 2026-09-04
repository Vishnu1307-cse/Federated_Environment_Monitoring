// WSN_LAB1/frontend/src/components/FederatedLearningView.jsx
import React, { useEffect, useState } from 'react';
import { socket } from '../services/socket';
import { Cpu, Activity } from 'lucide-react';

export default function FederatedLearningView() {
  const [fedData, setFedData] = useState({
    completed_rounds: 0,
    global_accuracy: 0.0,
    global_loss: 0.5000,
    target_iterations: 50,
    client_weights: {}
  });

  const [onlineNodesCount, setOnlineNodesCount] = useState(0);
  const [nodeNamesList, setNodeNamesList] = useState("Waiting for nodes...");
  const [isAggregating, setIsAggregating] = useState(false);

  const fetchFedData = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:5000/api/fedavg/status`);
      if (res.ok) {
        const data = await res.json();
        setFedData(data);
      }

      const nRes = await fetch(`http://${window.location.hostname}:5000/api/nodes`);
      if (nRes.ok) {
        const nodes = await nRes.json();
        const active = nodes.filter(n => n.status === 'online');
        setOnlineNodesCount(active.length);
        if (active.length > 0) {
          setNodeNamesList(active.map(n => n.node_id).join(', '));
        } else {
          setNodeNamesList("No active nodes");
        }
      }
    } catch (err) {
      console.error("Error fetching FedAvg data:", err);
    }
  };

  useEffect(() => {
    fetchFedData();

    socket.on('fedavg_update', (updatedState) => {
      setFedData(updatedState);
      setIsAggregating(false);
      fetchFedData();
    });

    socket.on('sensor_update', () => {
      fetchFedData();
    });

    const interval = setInterval(fetchFedData, 4000);
    return () => {
      clearInterval(interval);
      socket.off('fedavg_update');
      socket.off('sensor_update');
    };
  }, []);

  const handleExecuteFedAvg = async () => {
    setIsAggregating(true);
    try {
      const url = `http://${window.location.hostname}:5000/api/fedavg/aggregate`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.state) {
        setFedData(data.state);
      }
    } catch (err) {
      console.error("Failed to execute FedAvg aggregation:", err);
    } finally {
      setIsAggregating(false);
    }
  };

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-100 space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-950 text-indigo-400 border border-indigo-800">
              FEDERATED LEARNING ENGINE
            </span>
            <span className="text-xs text-slate-400">FedAvg Algorithm</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Decentralized Privacy-Preserving AI</h1>
          <p className="text-sm text-slate-400 mt-1">
            Edge nodes train local models on non-IID sensor telemetry. Raw sensor data never leaves the microcontroller; only model weights and gradient deltas are aggregated.
          </p>
        </div>
        <button
          onClick={handleExecuteFedAvg}
          disabled={isAggregating}
          className={`px-5 py-2.5 rounded-lg font-semibold text-sm shadow transition-all flex items-center gap-2 whitespace-nowrap ${isAggregating
              ? 'bg-teal-700 opacity-50 cursor-not-allowed'
              : 'bg-teal-500 hover:bg-teal-400 text-slate-950'
            }`}
        >
          {isAggregating ? 'Aggregating Weights...' : '▶ Execute FedAvg Aggregation'}
        </button>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Completed Rounds</p>
          <p className="text-3xl font-extrabold text-white mt-2">#{fedData.completed_rounds}</p>
          <p className="text-xs text-slate-500 mt-1">Target iterations: {fedData.target_iterations}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Global Model Accuracy</p>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2">{fedData.global_accuracy.toFixed(2)}%</p>
          <p className="text-xs text-slate-500 mt-1">Asymptotic limit: 98.5%</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Global Training Loss</p>
          <p className="text-3xl font-extrabold text-indigo-400 mt-2">{fedData.global_loss.toFixed(4)}</p>
          <p className="text-xs text-slate-500 mt-1">Sparse Categorical Cross-Entropy</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Participating Nodes</p>
          <p className="text-3xl font-extrabold text-indigo-300 mt-2">{onlineNodesCount} Active</p>
          <p className="text-xs text-slate-500 mt-1 truncate" title={nodeNamesList}>{nodeNamesList}</p>
        </div>
      </div>

      {/* Bottom Details Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Accuracy Convergence Progression</h3>
            <p className="text-xs text-slate-400 mb-6">Tracking global weight aggregation across rounds.</p>
          </div>
          <div className="h-48 flex items-end gap-2 border-b border-l border-slate-800 pb-2 pl-2">
            <div className="w-full bg-indigo-500/20 rounded-t flex items-center justify-center text-xs text-indigo-300 font-mono" style={{ height: `${Math.max(15, fedData.global_accuracy)}%` }}>
              {fedData.global_accuracy.toFixed(1)}%
            </div>
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>Round #1</span>
            <span>Latest Active Round</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
          <h3 className="text-base font-bold text-white">Client Aggregation Weights</h3>
          <p className="text-xs text-slate-400">Federated server applies normalized weighting based on local sample batch sizes.</p>

          <div className="space-y-3 pt-2">
            {Object.keys(fedData.client_weights).length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-4">Run an aggregation round to compute node weights.</p>
            ) : (
              Object.entries(fedData.client_weights).map(([nodeName, weight]) => (
                <div key={nodeName}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium truncate max-w-[150px]">{nodeName}</span>
                    <span className="text-indigo-400 font-bold">{weight}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${weight}%` }}></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}