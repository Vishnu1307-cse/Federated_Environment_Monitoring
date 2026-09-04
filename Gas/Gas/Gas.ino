#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

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

// --- Configuration ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://YOUR_FLASK_SERVER_IP:5000/gas";

// --- Pin Definitions & Constants ---
#define MQ2_PIN 34   // Analog input pin connected to MQ2 sensor

unsigned long previousMillis = 0;
const long interval = 5000;

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
    Serial.println("Gas Model Schema mismatch!");
    return false;
  }

  static tflite::AllOpsResolver resolver;
  static tflite::MicroInterpreter static_interpreter(
      model, resolver, tensor_arena, kTensorArenaSize, error_reporter);
  interpreter = &static_interpreter;

  if (interpreter->AllocateTensors() != kTfLiteOk) {
    Serial.println("AllocateTensors() failed for Gas model!");
    return false;
  }

  input = interpreter->input(0);
  output = interpreter->output(0);
  Serial.println("TFLite Gas Model initialized successfully.");
  return true;
}
#endif

void setupWiFi() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nGas Node WiFi Connected.");
}

void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
    }
  }
}

struct InferenceResult {
  String prediction;
  float confidence;
};

InferenceResult runInference(int rawGasValue) {
  InferenceResult result;

#if HAS_TFLITE_MICRO
  if (interpreter && input && output) {
    input->data.f[0] = (float)rawGasValue;
    if (interpreter->Invoke() == kTfLiteOk) {
      float safeScore = output->data.f[0];
      float leakScore = output->data.f[1];
      if (leakScore > safeScore) {
        result.prediction = "Leak";
        result.confidence = leakScore;
      } else {
        result.prediction = "Safe";
        result.confidence = safeScore;
      }
      return result;
    }
  }
#endif

  // Fallback if TFLite Micro library is not installed or uninitialized
  if (rawGasValue > 2500) {
    result.prediction = "Leak";
    result.confidence = 0.92;
  } else {
    result.prediction = "Safe";
    result.confidence = 0.99;
  }
  return result;
}

void setup() {
  setupWiFi();
  pinMode(MQ2_PIN, INPUT);
#if HAS_TFLITE_MICRO
  setupTFLite();
#else
  Serial.println("[Info] Running rule fallback. To run on-device neural model, install 'TensorFlowLite_ESP32' via Arduino Library Manager.");
#endif
  Serial.println("Gas Node Initialized.");
}

void loop() {
  checkWiFiConnection();

  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    int gasValue = analogRead(MQ2_PIN);
    InferenceResult inf = runInference(gasValue);

    JsonDocument doc;
    doc["node"] = "gas";
    doc["value"] = gasValue;
    doc["prediction"] = inf.prediction;
    doc["confidence"] = inf.confidence;

    String jsonString;
    serializeJson(doc, jsonString);

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(serverUrl);
      http.addHeader("Content-Type", "application/json");
      int httpResponseCode = http.POST(jsonString);
      
      if (httpResponseCode > 0) {
        Serial.printf("Gas POST successful. Code: %d | Pred: %s (%.2f)\n", 
                      httpResponseCode, inf.prediction.c_str(), inf.confidence);
      } else {
        Serial.printf("Gas POST failed. Error: %s\n", http.errorToString(httpResponseCode).c_str());
      }
      http.end();
    }
  }
}