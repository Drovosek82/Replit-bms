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
  // Extended fields from PlatformIO ESP32 project
  cell_count?: number | null;
  balance_status?: number | null;
  balance_status_high?: number | null;
  cell_delta_mv?: number | null;
  rssi?: number | null;
}

// ── Normalize incoming push payload ──────────────────────────────────────────
// Handles both the PlatformIO field names (capacity, total_capacity,
// cycle_count, cell_voltages, protection_status, fet_status, temperatures[])
// and the legacy field names (remaining_cap, full_cap, cycles, cells, etc.)
function normalizePayload(data: Record<string, unknown>): Record<string, unknown> {
  const temps = Array.isArray(data.temperatures)
    ? (data.temperatures as number[])
    : [];

  // fet_status bitmask: bit0=CHG MOS, bit1=DSG MOS
  const fetStatus = typeof data.fet_status === "number" ? (data.fet_status as number) : null;
  const chargeMos =
    data.charge_mos !== undefined
      ? data.charge_mos
      : fetStatus !== null
      ? !!(fetStatus & 0x01)
      : null;
  const dischargeMos =
    data.discharge_mos !== undefined
      ? data.discharge_mos
      : fetStatus !== null
      ? !!(fetStatus & 0x02)
      : null;

  return {
    // PlatformIO names → legacy names (fallback chain)
    voltage:        data.voltage,
    current:        data.current,
    soc:            data.soc,
    remaining_cap:  data.remaining_cap  ?? data.capacity,
    full_cap:       data.full_cap       ?? data.total_capacity,
    cycles:         data.cycles         ?? data.cycle_count,
    temp1:          data.temp1          ?? temps[0],
    temp2:          data.temp2          ?? temps[1],
    cells:          Array.isArray(data.cells)
                      ? data.cells
                      : Array.isArray(data.cell_voltages)
                      ? data.cell_voltages
                      : null,
    protection:     data.protection     ?? data.protection_status,
    charge_mos:     chargeMos,
    discharge_mos:  dischargeMos,
    // Extended fields
    cell_count:        data.cell_count,
    balance_status:    data.balance_status,
    balance_status_high: data.balance_status_high,
    cell_delta_mv:     data.cell_delta_mv,
    rssi:              data.rssi,
  };
}

export async function insertReading(
  deviceId: string,
  data: Record<string, unknown>
): Promise<void> {
  const n = normalizePayload(data);

  const row: BmsReading = {
    device_id:    deviceId,
    received_at:  new Date().toISOString(),
    voltage:      typeof n.voltage      === "number" ? n.voltage      : null,
    current:      typeof n.current      === "number" ? n.current      : null,
    soc:          typeof n.soc          === "number" ? n.soc          : null,
    remaining_cap: typeof n.remaining_cap === "number" ? n.remaining_cap : null,
    full_cap:     typeof n.full_cap     === "number" ? n.full_cap     : null,
    cycles:       typeof n.cycles       === "number" ? n.cycles       : null,
    temp1:        typeof n.temp1        === "number" ? n.temp1        : null,
    temp2:        typeof n.temp2        === "number" ? n.temp2        : null,
    cells:        Array.isArray(n.cells) ? (n.cells as number[]) : null,
    protection:   typeof n.protection   === "number" ? n.protection   : null,
    charge_mos:   n.charge_mos  !== null ? (n.charge_mos  as boolean) : null,
    discharge_mos: n.discharge_mos !== null ? (n.discharge_mos as boolean) : null,
    // Extended — stored only if Supabase table has these columns
    cell_count:        typeof n.cell_count        === "number" ? n.cell_count        : null,
    balance_status:    typeof n.balance_status     === "number" ? n.balance_status     : null,
    balance_status_high: typeof n.balance_status_high === "number" ? n.balance_status_high : null,
    cell_delta_mv:     typeof n.cell_delta_mv      === "number" ? n.cell_delta_mv      : null,
    rssi:              typeof n.rssi               === "number" ? n.rssi               : null,
  };

  const { error } = await supabase.from("bms_readings").insert(row);
  if (error) {
    // Ignore unknown column errors for extended fields (table not migrated yet)
    if (error.message?.includes("column") && error.message?.includes("does not exist")) {
      // Retry without extended fields
      const baseRow: BmsReading = {
        device_id:    row.device_id,
        received_at:  row.received_at,
        voltage:      row.voltage,
        current:      row.current,
        soc:          row.soc,
        remaining_cap: row.remaining_cap,
        full_cap:     row.full_cap,
        cycles:       row.cycles,
        temp1:        row.temp1,
        temp2:        row.temp2,
        cells:        row.cells,
        protection:   row.protection,
        charge_mos:   row.charge_mos,
        discharge_mos: row.discharge_mos,
      };
      const { error: e2 } = await supabase.from("bms_readings").insert(baseRow);
      if (e2) {
        console.warn("[supabase] insert error (base):", e2.message);
        throw new Error(e2.message);
      }
      return;
    }
    console.warn("[supabase] insert error:", error.message);
    throw new Error(error.message);
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
  limit = 100,
  sinceMs?: number
): Promise<BmsReading[]> {
  let query = supabase
    .from("bms_readings")
    .select("id,device_id,received_at,voltage,current,soc,temp1,temp2")
    .eq("device_id", deviceId)
    .order("received_at", { ascending: false })
    .limit(Math.min(limit, 500));

  if (sinceMs) {
    query = query.gte("received_at", new Date(sinceMs).toISOString());
  }

  const { data, error } = await query;

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
    .limit(2000);

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
