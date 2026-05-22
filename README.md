# BMS Monitor

Мобільний додаток для моніторингу LiFePO₄/Li-Ion акумуляторів через JBD BMS контролер. ESP32-C3 підключається до BMS по **BLE**, показує дані на вбудованому дисплеї ST7789 та надсилає їх на сервер. Додаток читає дані звідусіль — вдома, в дорозі, через інтернет.

## Скріншоти

| Головний екран | Комірки | Графіки | Налаштування | Про додаток |
|:-:|:-:|:-:|:-:|:-:|
| SOC, напруга, струм | Гістограма комірок | 1г / 24г / 7д / 30д | WiFi · Relay · Demo | Апаратура і прошивка |

---

## Функції

- **Реальні дані з JBD BMS** — напруга, струм, SOC, температура, захисти MOS
- **Візуалізація комірок** — гістограма кожної комірки з індикатором балансу та delta мВ
- **Графіки历史** — напруга, струм, SOC, температура за обраним діапазоном
- **Cloud Relay режим** — ESP32 надсилає дані на сервер, додаток читає звідусіль
- **WiFi Direct** — пряме підключення до ESP32 по локальній мережі
- **Supabase** — постійне зберігання показань, список пристроїв
- **Банер застарілих даних** — жовте / червоне попередження коли ESP32 перестав надсилати
- **Демо-режим** — повністю функціональний без фізичного пристрою
- **Двомовність** — Українська / English

---

## Апаратне забезпечення

| Компонент | Модель |
|---|---|
| Мікроконтролер | **ESP32-C3 Super Mini** |
| Дисплей | GMT020-02 · ST7789 · 240×320 |
| BMS | JBD / Jiabaida (будь-яка модель) |
| Зв'язок з BMS | **BLE** (Bluetooth Low Energy) |
| Хімія | LiFePO₄ · Li-Ion · LiPo |
| Комірки | до 24S послідовних |

### Схема підключення дисплея ST7789

```
ESP32-C3       ST7789 (GMT020-02)
──────────────────────────────────
GPIO 4  ──────► MOSI (SDA)
GPIO 5  ──────► CLK (SCL)
GPIO 6  ──────► CS
GPIO 7  ──────► DC
GPIO 8  ──────► RST
3.3V    ──────► VCC, BL
GND     ──────── GND
```

---

## Стек технологій

| Частина | Технологія |
|---|---|
| Мобільний додаток | Expo (React Native) + Expo Router |
| Бекенд | Express + TypeScript |
| База даних | Supabase (PostgreSQL) |
| Стан | React Query + React Context |
| Графіки | react-native-svg |
| Мікроконтролер | ESP32-C3 + PlatformIO |
| BMS зв'язок | BLE (NimBLE / ArduinoBLE) |

---

## Архітектура

```
┌─────────────┐      BLE       ┌──────────────────────┐
│   JBD BMS   │ ◄────────────► │  ESP32-C3 Super Mini │
└─────────────┘                │  + ST7789 дисплей    │
                                └──────────┬───────────┘
                                           │ HTTP POST /api/bms/push
                                           │ (кожні 5 секунд)
                                           ▼
                                    ┌─────────────┐
                                    │   Сервер    │  :5000
                                    │  (Express)  │
                                    └──────┬──────┘
                                           │
                       ┌───────────────────┼─────────────────────┐
                       ▼                   ▼                      ▼
                ┌──────────┐      ┌──────────────┐      ┌──────────────┐
                │ Мобільний│      │   Supabase   │      │  In-memory   │
                │ додаток  │      │ (PostgreSQL) │      │    cache     │
                └──────────┘      └──────────────┘      └──────────────┘
```

### Режими підключення

1. **Cloud Relay** — ESP32 → сервер → додаток (працює через інтернет)
2. **WiFi Direct** — додаток підключається напряму до ESP32 по локальній мережі
3. **Demo** — генеровані дані для тестування без пристрою

---

## Формат даних ESP32 → сервер

ESP32 (PlatformIO) надсилає `POST /api/bms/push`:

```json
{
  "device_id": "esp32-c3-01",
  "voltage": 51.84,
  "current": -2.15,
  "soc": 74,
  "capacity": 22.2,
  "total_capacity": 30.0,
  "cycle_count": 47,
  "fet_status": 3,
  "protection_status": 0,
  "cell_count": 16,
  "temperatures": [28.5, 27.1],
  "cell_voltages": [3.24, 3.24, 3.25, ...],
  "cell_delta_mv": 12,
  "balance_status": 0,
  "balance_status_high": 0,
  "rssi": -65
}
```

Сервер нормалізує поля і зберігає в Supabase. `fet_status` — bitmask: bit0 = CHG MOS, bit1 = DSG MOS.

---

## Швидкий старт

### Вимоги

- Node.js 18+
- Expo Go на телефоні (iOS / Android)
- Supabase акаунт (безкоштовний)

### Встановлення

```bash
git clone https://github.com/Drovosek82/Replit-bms.git
cd Replit-bms
npm install
```

### Змінні середовища

Створіть `.env` файл:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SESSION_SECRET=your-secret-key
```

### Supabase — SQL міграція

Виконайте в **SQL Editor** вашого Supabase проєкту:

```sql
-- Основна таблиця
CREATE TABLE IF NOT EXISTS bms_readings (
  id            BIGSERIAL PRIMARY KEY,
  device_id     TEXT NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  voltage       NUMERIC,
  current       NUMERIC,
  soc           INTEGER,
  remaining_cap INTEGER,
  full_cap      INTEGER,
  cycles        INTEGER,
  temp1         NUMERIC,
  temp2         NUMERIC,
  cells         JSONB,
  protection    INTEGER,
  charge_mos    BOOLEAN,
  discharge_mos BOOLEAN
);

-- Розширені колонки (PlatformIO прошивка)
ALTER TABLE bms_readings
  ADD COLUMN IF NOT EXISTS cell_count          INTEGER,
  ADD COLUMN IF NOT EXISTS balance_status      INTEGER,
  ADD COLUMN IF NOT EXISTS balance_status_high INTEGER,
  ADD COLUMN IF NOT EXISTS cell_delta_mv       INTEGER,
  ADD COLUMN IF NOT EXISTS rssi                INTEGER;

-- Індекс для швидкого пошуку по пристрою та часу
CREATE INDEX IF NOT EXISTS idx_bms_device_time
  ON bms_readings (device_id, received_at DESC);

-- Вимкнути RLS (або налаштуйте власні правила)
ALTER TABLE bms_readings DISABLE ROW LEVEL SECURITY;
```

### Запуск

```bash
# Бекенд (порт 5000)
npm run server:dev

# Фронтенд (порт 8081)
npm run expo:dev
```

Відскануйте QR-код у Expo Go.

---

## ESP32 — прошивка (PlatformIO)

Прошивка знаходиться в папці `attached_assets/BMS_PlatformIO_*.zip`.

### Підготовка

1. Встановіть [PlatformIO IDE](https://platformio.org/) або розширення для VS Code
2. Розпакуйте архів `BMS_PlatformIO_*.zip`
3. Відкрийте папку проєкту в PlatformIO
4. Відредагуйте `src/config.h`:

```cpp
#define WIFI_SSID       "ВашаМережа"
#define WIFI_PASSWORD   "ВашПароль"
#define SERVER_URL      "http://your-server.repl.co/api/bms/push"
#define BMS_BLE_NAME    "JBD-SP04S034"   // назва вашого BMS у BLE
```

5. Прошийте: `pio run --target upload`

### Що робить прошивка

- Сканує BLE пристрої і підключається до JBD BMS
- Зчитує дані (напруга, струм, SOC, комірки, температури) кожні 5 секунд
- Виводить дані на дисплей ST7789 з анімацією
- Надсилає JSON на сервер через HTTP POST
- Підтримує WiFi AP режим для первинного налаштування

---

## API

| Метод | URL | Опис |
|---|---|---|
| `POST` | `/api/bms/push` | ESP32 надсилає показання |
| `GET` | `/api/bms/latest?device_id=X` | Останнє показання (кеш або Supabase) |
| `GET` | `/api/bms/history?device_id=X&hours=24&limit=500` | Історія за діапазон |
| `GET` | `/api/bms/devices` | Список всіх пристроїв |

---

## Структура проєкту

```
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx        # Головний дашборд
│   │   ├── cells.tsx        # Напруга комірок
│   │   ├── history.tsx      # Графіки із вибором діапазону
│   │   ├── settings.tsx     # Налаштування підключення
│   │   └── about.tsx        # Про додаток і апаратуру
│   └── _layout.tsx          # NativeTabs / ClassicTabs
├── components/
│   ├── GaugeCircle.tsx      # Кругова шкала SOC
│   ├── FullChart.tsx        # Повний графік (SVG)
│   ├── CellBar.tsx          # Гістограма комірки
│   ├── StaleBanner.tsx      # Банер застарілих даних
│   └── ...
├── lib/
│   ├── bms-context.tsx      # Глобальний стан + StaleBanner логіка
│   ├── bms-data.ts          # Типи та demo-генератор
│   ├── relay-connection.ts  # Cloud Relay клієнт
│   ├── wifi-connection.ts   # WiFi Direct + нормалізація полів
│   ├── esp32-sketch.ts      # Embedded Arduino скетч
│   └── i18n.ts              # Переклади uk / en
└── server/
    ├── index.ts             # Express сервер
    ├── routes.ts            # API ендпоінти + in-memory кеш
    └── supabase.ts          # Supabase клієнт + normalizePayload()
```

---

## Ліцензія

MIT
