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
import { CellBar } from "@/components/CellBar";
import Colors from "@/constants/colors";

export default function CellsScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useBMS();
  const { t } = useI18n();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  if (isLoading || !data) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: Colors.dark.background }]}>
        <Ionicons name="grid" size={48} color={Colors.dark.tint} />
        <Text style={styles.loadingText}>{t("scanning")}</Text>
      </View>
    );
  }

  const voltages = data.cells.map((c) => c.voltage);
  const minV = Math.min(...voltages);
  const maxV = Math.max(...voltages);
  const avgV = voltages.reduce((a, b) => a + b, 0) / voltages.length;
  const deltaV = maxV - minV;

  const minCellIndex = voltages.indexOf(minV);
  const maxCellIndex = voltages.indexOf(maxV);

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
      <Text style={styles.headerTitle}>{t("cellVoltages")}</Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t("minCell")}</Text>
          <Text style={[styles.summaryValue, { color: Colors.dark.warning }]}>
            {minV.toFixed(3)}V
          </Text>
          <Text style={styles.summarySubtext}>#{minCellIndex + 1}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t("avgCell")}</Text>
          <Text style={[styles.summaryValue, { color: Colors.dark.tint }]}>
            {avgV.toFixed(3)}V
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t("maxCell")}</Text>
          <Text style={[styles.summaryValue, { color: Colors.dark.success }]}>
            {maxV.toFixed(3)}V
          </Text>
          <Text style={styles.summarySubtext}>#{maxCellIndex + 1}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t("deltaCell")}</Text>
          <Text
            style={[
              styles.summaryValue,
              {
                color:
                  deltaV > 0.05
                    ? Colors.dark.danger
                    : deltaV > 0.02
                    ? Colors.dark.warning
                    : Colors.dark.success,
              },
            ]}
          >
            {(deltaV * 1000).toFixed(0)}
          </Text>
          <Text style={styles.summarySubtext}>mV</Text>
        </View>
      </View>

      <View style={styles.barChartContainer}>
        <Text style={styles.sectionTitle}>{t("cellBalance")}</Text>
        <View style={styles.barChart}>
          {data.cells.map((cell) => (
            <CellBar
              key={cell.index}
              index={cell.index}
              voltage={cell.voltage}
              minVoltage={2.8}
              maxVoltage={4.2}
            />
          ))}
        </View>
      </View>

      <View style={styles.cellListContainer}>
        <Text style={styles.sectionTitle}>{t("cellVoltages")}</Text>
        {data.cells.map((cell) => {
          const isMin = cell.voltage === minV;
          const isMax = cell.voltage === maxV;
          const diffFromAvg = cell.voltage - avgV;

          return (
            <View key={cell.index} style={styles.cellRow}>
              <View style={styles.cellIndexWrap}>
                <Text style={styles.cellIndex}>{cell.index + 1}</Text>
              </View>
              <View style={styles.cellVoltageBar}>
                <View
                  style={[
                    styles.cellVoltageBarFill,
                    {
                      width: `${((cell.voltage - 2.8) / 1.4) * 100}%`,
                      backgroundColor: isMin
                        ? Colors.dark.warning
                        : isMax
                        ? Colors.dark.success
                        : Colors.dark.tint,
                    },
                  ]}
                />
              </View>
              <Text style={styles.cellVoltage}>{cell.voltage.toFixed(3)}V</Text>
              <Text
                style={[
                  styles.cellDiff,
                  {
                    color:
                      diffFromAvg > 0
                        ? Colors.dark.success
                        : diffFromAvg < 0
                        ? Colors.dark.warning
                        : Colors.dark.textMuted,
                  },
                ]}
              >
                {diffFromAvg >= 0 ? "+" : ""}
                {(diffFromAvg * 1000).toFixed(0)}
              </Text>
              {(isMin || isMax) && (
                <View
                  style={[
                    styles.cellTag,
                    {
                      backgroundColor: isMin
                        ? Colors.dark.warning + "22"
                        : Colors.dark.success + "22",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cellTagText,
                      {
                        color: isMin ? Colors.dark.warning : Colors.dark.success,
                      },
                    ]}
                  >
                    {isMin ? t("minCell") : t("maxCell")}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
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
  summaryRow: {
    flexDirection: "row",
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 20,
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.dark.border,
    marginHorizontal: 4,
  },
  summaryLabel: {
    color: Colors.dark.textMuted,
    fontSize: 10,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700" as const,
  },
  summarySubtext: {
    color: Colors.dark.textMuted,
    fontSize: 9,
    fontWeight: "500" as const,
  },
  barChartContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 20,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "700" as const,
    marginBottom: 16,
  },
  barChart: {
    flexDirection: "row",
    gap: 2,
    alignItems: "flex-end",
  },
  cellListContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: 16,
  },
  cellRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border + "60",
  },
  cellIndexWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: Colors.dark.surfaceElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  cellIndex: {
    color: Colors.dark.textSecondary,
    fontSize: 10,
    fontWeight: "700" as const,
  },
  cellVoltageBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.dark.gaugeTrack,
    borderRadius: 3,
    overflow: "hidden",
  },
  cellVoltageBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  cellVoltage: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: "600" as const,
    width: 56,
    textAlign: "right",
  },
  cellDiff: {
    fontSize: 10,
    fontWeight: "600" as const,
    width: 32,
    textAlign: "right",
  },
  cellTag: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cellTagText: {
    fontSize: 8,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
});
