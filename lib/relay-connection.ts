import { fetch } from "expo/fetch";
import { BMSData } from "./bms-data";
import { parseESP32Response } from "./wifi-connection";

const RELAY_TIMEOUT_MS = 8000;

export async function fetchBMSDataFromRelay(
  serverUrl: string,
  deviceId: string
): Promise<BMSData> {
  const url = new URL(
    `/api/bms/latest?device_id=${encodeURIComponent(deviceId)}`,
    serverUrl
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (res.status === 404) throw new Error("no_data");
    if (!res.ok) throw new Error("server_error");

    const json = await res.json();
    return parseESP32Response(json as any);
  } catch (e) {
    clearTimeout(timeout);
    const err = e as Error;
    if (err.name === "AbortError") throw new Error("timeout");
    throw err;
  }
}

export function getRelayPushUrl(serverUrl: string): string {
  try {
    return new URL("/api/bms/push", serverUrl).toString();
  } catch {
    return serverUrl.replace(/\/$/, "") + "/api/bms/push";
  }
}
