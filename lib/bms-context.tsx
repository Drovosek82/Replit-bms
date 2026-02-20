import React, { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BMSData, BMSDevice, HistoryEntry, generateDemoData, generateHistoryData } from "./bms-data";
import { Language, translations, TranslationKey, I18nContext } from "./i18n";

interface BMSContextType {
  data: BMSData | null;
  history: HistoryEntry[];
  devices: BMSDevice[];
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
  addDevice: (device: BMSDevice) => void;
  removeDevice: (id: string) => void;
  isLoading: boolean;
}

const BMSContext = createContext<BMSContextType | null>(null);

export function BMSProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<BMSData | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [devices, setDevices] = useState<BMSDevice[]>([]);
  const [demoMode, setDemoModeState] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const prevDataRef = useRef<BMSData | null>(null);

  useEffect(() => {
    loadState();
  }, []);

  useEffect(() => {
    if (!demoMode) return;

    const initialData = generateDemoData();
    setData(initialData);
    prevDataRef.current = initialData;
    setHistory(generateHistoryData(24));
    setDevices([
      {
        id: "ESP32_001",
        name: "JBD BMS #1",
        type: "wifi",
        group: "Main Pack",
        connected: true,
        lastSeen: Date.now(),
      },
      {
        id: "ESP32_002",
        name: "JBD BMS #2",
        type: "bluetooth",
        group: "Main Pack",
        connected: true,
        lastSeen: Date.now(),
      },
    ]);
    setIsLoading(false);

    const interval = setInterval(() => {
      const newData = generateDemoData(prevDataRef.current || undefined);
      prevDataRef.current = newData;
      setData(newData);
      setHistory((prev) => {
        const entry: HistoryEntry = {
          timestamp: Date.now(),
          voltage: newData.totalVoltage,
          current: newData.current,
          soc: newData.soc,
          temperature: newData.temperature1,
        };
        const updated = [...prev, entry];
        return updated.length > 500 ? updated.slice(-500) : updated;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [demoMode]);

  const loadState = async () => {
    try {
      const stored = await AsyncStorage.getItem("bms_demo_mode");
      if (stored !== null) {
        setDemoModeState(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load state:", e);
    }
  };

  const setDemoMode = async (v: boolean) => {
    setDemoModeState(v);
    await AsyncStorage.setItem("bms_demo_mode", JSON.stringify(v));
  };

  const addDevice = useCallback((device: BMSDevice) => {
    setDevices((prev) => [...prev, device]);
  }, []);

  const removeDevice = useCallback((id: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
  }, []);

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
    }),
    [data, history, devices, demoMode, isLoading, addDevice, removeDevice]
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

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
