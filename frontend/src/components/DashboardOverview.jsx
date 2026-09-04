// WSN_LAB1/frontend/src/components/SensorNodeView.jsx
import React, { useEffect, useState } from 'react';
import { socket } from '../services/socket';

const SensorNodeView = () => {
  const [nodes, setNodes] = useState([]);

  useEffect(() => {
    // 1. Fetch real initial data to replace mock data
    fetch('http://localhost:5000/api/nodes')
      .then(res => res.json())
      .then(data => setNodes(data))
      .catch(err => console.error("Error fetching nodes:", err));

    // 2. Listen for real-time sensor data updates
    socket.on('sensor_update', (data) => {
      setNodes(prevNodes => {
        const nodeExists = prevNodes.find(n => n.node_id === data.node_id);
        if (nodeExists) {
          return prevNodes.map(n => n.node_id === data.node_id ? { ...n, ...data } : n);
        }
        return [...prevNodes, data];
      });
    });

    // 3. Listen for dynamic connection/disconnection events
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
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Live Sensor Nodes</h2>
        <img src="/image_5a49c6.png" alt="Node reference" className="w-10 h-10 rounded-full shadow-sm hidden" />
      </div>

      {nodes.length === 0 ? (
        <p className="text-gray-500">Waiting for hardware boards (e.g., IR board) to connect...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodes.map((node) => (
            <div key={node.node_id} className="bg-white rounded-lg shadow p-5 border border-gray-100">
              <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h3 className="text-lg font-semibold text-gray-700">{node.node_id}</h3>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${node.status === 'online'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                  }`}>
                  {node.status.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Sensor Type:</span>
                <span className="font-medium">{node.type}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-500">Current Value:</span>
                <span className="text-2xl font-bold text-blue-600">{node.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SensorNodeView;