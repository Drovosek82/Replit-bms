import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  unit: string;
  color?: string;
  compact?: boolean;
}

export function StatCard({
  icon,
  label,
  value,
  unit,
  color = Colors.dark.tint,
  compact = false,
}: StatCardProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={[styles.iconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as any} size={compact ? 16 : 18} color={color} />
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, compact && styles.valueCompact]}>{value}</Text>
          <Text style={styles.unit}>{unit}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  containerCompact: {
    padding: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "500" as const,
    letterSpacing: 0.3,
    textTransform: "uppercase" as const,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  value: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: "700" as const,
  },
  valueCompact: {
    fontSize: 17,
  },
  unit: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: "500" as const,
  },
});
