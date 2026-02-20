import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { getCellHealthColor } from "@/lib/bms-data";
import Colors from "@/constants/colors";

interface CellBarProps {
  index: number;
  voltage: number;
  minVoltage: number;
  maxVoltage: number;
}

export function CellBar({ index, voltage, minVoltage, maxVoltage }: CellBarProps) {
  const barHeight = useSharedValue(0);
  const color = getCellHealthColor(voltage);
  const range = maxVoltage - minVoltage || 0.01;
  const normalizedHeight = ((voltage - minVoltage) / range) * 100;

  useEffect(() => {
    barHeight.value = withTiming(Math.max(10, normalizedHeight), {
      duration: 600,
      easing: Easing.bezierFn(0.25, 0.1, 0.25, 1),
    });
  }, [voltage, normalizedHeight]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: `${barHeight.value}%`,
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.voltage}>{voltage.toFixed(3)}</Text>
      <View style={styles.barTrack}>
        <Animated.View
          style={[styles.barFill, { backgroundColor: color }, animatedStyle]}
        />
      </View>
      <Text style={styles.label}>{index + 1}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    gap: 4,
  },
  voltage: {
    color: Colors.dark.textSecondary,
    fontSize: 8,
    fontWeight: "600" as const,
    letterSpacing: 0.2,
  },
  barTrack: {
    width: "70%",
    height: 80,
    backgroundColor: Colors.dark.gaugeTrack,
    borderRadius: 4,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    borderRadius: 4,
    minHeight: 4,
  },
  label: {
    color: Colors.dark.textMuted,
    fontSize: 9,
    fontWeight: "600" as const,
  },
});
