# FedShield: Decentralized Privacy-Preserving AI for Smart Manufacturing WSN

**FedShield** is an advanced Edge AI and Wireless Sensor Network (WSN) management platform designed for smart manufacturing environments. It combines **TinyML** deployed on ESP32 microcontrollers with a central **Federated Learning (FedAvg)** orchestration engine, real-time WebSocket telemetry tracking, and a modern React dashboard.

---

## 🚀 Key Features

* **Decentralized Edge Intelligence:** Microcontrollers (ESP32, ESP32-CAM, PIR, DHT22) run local neural network inference via TensorFlow Lite Micro. Raw sensor data stays on-device; only local weights and model metadata are shared.
* **Federated Averaging (FedAvg) Engine:** The Flask backend aggregates weights from active edge nodes proportionally based on sample sizes ($n_k / n$), updating the global model in real-time.
* **Bidirectional Model Sync (Uplink/Downlink):** Nodes upload their local weights and receive updated global model parameters dynamically.
* **Real-Time WebSocket Dashboard:** Live metrics, active node statuses, anomaly alerts, QoS radio latency profiles, and FL audit trails update instantly without page refreshes.
* **Automated Node Timeouts:** Built-in background daemon threads automatically detect disconnected hardware and update network topology states.

---

## 🛠️ System Architecture

```text
┌────────────────────────┐         HTTP POST (Sensor Data & Weights)         ┌────────────────────────┐
│  ESP32 / Edge Nodes    │ ──────────────────────────────────────────────> │  Flask Backend (app.py)│
│  (TinyML / TFLite)     │ <────────────────────────────────────────────── │  - FedAvg Aggregator   │
└────────────────────────┘          GET (Global Model Downlink)            └───────────┬────────────┘
                                                                                       │
                                                                                 WebSocket (Socket.IO)
                                                                                       │
                                                                                       v
                                                                           ┌────────────────────────┐
                                                                           │   React Vite Frontend  │
                                                                           │   (Tailwind CSS UI)    │
                                                                           └────────────────────────┘

                                                                           ⚙️ Installation & Setup Guide
1. Backend Setup (Flask & SocketIO)
Ensure you have Python installed, then navigate to the root directory and install dependencies:

cd WSN_LAB1
pip install flask flask-cors flask-socketio eventlet pyserial

Run the backend server (binds to all network interfaces on port 5000):

python app.py

2. Frontend Setup (React Vite)
Navigate into the frontend directory, install dependencies, and start the development server:

cd frontend
npm install
npm run dev

3. Edge Node Setup (Arduino IDE / ESP32)
Open your ESP32 board sketches (Camera.ino[cite: 2], Motion_sensor.ino[cite: 3], Temp.ino[cite: 4], or your IR node script) in the Arduino IDE.

Install the required libraries via the Arduino Library Manager:

ArduinoJson (v6+)

DHT sensor library (for temperature nodes)

TensorFlowLite_ESP32 (optional for on-device TinyML; scripts include graceful rule-based fallbacks if omitted).

Update your Wi-Fi credentials and server IP address inside the sketch configuration:

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://<YOUR_PC_LAN_IP>:5000/api/sensor";

Compile and flash the code to your ESP32 microcontrollers.

📊 Usage Guide
Monitor Live Nodes: Navigate to Live Nodes Overview in the sidebar to inspect real-time raw values, local model predictions, confidence score progress bars, and sample counts from active microcontrollers.

Execute Federated Learning: Go to the Federated Learning tab and click Execute FedAvg Aggregation to mathematically aggregate client weights, increase global model accuracy, and push the updated model version back down to the hardware nodes.

Audit QoS & System Logs: Review continuous server uptime, packet throughput, per-node RSSI signal profiles, and anomaly alert logs under the QoS & System Health and Alerts Log sections.
