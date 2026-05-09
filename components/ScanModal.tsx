import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import {
  scanWifiNetwork,
  scanBLE,
  isBleSupported,
  DiscoveredDevice,
  BLEDevice,
} from "@/lib/wifi-scanner";
import { useI18n } from "@/lib/i18n";

type Tab = "wifi" | "ble";

interface ScanModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectWifi: (host: string, name: string) => void;
  onSelectBLE?: (device: BLEDevice) => void;
}

function PulseRing({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.5,
            duration: 900,
            easing: Easing.out(Easing.circle),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.8,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        {
          borderColor: color,
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

function ScannerIcon({ scanning, color }: { scanning: boolean; color: string }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (scanning) {
      const anim = Animated.loop(
        Animated.timing(rotation, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      anim.start();
      return () => anim.stop();
    }
  }, [scanning, rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.scannerContainer}>
      {scanning && <PulseRing color={color} />}
      {scanning && (
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Ionicons name="scan-outline" size={48} color={color} />
        </Animated.View>
      )}
      {!scanning && (
        <Ionicons name="scan-outline" size={48} color={Colors.dark.textMuted} />
      )}
    </View>
  );
}

function WifiResultItem({
  device,
  onConnect,
}: {
  device: DiscoveredDevice;
  onConnect: () => void;
}) {
  const soc = device.partialData?.soc;
  const voltage = device.partialData?.totalVoltage;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.resultItem,
        pressed && { opacity: 0.75 },
      ]}
      onPress={onConnect}
    >
      <View style={styles.resultIcon}>
        <Ionicons name="wifi" size={20} color={Colors.dark.tint} />
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{device.name}</Text>
        <Text style={styles.resultHost}>{device.host}</Text>
        {(soc !== undefined || voltage !== undefined) && (
          <Text style={styles.resultMeta}>
            {voltage !== undefined ? `${voltage.toFixed(1)}V` : ""}
            {voltage !== undefined && soc !== undefined ? "  " : ""}
            {soc !== undefined ? `${soc.toFixed(0)}% SoC` : ""}
          </Text>
        )}
      </View>
      <View style={styles.resultRight}>
        <Text style={styles.resultMs}>{device.responseMs}ms</Text>
        <View style={styles.connectChip}>
          <Text style={styles.connectChipText}>Connect</Text>
        </View>
      </View>
    </Pressable>
  );
}

function BLEResultItem({
  device,
  onConnect,
}: {
  device: BLEDevice;
  onConnect: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.resultItem,
        pressed && { opacity: 0.75 },
      ]}
      onPress={onConnect}
    >
      <View style={[styles.resultIcon, { backgroundColor: Colors.dark.info + "18" }]}>
        <Ionicons name="bluetooth" size={20} color={Colors.dark.info} />
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName}>{device.name}</Text>
        {device.isBMS && (
          <View style={styles.bmsBadge}>
            <Text style={styles.bmsBadgeText}>JBD BMS</Text>
          </View>
        )}
      </View>
      <View style={styles.connectChip}>
        <Text style={styles.connectChipText}>Connect</Text>
      </View>
    </Pressable>
  );
}

export function ScanModal({
  visible,
  onClose,
  onSelectWifi,
  onSelectBLE,
}: ScanModalProps) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("wifi");

  const [wifiScanning, setWifiScanning] = useState(false);
  const [wifiFound, setWifiFound] = useState<DiscoveredDevice[]>([]);
  const [wifiScanned, setWifiScanned] = useState(0);
  const [wifiTotal, setWifiTotal] = useState(0);
  const [wifiDone, setWifiDone] = useState(false);

  const [bleScanning, setBleScanning] = useState(false);
  const [bleFound, setBleFound] = useState<BLEDevice[]>([]);
  const [bleError, setBleError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const resetState = useCallback(() => {
    setWifiScanning(false);
    setWifiFound([]);
    setWifiScanned(0);
    setWifiTotal(0);
    setWifiDone(false);
    setBleScanning(false);
    setBleFound([]);
    setBleError(null);
  }, []);

  useEffect(() => {
    if (!visible) {
      abortRef.current?.abort();
      resetState();
    }
  }, [visible, resetState]);

  const startWifiScan = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setWifiScanning(true);
    setWifiFound([]);
    setWifiScanned(0);
    setWifiDone(false);

    try {
      const results = await scanWifiNetwork(
        (found, scanned, total) => {
          setWifiFound([...found]);
          setWifiScanned(scanned);
          setWifiTotal(total);
        },
        abortRef.current.signal
      );
      setWifiFound(results);
    } catch {
      // aborted or error
    } finally {
      setWifiScanning(false);
      setWifiDone(true);
    }
  }, []);

  const startBleScan = useCallback(async () => {
    setBleError(null);
    setBleScanning(true);
    try {
      if (!isBleSupported()) {
        setBleError("not_supported");
        return;
      }
      const device = await scanBLE();
      if (device) {
        setBleFound((prev) => {
          if (prev.find((d) => d.id === device.id)) return prev;
          return [...prev, device];
        });
      }
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("cancelled") || msg.includes("chosen")) {
        // user cancelled picker — not an error
      } else if (msg === "ble_not_supported") {
        setBleError("not_supported");
      } else {
        setBleError(msg);
      }
    } finally {
      setBleScanning(false);
    }
  }, []);

  const handleSelectWifi = (device: DiscoveredDevice) => {
    onSelectWifi(device.host, device.name);
    onClose();
  };

  const handleSelectBLE = (device: BLEDevice) => {
    onSelectBLE?.(device);
    onClose();
  };

  const bleSupported = isBleSupported();

  const wifiProgress =
    wifiTotal > 0 ? Math.min((wifiScanned / wifiTotal) * 100, 100) : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: Colors.dark.background,
            paddingTop: Platform.OS === "ios" ? insets.top + 8 : 16,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t("scanDevices")}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.dark.textSecondary} />
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tab, tab === "wifi" && styles.tabActive]}
            onPress={() => setTab("wifi")}
          >
            <Ionicons
              name="wifi"
              size={16}
              color={tab === "wifi" ? Colors.dark.tint : Colors.dark.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                tab === "wifi" && styles.tabTextActive,
              ]}
            >
              {t("wifi")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === "ble" && styles.tabActive]}
            onPress={() => setTab("ble")}
          >
            <Ionicons
              name="bluetooth"
              size={16}
              color={tab === "ble" ? Colors.dark.info : Colors.dark.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                tab === "ble" && { color: Colors.dark.info },
              ]}
            >
              {t("bluetooth")}
            </Text>
          </Pressable>
        </View>

        {/* WiFi Tab */}
        {tab === "wifi" && (
          <View style={styles.tabContent}>
            {!wifiScanning && wifiFound.length === 0 && !wifiDone && (
              <View style={styles.idleState}>
                <ScannerIcon scanning={false} color={Colors.dark.tint} />
                <Text style={styles.idleTitle}>{t("scanWifi")}</Text>
                <Text style={styles.idleSubtitle}>{t("scanWifiDesc")}</Text>
              </View>
            )}

            {wifiScanning && (
              <View style={styles.scanningState}>
                <ScannerIcon scanning color={Colors.dark.tint} />
                <Text style={styles.scanningTitle}>{t("scanning")}</Text>
                <Text style={styles.scanningSubtitle}>
                  {wifiScanned}/{wifiTotal} IP
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${wifiProgress}%` as any },
                    ]}
                  />
                </View>
                {wifiFound.length > 0 && (
                  <Text style={styles.foundCount}>
                    {t("found")}: {wifiFound.length}
                  </Text>
                )}
              </View>
            )}

            {wifiFound.length > 0 && (
              <FlatList
                data={wifiFound}
                keyExtractor={(d) => d.host}
                renderItem={({ item }) => (
                  <WifiResultItem
                    device={item}
                    onConnect={() => handleSelectWifi(item)}
                  />
                )}
                contentContainerStyle={styles.resultList}
                style={styles.resultsFlatList}
                scrollEnabled={wifiFound.length > 3}
              />
            )}

            {wifiDone && wifiFound.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons
                  name="search-outline"
                  size={36}
                  color={Colors.dark.textMuted}
                />
                <Text style={styles.emptyTitle}>{t("noDevicesFound")}</Text>
                <Text style={styles.emptySubtitle}>{t("scanWifiHint")}</Text>
              </View>
            )}

            <Pressable
              style={[
                styles.scanButton,
                wifiScanning && styles.scanButtonDisabled,
              ]}
              onPress={wifiScanning ? undefined : startWifiScan}
              disabled={wifiScanning}
            >
              {wifiScanning ? (
                <>
                  <ActivityIndicator size="small" color="#000" />
                  <Text style={styles.scanButtonText}>{t("scanning")}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="search" size={16} color="#000" />
                  <Text style={styles.scanButtonText}>
                    {wifiDone ? t("scanAgain") : t("startScan")}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* BLE Tab */}
        {tab === "ble" && (
          <View style={styles.tabContent}>
            {!bleSupported && Platform.OS !== "web" ? (
              <View style={styles.bleUnsupportedBox}>
                <View style={styles.bleUnsupportedIcon}>
                  <Ionicons
                    name="bluetooth"
                    size={36}
                    color={Colors.dark.textMuted}
                  />
                </View>
                <Text style={styles.bleUnsupportedTitle}>
                  {t("bleRequiresNative")}
                </Text>
                <Text style={styles.bleUnsupportedDesc}>
                  {t("bleRequiresNativeDesc")}
                </Text>
                <View style={styles.bleInfoCard}>
                  <Ionicons
                    name="information-circle"
                    size={16}
                    color={Colors.dark.accent}
                  />
                  <Text style={styles.bleInfoCardText}>
                    {t("jbdBleInfo")}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                {bleFound.length === 0 && !bleScanning && !bleError && (
                  <View style={styles.idleState}>
                    <ScannerIcon scanning={false} color={Colors.dark.info} />
                    <Text style={styles.idleTitle}>{t("scanBle")}</Text>
                    <Text style={styles.idleSubtitle}>
                      {t("scanBleDesc")}
                    </Text>
                  </View>
                )}

                {bleScanning && (
                  <View style={styles.scanningState}>
                    <ScannerIcon scanning color={Colors.dark.info} />
                    <Text style={[styles.scanningTitle, { color: Colors.dark.info }]}>
                      {t("scanning")}
                    </Text>
                    <Text style={styles.scanningSubtitle}>
                      {t("blePickerHint")}
                    </Text>
                  </View>
                )}

                {bleError && bleError !== "not_supported" && (
                  <View style={styles.bleErrorBox}>
                    <Ionicons
                      name="alert-circle"
                      size={16}
                      color={Colors.dark.danger}
                    />
                    <Text style={styles.bleErrorText}>{bleError}</Text>
                  </View>
                )}

                {bleFound.length > 0 && (
                  <FlatList
                    data={bleFound}
                    keyExtractor={(d) => d.id}
                    renderItem={({ item }) => (
                      <BLEResultItem
                        device={item}
                        onConnect={() => handleSelectBLE(item)}
                      />
                    )}
                    contentContainerStyle={styles.resultList}
                    style={styles.resultsFlatList}
                    scrollEnabled={bleFound.length > 3}
                  />
                )}

                <Pressable
                  style={[
                    styles.scanButton,
                    { backgroundColor: Colors.dark.info },
                    bleScanning && styles.scanButtonDisabled,
                  ]}
                  onPress={bleScanning ? undefined : startBleScan}
                  disabled={bleScanning}
                >
                  {bleScanning ? (
                    <>
                      <ActivityIndicator size="small" color="#000" />
                      <Text style={styles.scanButtonText}>{t("scanning")}</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="bluetooth" size={16} color="#000" />
                      <Text style={styles.scanButtonText}>
                        {bleFound.length > 0 ? t("scanAgain") : t("startScan")}
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>
        )}

        <View
          style={{
            height: Platform.OS === "ios" ? Math.max(insets.bottom, 16) : 16,
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.border,
    marginBottom: 12,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "700" as const,
  },
  closeBtn: {
    position: "absolute",
    right: 20,
    top: 16,
    padding: 4,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: Colors.dark.surfaceElevated,
  },
  tabText: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    fontWeight: "600" as const,
  },
  tabTextActive: {
    color: Colors.dark.tint,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  idleState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 80,
  },
  idleTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "700" as const,
    marginTop: 8,
  },
  idleSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },
  scanningState: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 6,
  },
  scanningTitle: {
    color: Colors.dark.tint,
    fontSize: 16,
    fontWeight: "700" as const,
    marginTop: 6,
  },
  scanningSubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    fontWeight: "500" as const,
    fontVariant: ["tabular-nums"] as any,
  },
  progressBar: {
    width: "80%",
    height: 3,
    backgroundColor: Colors.dark.border,
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    backgroundColor: Colors.dark.tint,
    borderRadius: 2,
  },
  foundCount: {
    color: Colors.dark.tint,
    fontSize: 12,
    fontWeight: "600" as const,
    marginTop: 4,
  },
  resultsFlatList: { flex: 1, marginTop: 8 },
  resultList: { gap: 8, paddingBottom: 8 },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.dark.tint + "18",
    justifyContent: "center",
    alignItems: "center",
  },
  resultInfo: { flex: 1, gap: 2 },
  resultName: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "600" as const,
  },
  resultHost: {
    color: Colors.dark.tint,
    fontSize: 12,
    fontWeight: "400" as const,
    fontVariant: ["tabular-nums"] as any,
  },
  resultMeta: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontWeight: "400" as const,
    marginTop: 2,
  },
  resultRight: { alignItems: "flex-end", gap: 4 },
  resultMs: {
    color: Colors.dark.textMuted,
    fontSize: 10,
    fontWeight: "500" as const,
    fontVariant: ["tabular-nums"] as any,
  },
  connectChip: {
    backgroundColor: Colors.dark.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  connectChipText: {
    color: "#000",
    fontSize: 11,
    fontWeight: "700" as const,
  },
  bmsBadge: {
    backgroundColor: Colors.dark.success + "20",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  bmsBadgeText: {
    color: Colors.dark.success,
    fontSize: 10,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 60,
  },
  emptyTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: "600" as const,
    marginTop: 8,
  },
  emptySubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 18,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.dark.tint,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 12,
  },
  scanButtonDisabled: { opacity: 0.5 },
  scanButtonText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "700" as const,
  },

  bleUnsupportedBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingBottom: 80,
    paddingHorizontal: 8,
  },
  bleUnsupportedIcon: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: Colors.dark.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  bleUnsupportedTitle: {
    color: Colors.dark.text,
    fontSize: 17,
    fontWeight: "700" as const,
    textAlign: "center",
  },
  bleUnsupportedDesc: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 280,
  },
  bleInfoCard: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: Colors.dark.accent + "12",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    alignItems: "flex-start",
  },
  bleInfoCardText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  bleErrorBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: Colors.dark.danger + "15",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  bleErrorText: {
    color: Colors.dark.danger,
    fontSize: 13,
    flex: 1,
  },
  scannerContainer: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
  },
});
