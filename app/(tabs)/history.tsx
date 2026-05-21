import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useBMS } from "@/lib/bms-context";
import { useI18n } from "@/lib/i18n";
import { FullChart } from "@/components/FullChart";
import { HistoryEntry } from "@/lib/bms-data";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";
import Colors from "@/constants/colors";

const RANGES = [
  { key: "1h", label: "1г", hours: 1 },
  { key: "24h", label: "24г", hours: 24 },
  { key: "7d", label: "7д", hours: 168 },
  { key: "30d", label: "30д", hours: 720 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

interface DbHistoryResponse {
  deviceId: string;
  count: number;
  source: "supabase" | "memory";
  hours: number;
  entries: {
    timestamp: number;
    voltage: number;
    current: number;
    soc: number;
    temp1: number;
    temp2: number;
  }[];
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { history, isLoading, demoMode, relayDeviceId } = useBMS();
  const { t, lang } = useI18n();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const [range, setRange] = useState<RangeKey>("24h");

  const isRelayMode = !demoMode && !!relayDeviceId;
  const selectedRange = RANGES.find((r) => r.key === range)!;

  const {
    data: dbData,
    isLoading: dbLoading,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery<DbHistoryResponse>({
    queryKey: ["/api/bms/history", relayDeviceId, range],
    enabled: isRelayMode,
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async () => {
      const url = new URL("/api/bms/history", getApiUrl());
      url.searchParams.set("device_id", relayDeviceId!);
      url.searchParams.set("limit", "500");
      url.searchParams.set("hours", String(selectedRange.hours));
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const dbEntries: HistoryEntry[] = (dbData?.entries ?? []).map((e) => ({
    timestamp: e.timestamp,
    voltage: e.voltage,
    current: e.current,
    soc: e.soc,
    temperature: e.temp1,
  }));

  const displayHistory: HistoryEntry[] = isRelayMode ? dbEntries : history;
  const source = isRelayMode
    ? dbData?.source === "supabase"
      ? "Supabase"
      : "server"
    : demoMode
    ? "Demo"
    : "Live";

  const recordCount = isRelayMode ? (dbData?.count ?? 0) : history.length;

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString(lang === "uk" ? "uk-UA" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: Colors.dark.background }]}>
        <Ionicons name="analytics" size={48} color={Colors.dark.tint} />
        <Text style={styles.loadingText}>{t("scanning")}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.dark.background }]}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingTop: insets.top + webTopInset + 12 },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{t("history")}</Text>
        {isRelayMode && (
          <Pressable
            style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.6 }]}
            onPress={() => refetch()}
          >
            {isFetching ? (
              <ActivityIndicator size={14} color={Colors.dark.tint} />
            ) : (
              <Ionicons name="refresh" size={16} color={Colors.dark.tint} />
            )}
          </Pressable>
        )}
      </View>

      {/* Source + count badge */}
      <View style={styles.metaRow}>
        <View style={[styles.sourceBadge, { backgroundColor: isRelayMode ? Colors.dark.tint + "18" : Colors.dark.accent + "18" }]}>
          <Ionicons
            name={isRelayMode ? "cloud" : demoMode ? "flask" : "radio"}
            size={11}
            color={isRelayMode ? Colors.dark.tint : demoMode ? Colors.dark.warning : Colors.dark.accent}
          />
          <Text style={[styles.sourceBadgeText, { color: isRelayMode ? Colors.dark.tint : demoMode ? Colors.dark.warning : Colors.dark.accent }]}>
            {source}
          </Text>
        </View>
        <Text style={styles.recordCount}>
          {recordCount} {lang === "uk" ? "записів" : "records"}
        </Text>
        {lastUpdated && (
          <Text style={styles.lastUpdated}>
            {lang === "uk" ? "оновл." : "upd."} {lastUpdated}
          </Text>
        )}
      </View>

      {/* Time range selector (relay mode only) */}
      {isRelayMode && (
        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <Pressable
              key={r.key}
              style={[styles.rangeBtn, range === r.key && styles.rangeBtnActive]}
              onPress={() => setRange(r.key)}
            >
              <Text style={[styles.rangeBtnText, range === r.key && styles.rangeBtnTextActive]}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Loading state for DB fetch */}
      {isRelayMode && dbLoading && (
        <View style={styles.dbLoadingRow}>
          <ActivityIndicator size="small" color={Colors.dark.tint} />
          <Text style={styles.dbLoadingText}>
            {lang === "uk" ? "Завантаження з Supabase..." : "Loading from Supabase..."}
          </Text>
        </View>
      )}

      {/* Empty state for relay mode with no data */}
      {isRelayMode && !dbLoading && displayHistory.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.dark.textMuted} />
          <Text style={styles.emptyTitle}>
            {lang === "uk" ? "Немає даних у БД" : "No data in DB"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {lang === "uk"
              ? `Немає записів для "${relayDeviceId}" за ${selectedRange.label}`
              : `No records for "${relayDeviceId}" in ${selectedRange.label}`}
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>
              {lang === "uk" ? "Оновити" : "Refresh"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Charts */}
      {displayHistory.length > 0 && (
        <>
          <View style={styles.chartGap}>
            <FullChart
              data={displayHistory}
              field="voltage"
              color={Colors.dark.accent}
              unit="V"
              title={t("voltageHistory")}
            />
          </View>

          <View style={styles.chartGap}>
            <FullChart
              data={displayHistory}
              field="current"
              color={Colors.dark.success}
              unit="A"
              title={t("currentHistory")}
            />
          </View>

          <View style={styles.chartGap}>
            <FullChart
              data={displayHistory}
              field="soc"
              color={Colors.dark.tint}
              unit="%"
              title={t("socHistory")}
            />
          </View>

          <View style={styles.chartGap}>
            <FullChart
              data={displayHistory}
              field="temperature"
              color={Colors.dark.accentWarm}
              unit="°C"
              title={t("temperature")}
            />
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={18} color={Colors.dark.info} />
            <Text style={styles.infoText}>
              {isRelayMode
                ? `Supabase · ${relayDeviceId} · ${recordCount} ${lang === "uk" ? "записів" : "records"} · ${selectedRange.label}`
                : `${t("last24h")} · ${displayHistory.length} ${lang === "uk" ? "точок" : "points"}`}
            </Text>
          </View>
        </>
      )}

      <View style={{ height: Platform.OS === "web" ? 34 : 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 16 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  loadingText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    fontWeight: "500" as const,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 28,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: "center",
    alignItems: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  recordCount: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    fontWeight: "500" as const,
  },
  lastUpdated: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "400" as const,
    marginLeft: "auto",
  },
  rangeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  rangeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
  },
  rangeBtnActive: {
    backgroundColor: Colors.dark.tint + "22",
  },
  rangeBtnText: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    fontWeight: "600" as const,
  },
  rangeBtnTextActive: {
    color: Colors.dark.tint,
  },
  dbLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 16,
  },
  dbLoadingText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: "500" as const,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    fontWeight: "600" as const,
  },
  emptySubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.dark.tint + "22",
    borderRadius: 10,
  },
  retryBtnText: {
    color: Colors.dark.tint,
    fontSize: 14,
    fontWeight: "600" as const,
  },
  chartGap: { marginBottom: 16 },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 16,
  },
  infoText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: "500" as const,
    flex: 1,
  },
});
