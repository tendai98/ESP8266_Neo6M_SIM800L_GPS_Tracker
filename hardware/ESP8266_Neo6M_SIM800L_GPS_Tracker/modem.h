#include <Arduino.h>
#include "gps.h"   // uses extern TinyGPSPlus gpsParser from your gps.h

// ================== USER SETTINGS ==================
#define GSM_BAUD            9600
#define GSM_APN             "internet.netone"
#define GSM_TARGET_IP       "31.97.156.77"
#define GSM_TARGET_PORT     "9331"
#define DEVICE_ID           "AGR 9021"      // <-- your device id
#define VEHICLE_ID          "TRUCK-01"      // <-- your vehicle id

// Command pacing / retries
#define CMD_RETRY_COUNT     2           // extra tries for transient failures
#define CMD_TIMEOUT_S       8           // default token wait (seconds) if holdDelay is small
// ====================================================

// Internal response buffer (bounded, avoids heap churn)
static char  g_lastResp[256];
char latBuf[20], lonBuf[20], spdBuf[16], hdgBuf[16];
static bool  g_lastOK   = false;
static bool  g_lastFAIL = false;

// Utility: flush UART RX for a short window
static inline void _flushInput(uint32_t ms = 30) {
  const uint32_t t0 = millis();
  while (millis() - t0 < ms) { while (Serial.available()) Serial.read(); yield(); }
}

// === YOUR API: sendAT(cmd, count, holdDelayMs) ===============================
// - Sends the command up to 'count' times (or until OK token seen).
// - Waits for modem feedback (OK/ERROR/FAIL) up to max(holdDelay, CMD_TIMEOUT_S*1000) per try.
// - Adds a small pacing delay (holdDelay/2) after each try.
void sendAT(const char * cmd_buff, short count, short holdDelayMs) {
  if (count < 1) count = 1;
  uint32_t timeoutMsDefault = (uint32_t)CMD_TIMEOUT_S * 1000UL;

  for (short attempt = 0; attempt < count; ++attempt) {
    for (short retry = 0; retry <= CMD_RETRY_COUNT; ++retry) {
      _flushInput();
      g_lastResp[0] = '\0'; g_lastOK = false; g_lastFAIL = false;

      Serial.println(cmd_buff);               // send to modem
      const uint32_t timeoutMs = max<uint32_t>(holdDelayMs, timeoutMsDefault);
      const uint32_t deadline  = millis() + timeoutMs;

      // Read until OK/ERROR/FAIL or timeout
      size_t n = 0;
      while (millis() < deadline) {
        while (Serial.available()) {
          char c = (char)Serial.read();
          if (n + 1 < sizeof(g_lastResp)) { g_lastResp[n++] = c; g_lastResp[n] = '\0'; }
          if (strstr(g_lastResp, "OK"))    { g_lastOK = true;  }
          if (strstr(g_lastResp, "ERROR") || strstr(g_lastResp, "FAIL")) { g_lastFAIL = true; }
          if (g_lastOK || g_lastFAIL) goto _resp_done;
        }
        yield();
      }
     _resp_done:;

      // Pace a bit after each try
      delay(holdDelayMs ? holdDelayMs / 2 : 100);

      if (g_lastOK) return;          // success, stop early
      if (g_lastFAIL && retry < CMD_RETRY_COUNT) {
        delay(holdDelayMs ? holdDelayMs : 300);
        continue;                    // retry same command
      }
      break;                         // move to next attempt or exit
    }
  }
}

// === YOUR API: initModem() ====================================================
void initModem() {
  Serial.begin(GSM_BAUD);
  delay(250);

  // Handshake & setup (simple pacing)
  sendAT("AT",                1, 300);
  sendAT("ATE0",              1, 300);
  sendAT("AT+CFUN=1",         1, 300);

  // Lock baud (build once into stack buffer)
  char ipr[32];
  snprintf(ipr, sizeof(ipr), "AT+IPR=%d", GSM_BAUD);
  sendAT(ipr,                 1, 300);

  sendAT("AT+CIPSPRT=1",      1, 300); // show '>' prompt for CIPSEND
}

// === YOUR API: initGPRS() =====================================================
// Follows: CIPSHUT -> CGATT=1 -> poll CGATT? -> CGDCONT -> CSTT -> CIICR -> CIFSR
void initGPRS() {
  // 0) Reset IP task
  sendAT("AT+CIPSHUT", 1, 1200);           // expect SHUT OK

  // 1) Attach
  sendAT("AT+CGATT=1", 1, 600);

  // 2) Poll attach until +CGATT: 1 (<= ~20s)
  {
    uint32_t t0 = millis(); bool attached = false;
    while (millis() - t0 < 20000UL) {
      _flushInput();
      Serial.println(F("AT+CGATT?"));
      size_t n = 0; g_lastResp[0] = '\0';
      const uint32_t deadline = millis() + 1200;
      while (millis() < deadline) {
        while (Serial.available()) {
          char c = (char)Serial.read();
          if (n + 1 < sizeof(g_lastResp)) { g_lastResp[n++] = c; g_lastResp[n] = '\0'; }
        }
        yield();
      }
      if (strstr(g_lastResp, ": 1")) { attached = true; break; }
      delay(300);
    }
    if (!attached) { return; }
  }

  // 3) Program PDP context (APN)
  char cgd[64];
  snprintf(cgd, sizeof(cgd), "AT+CGDCONT=1,\"IP\",\"%s\"", GSM_APN);
  sendAT(cgd, 1, 500);

  // 4) Set APN (no user/pass)
  char cstt[64];
  snprintf(cstt, sizeof(cstt), "AT+CSTT=\"%s\",\"\",\"\"", GSM_APN);
  sendAT(cstt, 1, 800);
  delay(1500);                             // let context settle

  // 5) Bring up bearer (can take a while)
  sendAT("AT+CIICR", 1, 85000);
  delay(1200);

  // 6) Get local IP (CIFSR returns IP line, no OK)
  _flushInput();
  Serial.println(F("AT+CIFSR"));
  size_t n = 0; g_lastResp[0] = '\0';
  {
    const uint32_t deadline = millis() + 8000;
    while (millis() < deadline) {
      while (Serial.available()) {
        char c = (char)Serial.read();
        if (n + 1 < sizeof(g_lastResp)) { g_lastResp[n++] = c; g_lastResp[n] = '\0'; }
      }
      yield();
    }
  }
  delay(300);
  // Optional quick sanity: require dotted-quad
  if (!(n >= 7 && strchr(g_lastResp, '.'))) {
    // no IP; leave as-is (caller can retry)
  }
}

// === YOUR API: deinitGPRS() ===================================================
void deinitGPRS() {
  sendAT("AT+CIPSHUT", 1, 4000);
}

// ---------- NEW: JSON builder from GPS (uses gps.h) ---------------------------
// Returns a compact JSON string like:
// {"deviceId":"AGR 9021","vehicleId":"TRUCK-01","lat":-17.812345,"long":31.052345,"speed":42.1,"heading":123.4}


// === YOUR API: sendTcp(payload) ===============================================
// Follows: (initGPRS) -> CIPSTART -> CIPSEND -> payload -> ^Z -> wait SEND OK -> CIPCLOSE
void sendTcp(String payload) {
  // Ensure bearer up
  initGPRS();

  // Open connection
  char openCmd[96];
  snprintf(openCmd, sizeof(openCmd),
           "AT+CIPSTART=\"TCP\",\"%s\",\"%s\"",
           GSM_TARGET_IP, GSM_TARGET_PORT);

  // Try once; if PDP DEACT or fail, re-bring-up and retry once more
  for (int tries = 0; tries < 2; ++tries) {
    _flushInput();
    g_lastResp[0] = '\0';
    Serial.println(openCmd);

    // Wait for CONNECT OK / ALREADY CONNECT / error tokens (30s)
    const uint32_t deadline = millis() + 30000UL;
    size_t n = 0; bool connected = false; bool pdpDown = false;
    while (millis() < deadline) {
      while (Serial.available()) {
        char c = (char)Serial.read();
        if (n + 1 < sizeof(g_lastResp)) { g_lastResp[n++] = c; g_lastResp[n] = '\0'; }
        if (strstr(g_lastResp, "CONNECT OK") || strstr(g_lastResp, "ALREADY CONNECT")) { connected = true; break; }
        if (strstr(g_lastResp, "CONNECT FAIL") || strstr(g_lastResp, "ERROR")) break;
        if (strstr(g_lastResp, "PDP DEACT")) { pdpDown = true; break; }
      }
      if (connected || pdpDown) break;
      yield();
    }
    delay(800);

    if (connected) break;

    if ((tries == 0) && (pdpDown || !connected)) {
      // Rebuild bearer once
      initGPRS();
      continue;
    } else {
      // Fail: give up
      return;
    }
  }

  // Optional status peek (non-critical)
  sendAT("AT+CIPSTATUS", 1, 1200);

  // Ask to send and wait for '>' prompt (25s)
  _flushInput();
  Serial.println(F("AT+CIPSEND"));
  {
    const uint32_t deadline = millis() + 25000UL;
    bool gotPrompt = false;
    while (millis() < deadline) {
      while (Serial.available()) {
        if ((char)Serial.read() == '>') { gotPrompt = true; }
      }
      if (gotPrompt) break;
      yield();
    }
    if (!gotPrompt) {
      Serial.println(F("AT+CIPCLOSE"));
      const uint32_t t1 = millis() + 8000;
      while (millis() < t1) { while (Serial.available()) Serial.read(); yield(); }
      return;
    }
  }

  // Send payload (raw TCP) + Ctrl+Z
  for (size_t i = 0; i < payload.length(); ++i) Serial.write((uint8_t)payload[i]);
  delay(30);
  Serial.write((uint8_t)0x1A);

  // Wait for SEND OK (15s)
  {
    g_lastResp[0] = '\0';
    size_t n = 0;
    const uint32_t deadline = millis() + 15000UL;
    bool sendOk = false;
    while (millis() < deadline) {
      while (Serial.available()) {
        char c = (char)Serial.read();
        if (n + 1 < sizeof(g_lastResp)) { g_lastResp[n++] = c; g_lastResp[n] = '\0'; }
        if (strstr(g_lastResp, "SEND OK")) { sendOk = true; break; }
        if (strstr(g_lastResp, "ERROR")) break;
      }
      if (sendOk) break;
      yield();
    }
    delay(300);
  }

  // Close socket
  sendAT("AT+CIPCLOSE", 1, 1500);
}

String buildTelemetryJson(double lat, double lon) {
  // Pull speed (km/h) and heading (deg) from TinyGPSPlus if valid
  double spdKmh = gpsParser.speed.isValid()   ? gpsParser.speed.kmph() : 0.0;
  double headDeg= gpsParser.course.isValid()  ? gpsParser.course.deg() : 0.0;

  // Format numbers with dtostrf into small local buffers (no heap churn)
  dtostrf(lat,    0, 6, latBuf);     // 6 dp
  dtostrf(lon,    0, 6, lonBuf);
  dtostrf(spdKmh, 0, 1, spdBuf);     // 1 dp is plenty for km/h
  dtostrf(headDeg,0, 1, hdgBuf);

  // Build JSON in a fixed buffer, then one String() allocation
  char json[200];
  snprintf(json, sizeof(json),
    "{\"Id\":\"%s\",\"vId\":\"%s\",\"lt\":%s,\"ln\":%s,\"s\":%s,\"h\":%s}",
    DEVICE_ID, VEHICLE_ID, latBuf, lonBuf, spdBuf, hdgBuf);

  return String(json);
}

// Convenience wrapper if you want one-liner sends
void sendTelemetryJson(double lat, double lon) {
  sendTcp(buildTelemetryJson(lat, lon));
}