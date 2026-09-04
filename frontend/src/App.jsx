// WSN_LAB1/frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import DashboardOverview from './components/DashboardOverview';
import SensorNodeView from './components/SensorNodeView';
import FederatedLearningView from './components/FederatedLearningView';
import QoSHealthView from './components/QoSHealthView';
import AlertsLogView from './components/AlertsLogView';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTriggeringFedAvg, setIsTriggeringFedAvg] = useState(false);
  const [backendOnline, setBackendOnline] = useState(true);

  // Fetch live dashboard aggregated metrics from Flask
  const fetchDashboard = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(`http://${window.location.hostname}:5000/dashboard`);
      if (res.ok) {
        const json = await res.json();
        setDashboardData(json);
        setBackendOnline(true);
      } else {
        setBackendOnline(false);
      }
    } catch (err) {
      setBackendOnline(false);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial load and periodic polling every 8 seconds
  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 8000);
    return () => clearInterval(interval);
  }, []);

  // Trigger Federated Learning Round
  const handleTriggerFedAvg = async () => {
    try {
      setIsTriggeringFedAvg(true);
      const res = await fetch(`http://${window.location.hostname}:5000/api/fedavg/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        await fetchDashboard();
      }
    } catch (err) {
      console.error('Failed to trigger FedAvg round:', err);
    } finally {
      setIsTriggeringFedAvg(false);
    }
  };

  const alertCount = dashboardData?.recent_alerts?.length || 0;
  const activeNodesCount = dashboardData?.system_health?.online_nodes || 4;
  const totalNodesCount = dashboardData?.system_health?.total_nodes || 4;

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* 1. Fixed Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        alertCount={alertCount}
      />

      {/* Main Content Area (offset by 256px for sidebar) */}
      <div className="flex-1 ml-64 flex flex-col min-w-0">
        {/* 2. Top Sticky Navbar */}
        <Navbar
          nodeCount={totalNodesCount}
          activeNodes={activeNodesCount}
          onRefresh={fetchDashboard}
          isRefreshing={isRefreshing}
          onTriggerFedAvg={handleTriggerFedAvg}
          isTriggeringFedAvg={isTriggeringFedAvg}
          backendOnline={backendOnline}
        />

        {/* 3. Dynamic Tab Content View */}
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardOverview
              dashboardData={dashboardData}
              onSelectNode={() => setActiveTab('live-nodes')}
              onTriggerFedAvg={handleTriggerFedAvg}
              isTriggeringFedAvg={isTriggeringFedAvg}
            />
          )}

          {activeTab === 'live-nodes' && (
            <SensorNodeView />
          )}

          {activeTab === 'fedavg' && (
            <FederatedLearningView
              onTriggerFedAvg={handleTriggerFedAvg}
              isTriggeringFedAvg={isTriggeringFedAvg}
            />
          )}

          {activeTab === 'qos' && (
            <QoSHealthView />
          )}

          {activeTab === 'alerts' && (
            <AlertsLogView />
          )}
        </main>
      </div>
    </div>
  );
}