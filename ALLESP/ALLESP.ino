#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid     = "xxxxx";
const char* password = "xxxxx";

#define WATER_PIN 34
#define SERVO_PIN 33

// חיישן מרחק לזיהוי פסולת
#define TRIG_PIN 13
#define ECHO_PIN 14

// חיישן מרחק למדידת תכולת הפח
#define TRIG_FILL_PIN 19
#define ECHO_FILL_PIN 18

#define SERVO_BIN_PIN 12

Servo myServo;
Servo binServo;
int lastBinAngle = 0;
bool isBinBusy = false;
bool isDryingAttached = false;
int fillbin = 0;

WebServer server(80);
const char* predictUrl = "http://xx:xx:xx:xx/auto-predict";
bool isWaitingForPrediction = false;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Booting...");

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("Connected! IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println(" Failed to connect to WiFi.");
    return;
  }

  myServo.attach(SERVO_PIN);
  myServo.write(90);
  pinMode(WATER_PIN, INPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  pinMode(TRIG_FILL_PIN, OUTPUT);
  pinMode(ECHO_FILL_PIN, INPUT);

  binServo.attach(SERVO_BIN_PIN);
  binServo.write(0);

  server.on("/fillbin", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "text/plain", String(fillbin));
  });

  server.on("/dryingstatus", HTTP_GET, []() {
    server.sendHeader("Access-Control-Allow-Origin", "*");
    server.send(200, "text/plain", isDryingAttached ? "1" : "0");
  });

  server.begin();
  Serial.println("✅ HTTP server started.");
}

float checkDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  float duration = pulseIn(echoPin, HIGH, 30000); 
  if (duration == 0) return -1;
  float distance = duration / 58.0;
  return distance;
}

void updateFillbinLevel() { 
  float d2 = checkDistance(TRIG_FILL_PIN, TRIG_FILL_PIN);
  Serial.print("sssssssssssss ");
  Serial.print(d2);
  Serial.println(" cm");

  if (d2 > 25.0 || d2 > 0.0 ) {
    Serial.println("its not valid");

  }
  else
  {
    float totalDistance= d2*5;
    fillbin=totalDistance;
    Serial.println(fillbin);

    
  }
}

void handleUltrasonicSensor() {
  float d = checkDistance(TRIG_PIN, ECHO_PIN);
  Serial.print(" Distance: ");
  Serial.print(d);
  Serial.println(" cm");

  if (d < 15 && d > 0 && !isWaitingForPrediction) {
    Serial.println(" Distance < 15 → Sending prediction request...");
    sendPredictionRequest();
   

  }
}

void sendPredictionRequest() {
  if (isWaitingForPrediction) {
    Serial.println(" עדיין ממתין לתגובה מהשרת – לא נשלחת בקשה חדשה.");
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(" Can't send prediction. Not connected to WiFi.");
    return;
  }

  isWaitingForPrediction = true;

  HTTPClient http;
  http.begin(predictUrl);
  Serial.println(" שולח בקשת ניבוי...");

  int httpCode = http.GET();

  if (httpCode == 200) {
    String response = http.getString();
    Serial.print(" תגובת JSON: ");
    Serial.println(response);

    StaticJsonDocument<200> doc;
    DeserializationError error = deserializeJson(doc, response);

    if (error) {
      Serial.print(" שגיאת JSON: ");
      Serial.println(error.c_str());
    } else {
      String prediction = doc["prediction"];
      Serial.print(" ערך הניבוי: ");
      Serial.println(prediction);

      if (prediction == "bottle") {
        Serial.println("♻️ בקבוקים למחזורית");
      } 
      else if (prediction == "trash") {
        Serial.println("✅ זבל רגיל - binServo מופעל");
        lastBinAngle = binServo.read();
        binServo.write(90);
        delay(5000);
        binServo.write(lastBinAngle);
      } 
      else {
        Serial.println(" ערך ניבוי לא מזוהה");
      }
    }

  } else {
    Serial.print(" שגיאת HTTP: ");
    Serial.println(httpCode);
  }

  http.end();
  isWaitingForPrediction = false;
}

void loop() {
  server.handleClient();
  Serial.println(WiFi.localIP());
  int sensorValue = analogRead(WATER_PIN);
  Serial.print("💧 Water sensor value: ");
  Serial.println(sensorValue);

  if (sensorValue > 1000) {
    Serial.println(" Detected water! Starting drying...");
    if (!isDryingAttached) {
      Serial.println("מפעיל מנוע");
      myServo.attach(SERVO_PIN);
      isDryingAttached = true;
    }
    myServo.write(0);
  } else {
    Serial.println(" Dry. Detaching drying servo.");
    if (isDryingAttached) {
      myServo.detach();
      isDryingAttached = false;
    }
  }

  updateFillbinLevel();
  handleUltrasonicSensor();

  delay(1000); 
}
