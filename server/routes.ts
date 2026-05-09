import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";

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

interface HistoryEntry {
  timestamp: number;
  data: BMSPushData;
}

const HISTORY_LIMIT = 500;
const deviceStore = new Map<string, DeviceRecord>();
const deviceHistory = new Map<string, HistoryEntry[]>();

function setRelayHeaders(res: Response) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Device-Id");
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.options("/api/bms/push", (_req: Request, res: Response) => {
    setRelayHeaders(res);
    res.sendStatus(200);
  });

  app.post("/api/bms/push", (req: Request, res: Response) => {
    setRelayHeaders(res);
    const body = req.body as BMSPushData & { device_id?: string };
    const deviceId: string =
      (body.device_id as string) ||
      (req.headers["x-device-id"] as string) ||
      "default";

    const record: DeviceRecord = { deviceId, data: body, receivedAt: Date.now() };
    deviceStore.set(deviceId, record);

    const hist = deviceHistory.get(deviceId) ?? [];
    hist.push({ timestamp: record.receivedAt, data: body });
    if (hist.length > HISTORY_LIMIT) hist.splice(0, hist.length - HISTORY_LIMIT);
    deviceHistory.set(deviceId, hist);

    res.json({ ok: true, deviceId, receivedAt: record.receivedAt });
  });

  app.get("/api/bms/latest", (req: Request, res: Response) => {
    const deviceId = (req.query.device_id as string) || "default";
    const record = deviceStore.get(deviceId);
    if (!record) {
      return res.status(404).json({ error: "No data yet" });
    }
    const ageMs = Date.now() - record.receivedAt;
    res.json({ ...record.data, _receivedAt: record.receivedAt, _ageMs: ageMs });
  });

  app.get("/api/bms/history", (req: Request, res: Response) => {
    const deviceId = (req.query.device_id as string) || "default";
    const limit = Math.min(
      parseInt((req.query.limit as string) || "100", 10),
      500
    );
    const hist = deviceHistory.get(deviceId) ?? [];
    const entries = hist.slice(-limit);
    res.json({ deviceId, count: entries.length, entries });
  });

  app.get("/api/bms/devices", (_req: Request, res: Response) => {
    const list = Array.from(deviceStore.values()).map((r) => ({
      deviceId: r.deviceId,
      receivedAt: r.receivedAt,
      ageMs: Date.now() - r.receivedAt,
    }));
    res.json(list);
  });

  const httpServer = createServer(app);
  return httpServer;
}
