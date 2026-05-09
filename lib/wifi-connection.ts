import { BMSData, CellData, ProtectionFlags } from "./bms-data";

const FETCH_TIMEOUT_MS = 5000;

// Endpoints to try on ESP32, in order of preference
const ENDPOINTS = ["/data", "/api/data", "/bms", "/api/bms", "/status"];

interface ESP32Raw {
  voltage?: number;
  totalVoltage?: number;
  total_voltage?: number;
  pack_voltage?: number;

  current?: number;
  pack_current?: number;

  remaining_cap?: number;
  remainingCap?: number;
  remain_cap?: number;
  remaining_capacity?: number;

  full_cap?: number;
  fullCap?: number;
  design_cap?: number;
  full_capacity?: number;

  soc?: number;
  rsoc?: number;
  capacity_percent?: number;

  cycles?: number;
  cycle_cnt?: number;
  cycle_count?: number;

  temp1?: number;
  temp2?: number;
  temperature1?: number;
  temperature2?: number;
  temperatures?: number[];

  cells?: (number | { voltage: number })[];
  cell_voltages?: number[];
  cellVoltages?: number[];

  protection?: number | Record<string, boolean>;
  protection_status?: number;
  protect_status?: number;

  charge_mos?: boolean;
  discharge_mos?: boolean;
  chargeMos?: boolean;
  dischargeMos?: boolean;
  charge_fet?: boolean;
  discharge_fet?: boolean;
}

function parseProtectionBits(
  raw: ESP32Raw,
  temp1: number,
  temp2: number
): ProtectionFlags {
  let bits = 0;

  if (typeof raw.protection === "number") bits = raw.protection;
  else if (typeof raw.protection_status === "number")
    bits = raw.protection_status;
  else if (typeof raw.protect_status === "number") bits = raw.protect_status;

  const chargeMos =
    raw.charge_mos ??
    raw.chargeMos ??
    raw.charge_fet ??
    (bits === 0 ? true : !(bits & 0x40));
  const dischargeMos =
    raw.discharge_mos ??
    raw.dischargeMos ??
    raw.discharge_fet ??
    (bits === 0 ? true : !(bits & 0x80));

  return {
    overVoltage: !!(bits & 0x01),
    underVoltage: !!(bits & 0x02),
    overCurrent: !!(bits & 0x04),
    overTemp: !!(bits & 0x08) || temp1 > 45 || temp2 > 45,
    underTemp: !!(bits & 0x10) || temp1 < 0 || temp2 < 0,
    shortCircuit: !!(bits & 0x20),
    chargeMosOn: !!chargeMos,
    dischargeMosOn: !!dischargeMos,
  };
}

function parseCells(raw: ESP32Raw): CellData[] {
  const arr =
    raw.cells ?? raw.cell_voltages ?? raw.cellVoltages ?? [];
  return arr.map((c, i) => ({
    voltage: parseFloat(
      (typeof c === "number" ? c : (c as { voltage: number }).voltage).toFixed(
        3
      )
    ),
    index: i,
  }));
}

export function parseESP32Response(raw: ESP32Raw): BMSData {
  const cells = parseCells(raw);

  const totalVoltage =
    raw.totalVoltage ??
    raw.total_voltage ??
    raw.voltage ??
    raw.pack_voltage ??
    (cells.length > 0
      ? parseFloat(cells.reduce((s, c) => s + c.voltage, 0).toFixed(2))
      : 0);

  const current = raw.current ?? raw.pack_current ?? 0;

  const fullCapacity =
    raw.full_cap ??
    raw.fullCap ??
    raw.design_cap ??
    raw.full_capacity ??
    30;

  const soc =
    raw.soc ?? raw.rsoc ?? raw.capacity_percent ?? 0;

  const remainingCapacity =
    raw.remaining_cap ??
    raw.remainingCap ??
    raw.remain_cap ??
    raw.remaining_capacity ??
    parseFloat(((fullCapacity * soc) / 100).toFixed(1));

  const temps = raw.temperatures ?? [];
  const temp1 =
    raw.temp1 ?? raw.temperature1 ?? temps[0] ?? 25;
  const temp2 =
    raw.temp2 ?? raw.temperature2 ?? temps[1] ?? temp1;

  return {
    totalVoltage: parseFloat(totalVoltage.toFixed(2)),
    current: parseFloat(current.toFixed(2)),
    remainingCapacity: parseFloat(remainingCapacity.toFixed(1)),
    fullCapacity: parseFloat(fullCapacity.toFixed(0)),
    soc: parseFloat(soc.toFixed(1)),
    cycles: raw.cycles ?? raw.cycle_cnt ?? raw.cycle_count ?? 0,
    temperature1: parseFloat(temp1.toFixed(1)),
    temperature2: parseFloat(temp2.toFixed(1)),
    cells,
    protection: parseProtectionBits(raw, temp1, temp2),
    timestamp: Date.now(),
  };
}

export async function fetchBMSDataFromDevice(host: string): Promise<BMSData> {
  const cleanHost = host.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let lastError: Error = new Error("No endpoints responded");

  for (const endpoint of ENDPOINTS) {
    try {
      const url = `http://${cleanHost}${endpoint}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!res.ok) continue;

      const json = await res.json();
      clearTimeout(timeout);
      return parseESP32Response(json as ESP32Raw);
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        clearTimeout(timeout);
        throw new Error("timeout");
      }
      lastError = err;
    }
  }

  clearTimeout(timeout);
  throw lastError;
}

export function normalizeHost(input: string): string {
  return input.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}
