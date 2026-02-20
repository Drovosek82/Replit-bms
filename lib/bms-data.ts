export interface CellData {
  voltage: number;
  index: number;
}

export interface ProtectionFlags {
  overVoltage: boolean;
  underVoltage: boolean;
  overCurrent: boolean;
  overTemp: boolean;
  underTemp: boolean;
  shortCircuit: boolean;
  chargeMosOn: boolean;
  dischargeMosOn: boolean;
}

export interface BMSData {
  totalVoltage: number;
  current: number;
  remainingCapacity: number;
  fullCapacity: number;
  soc: number;
  cycles: number;
  temperature1: number;
  temperature2: number;
  cells: CellData[];
  protection: ProtectionFlags;
  timestamp: number;
}

export interface HistoryEntry {
  timestamp: number;
  voltage: number;
  current: number;
  soc: number;
  temperature: number;
}

export interface BMSDevice {
  id: string;
  name: string;
  type: "wifi" | "bluetooth";
  group: string;
  connected: boolean;
  lastSeen: number;
}

const CELL_COUNT = 14;
const NOMINAL_CELL_VOLTAGE = 3.7;
const MIN_CELL_VOLTAGE = 3.0;
const MAX_CELL_VOLTAGE = 4.2;

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function generateDemoData(prevData?: BMSData): BMSData {
  const baseVoltage = prevData
    ? prevData.cells[0].voltage + randomInRange(-0.005, 0.005)
    : randomInRange(3.55, 3.85);

  const cells: CellData[] = [];
  let totalVoltage = 0;

  for (let i = 0; i < CELL_COUNT; i++) {
    const cellVariation = randomInRange(-0.03, 0.03);
    const voltage = Math.max(
      MIN_CELL_VOLTAGE,
      Math.min(MAX_CELL_VOLTAGE, baseVoltage + cellVariation)
    );
    cells.push({ voltage: parseFloat(voltage.toFixed(3)), index: i });
    totalVoltage += voltage;
  }

  totalVoltage = parseFloat(totalVoltage.toFixed(2));

  const current = prevData
    ? prevData.current + randomInRange(-0.3, 0.3)
    : randomInRange(-5, 15);

  const soc = prevData
    ? Math.max(0, Math.min(100, prevData.soc + randomInRange(-0.1, 0.15)))
    : randomInRange(40, 85);

  const temp1 = prevData
    ? prevData.temperature1 + randomInRange(-0.2, 0.2)
    : randomInRange(22, 35);

  const temp2 = prevData
    ? prevData.temperature2 + randomInRange(-0.2, 0.2)
    : randomInRange(22, 35);

  return {
    totalVoltage,
    current: parseFloat(current.toFixed(2)),
    remainingCapacity: parseFloat((30 * (soc / 100)).toFixed(1)),
    fullCapacity: 30,
    soc: parseFloat(soc.toFixed(1)),
    cycles: 127,
    temperature1: parseFloat(temp1.toFixed(1)),
    temperature2: parseFloat(temp2.toFixed(1)),
    cells,
    protection: {
      overVoltage: false,
      underVoltage: false,
      overCurrent: false,
      overTemp: temp1 > 45 || temp2 > 45,
      underTemp: temp1 < 0 || temp2 < 0,
      shortCircuit: false,
      chargeMosOn: true,
      dischargeMosOn: true,
    },
    timestamp: Date.now(),
  };
}

export function generateHistoryData(hours: number = 24): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  const now = Date.now();
  const intervalMs = (hours * 60 * 60 * 1000) / 200;

  let voltage = randomInRange(49, 52);
  let current = randomInRange(-2, 10);
  let soc = randomInRange(40, 80);
  let temp = randomInRange(24, 30);

  for (let i = 200; i >= 0; i--) {
    const timestamp = now - i * intervalMs;

    voltage += randomInRange(-0.2, 0.2);
    voltage = Math.max(42, Math.min(58.8, voltage));

    current += randomInRange(-0.5, 0.5);
    current = Math.max(-10, Math.min(20, current));

    soc += current > 0 ? randomInRange(0, 0.3) : randomInRange(-0.3, 0);
    soc = Math.max(0, Math.min(100, soc));

    temp += randomInRange(-0.3, 0.3);
    temp = Math.max(18, Math.min(42, temp));

    entries.push({
      timestamp,
      voltage: parseFloat(voltage.toFixed(2)),
      current: parseFloat(current.toFixed(2)),
      soc: parseFloat(soc.toFixed(1)),
      temperature: parseFloat(temp.toFixed(1)),
    });
  }

  return entries;
}

export function getChargingStatus(current: number): "charging" | "discharging" | "idle" {
  if (current > 0.5) return "charging";
  if (current < -0.5) return "discharging";
  return "idle";
}

export function getCellHealthColor(voltage: number): string {
  if (voltage >= 3.9) return "#00E676";
  if (voltage >= 3.6) return "#00D4AA";
  if (voltage >= 3.3) return "#FFB300";
  return "#FF5252";
}
