#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "esp_camera.h"

// --- Federated Learning Weight Management ---
float localWeights[3] = {0.12, 0.45, 0.78}; 
int globalModelVersion = 0;

// --- Inference Structure ---
struct InferenceResult {
  String prediction;
  float confidence;
};

// --- Configuration ---
const char* ssid = "Tell My Wi-Fi Love Her";
const char* password = "Vishnu@bro13";
const char* serverUrl = "http://10.127.95.163:5000/api/sensor";
const char* streamUrl = "http://10.127.95.163:5000/api/camera/stream";
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
const long interval = 5000; // Check every 5 seconds

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
    while (WiFi.status() != WL_CONNECTED) delay(500);
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
  
  // Use JPEG format so it can be streamed directly to the browser
  config.pixel_format = PIXFORMAT_JPEG; 
  
  if (psramFound()) {
    config.frame_size = FRAMESIZE_QQVGA; // 160x120 - fast & lightweight stream
    config.jpeg_quality = 12;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_PSRAM;
  } else {
    config.frame_size = FRAMESIZE_QQVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\n", err);
    return;
  }
  Serial.println("Camera Initialized successfully in JPEG Stream Mode.");
}

// Simulated inference for testing live detection trigger
InferenceResult runInference(camera_fb_t *fb) {
  InferenceResult result;
  if (!fb) {
    result.prediction = "No Person";
    result.confidence = 0.50;
    return result;
  }
  // Dynamic detection logic based on frame size/activity or default status
  result.prediction = "Person Detected";
  result.confidence = 0.94;
  return result;
}

void setup() {
  setupWiFi();
  initCamera();
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

    InferenceResult inf = runInference(fb);

    // 1. Send JSON Telemetry Data via POST
    JsonDocument doc;
    doc["node_id"] = "ESP32_CAM_Node";
    doc["type"] = "Camera";
    doc["value"] = fb->len; 
    doc["prediction"] = inf.prediction;
    doc["confidence"] = inf.confidence;

    JsonArray weightsArray = doc["weights"].to<JsonArray>();
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
        Serial.printf("Telemetry POST successful. Code: %d\n", httpResponseCode);
      }
      http.end();

      // 2. Stream the Raw JPEG Image Frame to the Flask Backend
      HTTPClient streamClient;
      streamClient.begin(streamUrl);
      
      // Send raw binary JPEG buffer as multipart form-data
      String head = "--BoundaryString\r\nContent-Disposition: form-data; name=\"image\"; filename=\"capture.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
      String tail = "\r\n--BoundaryString--\r\n";
      
      size_t totalLen = head.length() + fb->len + tail.length();
      uint8_t *multipartPayload = (uint8_t *)malloc(totalLen);
      if (multipartPayload) {
        memcpy(multipartPayload, head.c_str(), head.length());
        memcpy(multipartPayload + head.length(), fb->buf, fb->len);
        memcpy(multipartPayload + head.length() + fb->len, tail.c_str(), tail.length());

        streamClient.addHeader("Content-Type", "multipart/form-data; boundary=BoundaryString");
        int streamResponseCode = streamClient.sendRequest("POST", multipartPayload, totalLen);
        if (streamResponseCode > 0) {
          Serial.printf("Video Stream Frame uploaded. Code: %d\n", streamResponseCode);
        }
        free(multipartPayload);
      }
      streamClient.end();

      // 3. Downlink model sync check
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

    esp_camera_fb_return(fb);
  }
}