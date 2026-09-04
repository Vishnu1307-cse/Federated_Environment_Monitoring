# WSN_LAB1/app.py
import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from datetime import datetime
import threading
import time
import database 

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

active_nodes = {}
packet_history = []  # Stores every incoming packet dynamically
alert_logs = []      # Stores alerts triggered by nodes
fedavg_rounds_history = [] # Stores how each FedAvg round affected global model states

TIMEOUT_SECONDS = 5 
start_time = time.time()

fedavg_state = {
    "completed_rounds": 0,
    "global_accuracy": 72.5,
    "global_loss": 0.3421,
    "target_iterations": 50,
    "client_weights": {}
}

global_model_state = {
    "version": 0,
    "weights": [0.10, 0.40, 0.70]
}

@app.route('/api/sensor', methods=['POST'])
def receive_sensor_data():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    node_id = data.get('node_id', 'Unknown_Node')
    sensor_type = data.get('type', 'General')
    value = data.get('value', 0)
    prediction = data.get('prediction', 'Clear')
    confidence = float(data.get('confidence', 0.85))
    client_weights = data.get('weights', [0.12, 0.45, 0.78])
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if node_id not in active_nodes:
        active_nodes[node_id] = {
            'type': sensor_type,
            'samples': 0,
            'local_accuracy': 0.0,
            'local_loss': 0.0,
            'weights': client_weights,
            'rssi': -54 # Simulated RSSI dBm for QoS
        }
    
    node = active_nodes[node_id]
    node['samples'] += 1
    node['local_accuracy'] = round(confidence * 100, 2)
    node['local_loss'] = round(max(0.01, 1.0 - confidence), 4)
    node['weights'] = client_weights
    node['last_seen'] = time.time()
    node['status'] = 'online'
    node['value'] = value
    node['prediction'] = prediction
    node['confidence'] = confidence

    # Record packet into history ledger
    packet_record = {
        'timestamp': timestamp,
        'node_id': node_id,
        'type': sensor_type,
        'value': value,
        'prediction': prediction,
        'confidence': confidence,
        'version': global_model_state['version']
    }
    packet_history.insert(0, packet_record)
    if len(packet_history) > 200: packet_history.pop() # Keep last 200 packets

    # Auto-generate alerts if anomaly is detected
    if prediction in ['Overheating', 'Object Detected', 'Motion Detected', 'Person Detected']:
        alert_logs.insert(0, {
            'timestamp': timestamp,
            'node_id': node_id,
            'severity': 'warning' if prediction != 'Overheating' else 'critical',
            'message': f"{node_id} triggered anomaly event: {prediction} (Val: {value})"
        })
        if len(alert_logs) > 50: alert_logs.pop()

    socketio.emit('sensor_update', packet_record)
    return jsonify({"status": "success"}), 200

@app.route('/api/nodes', methods=['GET'])
def get_nodes():
    return jsonify([{
        'node_id': nid,
        'type': info['type'],
        'value': info['value'],
        'prediction': info.get('prediction', 'Clear'),
        'confidence': info.get('confidence', 0.85),
        'status': info.get('status', 'offline'),
        'samples': info.get('samples', 0),
        'local_accuracy': info.get('local_accuracy', 0.0),
        'rssi': info.get('rssi', -60)
    } for nid, info in active_nodes.items()])

@app.route('/api/system/health', methods=['GET'])
def get_system_health():
    total = len(active_nodes)
    online = sum(1 for i in active_nodes.values() if i.get('status') == 'online')
    uptime_seconds = int(time.time() - start_time)
    
    return jsonify({
        "total_nodes": total,
        "online_nodes": online,
        "mesh_active": online > 0,
        "total_packets": len(packet_history),
        "uptime_seconds": uptime_seconds,
        "mean_confidence": round(sum(i.get('confidence', 0.85) for i in active_nodes.values()) / max(1, online) * 100, 1)
    }), 200

@app.route('/api/history/packets', methods=['GET'])
def get_packet_history():
    return jsonify(packet_history), 200

@app.route('/api/history/alerts', methods=['GET'])
def get_alerts():
    return jsonify(alert_logs), 200

@app.route('/api/history/fedavg', methods=['GET'])
def get_fedavg_history():
    return jsonify(fedavg_rounds_history), 200

@app.route('/api/fedavg/aggregate', methods=['POST'])
def execute_fedavg():
    online_nodes = {nid: info for nid, info in active_nodes.items() if info['status'] == 'online'}
    if not online_nodes:
        return jsonify({"status": "error", "message": "No online nodes available"}), 400

    fedavg_state["completed_rounds"] += 1
    total_samples = sum(node['samples'] for node in online_nodes.values()) or 1

    agg_acc = 0.0
    agg_loss = 0.0
    client_weights = {}
    new_weights = [0.0, 0.0, 0.0]

    participating_summary = []

    for nid, node in online_nodes.items():
        ratio = node['samples'] / total_samples
        client_weights[nid] = round(ratio * 100, 1)
        agg_acc += ratio * node['local_accuracy']
        agg_loss += ratio * node['local_loss']
        
        node_w = node.get('weights', [0.1, 0.4, 0.7])
        for i in range(3):
            new_weights[i] += ratio * node_w[i]
            
        participating_summary.append(f"{nid} ({node['samples']} samples, {round(ratio*100,1)}% weight)")

    global_model_state["version"] += 1
    global_model_state["weights"] = [round(w, 4) for w in new_weights]

    fedavg_state["global_accuracy"] = round(agg_acc, 2)
    fedavg_state["global_loss"] = round(agg_loss, 4)
    fedavg_state["client_weights"] = client_weights

    # Log how this round impacted global data
    round_log = {
        "round": fedavg_state["completed_rounds"],
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "accuracy": fedavg_state["global_accuracy"],
        "loss": fedavg_state["global_loss"],
        "participating_nodes": participating_summary,
        "new_weights": global_model_state["weights"]
    }
    fedavg_rounds_history.insert(0, round_log)

    socketio.emit('fedavg_update', fedavg_state)
    return jsonify({"status": "success", "state": fedavg_state, "audit": round_log}), 200

def monitor_node_timeouts():
    while True:
        curr = time.time()
        for nid, info in list(active_nodes.items()):
            if info.get('status') == 'online' and (curr - info.get('last_seen', 0)) > TIMEOUT_SECONDS:
                active_nodes[nid]['status'] = 'offline'
                socketio.emit('node_status_change', {'node_id': nid, 'status': 'offline'})
        time.sleep(2)

if __name__ == '__main__':
    database.init_db()
    threading.Thread(target=monitor_node_timeouts, daemon=True).start()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)