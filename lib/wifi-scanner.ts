import { parseESP32Response } from "./wifi-connection";
import { BMSData } from "./bms-data";

export interface DiscoveredDevice {
  host: string;
  name: string;
  responseMs: number;
  endpoint: string;
  partialData?: Partial<BMSData>;
}

const PROBE_TIMEOUT_MS = 1200;
const ENDPOINTS = ["/data", "/api/data", "/bms", "/api/bms"];

// Common ESP32 IPs to probe, ordered by likelihood
function buildCandidateHosts(): string[] {
  const hosts: string[] = [
    "192.168.4.1",  // ESP32 SoftAP default
    "192.168.4.2",
  ];

  // Home router subnets
  const subnets = ["192.168.1", "192.168.0", "192.168.2", "10.0.0", "10.0.1"];

  // Common ESP32 DHCP addresses (devices tend to get low or specific addresses)
  const suffixes = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    100, 101, 102, 103, 104, 105, 106, 107, 108, 110, 120,
    150, 200, 201, 202, 210, 220, 230, 240, 250,
  ];

  for (const subnet of subnets) {
    for (const s of suffixes) {
      hosts.push(`${subnet}.${s}`);
    }
  }

  return [...new Set(hosts)]; // dedupe
}

async function probeHost(host: string): Promise<DiscoveredDevice | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  for (const endpoint of ENDPOINTS) {
    const url = `http://${host}${endpoint}`;
    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const json = await res.json();
      const responseMs = Date.now() - t0;
      clearTimeout(timer);

      let partialData: Partial<BMSData> | undefined;
      try {
        partialData = parseESP32Response(json as any);
      } catch {
        partialData = undefined;
      }

      // Try to get a device name from the response
      const name: string =
        (json as any)?.device_name ||
        (json as any)?.name ||
        (json as any)?.hostname ||
        `ESP32 (${host})`;

      return { host, name, responseMs, endpoint, partialData };
    } catch {
      if ((controller.signal as any).aborted) {
        clearTimeout(timer);
        return null;
      }
    }
  }

  clearTimeout(timer);
  return null;
}

const BATCH_SIZE = 20;

export async function scanWifiNetwork(
  onProgress?: (found: DiscoveredDevice[], scanned: number, total: number) => void,
  signal?: AbortSignal
): Promise<DiscoveredDevice[]> {
  const candidates = buildCandidateHosts();
  const found: DiscoveredDevice[] = [];
  let scanned = 0;

  // Process in batches to avoid overwhelming the network stack
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    if (signal?.aborted) break;

    const batch = candidates.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((h) => probeHost(h)));

    for (const result of results) {
      scanned++;
      if (result.status === "fulfilled" && result.value) {
        found.push(result.value);
        onProgress?.(found, scanned, candidates.length);
      }
    }

    if (!signal?.aborted) {
      onProgress?.(found, scanned, candidates.length);
    }
  }

  return found;
}

// BLE — only available via Web Bluetooth API on web
export interface BLEDevice {
  id: string;
  name: string;
  rssi?: number;
  isBMS: boolean;
}

// JBD BMS BLE service UUIDs
export const JBD_SERVICE_UUID = "0000ff00-0000-1000-8000-00805f9b34fb";
export const JBD_CHAR_TX = "0000ff02-0000-1000-8000-00805f9b34fb";
export const JBD_CHAR_RX = "0000ff01-0000-1000-8000-00805f9b34fb";

export function isBleSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return "bluetooth" in navigator;
}

export async function scanBLE(): Promise<BLEDevice | null> {
  if (!isBleSupported()) throw new Error("ble_not_supported");

  const bt = (navigator as any).bluetooth;
  const device = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: [JBD_SERVICE_UUID],
  });

  if (!device) return null;

  const name: string = device.name || device.id || "Unknown BLE";
  const isBMS =
    name.toLowerCase().includes("jbd") ||
    name.toLowerCase().includes("bms") ||
    name.toLowerCase().includes("xiaoxiang");

  return { id: device.id, name, isBMS };
}
