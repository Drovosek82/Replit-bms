import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useBMS } from "@/lib/bms-context";
import { useI18n } from "@/lib/i18n";
import { FullChart } from "@/components/FullChart";
import Colors from "@/constants/colors";

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { history, isLoading } = useBMS();
  const { t } = useI18n();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

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
      <Text style={styles.headerTitle}>{t("history")}</Text>

      <View style={styles.chartGap}>
        <FullChart
          data={history}
          field="voltage"
          color={Colors.dark.accent}
          unit="V"
          title={t("voltageHistory")}
        />
      </View>

      <View style={styles.chartGap}>
        <FullChart
          data={history}
          field="current"
          color={Colors.dark.success}
          unit="A"
          title={t("currentHistory")}
        />
      </View>

      <View style={styles.chartGap}>
        <FullChart
          data={history}
          field="soc"
          color={Colors.dark.tint}
          unit="%"
          title={t("socHistory")}
        />
      </View>

      <View style={styles.chartGap}>
        <FullChart
          data={history}
          field="temperature"
          color={Colors.dark.accentWarm}
          unit={"\u00B0C"}
          title={t("temperature")}
        />
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={18} color={Colors.dark.info} />
        <Text style={styles.infoText}>
          {t("last24h")} - {history.length} records
        </Text>
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
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 28,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  chartGap: {
    marginBottom: 16,
  },
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
  },
});
