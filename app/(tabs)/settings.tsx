import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
  Pressable,
  Switch,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { fetch } from "expo/fetch";
import { useBMS, ConnectionState } from "@/lib/bms-context";
import { useI18n } from "@/lib/i18n";
import { getApiUrl } from "@/lib/query-client";
import { getEsp32Sketch } from "@/lib/esp32-sketch";
import Colors from "@/constants/colors";
import { ScanModal } from "@/components/ScanModal";
import { BLEDevice } from "@/lib/wifi-scanner";
import * as Clipboard from "expo-clipboard";

function haptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function SectionTitle({ label }: { label: string }) {
  return <Text style={styles.sectionTitle}>{label}</Text>;
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
  showArrow = false,
  color = Colors.dark.tint,
  rightElement,
  danger = false,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  color?: string;
  rightElement?: React.ReactNode;
  danger?: boolean;
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
        <Text style={[styles.settingLabel, danger && { color: Colors.dark.danger }]}>
          {label}
        </Text>
        {value ? (
          <Text style={styles.settingValue}>{value}</Text>
        ) : null}
      </View>
      {rightElement}
      {showArrow && (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={Colors.dark.textMuted}
        />
      )}
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.settingDivider} />;
}

function ConnectionStateBadge({ state }: { state: ConnectionState }) {
  const { t } = useI18n();
  const configs: Record<
    ConnectionState,
    { color: string; label: string; icon: string }
  > = {
    idle: {
      color: Colors.dark.textMuted,
      label: t("noConnection"),
      icon: "ellipse-outline",
    },
    connecting: {
      color: Colors.dark.warning,
      label: t("connecting"),
      icon: "sync-outline",
    },
    connected: {
      color: Colors.dark.success,
      label: t("connected"),
      icon: "checkmark-circle",
    },
    error: {
      color: Colors.dark.danger,
      label: t("connectionError"),
      icon: "alert-circle",
    },
  };
  const cfg = configs[state];
  return (
    <View
      style={[
        styles.stateBadge,
        { backgroundColor: cfg.color + "18" },
      ]}
    >
      {state === "connecting" ? (
        <ActivityIndicator size={10} color={cfg.color} />
      ) : (
        <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
      )}
      <Text style={[styles.stateBadgeText, { color: cfg.color }]}>
        {cfg.label}
      </Text>
    </View>
  );
}

function DeviceItem({
  name,
  id,
  type,
  connected,
  host,
  isActive,
  onRemove,
  onConnect,
}: {
  name: string;
  id: string;
  type: "wifi" | "bluetooth";
  connected: boolean;
  host?: string;
  isActive: boolean;
  onRemove: () => void;
  onConnect?: () => void;
}) {
  const { t } = useI18n();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.deviceItem,
        isActive && styles.deviceItemActive,
        pressed && onConnect && { opacity: 0.85 },
      ]}
      onPress={onConnect}
      disabled={!onConnect}
    >
      <View style={styles.deviceLeft}>
        <View
          style={[
            styles.deviceIcon,
            {
              backgroundColor: connected
                ? Colors.dark.success + "20"
                : Colors.dark.textMuted + "18",
            },
          ]}
        >
          <Ionicons
            name={type === "relay" ? "cloud-outline" : type === "wifi" ? "wifi" : "bluetooth"}
            size={18}
            color={connected ? Colors.dark.success : Colors.dark.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.deviceName}>{name}</Text>
          {host ? (
            <Text style={styles.deviceId}>{host}</Text>
          ) : (
            <Text style={styles.deviceId}>{id}</Text>
          )}
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
          hitSlop={8}
          onPress={() => {
            haptic();
            onRemove();
          }}
        >
          <Ionicons
            name="trash-outline"
            size={18}
            color={Colors.dark.danger}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

function WifiSetupModal({
  visible,
  onClose,
  onConnect,
  initialHost,
  initialName,
  connectionState,
  connectionError,
}: {
  visible: boolean;
  onClose: () => void;
  onConnect: (host: string, name: string) => void;
  initialHost?: string;
  initialName?: string;
  connectionState: ConnectionState;
  connectionError: string | null;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [host, setHost] = useState(initialHost ?? "");
  const [name, setName] = useState(initialName ?? "");
  const isConnecting = connectionState === "connecting";

  const handleConnect = () => {
    if (!host.trim()) return;
    haptic();
    onConnect(host.trim(), name.trim());
  };

  const errorLabel =
    connectionError === "timeout" ? t("timeout") : t("connectionFailed");

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[
          styles.modalContainer,
          { backgroundColor: Colors.dark.background },
        ]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            styles.modalHeader,
            {
              paddingTop:
                Platform.OS === "ios" ? insets.top + 16 : 24,
            },
          ]}
        >
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{t("wifiSetup")}</Text>
          <Pressable onPress={onClose} style={styles.modalClose}>
            <Ionicons
              name="close"
              size={22}
              color={Colors.dark.textSecondary}
            />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.modalContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.modalInfoBox}>
            <Ionicons
              name="information-circle"
              size={18}
              color={Colors.dark.accent}
            />
            <Text style={styles.modalInfoText}>
              {Platform.OS === "web"
                ? "ESP32 та телефон мають бути в одній мережі. Підтримується також Push-режим через сервер."
                : "ESP32 та телефон повинні бути підключені до однієї WiFi мережі."}
            </Text>
          </View>

          <Text style={styles.inputLabel}>{t("ipAddress")}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="wifi"
              size={18}
              color={Colors.dark.tint}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.textInput}
              value={host}
              onChangeText={setHost}
              placeholder={t("ipAddressHint")}
              placeholderTextColor={Colors.dark.textMuted}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <Text style={styles.inputLabel}>{t("enterDeviceName")}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="hardware-chip-outline"
              size={18}
              color={Colors.dark.tint}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder={t("deviceNameHint")}
              placeholderTextColor={Colors.dark.textMuted}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleConnect}
            />
          </View>

          {connectionError && connectionState === "error" && (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle"
                size={16}
                color={Colors.dark.danger}
              />
              <Text style={styles.errorText}>{errorLabel}</Text>
            </View>
          )}

          <Text style={styles.hintText}>
            {"Перевірені ендпоінти ESP32:\n/data • /api/data • /bms • /api/bms"}
          </Text>
        </ScrollView>

        <View
          style={[
            styles.modalFooter,
            {
              paddingBottom:
                Platform.OS === "ios"
                  ? Math.max(insets.bottom, 20)
                  : 24,
            },
          ]}
        >
          <Pressable
            style={styles.cancelButton}
            onPress={onClose}
          >
            <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
          </Pressable>
          <Pressable
            style={[
              styles.connectButton,
              (!host.trim() || isConnecting) && { opacity: 0.5 },
            ]}
            onPress={handleConnect}
            disabled={!host.trim() || isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="wifi" size={16} color="#000" />
            )}
            <Text style={styles.connectButtonText}>
              {isConnecting ? t("connecting") : t("connect")}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function RelaySection({
  pushUrl,
  relayIdInput,
  setRelayIdInput,
  onConnect,
  onCopy,
  urlCopied,
  activeRelayId,
}: {
  pushUrl: string;
  relayIdInput: string;
  setRelayIdInput: (v: string) => void;
  onConnect: () => void;
  onCopy: () => void;
  urlCopied: boolean;
  activeRelayId: string | null;
}) {
  const { t } = useI18n();

  const esp32Code = `#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* SERVER = "${pushUrl}";
const char* DEVICE_ID = "esp01"; // змінити!

void pushBMSData(float v, float i, int soc) {
  HTTPClient http;
  http.begin(SERVER);
  http.addHeader("Content-Type","application/json");
  String body = "{\\"device_id\\":\\"" + String(DEVICE_ID)
    + "\\",\\"voltage\\":" + v
    + ",\\"current\\":" + i
    + ",\\"soc\\":" + soc + "}";
  http.POST(body);
  http.end();
}`;

  return (
    <View style={styles.relaySection}>
      <View style={styles.relayHeader}>
        <View style={styles.relayHeaderIcon}>
          <Ionicons name="cloud-outline" size={20} color={Colors.dark.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.relayTitle}>{t("cloudRelay")}</Text>
          <Text style={styles.relayDesc}>{t("cloudRelayDesc")}</Text>
        </View>
      </View>

      {activeRelayId && (
        <View style={styles.relayActiveBadge}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.dark.success} />
          <Text style={styles.relayActiveBadgeText}>
            {t("relayConnected")}: {activeRelayId}
          </Text>
        </View>
      )}

      <Text style={styles.relayLabel}>{t("relayPushUrlLabel")}</Text>
      <Pressable style={styles.relayUrlBox} onPress={onCopy}>
        <Text style={styles.relayUrlText} numberOfLines={2} selectable>
          {pushUrl}
        </Text>
        <View style={styles.relayUrlCopyBtn}>
          <Ionicons
            name={urlCopied ? "checkmark" : "copy-outline"}
            size={15}
            color={urlCopied ? Colors.dark.success : Colors.dark.accent}
          />
          <Text style={[styles.relayUrlCopyText, urlCopied && { color: Colors.dark.success }]}>
            {urlCopied ? t("urlCopied") : t("copyUrl")}
          </Text>
        </View>
      </Pressable>

      <Text style={styles.relayLabel}>{t("relayDeviceIdLabel")}</Text>
      <View style={styles.inputWrapper}>
        <Ionicons
          name="hardware-chip-outline"
          size={18}
          color={Colors.dark.accent}
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.textInput}
          value={relayIdInput}
          onChangeText={setRelayIdInput}
          placeholder={t("relayDeviceIdHint")}
          placeholderTextColor={Colors.dark.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={onConnect}
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.relayConnectBtn,
          (!relayIdInput.trim()) && { opacity: 0.45 },
          pressed && { opacity: 0.7 },
        ]}
        onPress={onConnect}
        disabled={!relayIdInput.trim()}
      >
        <Ionicons name="cloud-upload-outline" size={16} color="#000" />
        <Text style={styles.relayConnectBtnText}>{t("connectViaCloud")}</Text>
      </Pressable>

      <Text style={styles.relayLabel}>{t("esp32CodeTitle")}</Text>
      <View style={styles.pushEndpointBox}>
        <Text style={styles.pushCodeText} selectable>
          {esp32Code}
        </Text>
      </View>
    </View>
  );
}

// ── Helper ────────────────────────────────────────────────────────────────
function relativeAge(ageMs: number, lang: string): string {
  const mins = Math.floor(ageMs / 60_000);
  if (mins < 1) return lang === "uk" ? "щойно" : "just now";
  if (mins < 60) return `${mins} ${lang === "uk" ? "хв тому" : "min ago"}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${lang === "uk" ? "г тому" : "h ago"}`;
  return `${Math.floor(hrs / 24)} ${lang === "uk" ? "дн тому" : "d ago"}`;
}

// ── Cloud Devices Section ─────────────────────────────────────────────────
interface CloudDevice {
  device_id: string;
  last_seen: string;
  count: number;
  ageMs: number;
}

function CloudDevicesSection({
  onConnect,
  activeRelayId,
}: {
  onConnect: (id: string) => void;
  activeRelayId: string | null;
}) {
  const { t, lang } = useI18n();
  const { data: devices, isLoading, isFetching, refetch } = useQuery<CloudDevice[]>({
    queryKey: ["/api/bms/devices"],
    refetchInterval: 30_000,
    staleTime: 20_000,
    queryFn: async () => {
      const url = new URL("/api/bms/devices", getApiUrl());
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  return (
    <View style={styles.cloudSection}>
      <View style={styles.cloudHeader}>
        <View style={styles.cloudHeaderLeft}>
          <View style={styles.cloudHeaderIcon}>
            <Ionicons name="server-outline" size={18} color={Colors.dark.tint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cloudTitle}>{t("cloudDevices")}</Text>
            <Text style={styles.cloudSubtitle}>
              {devices && devices.length > 0
                ? `${devices.length} ${lang === "uk" ? "пристроїв у БД" : "devices in DB"}`
                : t("noCloudDevices")}
            </Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.cloudRefreshBtn, pressed && { opacity: 0.6 }]}
          onPress={() => { haptic(); refetch(); }}
        >
          {isFetching
            ? <ActivityIndicator size={14} color={Colors.dark.tint} />
            : <Ionicons name="refresh" size={15} color={Colors.dark.tint} />}
        </Pressable>
      </View>

      {isLoading && (
        <View style={styles.cloudLoadingRow}>
          <ActivityIndicator size="small" color={Colors.dark.tint} />
          <Text style={styles.cloudLoadingText}>
            {lang === "uk" ? "Завантаження..." : "Loading..."}
          </Text>
        </View>
      )}

      {!isLoading && (!devices || devices.length === 0) && (
        <View style={styles.cloudEmptyRow}>
          <Ionicons name="cloud-offline-outline" size={28} color={Colors.dark.textMuted} />
          <Text style={styles.cloudEmptyText}>{t("noCloudDevices")}</Text>
        </View>
      )}

      {devices && devices.length > 0 && (
        <View style={styles.cloudDeviceList}>
          {devices.map((d) => {
            const isActive = activeRelayId === d.device_id;
            return (
              <Pressable
                key={d.device_id}
                style={({ pressed }) => [
                  styles.cloudDeviceRow,
                  isActive && styles.cloudDeviceRowActive,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => { haptic(); onConnect(d.device_id); }}
              >
                <View style={[styles.cloudDeviceIcon, { backgroundColor: isActive ? Colors.dark.tint + "20" : Colors.dark.surface }]}>
                  <Ionicons
                    name="cloud"
                    size={16}
                    color={isActive ? Colors.dark.tint : Colors.dark.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cloudDeviceName, isActive && { color: Colors.dark.tint }]}>
                    {d.device_id}
                  </Text>
                  <Text style={styles.cloudDeviceMeta}>
                    {relativeAge(d.ageMs, lang)} · {d.count} {t("dbRecords")}
                  </Text>
                </View>
                {isActive ? (
                  <View style={styles.cloudActiveChip}>
                    <Ionicons name="checkmark-circle" size={13} color={Colors.dark.tint} />
                    <Text style={styles.cloudActiveChipText}>
                      {lang === "uk" ? "Активний" : "Active"}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.cloudConnectChip}>
                    <Ionicons name="link" size={12} color={Colors.dark.accent} />
                    <Text style={styles.cloudConnectChipText}>{t("connectRelay")}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── ESP32 Full Sketch Modal ───────────────────────────────────────────────
function ESP32SketchModal({
  visible,
  onClose,
  pushUrl,
}: {
  visible: boolean;
  onClose: () => void;
  pushUrl: string;
}) {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const sketch = getEsp32Sketch(pushUrl);

  const handleCopy = useCallback(async () => {
    haptic();
    await Clipboard.setStringAsync(sketch);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [sketch]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: Colors.dark.background }]}>
        <View style={[styles.modalHeader, { paddingTop: Platform.OS === "ios" ? insets.top + 12 : 20 }]}>
          <View style={styles.modalHandle} />
          <View style={styles.sketchModalTitleRow}>
            <Ionicons name="code-slash" size={18} color={Colors.dark.tint} />
            <Text style={styles.modalTitle}>{t("esp32FullSketch")}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={22} color={Colors.dark.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.sketchInfoBox}>
          <Ionicons name="hardware-chip-outline" size={15} color={Colors.dark.accent} />
          <Text style={styles.sketchInfoText}>
            {lang === "uk"
              ? "Arduino IDE · ESP32 · JBD BMS UART\nПотрібні: ArduinoJson v6, WiFi.h, HTTPClient.h"
              : "Arduino IDE · ESP32 · JBD BMS UART\nRequired: ArduinoJson v6, WiFi.h, HTTPClient.h"}
          </Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.sketchScrollContent}
          showsVerticalScrollIndicator
        >
          <View style={styles.sketchCodeBox}>
            <Text style={styles.sketchCodeText} selectable>
              {sketch}
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.modalFooter, { paddingBottom: Platform.OS === "ios" ? Math.max(insets.bottom, 20) : 20 }]}>
          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>{t("cancel")}</Text>
          </Pressable>
          <Pressable style={styles.connectButton} onPress={handleCopy}>
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={16}
              color="#000"
            />
            <Text style={styles.connectButtonText}>
              {copied ? t("codeCopied") : t("copyCode")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    devices,
    demoMode,
    setDemoMode,
    removeDevice,
    connectionState,
    connectionError,
    activeDevice,
    connectToWifi,
    connectToRelay,
    disconnectDevice,
    lastUpdateTime,
    relayDeviceId,
    relayPushUrl,
  } = useBMS();
  const { t, lang, setLang } = useI18n();
  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const [wifiModalVisible, setWifiModalVisible] = useState(false);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [sketchModalVisible, setSketchModalVisible] = useState(false);
  const [relayIdInput, setRelayIdInput] = useState(relayDeviceId ?? "");
  const [urlCopied, setUrlCopied] = useState(false);

  const handleLanguageToggle = () => {
    haptic();
    setLang(lang === "en" ? "uk" : "en");
  };

  const handleDemoToggle = (val: boolean) => {
    haptic();
    setDemoMode(val);
  };

  const handleConnectWifi = useCallback(
    async (host: string, name: string) => {
      await connectToWifi(host, name);
      setWifiModalVisible(false);
    },
    [connectToWifi]
  );

  const handleScanSelectWifi = useCallback(
    async (host: string, name: string) => {
      setScanModalVisible(false);
      if (demoMode) await setDemoMode(false);
      await connectToWifi(host, name);
    },
    [connectToWifi, demoMode, setDemoMode]
  );

  const handleScanSelectBLE = useCallback((_device: BLEDevice) => {
    // BLE connection flow placeholder for native build
    Alert.alert(
      "Bluetooth",
      "BLE підключення буде доступне у нативному збірнику.",
      [{ text: "OK" }]
    );
  }, []);

  const handleOpenWebInterface = useCallback(() => {
    if (!activeDevice?.host) return;
    haptic();
    const url = `http://${activeDevice.host}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(t("connectionError"), `${t("connectionFailed")}: ${url}`);
    });
  }, [activeDevice, t]);

  const handleConnectRelay = useCallback(async () => {
    if (!relayIdInput.trim()) return;
    haptic();
    if (demoMode) await setDemoMode(false);
    await connectToRelay(relayIdInput.trim());
  }, [relayIdInput, demoMode, setDemoMode, connectToRelay]);

  const handleCopyUrl = useCallback(async () => {
    haptic();
    await Clipboard.setStringAsync(relayPushUrl);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  }, [relayPushUrl]);

  const handleDisconnect = () => {
    haptic();
    Alert.alert(
      t("disconnect"),
      activeDevice
        ? `${activeDevice.name} (${activeDevice.host})`
        : t("disconnect"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("disconnect"),
          style: "destructive",
          onPress: () => {
            disconnectDevice();
            setDemoMode(true);
          },
        },
      ]
    );
  };

  const realDevices = demoMode
    ? []
    : devices.filter((d) => !d.id.startsWith("DEMO_"));

  const demoDevices = demoMode
    ? devices.filter((d) => d.id.startsWith("DEMO_"))
    : [];

  const lastUpdateStr = lastUpdateTime
    ? new Date(lastUpdateTime).toLocaleTimeString()
    : null;

  return (
    <>
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

        {!demoMode && (
          <View style={styles.section}>
            <SectionTitle label={t("connectionStatus")} />
            <View style={styles.sectionCard}>
              <View style={styles.connectionStatusRow}>
                <View style={styles.connectionStatusLeft}>
                  <ConnectionStateBadge state={connectionState} />
                  {activeDevice && (
                    <Text style={styles.activeDeviceName}>
                      {activeDevice.name}
                    </Text>
                  )}
                  {activeDevice?.host && (
                    <Text style={styles.activeDeviceHost}>
                      {activeDevice.host}
                    </Text>
                  )}
                  {lastUpdateStr && connectionState === "connected" && (
                    <Text style={styles.lastUpdateText}>
                      {t("lastUpdate")}: {lastUpdateStr}
                    </Text>
                  )}
                  {connectionState === "error" && (
                    <Text style={styles.errorSmallText}>
                      {connectionError === "timeout"
                        ? t("timeout")
                        : t("connectionFailed")}
                      {" · "}{t("retrying")}
                    </Text>
                  )}
                </View>
                <View style={styles.connectionStatusActions}>
                  {activeDevice ? (
                    <>
                      <Pressable
                        style={styles.actionChip}
                        onPress={() => setWifiModalVisible(true)}
                      >
                        <Ionicons
                          name="pencil"
                          size={13}
                          color={Colors.dark.accent}
                        />
                        <Text
                          style={[
                            styles.actionChipText,
                            { color: Colors.dark.accent },
                          ]}
                        >
                          {t("editConnection")}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.actionChip,
                          { backgroundColor: Colors.dark.danger + "18" },
                        ]}
                        onPress={handleDisconnect}
                      >
                        <Ionicons
                          name="power"
                          size={13}
                          color={Colors.dark.danger}
                        />
                        <Text
                          style={[
                            styles.actionChipText,
                            { color: Colors.dark.danger },
                          ]}
                        >
                          {t("disconnect")}
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      style={[
                        styles.actionChip,
                        { backgroundColor: Colors.dark.tint + "18" },
                      ]}
                      onPress={() => setWifiModalVisible(true)}
                    >
                      <Ionicons
                        name="wifi"
                        size={13}
                        color={Colors.dark.tint}
                      />
                      <Text
                        style={[
                          styles.actionChipText,
                          { color: Colors.dark.tint },
                        ]}
                      >
                        {t("connect")}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <SectionTitle label={t("devices")} />
          <View style={styles.sectionCard}>
            {demoMode && demoDevices.length > 0
              ? demoDevices.map((device) => (
                  <DeviceItem
                    key={device.id}
                    name={device.name}
                    id={device.id}
                    type={device.type}
                    connected={device.connected}
                    host={device.host}
                    isActive={false}
                    onRemove={() => removeDevice(device.id)}
                  />
                ))
              : !demoMode && realDevices.length > 0
              ? realDevices.map((device) => (
                  <DeviceItem
                    key={device.id}
                    name={device.name}
                    id={device.id}
                    type={device.type}
                    connected={device.connected}
                    host={device.host}
                    isActive={activeDevice?.id === device.id}
                    onRemove={() => removeDevice(device.id)}
                  />
                ))
              : null}

            {!demoMode && realDevices.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons
                  name="hardware-chip-outline"
                  size={32}
                  color={Colors.dark.textMuted}
                />
                <Text style={styles.emptyText}>{t("noDevices")}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <SectionTitle label={t("connectionType")} />
          <View style={styles.sectionCard}>
            <SettingRow
              icon="wifi"
              label={t("wifi")}
              value={
                !demoMode && activeDevice
                  ? activeDevice.host
                  : t("tapToSetup")
              }
              color={Colors.dark.accent}
              showArrow
              onPress={() => {
                haptic();
                setWifiModalVisible(true);
              }}
            />
            <Divider />
            <SettingRow
              icon="bluetooth"
              label={t("bluetooth")}
              value={t("bleInfo")}
              color={Colors.dark.info}
              showArrow
              onPress={() => {
                haptic();
                setScanModalVisible(true);
              }}
            />
          </View>
          {!demoMode && (
            <Text style={styles.bleHintText}>{t("bleInfoDesc")}</Text>
          )}

          {/* Scan network button */}
          <Pressable
            style={({ pressed }) => [
              styles.scanNetworkBtn,
              pressed && { opacity: 0.75 },
            ]}
            onPress={() => {
              haptic();
              setScanModalVisible(true);
            }}
          >
            <Ionicons name="search" size={16} color={Colors.dark.tint} />
            <Text style={styles.scanNetworkBtnText}>{t("scanNetwork")}</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.dark.textMuted} />
          </Pressable>

          {/* Open ESP32 web interface */}
          {!demoMode && activeDevice?.host && (
            <Pressable
              style={({ pressed }) => [
                styles.webInterfaceBtn,
                pressed && { opacity: 0.75 },
              ]}
              onPress={handleOpenWebInterface}
            >
              <View style={styles.webInterfaceBtnLeft}>
                <View style={styles.webInterfaceBtnIcon}>
                  <Ionicons name="globe-outline" size={18} color={Colors.dark.accent} />
                </View>
                <View>
                  <Text style={styles.webInterfaceBtnLabel}>
                    {t("openWebInterface")}
                  </Text>
                  <Text style={styles.webInterfaceBtnValue}>
                    http://{activeDevice.host}
                  </Text>
                </View>
              </View>
              <Ionicons name="open-outline" size={16} color={Colors.dark.accent} />
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          <RelaySection
            pushUrl={relayPushUrl}
            relayIdInput={relayIdInput}
            setRelayIdInput={setRelayIdInput}
            onConnect={handleConnectRelay}
            onCopy={handleCopyUrl}
            urlCopied={urlCopied}
            activeRelayId={relayDeviceId}
          />
          <Pressable
            style={({ pressed }) => [styles.viewSketchBtn, pressed && { opacity: 0.75 }]}
            onPress={() => { haptic(); setSketchModalVisible(true); }}
          >
            <Ionicons name="code-slash" size={15} color={Colors.dark.tint} />
            <Text style={styles.viewSketchBtnText}>{t("viewFullSketch")}</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.dark.textMuted} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <SectionTitle label={t("cloudDevices")} />
          <CloudDevicesSection
            onConnect={async (id) => {
              haptic();
              if (demoMode) await setDemoMode(false);
              setRelayIdInput(id);
              connectToRelay(id);
            }}
            activeRelayId={relayDeviceId}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle label={t("settings")} />
          <View style={styles.sectionCard}>
            <SettingRow
              icon="flask"
              label={t("demoMode")}
              color={Colors.dark.warning}
              rightElement={
                <Switch
                  value={demoMode}
                  onValueChange={handleDemoToggle}
                  trackColor={{
                    false: Colors.dark.gaugeTrack,
                    true: Colors.dark.tint + "60",
                  }}
                  thumbColor={
                    demoMode ? Colors.dark.tint : Colors.dark.textMuted
                  }
                />
              }
            />
            <Divider />
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
          <SectionTitle label={t("about")} />
          <View style={styles.sectionCard}>
            <SettingRow
              icon="information-circle"
              label={t("version")}
              value="1.0.0"
              color={Colors.dark.textSecondary}
            />
            <Divider />
            <SettingRow
              icon="hardware-chip"
              label="ESP32-C3 Super Mini"
              color={Colors.dark.tint}
            />
            <Divider />
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
          <Text style={styles.footerSubtext}>
            ESP32-C3 Super Mini / JBD BMS SP14S004
          </Text>
        </View>

        <View style={{ height: Platform.OS === "web" ? 34 : 100 }} />
      </ScrollView>

      <WifiSetupModal
        visible={wifiModalVisible}
        onClose={() => setWifiModalVisible(false)}
        onConnect={handleConnectWifi}
        initialHost={activeDevice?.host ?? ""}
        initialName={activeDevice?.name ?? ""}
        connectionState={connectionState}
        connectionError={connectionError}
      />

      <ScanModal
        visible={scanModalVisible}
        onClose={() => setScanModalVisible(false)}
        onSelectWifi={handleScanSelectWifi}
        onSelectBLE={handleScanSelectBLE}
      />

      <ESP32SketchModal
        visible={sketchModalVisible}
        onClose={() => setSketchModalVisible(false)}
        pushUrl={relayPushUrl}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 16 },
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 28,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  section: { marginBottom: 24 },
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
  settingContent: { flex: 1, gap: 2 },
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
  deviceItemActive: {
    backgroundColor: Colors.dark.tint + "08",
  },
  deviceLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
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
  deviceStatusDot: { width: 6, height: 6, borderRadius: 3 },
  deviceStatusText: { fontSize: 10, fontWeight: "600" as const, letterSpacing: 0.3 },
  emptyState: { padding: 32, alignItems: "center", gap: 8 },
  emptyText: {
    color: Colors.dark.textMuted,
    fontSize: 14,
    fontWeight: "500" as const,
  },

  connectionStatusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: 14,
    gap: 12,
  },
  connectionStatusLeft: { flex: 1, gap: 4 },
  connectionStatusActions: { gap: 6, alignItems: "flex-end" },
  activeDeviceName: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "600" as const,
    marginTop: 4,
  },
  activeDeviceHost: {
    color: Colors.dark.tint,
    fontSize: 12,
    fontWeight: "400" as const,
    fontVariant: ["tabular-nums"] as any,
  },
  lastUpdateText: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "400" as const,
    marginTop: 2,
  },
  errorSmallText: {
    color: Colors.dark.danger,
    fontSize: 11,
    fontWeight: "500" as const,
    marginTop: 2,
  },
  stateBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  stateBadgeText: { fontSize: 12, fontWeight: "600" as const },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.dark.accent + "18",
  },
  actionChipText: { fontSize: 11, fontWeight: "600" as const },
  bleHintText: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    paddingLeft: 4,
    marginTop: 6,
  },

  pushBox: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 14,
    gap: 8,
  },
  pushBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pushBoxTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "600" as const,
  },
  pushBoxDesc: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: "400" as const,
  },
  pushEndpointLabel: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    marginTop: 4,
  },
  pushBodyLabel: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  pushEndpointBox: {
    backgroundColor: Colors.dark.background,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  pushEndpointText: {
    color: Colors.dark.tint,
    fontSize: 11,
    fontWeight: "500" as const,
    fontVariant: ["tabular-nums"] as any,
  },
  pushCodeText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: "400" as const,
    fontVariant: ["tabular-nums"] as any,
  },

  footer: { alignItems: "center", gap: 4, marginBottom: 16, paddingTop: 8 },
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

  modalContainer: { flex: 1 },
  modalHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    alignItems: "center",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.border,
    marginBottom: 16,
  },
  modalTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "700" as const,
  },
  modalClose: {
    position: "absolute",
    right: 20,
    top: 0,
    padding: 4,
  },
  modalContent: {
    padding: 20,
    gap: 8,
  },
  modalInfoBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: Colors.dark.accent + "12",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  modalInfoText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  inputLabel: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    fontWeight: "600" as const,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    marginTop: 8,
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    paddingHorizontal: 12,
    height: 48,
    gap: 10,
  },
  inputIcon: {},
  textInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "500" as const,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.dark.danger + "15",
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  errorText: {
    color: Colors.dark.danger,
    fontSize: 13,
    fontWeight: "500" as const,
  },
  hintText: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    marginTop: 8,
    lineHeight: 16,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButtonText: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    fontWeight: "600" as const,
  },
  connectButton: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.dark.tint,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  connectButtonText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "700" as const,
  },
  scanNetworkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.tint + "40",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  scanNetworkBtnText: {
    flex: 1,
    color: Colors.dark.tint,
    fontSize: 14,
    fontWeight: "600" as const,
  },
  webInterfaceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.accent + "40",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  webInterfaceBtnLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  webInterfaceBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.dark.accent + "18",
    justifyContent: "center",
    alignItems: "center",
  },
  webInterfaceBtnLabel: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "600" as const,
  },
  webInterfaceBtnValue: {
    color: Colors.dark.accent,
    fontSize: 11,
    fontWeight: "400" as const,
    marginTop: 1,
    fontVariant: ["tabular-nums"] as any,
  },
  relaySection: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.accent + "30",
    padding: 16,
    gap: 10,
  },
  relayHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 4,
  },
  relayHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.dark.accent + "18",
    justifyContent: "center",
    alignItems: "center",
  },
  relayTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "700" as const,
    marginBottom: 2,
  },
  relayDesc: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  relayActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.dark.success + "15",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  relayActiveBadgeText: {
    color: Colors.dark.success,
    fontSize: 12,
    fontWeight: "600" as const,
    flex: 1,
  },
  relayLabel: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.3,
    marginTop: 4,
    textTransform: "uppercase" as const,
  },
  relayUrlBox: {
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 10,
    gap: 6,
  },
  relayUrlText: {
    color: Colors.dark.accent,
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  relayUrlCopyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-end",
  },
  relayUrlCopyText: {
    color: Colors.dark.accent,
    fontSize: 12,
    fontWeight: "600" as const,
  },
  relayConnectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.dark.accent,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 2,
  },
  relayConnectBtnText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700" as const,
  },

  viewSketchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.tint + "30",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  viewSketchBtnText: {
    flex: 1,
    color: Colors.dark.tint,
    fontSize: 14,
    fontWeight: "600" as const,
  },

  cloudSection: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.tint + "25",
    overflow: "hidden",
  },
  cloudHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border + "60",
  },
  cloudHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  cloudHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.dark.tint + "18",
    justifyContent: "center",
    alignItems: "center",
  },
  cloudTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "700" as const,
  },
  cloudSubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontWeight: "400" as const,
    marginTop: 1,
  },
  cloudRefreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.tint + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  cloudLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  cloudLoadingText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  cloudEmptyRow: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  cloudEmptyText: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    textAlign: "center",
  },
  cloudDeviceList: { },
  cloudDeviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border + "50",
  },
  cloudDeviceRowActive: {
    backgroundColor: Colors.dark.tint + "08",
  },
  cloudDeviceIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  cloudDeviceName: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "600" as const,
  },
  cloudDeviceMeta: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  cloudActiveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.dark.tint + "18",
    borderRadius: 8,
  },
  cloudActiveChipText: {
    color: Colors.dark.tint,
    fontSize: 11,
    fontWeight: "600" as const,
  },
  cloudConnectChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.dark.accent + "18",
    borderRadius: 8,
  },
  cloudConnectChipText: {
    color: Colors.dark.accent,
    fontSize: 11,
    fontWeight: "600" as const,
  },

  sketchModalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sketchInfoBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: Colors.dark.accent + "12",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    alignItems: "flex-start",
  },
  sketchInfoText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  sketchScrollContent: {
    padding: 16,
  },
  sketchCodeBox: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  sketchCodeText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
