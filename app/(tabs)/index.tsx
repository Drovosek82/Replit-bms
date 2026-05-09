import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useBMS } from "@/lib/bms-context";
import { useI18n } from "@/lib/i18n";
import { getChargingStatus } from "@/lib/bms-data";
import { GaugeCircle } from "@/components/GaugeCircle";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { MiniChart } from "@/components/MiniChart";
import Colors from "@/constants/colors";

const screenWidth = Dimensions.get("window").width;

function NoDataScreen() {
  const { t } = useI18n();
  const { connectionState, connectionError, demoMode, isLoading, relayDeviceId } = useBMS();
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const isConnecting = connectionState === "connecting" || isLoading;
  const isError = connectionState === "error";
  const isRelay = !!relayDeviceId;

  return (
    <View
      style={[
        noDataStyles.container,
        {
          backgroundColor: Colors.dark.background,
          paddingTop: insets.top + webTopInset,
        },
      ]}
    >
      {isConnecting ? (
        <>
          <ActivityIndicator size="large" color={isRelay ? Colors.dark.accent : Colors.dark.tint} />
          <Text style={noDataStyles.title}>
            {isRelay ? t("cloudRelay") : t("connecting")}
          </Text>
          <Text style={noDataStyles.subtitle}>
            {isRelay
              ? `${t("relayWaiting")}\nDevice ID: ${relayDeviceId}`
              : demoMode ? t("scanning") : "ESP32 WiFi..."}
          </Text>
        </>
      ) : isError ? (
        <>
          <View style={noDataStyles.iconBox}>
            <Ionicons
              name="wifi-outline"
              size={48}
              color={Colors.dark.danger}
            />
          </View>
          <Text style={noDataStyles.title}>{t("connectionError")}</Text>
          <Text style={noDataStyles.subtitle}>
            {connectionError === "timeout" ? t("timeout") : t("connectionFailed")}
          </Text>
          <View style={noDataStyles.retryBox}>
            <ActivityIndicator size="small" color={Colors.dark.warning} />
            <Text style={noDataStyles.retryText}>{t("retrying")}</Text>
          </View>
        </>
      ) : (
        <>
          <View style={noDataStyles.iconBox}>
            <Ionicons
              name="battery-charging-outline"
              size={48}
              color={Colors.dark.textMuted}
            />
          </View>
          <Text style={noDataStyles.title}>{t("noConnection")}</Text>
          <Text style={noDataStyles.subtitle}>
            {t("tapToSetup")}
          </Text>
        </>
      )}
    </View>
  );
}

const noDataStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: "700" as const,
    textAlign: "center",
  },
  subtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: "400" as const,
    textAlign: "center",
  },
  retryBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  retryText: {
    color: Colors.dark.warning,
    fontSize: 13,
    fontWeight: "500" as const,
  },
});

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { data, history, demoMode, isLoading, connectionState, activeDevice, lastUpdateTime } = useBMS();
  const { t } = useI18n();

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  if (isLoading || !data) {
    return (
      <NoDataScreen />
    );
  }

  const status = getChargingStatus(data.current);
  const statusColor =
    status === "charging"
      ? Colors.dark.success
      : status === "discharging"
      ? Colors.dark.accentWarm
      : Colors.dark.textMuted;

  const statusLabel =
    status === "charging"
      ? t("charging")
      : status === "discharging"
      ? t("discharging")
      : t("idle");

  const power = Math.abs(data.totalVoltage * data.current);
  const avgTemp = (data.temperature1 + data.temperature2) / 2;

  const recentVoltages = history.slice(-60).map((h) => h.voltage);
  const recentCurrents = history.slice(-60).map((h) => h.current);

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
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>BMS Monitor</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusLabel, { color: statusColor }]}>
              {statusLabel}
            </Text>
            {demoMode && (
              <View style={styles.demoBadge}>
                <Text style={styles.demoBadgeText}>{t("demo")}</Text>
              </View>
            )}
            {!demoMode && activeDevice && (
              <Text style={styles.deviceLabel} numberOfLines={1}>
                {activeDevice.host}
              </Text>
            )}
          </View>
        </View>
        <View
          style={[
            styles.connectionIndicator,
            {
              backgroundColor:
                connectionState === "connected"
                  ? Colors.dark.success + "18"
                  : connectionState === "error"
                  ? Colors.dark.danger + "18"
                  : connectionState === "connecting"
                  ? Colors.dark.warning + "18"
                  : Colors.dark.textMuted + "18",
            },
          ]}
        >
          <Ionicons
            name={
              connectionState === "connected"
                ? "wifi"
                : connectionState === "error"
                ? "wifi-outline"
                : connectionState === "connecting"
                ? "sync-outline"
                : "wifi-outline"
            }
            size={16}
            color={
              connectionState === "connected"
                ? Colors.dark.success
                : connectionState === "error"
                ? Colors.dark.danger
                : connectionState === "connecting"
                ? Colors.dark.warning
                : Colors.dark.textMuted
            }
          />
        </View>
      </View>

      <View style={styles.gaugeSection}>
        <GaugeCircle
          value={data.soc}
          maxValue={100}
          size={screenWidth * 0.42}
          strokeWidth={10}
          label={t("soc")}
          unit="%"
          color={
            data.soc > 50
              ? Colors.dark.success
              : data.soc > 20
              ? Colors.dark.warning
              : Colors.dark.danger
          }
        />
        <View style={styles.gaugeSideStats}>
          <View style={styles.miniStatItem}>
            <Text style={styles.miniStatLabel}>{t("voltage")}</Text>
            <Text style={styles.miniStatValue}>
              {data.totalVoltage.toFixed(1)}
              <Text style={styles.miniStatUnit}> V</Text>
            </Text>
          </View>
          <View style={styles.miniStatItem}>
            <Text style={styles.miniStatLabel}>{t("current")}</Text>
            <Text
              style={[
                styles.miniStatValue,
                {
                  color:
                    data.current > 0 ? Colors.dark.success : Colors.dark.accentWarm,
                },
              ]}
            >
              {data.current > 0 ? "+" : ""}
              {data.current.toFixed(1)}
              <Text style={styles.miniStatUnit}> A</Text>
            </Text>
          </View>
          <View style={styles.miniStatItem}>
            <Text style={styles.miniStatLabel}>{t("power")}</Text>
            <Text style={styles.miniStatValue}>
              {power.toFixed(0)}
              <Text style={styles.miniStatUnit}> W</Text>
            </Text>
          </View>
          <View style={styles.miniStatItem}>
            <Text style={styles.miniStatLabel}>{t("temperature")}</Text>
            <Text
              style={[
                styles.miniStatValue,
                {
                  color:
                    avgTemp > 40
                      ? Colors.dark.danger
                      : avgTemp > 35
                      ? Colors.dark.warning
                      : Colors.dark.text,
                },
              ]}
            >
              {avgTemp.toFixed(1)}
              <Text style={styles.miniStatUnit}>{"\u00B0C"}</Text>
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.chartsRow}>
        <View style={styles.chartCard}>
          <MiniChart
            data={recentVoltages}
            width={(screenWidth - 56) / 2}
            height={60}
            color={Colors.dark.accent}
            label={t("voltage")}
            currentValue={`${data.totalVoltage.toFixed(1)}V`}
            showGrid
          />
        </View>
        <View style={styles.chartCard}>
          <MiniChart
            data={recentCurrents}
            width={(screenWidth - 56) / 2}
            height={60}
            color={
              data.current > 0 ? Colors.dark.success : Colors.dark.accentWarm
            }
            label={t("current")}
            currentValue={`${data.current.toFixed(1)}A`}
            showGrid
          />
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <View style={styles.statHalf}>
            <StatCard
              icon="battery-half"
              label={t("remainingCapacity")}
              value={data.remainingCapacity.toFixed(1)}
              unit="Ah"
              color={Colors.dark.accent}
              compact
            />
          </View>
          <View style={styles.statHalf}>
            <StatCard
              icon="battery-full"
              label={t("fullCapacity")}
              value={data.fullCapacity.toFixed(0)}
              unit="Ah"
              color={Colors.dark.info}
              compact
            />
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statHalf}>
            <StatCard
              icon="repeat"
              label={t("cycles")}
              value={data.cycles.toString()}
              unit=""
              color={Colors.dark.warning}
              compact
            />
          </View>
          <View style={styles.statHalf}>
            <StatCard
              icon="thermometer"
              label={t("temperature")}
              value={`${data.temperature1.toFixed(0)} / ${data.temperature2.toFixed(0)}`}
              unit={"\u00B0C"}
              color={
                avgTemp > 35 ? Colors.dark.danger : Colors.dark.tint
              }
              compact
            />
          </View>
        </View>
      </View>

      <View style={styles.protectionSection}>
        <Text style={styles.sectionTitle}>{t("protectionStatus")}</Text>
        <View style={styles.protectionGrid}>
          <StatusBadge
            label={t("overVoltage")}
            isActive={!data.protection.overVoltage}
            isGood={!data.protection.overVoltage}
          />
          <StatusBadge
            label={t("underVoltage")}
            isActive={!data.protection.underVoltage}
            isGood={!data.protection.underVoltage}
          />
          <StatusBadge
            label={t("overCurrent")}
            isActive={!data.protection.overCurrent}
            isGood={!data.protection.overCurrent}
          />
          <StatusBadge
            label={t("overTemp")}
            isActive={!data.protection.overTemp}
            isGood={!data.protection.overTemp}
          />
          <StatusBadge
            label={t("chargeMos")}
            isActive={data.protection.chargeMosOn}
            isGood={true}
          />
          <StatusBadge
            label={t("dischargeMos")}
            isActive={data.protection.dischargeMosOn}
            isGood={true}
          />
        </View>
      </View>

      <View style={{ height: Platform.OS === "web" ? 34 : 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
  },
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
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 28,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  demoBadge: {
    backgroundColor: Colors.dark.warning + "22",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  demoBadgeText: {
    color: Colors.dark.warning,
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.5,
  },
  connectionIndicator: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  deviceLabel: {
    color: Colors.dark.tint,
    fontSize: 11,
    fontWeight: "500" as const,
    fontVariant: ["tabular-nums"] as any,
    maxWidth: 120,
  },
  gaugeSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginBottom: 20,
  },
  gaugeSideStats: {
    gap: 12,
    flex: 1,
  },
  miniStatItem: {
    gap: 2,
  },
  miniStatLabel: {
    color: Colors.dark.textMuted,
    fontSize: 10,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  miniStatValue: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "700" as const,
  },
  miniStatUnit: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: "500" as const,
  },
  chartsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  chartCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statsGrid: {
    gap: 8,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statHalf: {
    flex: 1,
  },
  protectionSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 17,
    fontWeight: "700" as const,
    marginBottom: 12,
  },
  protectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
});
