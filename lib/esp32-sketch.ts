export function getEsp32Sketch(serverUrl: string, deviceId = "esp01"): string {
  return `/*
 * BMS Monitor — ESP32 Cloud Relay
 * Читає JBD BMS через UART, надсилає на сервер
 *
 * Підключення:
 *   BMS TX  →  ESP32 RX (pin 16)
 *   BMS RX  →  ESP32 TX (pin 17)
 *   BMS GND →  ESP32 GND
 *
 * Бібліотеки (Arduino Library Manager):
 *   - ArduinoJson by Benoit Blanchon (v6)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ────────────────────────────────────────────────
//  Налаштування — змінити перед завантаженням
// ────────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "${serverUrl}";
const char* DEVICE_ID     = "${deviceId}";
const int   PUSH_INTERVAL = 5000;   // інтервал надсилання, мс

// ── UART ─────────────────────────────────────────
#define BMS_RX  16
#define BMS_TX  17
HardwareSerial bmsSerial(1);

// ── JBD команди ──────────────────────────────────
const uint8_t CMD_BASIC[] = {0xDD, 0xA5, 0x03, 0x00, 0xFF, 0xFD};
const uint8_t CMD_CELLS[] = {0xDD, 0xA5, 0x04, 0x00, 0xFF, 0xFC};

struct BMSData {
  float    voltage;       // В (загальна)
  float    current;       // А (+ заряд, − розряд)
  float    remainCap;     // Аг
  float    fullCap;       // Аг
  uint8_t  soc;           // %
  uint16_t cycles;
  float    temp1, temp2;  // °C
  float    cells[32];
  uint8_t  cellCount;
  uint16_t protection;
  bool     chargeMos;
  bool     dischargeMos;
  bool     valid;
};

bool readBMS(BMSData& d);
bool pushData(const BMSData& d);
uint16_t calcCRC(const uint8_t* d, int len);

// ─────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  bmsSerial.begin(9600, SERIAL_8N1, BMS_RX, BMS_TX);

  Serial.println("BMS Monitor v1.0 — запуск...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi");
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries++ < 40) {
    delay(500); Serial.print(".");
  }
  if (WiFi.isConnected()) {
    Serial.println(" OK  IP: " + WiFi.localIP().toString());
  } else {
    Serial.println(" ПОМИЛКА — продовжую без WiFi");
  }
}

// ─────────────────────────────────────────────────
void loop() {
  static unsigned long lastPush = 0;

  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    delay(3000);
    return;
  }

  if (millis() - lastPush >= (unsigned long)PUSH_INTERVAL) {
    lastPush = millis();

    BMSData d;
    if (readBMS(d) && d.valid) {
      pushData(d);
    } else {
      Serial.println("[BMS] Помилка читання");
    }
  }
}

// ── Читання BMS ───────────────────────────────────
bool readBMS(BMSData& d) {
  d = BMSData{};
  d.valid = false;

  // Очищаємо буфер
  while (bmsSerial.available()) bmsSerial.read();

  // ─── Базова інформація (0x03) ─────────────────
  bmsSerial.write(CMD_BASIC, sizeof(CMD_BASIC));
  delay(200);

  uint8_t buf[80] = {};
  int len = 0;
  unsigned long t0 = millis();
  while (millis() - t0 < 500 && len < 80) {
    if (bmsSerial.available()) buf[len++] = bmsSerial.read();
    else delay(1);
  }

  // Перевірка: DD 03 00 <len> <data...> <crc_hi> <crc_lo> 77
  if (len < 7 || buf[0] != 0xDD || buf[1] != 0x03 || buf[2] != 0x00) {
    Serial.printf("[BMS] Невалідна відповідь 0x03, len=%d\\n", len);
    return false;
  }
  uint8_t dLen = buf[3];
  if (len < dLen + 7) {
    Serial.println("[BMS] Відповідь обрізана");
    return false;
  }

  uint8_t* data = &buf[4];
  d.voltage    = ((data[0] << 8) | data[1]) * 0.01f;
  int16_t cur  = (int16_t)((data[2] << 8) | data[3]);
  d.current    = cur * 0.01f;
  d.remainCap  = ((data[4] << 8) | data[5]) * 0.01f;
  d.fullCap    = ((data[6] << 8) | data[7]) * 0.01f;
  d.cycles     = (data[8] << 8) | data[9];
  d.protection = (data[16] << 8) | data[17];
  d.soc        = data[19];
  d.chargeMos    = (data[20] & 0x01) != 0;
  d.dischargeMos = (data[20] & 0x02) != 0;
  uint8_t nTemp  = data[22];
  for (uint8_t i = 0; i < nTemp && i < 2; i++) {
    uint16_t raw = (data[23 + i*2] << 8) | data[24 + i*2];
    float tc = (raw - 2731) * 0.1f;
    if (i == 0) d.temp1 = tc; else d.temp2 = tc;
  }

  // ─── Напруги комірок (0x04) ──────────────────
  while (bmsSerial.available()) bmsSerial.read();
  bmsSerial.write(CMD_CELLS, sizeof(CMD_CELLS));
  delay(200);

  uint8_t cbuf[128] = {};
  int clen = 0;
  t0 = millis();
  while (millis() - t0 < 500 && clen < 128) {
    if (bmsSerial.available()) cbuf[clen++] = bmsSerial.read();
    else delay(1);
  }

  if (clen >= 7 && cbuf[0] == 0xDD && cbuf[1] == 0x04 && cbuf[2] == 0x00) {
    uint8_t cDataLen = cbuf[3];
    d.cellCount = cDataLen / 2;
    if (d.cellCount > 32) d.cellCount = 32;
    for (uint8_t i = 0; i < d.cellCount; i++) {
      uint16_t mv = (cbuf[4 + i*2] << 8) | cbuf[5 + i*2];
      d.cells[i] = mv * 0.001f;
    }
  }

  d.valid = true;
  return true;
}

// ── Надсилання на сервер ─────────────────────────
bool pushData(const BMSData& d) {
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  StaticJsonDocument<1024> doc;
  doc["device_id"]     = DEVICE_ID;
  doc["voltage"]       = (int)(d.voltage * 100) / 100.0;
  doc["current"]       = (int)(d.current * 100) / 100.0;
  doc["soc"]           = d.soc;
  doc["remaining_cap"] = (int)(d.remainCap * 100) / 100.0;
  doc["full_cap"]      = (int)(d.fullCap * 100) / 100.0;
  doc["cycles"]        = d.cycles;
  doc["temp1"]         = (int)(d.temp1 * 10) / 10.0;
  doc["temp2"]         = (int)(d.temp2 * 10) / 10.0;
  doc["protection"]    = d.protection;
  doc["charge_mos"]    = d.chargeMos;
  doc["discharge_mos"] = d.dischargeMos;

  JsonArray cells = doc.createNestedArray("cells");
  for (uint8_t i = 0; i < d.cellCount; i++) {
    cells.add((int)(d.cells[i] * 1000) / 1000.0);
  }

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  http.end();

  if (code == 200) {
    Serial.printf("[OK] %.2fV  %+.2fA  %d%%  %d комірок\\n",
      d.voltage, d.current, d.soc, d.cellCount);
    return true;
  } else {
    Serial.printf("[ERR] HTTP %d\\n", code);
    return false;
  }
}

uint16_t calcCRC(const uint8_t* d, int len) {
  uint16_t sum = 0;
  for (int i = 0; i < len; i++) sum += d[i];
  return (~sum) + 1;
}
`;
}
