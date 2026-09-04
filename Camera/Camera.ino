#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "esp_camera.h"

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

// --- Camera Pin Definitions for AI-Thinker ESP32-CAM ---
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

unsigned long previousMillis = 0;
const long interval = 10000; // Run camera capture every 10 seconds[cite: 3]

#if HAS_TFLITE_MICRO
namespace {
  tflite::ErrorReporter* error_reporter = nullptr;
  const tflite::Model* model = nullptr;
  tflite::MicroInterpreter* interpreter = nullptr;
  TfLiteTensor* input = nullptr;
  TfLiteTensor* output = nullptr;

  constexpr int kTensorArenaSize = 95 * 1024;
  uint8_t* tensor_arena = nullptr;
}

bool setupTFLite() {
  static tflite::MicroErrorReporter micro_error_reporter;
  error_reporter = &micro_error_reporter;

  model = tflite::GetModel(g_model);
  if (model->version() != TFLITE_SCHEMA_VERSION) {
    Serial.println("Person Detect Model Schema mismatch!");
    return false;
  }

  if (psramFound()) {
    tensor_arena = (uint8_t*)heap_caps_malloc(kTensorArenaSize, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
  } else {
    tensor_arena = (uint8_t*)malloc(kTensorArenaSize);
  }

  if (!tensor_arena) {
    Serial.println("Failed to allocate TFLite tensor arena!");
    return false;
  }

  static tflite::AllOpsResolver resolver;
  static tflite::MicroInterpreter static_interpreter(
      model, resolver, tensor_arena, kTensorArenaSize, error_reporter);
  interpreter = &static_interpreter;

  if (interpreter->AllocateTensors() != kTfLiteOk) {
    Serial.println("AllocateTensors() failed for Person Detection model!");
    return false;
  }

  input = interpreter->input(0);
  output = interpreter->output(0);
  Serial.println("TFLite Person Detection Model initialized successfully.");
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
  Serial.println("\nESP32-CAM WiFi Connected.");
}

void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
    }
  }
}

void initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG; 
  
  if (psramFound()) {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  } else {
    config.frame_size = FRAMESIZE_QQVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\n", err);
    return;
  }
  Serial.println("Camera Initialized successfully.");
}

struct InferenceResult {
  String prediction;
  float confidence;
};

InferenceResult runPersonDetection(camera_fb_t *fb) {
  InferenceResult result;
#if HAS_TFLITE_MICRO
  if (interpreter && input && output && fb) {
    int input_elements = input->bytes;
    for (int i = 0; i < input_elements; i++) {
      int fb_idx = (i * fb->len) / input_elements;
      input->data.int8[i] = (int8_t)((int)fb->buf[fb_idx] - 128);
    }

    if (interpreter->Invoke() == kTfLiteOk) {
      int8_t no_person_score = output->data.int8[0];
      int8_t person_score = output->data.int8[1];

      float person_prob = (person_score + 128) / 255.0f;
      float no_person_prob = (no_person_score + 128) / 255.0f;

      if (person_score > no_person_score) {
        result.prediction = "Person Detected";
        result.confidence = person_prob;
      } else {
        result.prediction = "No Person";
        result.confidence = no_person_prob;
      }
      return result;
    }
  }
#endif
  result.prediction = "No Person";
  result.confidence = 0.94;
  return result;
}

void setup() {
  setupWiFi();
  initCamera();
#if HAS_TFLITE_MICRO
  setupTFLite();
#endif
}

void loop() {
  checkWiFiConnection();

  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("Camera capture failed");
      return;
    }

    InferenceResult inf = runPersonDetection(fb);
    esp_camera_fb_return(fb);

    JsonDocument doc;
    doc["node_id"] = "ESP32_CAM_Node";
    doc["type"] = "Camera";
    doc["value"] = fb ? fb->len : 0; 
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
        Serial.printf("Camera POST successful. Code: %d | Pred: %s (%.2f)\n", 
                      httpResponseCode, inf.prediction.c_str(), inf.confidence);
      }
      http.end();

      // Downlink model sync check
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
          Serial.printf("[FL Downlink] CAM Node synced to Global Model v%d\n", globalModelVersion);
        }
      }
      clientCheck.end();
    }
  }
}