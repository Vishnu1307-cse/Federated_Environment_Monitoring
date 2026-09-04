#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// --- Federated Learning Weight Management ---
float localWeights[3] = {0.12, 0.45, 0.78}; 
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

// --- Configuration ---
const char* ssid = "Tell My Wi-Fi Love Her";
const char* password = "Vishnu@bro13";
const char* serverUrl = "http://10.127.95.163:5000/api/sensor";
const char* modelCheckUrl = "http://10.127.95.163:5000/api/model/latest";

#define DHTPIN 4     // Digital pin connected to the DHT22 sensor[cite: 5]
#define DHTTYPE DHT22 
DHT dht(DHTPIN, DHTTYPE);

unsigned long previousMillis = 0;
const long interval = 5000; // Send data every 5 seconds[cite: 5]

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
  if (model->version() != TFLITE_SCHEMA_VERSION) return false;

  static tflite::AllOpsResolver resolver;
  static tflite::MicroInterpreter static_interpreter(
      model, resolver, tensor_arena, kTensorArenaSize, error_reporter);
  interpreter = &static_interpreter;

  if (interpreter->AllocateTensors() != kTfLiteOk) return false;

  input = interpreter->input(0);
  output = interpreter->output(0);
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
}

void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) delay(500);
  }
}

struct InferenceResult {
  String prediction;
  float confidence;
};

InferenceResult runInference(float temperature) {
  InferenceResult result;
#if HAS_TFLITE_MICRO
  if (interpreter && input && output) {
    input->data.f[0] = temperature;
    if (interpreter->Invoke() == kTfLiteOk) {
      float normalScore = output->data.f[0];
      float overheatScore = output->data.f[1];
      if (overheatScore > normalScore) {
        result.prediction = "Overheating";
        result.confidence = overheatScore;
      } else {
        result.prediction = "Normal";
        result.confidence = normalScore;
      }
      return result;
    }
  }
#endif
  if (temperature > 40.0) {
    result.prediction = "Overheating";
    result.confidence = 0.95;
  } else {
    result.prediction = "Normal";
    result.confidence = 0.98;
  }
  return result;
}

void setup() {
  setupWiFi();
  dht.begin();
#if HAS_TFLITE_MICRO
  setupTFLite();
#endif
  Serial.println("Temperature Node Initialized.");
}

void loop() {
  checkWiFiConnection();

  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    float tempVal = dht.readTemperature();
    if (isnan(tempVal)) {
      Serial.println("Failed to read from DHT sensor!");
      return;
    }

    InferenceResult inf = runInference(tempVal);

    JsonDocument doc;
    doc["node_id"] = "Temperature_Node"; 
    doc["type"] = "Temperature";
    doc["value"] = tempVal;
    doc["prediction"] = inf.prediction;
    doc["confidence"] = inf.confidence;

    JsonArray weightsArray = doc.create_nested_array("weights");
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
        Serial.printf("Temperature POST successful. Code: %d | Temp: %.1f C | Pred: %s (%.2f)\n", 
                      httpResponseCode, tempVal, inf.prediction.c_str(), inf.confidence);
      }
      http.end();

      // Downlink sync check
      HTTPClient clientCheck;
      clientCheck.begin(modelCheckUrl);
      if (clientCheck.GET() > 0) {
        JsonDocument respDoc;
        deserializeJson(respDoc, clientCheck.getString());
        int serverVersion = respDoc["version"];
        if (serverVersion > globalModelVersion) {
          globalModelVersion = serverVersion;
          JsonArray newWeights = respDoc["weights"];
          localWeights[0] = newWeights[0];
          localWeights[1] = newWeights[1];
          localWeights[2] = newWeights[2];
          Serial.printf("[FL Downlink] Temperature Node synced to Global Model v%d\n", globalModelVersion);
        }
      }
      clientCheck.end();
    }
  }
}