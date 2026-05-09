import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set");
}

export const supabase = createClient(url, key);

export interface BmsReading {
  id?: number;
  device_id: string;
  received_at: string;
  voltage?: number | null;
  current?: number | null;
  soc?: number | null;
  remaining_cap?: number | null;
  full_cap?: number | null;
  cycles?: number | null;
  temp1?: number | null;
  temp2?: number | null;
  cells?: number[] | null;
  protection?: number | null;
  charge_mos?: boolean | null;
  discharge_mos?: boolean | null;
}

export async function ensureSchema(): Promise<void> {
  const { error } = await supabase.rpc("exec_ddl", {
    sql: `
      CREATE TABLE IF NOT EXISTS bms_readings (
        id            BIGSERIAL PRIMARY KEY,
        device_id     TEXT NOT NULL,
        received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        voltage       NUMERIC,
        current       NUMERIC,
        soc           NUMERIC,
        remaining_cap NUMERIC,
        full_cap      NUMERIC,
        cycles        INTEGER,
        temp1         NUMERIC,
        temp2         NUMERIC,
        cells         JSONB,
        protection    INTEGER,
        charge_mos    BOOLEAN,
        discharge_mos BOOLEAN
      );
      CREATE INDEX IF NOT EXISTS bms_readings_device_time
        ON bms_readings (device_id, received_at DESC);
    `,
  });

  if (error) {
    // RPC not available — try direct query fallback
    await supabase.from("bms_readings").select("id").limit(1);
  }
}

export async function insertReading(
  deviceId: string,
  data: Record<string, unknown>
): Promise<void> {
  const row: BmsReading = {
    device_id: deviceId,
    received_at: new Date().toISOString(),
    voltage: (data.voltage as number) ?? null,
    current: (data.current as number) ?? null,
    soc: (data.soc as number) ?? null,
    remaining_cap: (data.remaining_cap as number) ?? null,
    full_cap: (data.full_cap as number) ?? null,
    cycles: (data.cycles as number) ?? null,
    temp1: (data.temp1 as number) ?? null,
    temp2: (data.temp2 as number) ?? null,
    cells: Array.isArray(data.cells) ? (data.cells as number[]) : null,
    protection: (data.protection as number) ?? null,
    charge_mos: (data.charge_mos as boolean) ?? null,
    discharge_mos: (data.discharge_mos as boolean) ?? null,
  };

  const { error } = await supabase.from("bms_readings").insert(row);
  if (error) {
    console.warn("[supabase] insert error:", error.message);
  }
}

export async function getLatestReading(
  deviceId: string
): Promise<BmsReading | null> {
  const { data, error } = await supabase
    .from("bms_readings")
    .select("*")
    .eq("device_id", deviceId)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[supabase] getLatest error:", error.message);
    return null;
  }
  return data;
}

export async function getHistory(
  deviceId: string,
  limit = 100
): Promise<BmsReading[]> {
  const { data, error } = await supabase
    .from("bms_readings")
    .select("id,device_id,received_at,voltage,current,soc,temp1")
    .eq("device_id", deviceId)
    .order("received_at", { ascending: false })
    .limit(Math.min(limit, 500));

  if (error) {
    console.warn("[supabase] getHistory error:", error.message);
    return [];
  }
  return (data ?? []).reverse();
}

export async function getDeviceList(): Promise<
  { device_id: string; last_seen: string; count: number }[]
> {
  const { data, error } = await supabase
    .from("bms_readings")
    .select("device_id, received_at")
    .order("received_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.warn("[supabase] getDeviceList error:", error.message);
    return [];
  }

  const map = new Map<string, { last_seen: string; count: number }>();
  for (const row of data ?? []) {
    const existing = map.get(row.device_id);
    if (!existing) {
      map.set(row.device_id, { last_seen: row.received_at, count: 1 });
    } else {
      existing.count++;
    }
  }

  return Array.from(map.entries()).map(([device_id, v]) => ({
    device_id,
    ...v,
  }));
}
