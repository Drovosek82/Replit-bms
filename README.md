# BMS Monitor

Мобільний додаток для моніторингу акумуляторних батарей через JBD BMS контролер. Підключення через ESP32 по WiFi або Bluetooth, з підтримкою хмарного реле та збереженням даних у Supabase.

## Скріншоти

| Головний екран | Комірки | Графіки | Налаштування |
|:-:|:-:|:-:|:-:|
| Дашборд з SOC та статистикою | Напруга кожної комірки | Графіки за 1г/24г/7д/30д | WiFi / Cloud Relay / Demo |

---

## Функції

- **Реальні дані з JBD BMS** — напруга, струм, SOC, температура, захисти
- **Візуалізація комірок** — гістограма напруги кожної комірки з кольоровим індикатором балансу
- **Графіки históрії** — напруга, струм, SOC, температура за обраним діапазоном
- **Cloud Relay режим** — ESP32 надсилає дані на сервер, додаток читає звідусіль
- **Supabase** — постійне зберігання показань, список пристроїв з БД
- **Банер застарілих даних** — попередження коли ESP32 перестав надсилати дані
- **Демо-режим** — повністю функціональний без фізичного пристрою
- **Двомовність** — Українська / English
- **Повний Arduino скетч** для ESP32 з JBD BMS UART протоколом

---

## Стек технологій

| Частина | Технологія |
|---|---|
| Мобільний додаток | Expo (React Native) + Expo Router |
| Бекенд | Express + TypeScript |
| База даних | Supabase (PostgreSQL) |
| Стан | React Query + React Context |
| Графіки | react-native-svg |
| Мікроконтролер | ESP32 + Arduino |

---

## Архітектура

```
┌─────────────┐    UART 9600    ┌─────────────┐
│   JBD BMS   │ ◄────────────► │    ESP32    │
└─────────────┘                 └──────┬──────┘
                                       │ HTTP POST /api/bms/push
                                       ▼
                                ┌─────────────┐
                                │   Сервер    │  :5000
                                │  (Express)  │
                                └──────┬──────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                   ▼
             ┌──────────┐      ┌─────────────┐    ┌──────────────┐
             │ Мобільний│      │  Supabase   │    │  In-memory   │
             │ додаток  │      │(PostgreSQL) │    │    cache     │
             └──────────┘      └─────────────┘    └──────────────┘
```

### Режими підключення

1. **WiFi Direct** — додаток підключається напряму до ESP32 по локальній мережі
2. **Cloud Relay** — ESP32 → сервер → додаток (працює через інтернет)
3. **Demo** — генеровані дані для тестування

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

### Supabase таблиця

Виконайте в SQL Editor вашого Supabase проєкту:

```sql
CREATE TABLE IF NOT EXISTS bms_readings (
  id          BIGSERIAL PRIMARY KEY,
  device_id   TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voltage     NUMERIC,
  current     NUMERIC,
  soc         INTEGER,
  remaining_cap INTEGER,
  full_cap    INTEGER,
  cycles      INTEGER,
  temp1       NUMERIC,
  temp2       NUMERIC,
  cells       JSONB,
  protection  INTEGER,
  charge_mos  BOOLEAN,
  discharge_mos BOOLEAN
);

CREATE INDEX IF NOT EXISTS idx_bms_device_time
  ON bms_readings (device_id, received_at DESC);

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

## ESP32 — підключення до JBD BMS

### Схема підключення

```
JBD BMS         ESP32
─────────────────────
TX    ──────►  GPIO16 (RX)
RX    ◄──────  GPIO17 (TX)
GND   ─────── GND
```

### Прошивка

1. В додатку: Налаштування → Cloud Relay → **"Переглянути скетч"**
2. Скопіюйте код та вставте в Arduino IDE
3. Замініть `WIFI_SSID`, `WIFI_PASSWORD` та `SERVER_URL` на ваші значення
4. Прошийте ESP32

### Протокол JBD BMS

ESP32 надсилає UART команди:
- `0xDD 0xA5 0x03` — базова інформація (напруга, струм, SOC, температури)
- `0xDD 0xA5 0x04` — напруга комірок

Дані надсилаються на сервер кожні 5 секунд через HTTP POST.

---

## API

| Метод | URL | Опис |
|---|---|---|
| `POST` | `/api/bms/push` | ESP32 надсилає показання |
| `GET` | `/api/bms/latest?device_id=X` | Останнє показання пристрою |
| `GET` | `/api/bms/history?device_id=X&hours=24&limit=500` | Історія за діапазон |
| `GET` | `/api/bms/devices` | Список всіх пристроїв з БД |

---

## Структура проєкту

```
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx        # Головний дашборд
│   │   ├── cells.tsx        # Напруга комірок
│   │   ├── history.tsx      # Графіки历史
│   │   └── settings.tsx     # Налаштування
│   └── _layout.tsx
├── components/
│   ├── GaugeCircle.tsx      # Кругова шкала SOC
│   ├── FullChart.tsx        # Повний графік
│   ├── CellBar.tsx          # Гістограма комірки
│   ├── StaleBanner.tsx      # Банер застарілих даних
│   └── ...
├── lib/
│   ├── bms-context.tsx      # Глобальний стан
│   ├── bms-data.ts          # Типи та demo-генератор
│   ├── relay-connection.ts  # Cloud Relay клієнт
│   ├── wifi-connection.ts   # WiFi Direct клієнт
│   ├── esp32-sketch.ts      # Arduino код для ESP32
│   └── i18n.ts              # Переклади uk/en
└── server/
    ├── index.ts             # Express сервер
    ├── routes.ts            # API ендпоінти
    └── supabase.ts          # Supabase клієнт
```

---

## Ліцензія

MIT
