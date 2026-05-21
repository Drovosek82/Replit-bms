import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { STALE_WARN_MS, STALE_ERROR_MS } from "@/lib/bms-context";
import Colors from "@/constants/colors";

interface Props {
  pushedAt: number | null;
  lang: "uk" | "en";
  isRelayMode: boolean;
}

function formatAge(ms: number, lang: "uk" | "en"): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return lang === "uk" ? `${s}с тому` : `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return lang === "uk" ? `${m}хв тому` : `${m}min ago`;
  const h = Math.floor(m / 60);
  return lang === "uk" ? `${h}г тому` : `${h}h ago`;
}

export function StaleBanner({ pushedAt, lang, isRelayMode }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  if (!isRelayMode || pushedAt === null) return null;

  const ageMs = now - pushedAt;
  if (ageMs < STALE_WARN_MS) return null;

  const isError = ageMs >= STALE_ERROR_MS;
  const color = isError ? Colors.dark.danger : Colors.dark.warning;
  const bg = isError ? Colors.dark.danger + "18" : Colors.dark.warning + "18";
  const border = isError ? Colors.dark.danger + "40" : Colors.dark.warning + "40";
  const ageStr = formatAge(ageMs, lang);

  const message = isError
    ? lang === "uk"
      ? `ESP32 не надсилає дані вже ${ageStr}. Показуються збережені дані.`
      : `ESP32 has not sent data for ${ageStr}. Showing cached data.`
    : lang === "uk"
    ? `Останнє отримання від ESP32: ${ageStr}. Можливо відключено.`
    : `Last data from ESP32: ${ageStr}. Device may be offline.`;

  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: border }]}>
      <Ionicons
        name={isError ? "warning" : "time-outline"}
        size={15}
        color={color}
      />
      <Text style={[styles.text, { color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  text: {
    fontSize: 12,
    fontWeight: "500" as const,
    flex: 1,
    lineHeight: 17,
  },
});
