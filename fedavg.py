"""
FedShield - Federated Learning (FedAvg) Engine
Simulates edge model training, client parameter reporting,
and server-side Federated Averaging (FedAvg) aggregation across WSN edge nodes.
"""

from datetime import datetime, timezone
import random
import sqlite3
from typing import Dict, Any, List


def perform_fedavg_round(conn: sqlite3.Connection) -> Dict[str, Any]:
    """
    Executes a simulated Federated Averaging (FedAvg) round across the WSN edge nodes:
    1. Reads the previous round from the 'fedavg' table.
    2. Simulates local gradient updates and sample counts for active edge nodes.
    3. Computes the aggregated global model accuracy (88% - 98%) and training loss.
    4. Persists the round metrics into SQLite.
    5. Returns detailed telemetry and convergence metrics.
    """
    cursor = conn.cursor()

    # Get the latest round number and metrics
    latest = cursor.execute("""
        SELECT round_number, global_accuracy, training_loss 
        FROM fedavg 
        ORDER BY round_number DESC 
        LIMIT 1;
    """).fetchone()

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    if latest:
        current_round = latest["round_number"] + 1
        prev_acc = latest["global_accuracy"]
        prev_loss = latest["training_loss"]
    else:
        current_round = 1
        prev_acc = 0.820
        prev_loss = 0.450

    # Progressive convergence simulation towards ceiling of ~0.978 - 0.985
    # with realistic micro-fluctuations
    if prev_acc < 0.92:
        acc_increment = random.uniform(0.015, 0.035)
    elif prev_acc < 0.96:
        acc_increment = random.uniform(0.005, 0.018)
    else:
        acc_increment = random.uniform(-0.004, 0.008)

    new_acc = round(min(0.985, max(0.880, prev_acc + acc_increment)), 4)
    new_loss = round(max(0.045, prev_loss * random.uniform(0.88, 0.96)), 4)

    # Simulated client contributions for edge nodes
    participating_nodes = ["temperature", "gas", "ir", "motion"]
    client_updates = []
    total_samples = 0

    for node in participating_nodes:
        local_samples = random.randint(120, 250)
        total_samples += local_samples
        local_acc = round(min(0.99, max(0.85, new_acc + random.uniform(-0.02, 0.02))), 4)
        local_loss = round(max(0.04, new_loss + random.uniform(-0.015, 0.025)), 4)
        
        client_updates.append({
            "node_name": node,
            "samples_contributed": local_samples,
            "local_accuracy": local_acc,
            "local_loss": local_loss,
            "aggregation_weight": 0.0  # Will normalize below
        })

    # Compute normalized FedAvg weights based on sample proportion: w_k = n_k / n
    for client in client_updates:
        client["aggregation_weight"] = round(client["samples_contributed"] / total_samples, 4)

    # Insert round into 'fedavg' table
    cursor.execute("""
        INSERT INTO fedavg (round_number, global_accuracy, training_loss, timestamp)
        VALUES (?, ?, ?, ?);
    """, (current_round, new_acc, new_loss, timestamp))

    # Ensure fedavg_coordinator exists in nodes table for foreign key constraint
    cursor.execute("""
        INSERT OR IGNORE INTO nodes (node_name, status, last_seen)
        VALUES ('fedavg_coordinator', 'ONLINE', ?);
    """, (timestamp,))

    # Log an informational alert documenting the completed round
    cursor.execute("""
        INSERT INTO alerts (node_name, message, severity, timestamp)
        VALUES (?, ?, ?, ?);
    """, (
        "fedavg_coordinator",
        f"FedAvg Round #{current_round} completed successfully. Global Accuracy: {new_acc * 100:.2f}%, Loss: {new_loss:.4f}",
        "INFO",
        timestamp
    ))

    conn.commit()

    return {
        "round_number": current_round,
        "global_accuracy": new_acc,
        "global_accuracy_percentage": f"{new_acc * 100:.2f}%",
        "training_loss": new_loss,
        "accuracy_delta": round(new_acc - prev_acc, 4),
        "total_samples_trained": total_samples,
        "participating_clients_count": len(participating_nodes),
        "client_contributions": client_updates,
        "aggregation_algorithm": "Federated Averaging (FedAvg)",
        "timestamp": timestamp
    }
