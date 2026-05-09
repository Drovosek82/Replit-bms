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

const deviceStore = new Map<string, DeviceRecord>();

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/bms/push", (req: Request, res: Response) => {
    const body = req.body as BMSPushData & { device_id?: string };
    const deviceId: string =
      (body.device_id as string) ||
      (req.headers["x-device-id"] as string) ||
      "default";

    const record: DeviceRecord = {
      deviceId,
      data: body,
      receivedAt: Date.now(),
    };

    deviceStore.set(deviceId, record);

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
