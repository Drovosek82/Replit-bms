#!/usr/bin/env node

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("\n🚀 BMS Monitor - Supabase Setup\n");
  console.log("Це перша конфігурація для облікового сервісу.\n");

  // Step 1: Get Supabase credentials
  console.log(
    "📍 Крок 1: Отримайте облікові дані з https://app.supabase.com\n"
  );

  const supabaseUrl = await question("🔗 Supabase URL (https://...supabase.co): ");
  const supabaseKey = await question(
    "🔑 Supabase Anon Key (sk_anon_...): "
  );

  if (!supabaseUrl || !supabaseKey) {
    console.log("❌ Помилка: облікові дані порожні!");
    rl.close();
    return;
  }

  // Step 2: Create .env file
  console.log("\n📝 Крок 2: Збереження конфігурації...\n");

  const envPath = path.join(process.cwd(), ".env");
  const envContent = `SUPABASE_URL=${supabaseUrl}
SUPABASE_ANON_KEY=${supabaseKey}
SESSION_SECRET=${generateSecret()}
`;

  fs.writeFileSync(envPath, envContent);
  console.log("✅ Файл .env створений\n");

  // Step 3: Initialize Supabase database
  console.log("🗄️  Крок 3: Ініціалізація бази даних...\n");

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Create tables
  const { error: tablesError } = await supabase.rpc("exec", {
    sql: `
-- Users table (authentication)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  device_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BMS readings table
CREATE TABLE IF NOT EXISTS bms_readings (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES users(device_id),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voltage NUMERIC,
  current NUMERIC,
  soc INTEGER,
  remaining_cap INTEGER,
  full_cap INTEGER,
  cycles INTEGER,
  temp1 NUMERIC,
  temp2 NUMERIC,
  cells JSONB,
  protection INTEGER,
  charge_mos BOOLEAN,
  discharge_mos BOOLEAN,
  cell_count INTEGER,
  balance_status INTEGER,
  balance_status_high INTEGER,
  cell_delta_mv INTEGER,
  rssi INTEGER
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_bms_device_time
  ON bms_readings (device_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_device_id
  ON users (device_id);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bms_readings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own data"
  ON bms_readings FOR SELECT
  USING (device_id = current_user_id());

CREATE POLICY "Device can insert readings"
  ON bms_readings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (device_id = current_user_id());
    `,
  });

  if (tablesError) {
    console.log("⚠️  Примітка: таблиці можуть вже існувати\n");
  } else {
    console.log("✅ Таблиці створені успішно\n");
  }

  // Step 4: Success message
  console.log("🎉 Конфігурація завершена!\n");
  console.log("📌 Наступні кроки:");
  console.log("  1. npm run server:dev     # Запустити сервер");
  console.log("  2. npm start              # Запустити додаток\n");

  rl.close();
}

function generateSecret(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

main().catch((err) => {
  console.error("❌ Помилка:", err.message);
  rl.close();
  process.exit(1);
});
