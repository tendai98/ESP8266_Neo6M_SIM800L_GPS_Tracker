#pragma once
/*
  NEO-6M GPS on SoftwareSerial (adjust pins below to your wiring).
  Defaults:
    - GPS TX -> ESP D5 (GPIO14)  [we READ here]
    - GPS RX <- ESP D6 (GPIO12)  [optional; we rarely write to GPS]
*/

#include <Arduino.h>
#include <SoftwareSerial.h>
#include <TinyGPSPlus.h>

// ============== CHANGE IF YOUR WIRES DIFFER ==============
#define GPS_RX_PIN   D7   // ESP RX  <- GPS TX
#define GPS_TX_PIN   D8   // ESP TX  -> GPS RX (optional)
#define GPS_BAUD     9600
// =========================================================

extern SoftwareSerial gpsSerial;
extern TinyGPSPlus   gpsParser;

static inline void gpsBegin() {
  gpsSerial.begin(GPS_BAUD);
  delay(50);
}

static inline bool gpsReadFix(uint32_t readMs, double& lat, double& lon) {
  uint32_t start = millis(); bool updated = false;
  while (millis() - start < readMs) {
    while (gpsSerial.available()) gpsParser.encode(gpsSerial.read());
    if (gpsParser.location.isUpdated() && gpsParser.location.isValid()) {
      lat = gpsParser.location.lat();
      lon = gpsParser.location.lng();
      updated = true;
    }
    yield();
  }
  return updated;
}

// Stream raw NMEA to Serial Monitor (debug mode)
static inline void gpsDebugStreamLoop() {
  while (gpsSerial.available()) {
    char c = gpsSerial.read();
    Serial.write(c);
  }
}

// Allocate objects in exactly one translation unit
#ifdef GPS_IMPL
  SoftwareSerial gpsSerial(GPS_RX_PIN, GPS_TX_PIN); // (RX, TX)
  TinyGPSPlus   gpsParser;
#endif