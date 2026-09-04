import os
import tensorflow as tf
import numpy as np

def convert_to_header(tflite_path, dest_paths, prefix):
    with open(tflite_path, 'rb') as f:
        data = f.read()
    guard = f"{prefix.upper()}_MODEL_H"
    content = [
        f"#ifndef {guard}",
        f"#define {guard}",
        "",
        f"// Auto-generated header for {os.path.basename(tflite_path)}",
        f"// Model size: {len(data)} bytes",
        "",
        "alignas(16) const unsigned char g_model[] = {"
    ]
    chunk_size = 12
    for i in range(0, len(data), chunk_size):
        chunk = data[i:i+chunk_size]
        hex_bytes = ', '.join(f'0x{b:02x}' for b in chunk)
        if i + chunk_size < len(data):
            hex_bytes += ','
        content.append(f"  {hex_bytes}")
    content.append("};")
    content.append(f"const unsigned int g_model_len = {len(data)};")
    content.append("")
    alias = prefix.lower() + "_tflite"
    content.append(f"#define {alias} g_model")
    content.append(f"#define {alias}_len g_model_len")
    content.append("")
    content.append(f"#endif // {guard}\n")
    
    out_text = '\n'.join(content)
    for dp in dest_paths:
        os.makedirs(os.path.dirname(dp), exist_ok=True)
        with open(dp, 'w') as out:
            out.write(out_text)
        print(f"Generated header: {dp}")

def train_and_export(filename, X_train, y_train, dest_paths, prefix):
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=(1,)),
        tf.keras.layers.Dense(8, activation='relu'),
        tf.keras.layers.Dense(2, activation='softmax') # Class 0 = Normal/Safe/Clear, Class 1 = Alert/Leak/Detected
    ])
    model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    model.fit(X_train, y_train, epochs=25, verbose=0)
    
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    tflite_model = converter.convert()
    with open(filename, 'wb') as f:
        f.write(tflite_model)
    print(f"Successfully generated: {filename} ({len(tflite_model)} bytes)")
    convert_to_header(filename, dest_paths, prefix)

# 1. Temperature Node: Threshold at 40.0 C
X_temp = np.linspace(15, 65, 400).reshape(-1, 1).astype(np.float32)
y_temp = (X_temp > 40.0).astype(np.int32).flatten()
train_and_export('temperature.tflite', X_temp, y_temp, ['Temperature/Temp/model.h', 'Temperature/model.h'], 'TEMPERATURE')

# 2. Gas Node: Threshold at 2500 (MQ-2 ADC 0-4095)
X_gas = np.linspace(200, 4000, 400).reshape(-1, 1).astype(np.float32)
y_gas = (X_gas > 2500).astype(np.int32).flatten()
train_and_export('gas.tflite', X_gas, y_gas, ['Gas/Gas/model.h', 'Gas/model.h'], 'GAS')

# 3. IR Sensor: 0 = Object Detected (Class 1), 1 = Clear (Class 0)
X_ir = np.array([[0.0], [1.0]] * 200, dtype=np.float32)
y_ir = (X_ir < 0.5).astype(np.int32).flatten()
train_and_export('ir.tflite', X_ir, y_ir, ['IR/IR/model.h', 'IR/model.h'], 'IR')

# 4. Motion Sensor: 1 = Motion Detected (Class 1), 0 = Clear (Class 0)
X_mot = np.array([[0.0], [1.0]] * 200, dtype=np.float32)
y_mot = (X_mot > 0.5).astype(np.int32).flatten()
train_and_export('motion.tflite', X_mot, y_mot, ['Motion_sensor/model.h'], 'MOTION')

# 5. Person Detection (Camera model header export)
if os.path.exists('person_detect_model.tflite'):
    convert_to_header('person_detect_model.tflite', ['Camera/model.h'], 'PERSON_DETECT')