#define GPS_IMPL
#include "gps.h"
#include "modem.h"

/*
  Full system with simple switches:
    - Enable / disable modules in setup().
    - Debug modes:
        * DEBUG_MODEM_STREAM: polls AT and prints URCs/responses
        * DEBUG_GPS_STREAM:   prints raw NMEA from GPS
    - Normal mode: read GPS fix and (optionally) send once over TCP (demo).
*/

const uint8_t  LED_PIN          = LED_BUILTIN;   // active LOW
const uint32_t SEND_PERIOD_MS   = 2000;         // normal-mode send cadence
bool haveFix = false;

// ---------- Configuration switches (set in setup()) ----------
static bool ENABLE_MODEM        = true;
static bool ENABLE_GPS          = true;
static bool DEBUG_MODEM_STREAM  = false;  // stream modem bytes / simple AT ping
static bool DEBUG_GPS_STREAM    = false;  // stream raw NMEA

// ---------- State ----------
static uint32_t lastSend        = 0;
double lat = 0, lon = 0;

void blinkLed(int timeout){
    digitalWrite(LED_BUILTIN, LOW);
    delay(timeout);
    digitalWrite(LED_BUILTIN, HIGH);
    delay(timeout);
}

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, HIGH); // OFF

  // ====== CHOOSE WHAT YOU WANT THIS RUN TO DO ======
  ENABLE_MODEM       = true;    // set false to completely skip modem init/use
  ENABLE_GPS         = true;    // set false to skip GPS
  DEBUG_MODEM_STREAM = false;   // true = modem debug stream mode
  DEBUG_GPS_STREAM   = false;   // true = GPS raw NMEA stream mode
  // NOTE: don't enable both debug modes at once.

  // ====== Bring up modules per the flags ======
  if (ENABLE_GPS) {
    gpsBegin();
  }

  for(int c=0; c<10; c++){
    blinkLed(500);
  }

  digitalWrite(LED_BUILTIN, HIGH);

  if (ENABLE_MODEM) {
    initModem();
  }

}

void loop() {
  // ====== DEBUG MODES (exclusive) ======
  if (DEBUG_GPS_STREAM && ENABLE_GPS) {
    gpsDebugStreamLoop(); // raw NMEA -> Serial Monitor
    yield();
    return;
  }


  // ====== NORMAL MODE ======
  if (!ENABLE_GPS && !ENABLE_MODEM) {
    // nothing to do
    delay(200);
    return;
  }

  if (ENABLE_GPS) {
    haveFix = gpsReadFix(200, lat, lon); // short parse slice
  }

  // Send on interval if we have both modem & a fix
  if (ENABLE_MODEM && (millis() - lastSend >= SEND_PERIOD_MS)) {
      if(haveFix){
        initGPRS();
        sendTelemetryJson(lat, lon);
        digitalWrite(LED_PIN, LOW); delay(60); digitalWrite(LED_PIN, HIGH);
        deinitGPRS();

        blinkLed(100);
      }

    lastSend = millis();
  }

  if(!haveFix){
    blinkLed(500);
  }

}