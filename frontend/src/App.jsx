import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import {
  Activity, Video, Thermometer, ShieldAlert, Cpu,
  Wifi, RefreshCw, Layers, CheckCircle2, AlertTriangle, Database, Users, Server, Radio
} from 'lucide-react';

const BACKEND_URL = `http://${window.location.hostname}:5000`;
const socket = io(BACKEND_URL);

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [health, setHealth] = useState({ total_nodes: 0, online_nodes: 0, mesh_active: false, uptime_seconds: 0, mean_confidence: 0 });
  const [alerts, setAlerts] = useState([]);
  const [packets, setPackets] = useState([]);
  const [fedavgState, setFedavgState] = useState({ completed_rounds: 0, global_accuracy: 72.5, global_loss: 0.3421, client_weights: {} });
  const [globalModel, setGlobalModel] = useState({ version: 0, weights: [0.1, 0.4, 0.7] });
  const [isAggregating, setIsAggregating] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  // Fetch initial data & set up Socket.IO listeners
  useEffect(() => {
    fetchDashboardData();

    socket.on('sensor_update', (packet) => {
      setPackets((prev) => [packet, ...prev.slice(0, 199)]);
      fetchNodesAndHealth();
    });

    socket.on('fedavg_update', (state) => {
      setFedavgState(state);
      fetchLatestModel();
    });

    socket.on('node_status_change', () => {
      fetchNodesAndHealth();
    });

    const interval = setInterval(fetchNodesAndHealth, 3000);
    return () => {
      socket.off('sensor_update');
      socket.off('fedavg_update');
      socket.off('node_status_change');
      clearInterval(interval);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [nodesRes, healthRes, alertsRes, packetsRes, modelRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/nodes`),
        axios.get(`${BACKEND_URL}/api/system/health`),
        axios.get(`${BACKEND_URL}/api/history/alerts`),
        axios.get(`${BACKEND_URL}/api/history/packets`),
        axios.get(`${BACKEND_URL}/api/model/latest`)
      ]);
      setNodes(nodesRes.data);
      setHealth(healthRes.data);
      setAlerts(alertsRes.data);
      setPackets(packetsRes.data);
      setGlobalModel(modelRes.data);
      if (nodesRes.data.length > 0 && !selectedNode) {
        setSelectedNode(nodesRes.data[0].node_id);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    }
  };

  const fetchNodesAndHealth = async () => {
    try {
      const [nodesRes, healthRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/nodes`),
        axios.get(`${BACKEND_URL}/api/system/health`)
      ]);
      setNodes(nodesRes.data);
      setHealth(healthRes.data);
    } catch (err) {
      console.error("Polling error:", err);
    }
  };

  const fetchLatestModel = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/model/latest`);
      setGlobalModel(res.data);
    } catch (err) {
      console.error("Model fetch error:", err);
    }
  };

  const triggerFedAvg = async () => {
    setIsAggregating(true);
    try {
      await axios.post(`${BACKEND_URL}/api/fedavg/aggregate`);
      await fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.message || "Aggregation failed. Ensure nodes are online.");
    } finally {
      setIsAggregating(false);
    }
  };

  const activeNodeDetails = nodes.find(n => n.node_id === selectedNode) || nodes[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-6 shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-white">WSN & IoT Federated Learning Hub</h1>
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold rounded-full flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Mesh Active ({health.online_nodes}/{health.total_nodes} Nodes)
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">Real-time edge analytics, TinyML inference telemetry, and automated FedAvg aggregation</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-4 text-sm text-slate-300">
          <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <span>Mean Confidence: <strong>{health.mean_confidence}%</strong></span>
          </div>
          <button
            onClick={triggerFedAvg}
            disabled={isAggregating}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isAggregating ? 'animate-spin' : ''}`} />
            {isAggregating ? 'Aggregating Round...' : 'Trigger FedAvg Round'}
          </button>
        </div>
      </header>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Left Column: Live ESP32-CAM Stream */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-indigo-400" /> Live ESP32-CAM Stream
              </h2>
              <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-md border border-indigo-500/20">MJPEG Feed</span>
            </div>

            <div className="aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center relative shadow-inner">
              <img
                src={`${BACKEND_URL}/video_feed`}
                alt="ESP32-CAM Live Feed"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none -z-10 text-slate-600">
                <Video className="w-12 h-12 mb-2 stroke-1" />
                <p className="text-xs">Waiting for camera stream connection...</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
            <span>Resolution: QQVGA (160x120)</span>
            <span className="text-emerald-400 font-medium">Model v{globalModel.version} Active</span>
          </div>
        </div>

        {/* Center Column: Global Federated Learning State */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-400" /> Global FL Model State
              </h2>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-md border border-emerald-500/20">Round #{fedavgState.completed_rounds}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400 mb-1">Global Accuracy</p>
                <p className="text-2xl font-black text-emerald-400">{fedavgState.global_accuracy}%</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-400 mb-1">Global Loss</p>
                <p className="text-2xl font-black text-rose-400">{fedavgState.global_loss}</p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <p className="text-xs text-slate-400 mb-2">Aggregated Global Weights (v{globalModel.version})</p>
              <div className="flex gap-2">
                {globalModel.weights.map((w, idx) => (
                  <div key={idx} className="flex-1 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-500 block">W{idx + 1}</span>
                    <span className="text-sm font-mono font-bold text-indigo-300">{w}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
            <span>Aggregation Engine: FedAvg</span>
            <span>Sync: HTTP Downlink</span>
          </div>
        </div>

        {/* Right Column: Active Edge Nodes Overview */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-sky-400" /> Active Edge Nodes
              </h2>
              <span className="text-xs bg-sky-500/10 text-sky-400 px-2.5 py-1 rounded-md border border-sky-500/20">{nodes.length} Connected</span>
            </div>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {nodes.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">No edge nodes detected. Power on ESP32 nodes.</div>
              ) : (
                nodes.map((node) => (
                  <div
                    key={node.node_id}
                    onClick={() => setSelectedNode(node.node_id)}
                    className={`bg-slate-950 p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${selectedNode === node.node_id ? 'border-indigo-500 bg-slate-900/80 shadow-md' : 'border-slate-800 hover:border-slate-700'}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${node.status === 'online' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                        <h3 className="text-sm font-bold text-white">{node.node_id}</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">Pred: <strong className="text-slate-200">{node.prediction}</strong></p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-indigo-400">{node.type}</span>
                      <p className="text-[10px] text-slate-500">RSSI: {node.rssi} dBm</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
            <span>Click node to inspect details</span>
            <span>Timeout: 5s</span>
          </div>
        </div>

      </div>

      {/* Middle Row: Client Contributions & In-Depth Node Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Client Training Contributions Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" /> Client Training Contributions
              </h2>
              <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-md border border-indigo-500/20">
                Round #{fedavgState.completed_rounds}
              </span>
            </div>

            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
              {Object.keys(fedavgState.client_weights).length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No aggregation rounds executed yet. Click "Trigger FedAvg Round".
                </div>
              ) : (
                Object.entries(fedavgState.client_weights).map(([nodeId, weightPct]) => {
                  const nodeInfo = nodes.find(n => n.node_id === nodeId);
                  return (
                    <div key={nodeId} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-bold text-white">{nodeId}</span>
                        <span className="text-xs font-mono font-bold text-emerald-400">{weightPct}% Weight Share</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-2 mb-2 overflow-hidden border border-slate-800">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${weightPct}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Samples Uploaded: <strong className="text-slate-200">{nodeInfo?.samples || 0}</strong></span>
                        <span>Local Accuracy: <strong className="text-emerald-400">{nodeInfo?.local_accuracy || 0}%</strong></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
            <span>Aggregation Rule: Weighted Average</span>
            <span>Metric: Sample Ratio Share</span>
          </div>
        </div>

        {/* In-Depth Individual Node Inspector */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-400" /> In-Depth Node Telemetry Inspector
              </h2>
              <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-md border border-slate-700 font-mono">
                {activeNodeDetails ? activeNodeDetails.node_id : 'Select a Node'}
              </span>
            </div>

            {activeNodeDetails ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block mb-1">Sensor Value</span>
                    <span className="text-base font-bold text-white font-mono">{activeNodeDetails.value}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block mb-1">Confidence</span>
                    <span className="text-base font-bold text-emerald-400 font-mono">{(activeNodeDetails.confidence * 100).toFixed(1)}%</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block mb-1">Signal (RSSI)</span>
                    <span className="text-base font-bold text-sky-400 font-mono">{activeNodeDetails.rssi} dBm</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Node Type / Category:</span>
                    <span className="font-semibold text-white">{activeNodeDetails.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Current Edge Prediction:</span>
                    <span className="font-semibold text-indigo-300">{activeNodeDetails.prediction}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Samples Processed:</span>
                    <span className="font-semibold text-white font-mono">{activeNodeDetails.samples}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Connection Status:</span>
                    <span className={`font-semibold uppercase tracking-wider ${activeNodeDetails.status === 'online' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {activeNodeDetails.status}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-sm">
                No active node selected. Click a node from the right list above to inspect telemetry.
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400 flex justify-between">
            <span>Protocol: WebSocket Stream</span>
            <span>Live Diagnostics Active</span>
          </div>
        </div>

      </div>

      {/* Bottom Section: Tables for Packet Telemetry & Alert Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Packet Audit Trail */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" /> Real-Time Telemetry Audit Trail
          </h2>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 bg-slate-950 sticky top-0 border-b border-slate-800">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Node ID</th>
                  <th className="p-3">Prediction</th>
                  <th className="p-3">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {packets.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-6 text-slate-500">Waiting for sensor uplinks...</td></tr>
                ) : (
                  packets.slice(0, 15).map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-950/50 transition-colors">
                      <td className="p-3 text-slate-400">{p.timestamp}</td>
                      <td className="p-3 font-semibold text-white">{p.node_id}</td>
                      <td className="p-3 text-indigo-300">{p.prediction}</td>
                      <td className="p-3 text-emerald-400">{(p.confidence * 100).toFixed(1)}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Anomaly & Event Logs */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" /> Anomaly & Security Alert Logs
          </h2>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No anomalies or critical alerts recorded.</div>
            ) : (
              alerts.map((alert, idx) => (
                <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 shrink-0 ${alert.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{alert.node_id}</span>
                      <span className="text-[10px] text-slate-500">{alert.timestamp}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{alert.message}</p>
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