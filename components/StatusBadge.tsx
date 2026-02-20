import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

interface StatusBadgeProps {
  label: string;
  isActive: boolean;
  isGood?: boolean;
}

export function StatusBadge({ label, isActive, isGood = true }: StatusBadgeProps) {
  const bgColor = isActive
    ? isGood
      ? "rgba(0, 230, 118, 0.12)"
      : "rgba(255, 82, 82, 0.12)"
    : "rgba(85, 99, 128, 0.12)";

  const textColor = isActive
    ? isGood
      ? Colors.dark.success
      : Colors.dark.danger
    : Colors.dark.textMuted;

  const iconName = isActive
    ? isGood
      ? "checkmark-circle"
      : "alert-circle"
    : "ellipse-outline";

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Ionicons name={iconName as any} size={14} color={textColor} />
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.3,
  },
});
