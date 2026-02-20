import React, { useEffect } from "react";
import { View, StyleSheet, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import Colors from "@/constants/colors";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface GaugeCircleProps {
  value: number;
  maxValue: number;
  size: number;
  strokeWidth?: number;
  label: string;
  unit: string;
  color?: string;
}

export function GaugeCircle({
  value,
  maxValue,
  size,
  strokeWidth = 8,
  label,
  unit,
  color = Colors.dark.tint,
}: GaugeCircleProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = useSharedValue(0);

  useEffect(() => {
    const target = Math.min(value / maxValue, 1);
    progress.value = withTiming(target, {
      duration: 800,
      easing: Easing.bezierFn(0.25, 0.1, 0.25, 1),
    });
  }, [value, maxValue]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={Colors.dark.gaugeTrack}
          strokeWidth={strokeWidth}
          fill="none"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.labelContainer}>
        <Text style={[styles.value, { fontSize: size * 0.18 }]}>
          {typeof value === "number" ? value.toFixed(1) : value}
        </Text>
        <Text style={[styles.unit, { fontSize: size * 0.09 }]}>{unit}</Text>
        <Text style={[styles.label, { fontSize: size * 0.08 }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  labelContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    color: Colors.dark.text,
    fontWeight: "700" as const,
  },
  unit: {
    color: Colors.dark.textSecondary,
    fontWeight: "500" as const,
    marginTop: 2,
  },
  label: {
    color: Colors.dark.textMuted,
    fontWeight: "500" as const,
    marginTop: 2,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
});
