"""
FedShield WSN IoT Backend - Database Setup Module
SQLite database schema and initializer for federated sensor telemetry, 
edge node registry, FedAvg federated rounds, and intrusion/anomaly alerts.
"""

import os
import sqlite3
from datetime import datetime, timedelta
import random

DB_NAME = "database.db"


def get_db_connection(db_name: str = DB_NAME) -> sqlite3.Connection:
    """
    Establishes and returns a SQLite connection with:
    - Foreign key constraints enforced (PRAGMA foreign_keys = ON)
    - Row factory enabled for dictionary-like column access
    """
    conn = sqlite3.connect(db_name)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_name: str = DB_NAME, reset: bool = False) -> None:
    """
    Initializes the SQLite database tables.
    If reset is True, drops all existing tables before recreating them.
    """
    conn = get_db_connection(db_name)
    cursor = conn.cursor()

    if reset:
        print("[FedShield DB] Resetting existing tables...")
        tables_to_drop = [
            "alerts",
            "camera",
            "motion",
            "ir",
            "gas",
            "temperature",
            "fedavg",
            "nodes",
        ]
        for table in tables_to_drop:
            cursor.execute(f"DROP TABLE IF EXISTS {table};")

    print("[FedShield DB] Creating tables with foreign key constraints...")

    # 1. NODES TABLE (Primary registry for WSN edge nodes)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS nodes (
        node_name TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'OFFLINE' CHECK(status IN ('ONLINE', 'OFFLINE', 'WARNING', 'ALERT')),
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        rssi INTEGER DEFAULT -60,
        packet_loss REAL DEFAULT 0.0
    );
    """)

    # 2. TEMPERATURE TABLE (Scalar telemetry & TinyML inference)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS temperature (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        value REAL NOT NULL,
        prediction TEXT NOT NULL,
        confidence REAL NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (node_id) REFERENCES nodes(node_name) ON UPDATE CASCADE ON DELETE CASCADE
    );
    """)

    # 3. GAS SENSOR TABLE (MQ-2 analog telemetry & leak inference)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS gas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        value REAL NOT NULL,
        prediction TEXT NOT NULL,
        confidence REAL NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (node_id) REFERENCES nodes(node_name) ON UPDATE CASCADE ON DELETE CASCADE
    );
    """)

    # 4. IR OBSTACLE SENSOR TABLE
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ir (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        value INTEGER NOT NULL,
        prediction TEXT NOT NULL,
        confidence REAL NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (node_id) REFERENCES nodes(node_name) ON UPDATE CASCADE ON DELETE CASCADE
    );
    """)

    # 5. PIR MOTION SENSOR TABLE
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS motion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        value INTEGER NOT NULL,
        prediction TEXT NOT NULL,
        confidence REAL NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (node_id) REFERENCES nodes(node_name) ON UPDATE CASCADE ON DELETE CASCADE
    );
    """)

    # 6. CAMERA NODE TABLE (ESP32-CAM frame metrics & MobileNet Person Detection)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS camera (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        image_size INTEGER NOT NULL,
        prediction TEXT NOT NULL,
        confidence REAL NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (node_id) REFERENCES nodes(node_name) ON UPDATE CASCADE ON DELETE CASCADE
    );
    """)

    # 7. FEDAVG TABLE (Federated Learning Aggregation History)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fedavg (
        round_number INTEGER PRIMARY KEY,
        global_accuracy REAL NOT NULL,
        training_loss REAL NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 8. ALERTS TABLE (System & Intrusion/Anomaly Notifications)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_name TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT NOT NULL CHECK(severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (node_name) REFERENCES nodes(node_name) ON UPDATE CASCADE ON DELETE CASCADE
    );
    """)

    # --- Performance Indexes for Dashboard & Time-Series Analytics ---
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_temp_time ON temperature(timestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_gas_time ON gas(timestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ir_time ON ir(timestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_motion_time ON motion(timestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_camera_time ON camera(timestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_time ON alerts(timestamp);")

    conn.commit()
    conn.close()
    print("[FedShield DB] Database schema successfully initialized.")


def seed_dummy_data(db_name: str = DB_NAME) -> None:
    """
    Populates the database with realistic sample telemetry and records
    for development, testing, and UI dashboard visualization.
    """
    conn = get_db_connection(db_name)
    cursor = conn.cursor()

    print("[FedShield DB] Seeding sample data...")
    now = datetime.now()

    # 1. Seed Nodes
    nodes = [
        ("temperature", "ONLINE", (now - timedelta(seconds=12)).strftime("%Y-%m-%d %H:%M:%S"), -58, 0.01),
        ("gas", "ONLINE", (now - timedelta(seconds=8)).strftime("%Y-%m-%d %H:%M:%S"), -63, 0.02),
        ("ir", "ONLINE", (now - timedelta(seconds=5)).strftime("%Y-%m-%d %H:%M:%S"), -60, 0.00),
        ("motion", "ONLINE", (now - timedelta(seconds=15)).strftime("%Y-%m-%d %H:%M:%S"), -55, 0.00),
        ("camera", "ONLINE", (now - timedelta(seconds=20)).strftime("%Y-%m-%d %H:%M:%S"), -72, 0.04),
    ]

    cursor.executemany("""
    INSERT OR REPLACE INTO nodes (node_name, status, last_seen, rssi, packet_loss)
    VALUES (?, ?, ?, ?, ?);
    """, nodes)

    # 2. Seed Temperature Telemetry (DHT22: 24C to 45C)
    temp_records = []
    for i in range(25):
        t_time = (now - timedelta(minutes=25 - i)).strftime("%Y-%m-%d %H:%M:%S")
        val = round(26.5 + (i * 0.4) + random.uniform(-0.5, 0.8), 2)
        if val > 40.0:
            pred = "Overheating"
            conf = round(random.uniform(0.92, 0.98), 2)
        else:
            pred = "Normal"
            conf = round(random.uniform(0.95, 0.99), 2)
        temp_records.append(("temperature", val, pred, conf, t_time))

    cursor.executemany("""
    INSERT INTO temperature (node_id, value, prediction, confidence, timestamp)
    VALUES (?, ?, ?, ?, ?);
    """, temp_records)

    # 3. Seed Gas Telemetry (MQ-2: 600 - 3200 ADC)
    gas_records = []
    for i in range(25):
        t_time = (now - timedelta(minutes=25 - i)).strftime("%Y-%m-%d %H:%M:%S")
        val = 900 + (i * 70) + random.randint(-40, 50)
        if val > 2500:
            pred = "Leak"
            conf = round(random.uniform(0.91, 0.97), 2)
        else:
            pred = "Safe"
            conf = round(random.uniform(0.96, 0.99), 2)
        gas_records.append(("gas", val, pred, conf, t_time))

    cursor.executemany("""
    INSERT INTO gas (node_id, value, prediction, confidence, timestamp)
    VALUES (?, ?, ?, ?, ?);
    """, gas_records)

    # 4. Seed IR Obstacle Telemetry (0 = Detected, 1 = Clear)
    ir_records = []
    for i in range(20):
        t_time = (now - timedelta(minutes=20 - i)).strftime("%Y-%m-%d %H:%M:%S")
        val = 0 if i in [14, 15, 18] else 1
        pred = "Object Detected" if val == 0 else "Clear"
        conf = 0.96 if val == 0 else 0.99
        ir_records.append(("ir", val, pred, conf, t_time))

    cursor.executemany("""
    INSERT INTO ir (node_id, value, prediction, confidence, timestamp)
    VALUES (?, ?, ?, ?, ?);
    """, ir_records)

    # 5. Seed Motion Telemetry (1 = Motion, 0 = Clear)
    motion_records = []
    for i in range(20):
        t_time = (now - timedelta(minutes=20 - i)).strftime("%Y-%m-%d %H:%M:%S")
        val = 1 if i in [10, 11, 16, 17] else 0
        pred = "Motion Detected" if val == 1 else "Clear"
        conf = 0.97 if val == 1 else 0.99
        motion_records.append(("motion", val, pred, conf, t_time))

    cursor.executemany("""
    INSERT INTO motion (node_id, value, prediction, confidence, timestamp)
    VALUES (?, ?, ?, ?, ?);
    """, motion_records)

    # 6. Seed Camera Person Detection
    camera_records = []
    for i in range(15):
        t_time = (now - timedelta(minutes=(15 - i) * 2)).strftime("%Y-%m-%d %H:%M:%S")
        size = random.randint(14200, 19800)
        has_person = (i in [9, 10, 14])
        pred = "Person Detected" if has_person else "No Person"
        conf = round(random.uniform(0.88, 0.95), 2) if has_person else round(random.uniform(0.93, 0.98), 2)
        camera_records.append(("camera", size, pred, conf, t_time))

    cursor.executemany("""
    INSERT INTO camera (node_id, image_size, prediction, confidence, timestamp)
    VALUES (?, ?, ?, ?, ?);
    """, camera_records)

    # 7. Seed FedAvg Federated Aggregation Rounds
    fedavg_rounds = [
        (1, 0.742, 0.583, (now - timedelta(hours=5)).strftime("%Y-%m-%d %H:%M:%S")),
        (2, 0.795, 0.491, (now - timedelta(hours=4)).strftime("%Y-%m-%d %H:%M:%S")),
        (3, 0.841, 0.412, (now - timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S")),
        (4, 0.892, 0.325, (now - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")),
        (5, 0.927, 0.248, (now - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")),
        (6, 0.958, 0.164, now.strftime("%Y-%m-%d %H:%M:%S")),
    ]

    cursor.executemany("""
    INSERT OR REPLACE INTO fedavg (round_number, global_accuracy, training_loss, timestamp)
    VALUES (?, ?, ?, ?);
    """, fedavg_rounds)

    # 8. Seed Security & Safety Alerts
    alerts = [
        (
            "temperature",
            "Temperature threshold exceeded: 41.2 C (Potential Overheating)",
            "HIGH",
            (now - timedelta(minutes=4)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        (
            "gas",
            "MQ-2 Sensor detected combustible gas anomaly (ADC: 2680)",
            "CRITICAL",
            (now - timedelta(minutes=3)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        (
            "camera",
            "Person identified in restricted laboratory perimeter (Conf: 94%)",
            "MEDIUM",
            (now - timedelta(minutes=1)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        (
            "ir",
            "Intrusion boundary breached on sector IR-14",
            "LOW",
            (now - timedelta(seconds=45)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
    ]

    cursor.executemany("""
    INSERT INTO alerts (node_name, message, severity, timestamp)
    VALUES (?, ?, ?, ?);
    """, alerts)

    conn.commit()
    conn.close()
    print("[FedShield DB] Sample data successfully seeded into database.")


if __name__ == "__main__":
    # Setup database and seed dummy data on direct execution
    init_db(reset=True)
    seed_dummy_data()

    # Verification query
    conn = get_db_connection()
    c = conn.cursor()
    print("\n--- FedShield Database Table Summary ---")
    tables = ["nodes", "temperature", "gas", "ir", "motion", "camera", "fedavg", "alerts"]
    for t in tables:
        count = c.execute(f"SELECT COUNT(*) FROM {t};").fetchone()[0]
        print(f"Table '{t}': {count} records")
    conn.close()
