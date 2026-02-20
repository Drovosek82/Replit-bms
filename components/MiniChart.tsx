import React from "react";
import { View, StyleSheet, Text } from "react-native";
import Svg, { Polyline, Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import Colors from "@/constants/colors";

interface MiniChartProps {
  data: number[];
  width: number;
  height: number;
  color?: string;
  label?: string;
  currentValue?: string;
  showGrid?: boolean;
}

export function MiniChart({
  data,
  width,
  height,
  color = Colors.dark.tint,
  label,
  currentValue,
  showGrid = false,
}: MiniChartProps) {
  if (data.length < 2) return null;

  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const minVal = Math.min(...data);
  const maxVal = Math.max(...data);
  const range = maxVal - minVal || 1;

  const points = data
    .map((val, i) => {
      const x = padding + (i / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((val - minVal) / range) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <View style={styles.container}>
      {(label || currentValue) && (
        <View style={styles.header}>
          {label && <Text style={styles.label}>{label}</Text>}
          {currentValue && <Text style={[styles.value, { color }]}>{currentValue}</Text>}
        </View>
      )}
      <Svg width={width} height={height}>
        {showGrid &&
          [0.25, 0.5, 0.75].map((fraction) => (
            <Rect
              key={fraction}
              x={padding}
              y={padding + chartHeight * fraction}
              width={chartWidth}
              height={0.5}
              fill={Colors.dark.border}
            />
          ))}
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  label: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: "500" as const,
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
});
