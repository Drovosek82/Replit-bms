import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import {
  supabase,
  insertReading,
  getLatestReading,
  getHistory,
  getDeviceList,
} from "./supabase";

interface BMSPushData {
  voltage?: number;
  current?: number;
  soc?: number;
  remaining_cap?: number;
  full_cap?: number;
  cycles?: number;
  temp1?: number;
  temp2?: number;
  cells?: number[];
  protection?: number;
  charge_mos?: boolean;
  discharge_mos?: boolean;
  [key: string]: unknown;
}

interface DeviceRecord {
  deviceId: string;
  data: BMSPushData;
  receivedAt: number;
}

// In-memory cache — Supabase is persistent storage
const HISTORY_LIMIT = 500;
const deviceStore = new Map<string, DeviceRecord>();
const deviceHistory = new Map<string, { timestamp: number; data: BMSPushData }[]>();

function setRelayHeaders(res: Response) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Device-Id");
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ── ESP32 push endpoint ───────────────────────────────────────────────────
  app.options("/api/bms/push", (_req: Request, res: Response) => {
    setRelayHeaders(res);
    res.sendStatus(200);
  });

  app.post("/api/bms/push", async (req: Request, res: Response) => {
    setRelayHeaders(res);
    const body = req.body as BMSPushData & { device_id?: string };
    const deviceId: string =
      (body.device_id as string) ||
      (req.headers["x-device-id"] as string) ||
      "default";

    const now = Date.now();
    const record: DeviceRecord = { deviceId, data: body, receivedAt: now };
    deviceStore.set(deviceId, record);

    const hist = deviceHistory.get(deviceId) ?? [];
    hist.push({ timestamp: now, data: body });
    if (hist.length > HISTORY_LIMIT) hist.splice(0, hist.length - HISTORY_LIMIT);
    deviceHistory.set(deviceId, hist);

    // Persist to Supabase asynchronously — don't block the response
    insertReading(deviceId, body as Record<string, unknown>).catch((err) => {
      console.warn("[supabase] insert failed:", err?.message ?? err);
    });

    res.json({ ok: true, deviceId, receivedAt: now });
  });

  // ── Latest reading (in-memory first, fallback to Supabase) ───────────────
  app.get("/api/bms/latest", async (req: Request, res: Response) => {
    setRelayHeaders(res);
    const deviceId = (req.query.device_id as string) || "default";

    const cached = deviceStore.get(deviceId);
    if (cached) {
      const ageMs = Date.now() - cached.receivedAt;
      return res.json({ ...cached.data, _receivedAt: cached.receivedAt, _ageMs: ageMs, _source: "cache" });
    }

    // Fallback to Supabase (server was restarted — data still there)
    const row = await getLatestReading(deviceId);
    if (!row) {
      return res.status(404).json({ error: "No data yet" });
    }

    const receivedAt = new Date(row.received_at).getTime();
    const ageMs = Date.now() - receivedAt;
    return res.json({
      voltage: row.voltage,
      current: row.current,
      soc: row.soc,
      remaining_cap: row.remaining_cap,
      full_cap: row.full_cap,
      cycles: row.cycles,
      temp1: row.temp1,
      temp2: row.temp2,
      cells: row.cells,
      protection: row.protection,
      charge_mos: row.charge_mos,
      discharge_mos: row.discharge_mos,
      _receivedAt: receivedAt,
      _ageMs: ageMs,
      _source: "supabase",
    });
  });

  // ── History (Supabase with optional hours filter) ─────────────────────────
  app.get("/api/bms/history", async (req: Request, res: Response) => {
    setRelayHeaders(res);
    const deviceId = (req.query.device_id as string) || "default";
    const limit = Math.min(parseInt((req.query.limit as string) || "500", 10), 500);
    const hours = parseFloat((req.query.hours as string) || "24");
    const sinceMs = hours > 0 ? Date.now() - hours * 60 * 60 * 1000 : undefined;

    const rows = await getHistory(deviceId, limit, sinceMs);
    if (rows.length > 0) {
      return res.json({
        deviceId,
        count: rows.length,
        source: "supabase",
        hours,
        entries: rows.map((r) => ({
          timestamp: new Date(r.received_at).getTime(),
          voltage: r.voltage ?? 0,
          current: r.current ?? 0,
          soc: r.soc ?? 0,
          temp1: r.temp1 ?? 0,
          temp2: r.temp2 ?? 0,
        })),
      });
    }

    // Fallback to in-memory
    const hist = deviceHistory.get(deviceId) ?? [];
    const cutoff = sinceMs ?? 0;
    const entries = hist.filter((e) => e.timestamp >= cutoff).slice(-limit);
    return res.json({
      deviceId,
      count: entries.length,
      source: "memory",
      hours,
      entries: entries.map((e) => ({
        timestamp: e.timestamp,
        voltage: (e.data.voltage as number) ?? 0,
        current: (e.data.current as number) ?? 0,
        soc: (e.data.soc as number) ?? 0,
        temp1: (e.data.temp1 as number) ?? 0,
        temp2: (e.data.temp2 as number) ?? 0,
      })),
    });
  });

  // ── Device list (Supabase + in-memory merged) ─────────────────────────────
  app.get("/api/bms/devices", async (_req: Request, res: Response) => {
    setRelayHeaders(res);
    const supabaseDevices = await getDeviceList();
    const memDevices = Array.from(deviceStore.values()).map((r) => ({
      device_id: r.deviceId,
      last_seen: new Date(r.receivedAt).toISOString(),
      count: 0,
      ageMs: Date.now() - r.receivedAt,
    }));

    const merged = new Map<string, { device_id: string; last_seen: string; count: number; ageMs: number }>();
    for (const d of supabaseDevices) {
      merged.set(d.device_id, {
        ...d,
        ageMs: Date.now() - new Date(d.last_seen).getTime(),
      });
    }
    for (const d of memDevices) {
      const existing = merged.get(d.device_id);
      if (existing) {
        merged.set(d.device_id, { ...existing, ageMs: d.ageMs, last_seen: d.last_seen });
      } else {
        merged.set(d.device_id, d);
      }
    }

    res.json(Array.from(merged.values()).sort((a, b) => a.ageMs - b.ageMs));
  });

  // ── Supabase health check ─────────────────────────────────────────────────
  app.get("/api/bms/db-status", async (_req: Request, res: Response) => {
    const { error } = await supabase.from("bms_readings").select("id").limit(1);
    res.json({ ok: !error, error: error?.message ?? null });
  });

  const httpServer = createServer(app);
  return httpServer;
}
