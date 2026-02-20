import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import Svg, { Polyline, Rect, Text as SvgText, Line } from "react-native-svg";
import Colors from "@/constants/colors";
import { HistoryEntry } from "@/lib/bms-data";
import { useI18n } from "@/lib/i18n";

type ChartField = "voltage" | "current" | "soc" | "temperature";

interface FullChartProps {
  data: HistoryEntry[];
  field: ChartField;
  color: string;
  unit: string;
  title: string;
}

export function FullChart({ data, field, color, unit, title }: FullChartProps) {
  const { t } = useI18n();
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d">("24h");
  const screenWidth = Dimensions.get("window").width;
  const chartWidth = screenWidth - 72;
  const chartHeight = 160;
  const paddingLeft = 40;
  const paddingBottom = 24;
  const paddingTop = 8;

  const now = Date.now();
  const rangeMs =
    timeRange === "24h"
      ? 24 * 60 * 60 * 1000
      : timeRange === "7d"
      ? 7 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;

  const filtered = data.filter((d) => now - d.timestamp <= rangeMs);
  const displayData = filtered.length > 0 ? filtered : data.slice(-50);

  const values = displayData.map((d) => d[field]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const yPadding = range * 0.1;

  const effectiveMin = minVal - yPadding;
  const effectiveMax = maxVal + yPadding;
  const effectiveRange = effectiveMax - effectiveMin;

  const drawWidth = chartWidth - paddingLeft;
  const drawHeight = chartHeight - paddingBottom - paddingTop;

  const points = displayData
    .map((d, i) => {
      const x = paddingLeft + (i / Math.max(displayData.length - 1, 1)) * drawWidth;
      const y = paddingTop + drawHeight - ((d[field] - effectiveMin) / effectiveRange) * drawHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const gridLines = 4;
  const gridValues = Array.from({ length: gridLines + 1 }, (_, i) =>
    effectiveMin + (effectiveRange / gridLines) * i
  );

  const timeRanges = [
    { key: "24h" as const, label: t("last24h") },
    { key: "7d" as const, label: t("last7d") },
    { key: "30d" as const, label: t("last30d") },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.rangeButtons}>
          {timeRanges.map((r) => (
            <Pressable
              key={r.key}
              onPress={() => setTimeRange(r.key)}
              style={[
                styles.rangeButton,
                timeRange === r.key && { backgroundColor: color + "22" },
              ]}
            >
              <Text
                style={[
                  styles.rangeText,
                  timeRange === r.key && { color },
                ]}
              >
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Svg width={chartWidth} height={chartHeight}>
        {gridValues.map((val, i) => {
          const y = paddingTop + drawHeight - ((val - effectiveMin) / effectiveRange) * drawHeight;
          return (
            <React.Fragment key={i}>
              <Line
                x1={paddingLeft}
                y1={y}
                x2={paddingLeft + drawWidth}
                y2={y}
                stroke={Colors.dark.border}
                strokeWidth={0.5}
                strokeDasharray="4,4"
              />
              <SvgText
                x={paddingLeft - 6}
                y={y + 3}
                fill={Colors.dark.textMuted}
                fontSize={9}
                textAnchor="end"
              >
                {val.toFixed(field === "soc" ? 0 : 1)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {displayData.length > 1 && (
          <Polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </Svg>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {values.length > 0 ? `${minVal.toFixed(1)} - ${maxVal.toFixed(1)} ${unit}` : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "600" as const,
  },
  rangeButtons: {
    flexDirection: "row",
    gap: 4,
  },
  rangeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rangeText: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "600" as const,
  },
  footer: {
    marginTop: 4,
    alignItems: "center",
  },
  footerText: {
    color: Colors.dark.textMuted,
    fontSize: 10,
    fontWeight: "500" as const,
  },
});
