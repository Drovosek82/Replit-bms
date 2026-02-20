import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
  Pressable,
  Switch,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useBMS } from "@/lib/bms-context";
import { useI18n } from "@/lib/i18n";
import Colors from "@/constants/colors";

function SettingRow({
  icon,
  label,
  value,
  onPress,
  showArrow = false,
  color = Colors.dark.tint,
  rightElement,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  color?: string;
  rightElement?: React.ReactNode;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingRow,
        pressed && onPress && { opacity: 0.7 },
      ]}
      onPress={onPress}
      disabled={!onPress && !rightElement}
    >
      <View style={[styles.settingIcon, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {value && <Text style={styles.settingValue}>{value}</Text>}
      </View>
      {rightElement}
      {showArrow && (
        <Ionicons name="chevron-forward" size={16} color={Colors.dark.textMuted} />
      )}
    </Pressable>
  );
}

function DeviceItem({
  name,
  id,
  type,
  connected,
  onRemove,
}: {
  name: string;
  id: string;
  type: "wifi" | "bluetooth";
  connected: boolean;
  onRemove: () => void;
}) {
  const { t } = useI18n();

  return (
    <View style={styles.deviceItem}>
      <View style={styles.deviceLeft}>
        <View
          style={[
            styles.deviceIcon,
            {
              backgroundColor: connected
                ? Colors.dark.success + "18"
                : Colors.dark.textMuted + "18",
            },
          ]}
        >
          <Ionicons
            name={type === "wifi" ? "wifi" : "bluetooth"}
            size={18}
            color={connected ? Colors.dark.success : Colors.dark.textMuted}
          />
        </View>
        <View>
          <Text style={styles.deviceName}>{name}</Text>
          <Text style={styles.deviceId}>{id}</Text>
        </View>
      </View>
      <View style={styles.deviceRight}>
        <View
          style={[
            styles.deviceStatus,
            {
              backgroundColor: connected
                ? Colors.dark.success + "18"
                : Colors.dark.textMuted + "18",
            },
          ]}
        >
          <View
            style={[
              styles.deviceStatusDot,
              {
                backgroundColor: connected
                  ? Colors.dark.success
                  : Colors.dark.textMuted,
              },
            ]}
          />
          <Text
            style={[
              styles.deviceStatusText,
              {
                color: connected
                  ? Colors.dark.success
                  : Colors.dark.textMuted,
              },
            ]}
          >
            {connected ? t("connected") : t("disconnected")}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            onRemove();
          }}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.dark.danger} />
        </Pressable>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { devices, demoMode, setDemoMode, removeDevice } = useBMS();
  const { t, lang, setLang } = useI18n();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const handleLanguageToggle = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setLang(lang === "en" ? "uk" : "en");
  };

  const handleDemoToggle = (val: boolean) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setDemoMode(val);
  };

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
      <Text style={styles.headerTitle}>{t("settings")}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("devices")}</Text>
        <View style={styles.sectionCard}>
          {devices.length > 0 ? (
            devices.map((device) => (
              <DeviceItem
                key={device.id}
                name={device.name}
                id={device.id}
                type={device.type}
                connected={device.connected}
                onRemove={() => removeDevice(device.id)}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="hardware-chip-outline" size={32} color={Colors.dark.textMuted} />
              <Text style={styles.emptyText}>{t("noDevices")}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("connectionType")}</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon="wifi"
            label={t("wifi")}
            value="ESP32-C3 Super Mini"
            color={Colors.dark.accent}
            showArrow
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="bluetooth"
            label={t("bluetooth")}
            value="BLE 4.0+"
            color={Colors.dark.info}
            showArrow
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("settings")}</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon="flask"
            label={t("demoMode")}
            color={Colors.dark.warning}
            rightElement={
              <Switch
                value={demoMode}
                onValueChange={handleDemoToggle}
                trackColor={{ false: Colors.dark.gaugeTrack, true: Colors.dark.tint + "60" }}
                thumbColor={demoMode ? Colors.dark.tint : Colors.dark.textMuted}
              />
            }
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="language"
            label={t("language")}
            value={lang === "uk" ? "Українська" : "English"}
            color={Colors.dark.accent}
            onPress={handleLanguageToggle}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("about")}</Text>
        <View style={styles.sectionCard}>
          <SettingRow
            icon="information-circle"
            label={t("version")}
            value="1.0.0"
            color={Colors.dark.textSecondary}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="hardware-chip"
            label="ESP32-C3 Super Mini"
            color={Colors.dark.tint}
          />
          <View style={styles.settingDivider} />
          <SettingRow
            icon="battery-charging"
            label="JBD BMS SP14S004"
            value="14S Li-ion"
            color={Colors.dark.success}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>BMS Monitor v1.0</Text>
        <Text style={styles.footerSubtext}>ESP32-C3 Super Mini / JBD BMS SP14S004</Text>
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
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 28,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    fontWeight: "600" as const,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
    marginBottom: 8,
    paddingLeft: 4,
  },
  sectionCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: "hidden",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  settingContent: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "500" as const,
  },
  settingValue: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: "400" as const,
  },
  settingDivider: {
    height: 1,
    backgroundColor: Colors.dark.border + "60",
    marginLeft: 58,
  },
  deviceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border + "60",
  },
  deviceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  deviceName: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "600" as const,
  },
  deviceId: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "400" as const,
    marginTop: 2,
  },
  deviceRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  deviceStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deviceStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  deviceStatusText: {
    fontSize: 10,
    fontWeight: "600" as const,
    letterSpacing: 0.3,
  },
  emptyState: {
    padding: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    fontWeight: "500" as const,
  },
  footer: {
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
    paddingTop: 8,
  },
  footerText: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    fontWeight: "600" as const,
  },
  footerSubtext: {
    color: Colors.dark.textMuted + "80",
    fontSize: 11,
    fontWeight: "400" as const,
  },
});
