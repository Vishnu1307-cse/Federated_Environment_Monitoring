#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- Federated Learning Weight Management ---
float localWeights[3] = {0.12, 0.45, 0.78}; // Local layer weights to be trained/shared
int globalModelVersion = 0;

// --- TensorFlow Lite Micro Integration ---
#if __has_include(<TensorFlowLite_ESP32.h>) || __has_include(<TensorFlowLite.h>)
  #define HAS_TFLITE_MICRO 1
  #if __has_include(<TensorFlowLite_ESP32.h>)
    #include <TensorFlowLite_ESP32.h>
  #else
    #include <TensorFlowLite.h>
  #endif
  #include "tensorflow/lite/micro/all_ops_resolver.h"
  #include "tensorflow/lite/micro/micro_error_reporter.h"
  #include "tensorflow/lite/micro/micro_interpreter.h"
  #include "tensorflow/lite/schema/schema_generated.h"
  #include "tensorflow/lite/version.h"
#else
  #define HAS_TFLITE_MICRO 0
#endif

#include "model.h"

// --- Inference Structure ---
struct InferenceResult {
  String prediction;
  float confidence;
};

// --- Configuration ---
const char* ssid = "Tell My Wi-Fi Love Her";
const char* password = "Vishnu@bro13";
const char* serverUrl = "http://10.127.95.163:5000/api/sensor";
const char* modelCheckUrl = "http://10.127.95.163:5000/api/model/latest";

// --- Pin Definitions & Constants ---
#define IR_PIN 14   // Digital pin connected to the IR sensor output module

unsigned long previousMillis = 0;
const long interval = 3000; // Check IR state every 3 seconds

#if HAS_TFLITE_MICRO
namespace {
  tflite::ErrorReporter* error_reporter = nullptr;
  const tflite::Model* model = nullptr;
  tflite::MicroInterpreter* interpreter = nullptr;
  TfLiteTensor* input = nullptr;
  TfLiteTensor* output = nullptr;

  constexpr int kTensorArenaSize = 4 * 1024;
  alignas(16) uint8_t tensor_arena[kTensorArenaSize];
}

bool setupTFLite() {
  static tflite::MicroErrorReporter micro_error_reporter;
  error_reporter = &micro_error_reporter;

  model = tflite::GetModel(g_model);
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    Serial.println("IR Model Schema mismatch!");
    return false;
  }

  static tflite::AllOpsResolver resolver;
  static tflite::MicroInterpreter static_interpreter(
      model, resolver, tensor_arena, kTensorArenaSize, error_reporter);
  interpreter = &static_interpreter;

  if (interpreter->AllocateTensors() != kTfLiteOk) {
    Serial.println("AllocateTensors() failed for IR model!");
    return false;
  }

  input = interpreter->input(0);
  output = interpreter->output(0);
  Serial.println("TFLite IR Model initialized successfully.");
  return true;
}
#endif

void setupWiFi() {
  Serial.begin(115200);
  delay(1000);
  Serial.print("Connecting to ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected. IP address: ");
  Serial.println(WiFi.localIP());
}

void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected. Reconnecting...");
    WiFi.disconnect();
    WiFi.begin(ssid, password);
    unsigned long startAttemptTime = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttemptTime < 10000) {
      delay(500);
      Serial.print(".");
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\nReconnected!");
    } else {
      Serial.println("\nReconnection failed. Will retry later.");
    }
  }
}

InferenceResult runInference(int irState) {
  InferenceResult result;

#if HAS_TFLITE_MICRO
  if (interpreter && input && output) {
    input->data.f[0] = (float)irState;
    if (interpreter->Invoke() == kTfLiteOk) {
      float clearScore = output->data.f[0];
      float detectedScore = output->data.f[1];
      if (detectedScore > clearScore) {
        result.prediction = "Object Detected";
        result.confidence = detectedScore;
      } else {
        result.prediction = "Clear";
        result.confidence = clearScore;
      }
      return result;
    }
  }
#endif

  if (irState == LOW) {
    result.prediction = "Object Detected";
    result.confidence = 0.95;
  } else {
    result.prediction = "Clear";
    result.confidence = 0.98;
  }
  return result;
}

void setup() {
  setupWiFi();
  pinMode(IR_PIN, INPUT);
#if HAS_TFLITE_MICRO
  setupTFLite();
#else
  Serial.println("[Info] Running rule fallback.");
#endif
  Serial.println("IR Sensor Node Initialized.");
}

void loop() {
  checkWiFiConnection();

  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    int irVal = digitalRead(IR_PIN);
    InferenceResult inf = runInference(irVal);

    // Create JSON Payload including local model weights (Uplink)
    JsonDocument doc;
    doc["node_id"] = "IR_Barrier_Node"; 
    doc["type"] = "IR";
    doc["value"] = irVal; 
    doc["prediction"] = inf.prediction;
    doc["confidence"] = inf.confidence;

    JsonArray weightsArray = doc.createNestedArray("weights");
    weightsArray.add(localWeights[0]);
    weightsArray.add(localWeights[1]);
    weightsArray.add(localWeights[2]);

    String jsonString;
    serializeJson(doc, jsonString);

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(serverUrl);
      http.addHeader("Content-Type", "application/json");
      
      int httpResponseCode = http.POST(jsonString);
      if (httpResponseCode > 0) {
        Serial.printf("IR POST successful. Code: %d | State: %s (%.2f)\n", 
                    httpResponseCode, inf.prediction.c_str(), inf.confidence);
      } else {
        Serial.printf("Error on sending POST: %s\n", http.errorToString(httpResponseCode).c_str());
      }
      http.end();

      // Check for Global Model updates from the server (Downlink Loop)
      HTTPClient clientCheck;
      clientCheck.begin(modelCheckUrl);
      int getCode = clientCheck.GET();
      if (getCode > 0) {
        String payload = clientCheck.getString();
        JsonDocument respDoc;
        deserializeJson(respDoc, payload);
        int serverVersion = respDoc["version"];
        if (serverVersion > globalModelVersion) {
          globalModelVersion = serverVersion;
          JsonArray newWeights = respDoc["weights"];
          localWeights[0] = newWeights[0];
          localWeights[1] = newWeights[1];
          localWeights[2] = newWeights[2];
          Serial.printf("[FL Downlink] Synced to Global Model Version #%d\n", globalModelVersion);
        }
      }
      clientCheck.end();
    }
  }
}