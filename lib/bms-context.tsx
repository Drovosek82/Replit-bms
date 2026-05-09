import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  ReactNode,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  BMSData,
  BMSDevice,
  HistoryEntry,
  generateDemoData,
  generateHistoryData,
} from "./bms-data";
import {
  Language,
  translations,
  TranslationKey,
  I18nContext,
} from "./i18n";
import { fetchBMSDataFromDevice, normalizeHost } from "./wifi-connection";
import { fetchBMSDataFromRelay, getRelayPushUrl } from "./relay-connection";
import { getApiUrl } from "./query-client";

export type ConnectionState = "idle" | "connecting" | "connected" | "error";

interface StoredDevice {
  id: string;
  name: string;
  host: string;
}

interface BMSContextType {
  data: BMSData | null;
  history: HistoryEntry[];
  devices: BMSDevice[];
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
  addDevice: (device: BMSDevice) => void;
  removeDevice: (id: string) => void;
  isLoading: boolean;

  connectionState: ConnectionState;
  connectionError: string | null;
  activeDevice: BMSDevice | null;
  lastUpdateTime: number | null;
  connectToWifi: (host: string, name: string) => Promise<void>;
  connectToRelay: (deviceId: string) => Promise<void>;
  disconnectDevice: () => void;
  relayDeviceId: string | null;
  relayPushUrl: string;
}

const BMSContext = createContext<BMSContextType | null>(null);

const POLL_INTERVAL_MS = 2000;
const RETRY_INTERVAL_MS = 5000;
const STORAGE_KEY_DEMO = "bms_demo_mode";
const STORAGE_KEY_DEVICE = "bms_active_device";
const STORAGE_KEY_RELAY = "bms_relay_device_id";

export function BMSProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<BMSData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [devices, setDevices] = useState<BMSDevice[]>([]);
  const [demoMode, setDemoModeState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [activeDevice, setActiveDevice] = useState<BMSDevice | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);
  const [relayDeviceId, setRelayDeviceId] = useState<string | null>(null);

  const prevDataRef = useRef<BMSData | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const relayPushUrl = useMemo(() => {
    try {
      return getRelayPushUrl(getApiUrl());
    } catch {
      return "https://<your-domain>/api/bms/push";
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadState();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const appendHistory = useCallback((newData: BMSData) => {
    setHistory((prev) => {
      const entry: HistoryEntry = {
        timestamp: newData.timestamp,
        voltage: newData.totalVoltage,
        current: newData.current,
        soc: newData.soc,
        temperature: newData.temperature1,
      };
      const updated = [...prev, entry];
      return updated.length > 500 ? updated.slice(-500) : updated;
    });
  }, []);

  useEffect(() => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }

    if (!demoMode) return;

    const initialData = generateDemoData();
    setData(initialData);
    prevDataRef.current = initialData;
    setHistory(generateHistoryData(24));
    setDevices([
      {
        id: "DEMO_ESP32_001",
        name: "JBD BMS #1 (Demo)",
        type: "wifi",
        group: "Main Pack",
        connected: true,
        lastSeen: Date.now(),
        host: "192.168.1.100",
      },
    ]);
    setIsLoading(false);

    demoIntervalRef.current = setInterval(() => {
      if (!isMountedRef.current) return;
      const newData = generateDemoData(prevDataRef.current ?? undefined);
      prevDataRef.current = newData;
      setData(newData);
      appendHistory(newData);
    }, POLL_INTERVAL_MS);

    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    };
  }, [demoMode, appendHistory]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ── WiFi polling ──────────────────────────────────────────────────────────
  const schedulePoll = useCallback(
    (host: string, delay = POLL_INTERVAL_MS) => {
      stopPolling();
      pollTimerRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;
        try {
          const newData = await fetchBMSDataFromDevice(host);
          if (!isMountedRef.current) return;
          prevDataRef.current = newData;
          setData(newData);
          setLastUpdateTime(Date.now());
          setConnectionState("connected");
          setConnectionError(null);
          setActiveDevice((prev) =>
            prev ? { ...prev, connected: true, lastSeen: Date.now() } : prev
          );
          setDevices((prev) =>
            prev.map((d) =>
              d.host === host
                ? { ...d, connected: true, lastSeen: Date.now() }
                : d
            )
          );
          appendHistory(newData);
          schedulePoll(host, POLL_INTERVAL_MS);
        } catch (e) {
          if (!isMountedRef.current) return;
          const err = e as Error;
          const msg =
            err.message === "timeout" ? "timeout" : "connection_failed";
          setConnectionState("error");
          setConnectionError(msg);
          setActiveDevice((prev) =>
            prev ? { ...prev, connected: false } : prev
          );
          setDevices((prev) =>
            prev.map((d) =>
              d.host === host ? { ...d, connected: false } : d
            )
          );
          schedulePoll(host, RETRY_INTERVAL_MS);
        }
      }, delay);
    },
    [stopPolling, appendHistory]
  );

  // ── Relay polling ─────────────────────────────────────────────────────────
  const scheduleRelayPoll = useCallback(
    (deviceId: string, delay = POLL_INTERVAL_MS) => {
      stopPolling();
      pollTimerRef.current = setTimeout(async () => {
        if (!isMountedRef.current) return;
        try {
          const serverUrl = getApiUrl();
          const newData = await fetchBMSDataFromRelay(serverUrl, deviceId);
          if (!isMountedRef.current) return;
          prevDataRef.current = newData;
          setData(newData);
          setLastUpdateTime(Date.now());
          setConnectionState("connected");
          setConnectionError(null);
          setActiveDevice((prev) =>
            prev ? { ...prev, connected: true, lastSeen: Date.now() } : prev
          );
          setDevices((prev) =>
            prev.map((d) =>
              d.id === `relay_${deviceId}`
                ? { ...d, connected: true, lastSeen: Date.now() }
                : d
            )
          );
          appendHistory(newData);
          scheduleRelayPoll(deviceId, POLL_INTERVAL_MS);
        } catch (e) {
          if (!isMountedRef.current) return;
          const err = e as Error;
          if (err.message === "no_data") {
            // ESP32 hasn't pushed yet — keep waiting silently
            scheduleRelayPoll(deviceId, RETRY_INTERVAL_MS);
            return;
          }
          const msg =
            err.message === "timeout" ? "timeout" : "connection_failed";
          setConnectionState("error");
          setConnectionError(msg);
          setActiveDevice((prev) =>
            prev ? { ...prev, connected: false } : prev
          );
          scheduleRelayPoll(deviceId, RETRY_INTERVAL_MS);
        }
      }, delay);
    },
    [stopPolling, appendHistory]
  );

  // ── Connect via WiFi ──────────────────────────────────────────────────────
  const connectToWifi = useCallback(
    async (host: string, name: string) => {
      const cleanHost = normalizeHost(host);
      if (!cleanHost) return;

      stopPolling();
      setConnectionState("connecting");
      setConnectionError(null);
      setIsLoading(true);
      setRelayDeviceId(null);

      const deviceId =
        "wifi_" +
        Date.now().toString() +
        Math.random().toString(36).slice(2, 7);
      const newDevice: BMSDevice = {
        id: deviceId,
        name: name || `ESP32 (${cleanHost})`,
        type: "wifi",
        group: "Real Device",
        connected: false,
        lastSeen: Date.now(),
        host: cleanHost,
      };

      setActiveDevice(newDevice);
      setDevices((prev) => {
        const filtered = prev.filter(
          (d) => d.host !== cleanHost && !d.id.startsWith("DEMO_")
        );
        return [...filtered, newDevice];
      });

      try {
        const newData = await fetchBMSDataFromDevice(cleanHost);
        if (!isMountedRef.current) return;

        prevDataRef.current = newData;
        setData(newData);
        setLastUpdateTime(Date.now());
        setConnectionState("connected");
        setIsLoading(false);

        const connected: BMSDevice = {
          ...newDevice,
          connected: true,
          lastSeen: Date.now(),
        };
        setActiveDevice(connected);
        setDevices((prev) =>
          prev.map((d) => (d.id === deviceId ? connected : d))
        );

        appendHistory(newData);

        const stored: StoredDevice = {
          id: deviceId,
          name: connected.name,
          host: cleanHost,
        };
        await AsyncStorage.setItem(
          STORAGE_KEY_DEVICE,
          JSON.stringify(stored)
        );
        await AsyncStorage.removeItem(STORAGE_KEY_RELAY);

        schedulePoll(cleanHost, POLL_INTERVAL_MS);
      } catch (e) {
        if (!isMountedRef.current) return;
        const err = e as Error;
        const msg =
          err.message === "timeout" ? "timeout" : "connection_failed";
        setConnectionState("error");
        setConnectionError(msg);
        setIsLoading(false);
        setActiveDevice((prev) =>
          prev ? { ...prev, connected: false } : prev
        );
        schedulePoll(cleanHost, RETRY_INTERVAL_MS);
      }
    },
    [stopPolling, schedulePoll, appendHistory]
  );

  // ── Connect via Cloud Relay ───────────────────────────────────────────────
  const connectToRelay = useCallback(
    async (deviceId: string) => {
      const cleanId = deviceId.trim();
      if (!cleanId) return;

      stopPolling();
      setConnectionState("connecting");
      setConnectionError(null);
      setIsLoading(false);
      setRelayDeviceId(cleanId);

      const relayDevice: BMSDevice = {
        id: `relay_${cleanId}`,
        name: `Cloud (${cleanId})`,
        type: "relay",
        group: "Cloud Relay",
        connected: false,
        lastSeen: Date.now(),
        host: cleanId,
      };

      setActiveDevice(relayDevice);
      setDevices((prev) => {
        const filtered = prev.filter(
          (d) => !d.id.startsWith("relay_") && !d.id.startsWith("DEMO_")
        );
        return [...filtered, relayDevice];
      });

      await AsyncStorage.setItem(STORAGE_KEY_RELAY, cleanId);
      await AsyncStorage.removeItem(STORAGE_KEY_DEVICE);

      scheduleRelayPoll(cleanId, 0);
    },
    [stopPolling, scheduleRelayPoll]
  );

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnectDevice = useCallback(() => {
    stopPolling();
    setConnectionState("idle");
    setConnectionError(null);
    setActiveDevice(null);
    setRelayDeviceId(null);
    setData(null);
    setDevices((prev) =>
      prev.filter(
        (d) => !d.id.startsWith("wifi_") && !d.id.startsWith("relay_")
      )
    );
    AsyncStorage.removeItem(STORAGE_KEY_DEVICE).catch(() => {});
    AsyncStorage.removeItem(STORAGE_KEY_RELAY).catch(() => {});
  }, [stopPolling]);

  // ── Load persisted state ──────────────────────────────────────────────────
  const loadState = async () => {
    try {
      const [storedDemo, storedDevice, storedRelay] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_DEMO),
        AsyncStorage.getItem(STORAGE_KEY_DEVICE),
        AsyncStorage.getItem(STORAGE_KEY_RELAY),
      ]);

      const demo =
        storedDemo !== null ? (JSON.parse(storedDemo) as boolean) : true;
      setDemoModeState(demo);

      if (!demo) {
        // Очищаємо демо-дані, які могли генеруватись до завантаження налаштувань
        setData(null);
        setHistory([]);
        setDevices([]);

        if (storedDevice) {
          const dev = JSON.parse(storedDevice) as StoredDevice;
          connectToWifi(dev.host, dev.name);
        } else if (storedRelay) {
          connectToRelay(storedRelay);
        } else {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    } catch {
      setDemoModeState(true);
      setIsLoading(false);
    }
  };

  const setDemoMode = useCallback(
    async (v: boolean) => {
      if (!v) {
        stopPolling();
        setData(null);
        setHistory([]);
        setConnectionState("idle");
        setConnectionError(null);
        setActiveDevice(null);
        setRelayDeviceId(null);
        setDevices([]);
      }
      setDemoModeState(v);
      await AsyncStorage.setItem(STORAGE_KEY_DEMO, JSON.stringify(v));
    },
    [stopPolling]
  );

  const addDevice = useCallback((device: BMSDevice) => {
    setDevices((prev) => [...prev, device]);
  }, []);

  const removeDevice = useCallback(
    (id: string) => {
      setDevices((prev) => {
        const device = prev.find((d) => d.id === id);
        if (device && activeDevice?.id === id) {
          disconnectDevice();
        }
        return prev.filter((d) => d.id !== id);
      });
    },
    [activeDevice, disconnectDevice]
  );

  const value = useMemo(
    () => ({
      data,
      history,
      devices,
      demoMode,
      setDemoMode,
      addDevice,
      removeDevice,
      isLoading,
      connectionState,
      connectionError,
      activeDevice,
      lastUpdateTime,
      connectToWifi,
      connectToRelay,
      disconnectDevice,
      relayDeviceId,
      relayPushUrl,
    }),
    [
      data,
      history,
      devices,
      demoMode,
      setDemoMode,
      addDevice,
      removeDevice,
      isLoading,
      connectionState,
      connectionError,
      activeDevice,
      lastUpdateTime,
      connectToWifi,
      connectToRelay,
      disconnectDevice,
      relayDeviceId,
      relayPushUrl,
    ]
  );

  return <BMSContext.Provider value={value}>{children}</BMSContext.Provider>;
}

export function useBMS() {
  const ctx = useContext(BMSContext);
  if (!ctx) throw new Error("useBMS must be used within BMSProvider");
  return ctx;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("en");

  useEffect(() => {
    AsyncStorage.getItem("bms_language").then((stored) => {
      if (stored === "uk" || stored === "en") setLangState(stored);
    });
  }, []);

  const setLang = async (l: Language) => {
    setLangState(l);
    await AsyncStorage.setItem("bms_language", l);
  };

  const t = useCallback(
    (key: TranslationKey) => translations[lang][key] || key,
    [lang]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}
