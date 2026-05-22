import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
  Linking,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/lib/i18n";
import Colors from "@/constants/colors";

const VERSION = "1.0.0";
const GITHUB_URL = "https://github.com/Drovosek82/Replit-bms";

interface FeatureRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  desc: string;
}

function FeatureRow({ icon, color, title, desc }: FeatureRowProps) {
  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIcon, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const { lang } = useI18n();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const uk = lang === "uk";

  const features: FeatureRowProps[] = [
    {
      icon: "battery-charging",
      color: Colors.dark.success,
      title: uk ? "Реальні дані з BMS" : "Real BMS Data",
      desc: uk
        ? "Напруга, струм, заряд, температура та захисти в реальному часі"
        : "Voltage, current, SOC, temperature and protections in real time",
    },
    {
      icon: "grid",
      color: Colors.dark.tint,
      title: uk ? "Моніторинг комірок" : "Cell Monitoring",
      desc: uk
        ? "Напруга кожної комірки з візуальним балансом — бачите слабку комірку одразу"
        : "Per-cell voltage with visual balance indicator",
    },
    {
      icon: "analytics",
      color: Colors.dark.accent,
      title: uk ? "Графіки та історія" : "Charts & History",
      desc: uk
        ? "Графіки за 1г / 24г / 7д / 30д з хмарного сховища Supabase"
        : "Charts for 1h / 24h / 7d / 30d from Supabase cloud storage",
    },
    {
      icon: "cloud",
      color: Colors.dark.accentWarm,
      title: uk ? "Cloud Relay" : "Cloud Relay",
      desc: uk
        ? "ESP32 надсилає дані на сервер — слідкуйте за батареєю з будь-якого місця"
        : "ESP32 pushes data to server — monitor your battery from anywhere",
    },
    {
      icon: "wifi",
      color: Colors.dark.info,
      title: uk ? "WiFi Direct" : "WiFi Direct",
      desc: uk
        ? "Пряме підключення до ESP32 через локальну мережу без інтернету"
        : "Direct connection to ESP32 over local network without internet",
    },
    {
      icon: "code-slash",
      color: Colors.dark.textSecondary,
      title: uk ? "Готовий Arduino скетч" : "Ready Arduino Sketch",
      desc: uk
        ? "Повний код для ESP32 з JBD BMS UART протоколом — копіюй і прошивай"
        : "Full ESP32 code for JBD BMS UART protocol — copy and flash",
    },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.dark.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + webTopInset + 12 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.appIconWrap}>
          <Ionicons name="battery-charging" size={40} color={Colors.dark.tint} />
        </View>
        <Text style={styles.appName}>BMS Monitor</Text>
        <Text style={styles.appTagline}>
          {uk
            ? "Контролюйте свою батарею звідусіль"
            : "Monitor your battery from anywhere"}
        </Text>
        <View style={styles.versionBadge}>
          <Text style={styles.versionText}>v{VERSION}</Text>
        </View>
      </View>

      {/* Description */}
      <View style={styles.card}>
        <Text style={styles.cardText}>
          {uk
            ? "BMS Monitor — додаток для власників LiFePO₄ та Li-Ion акумуляторних зборок з JBD BMS контролером. Підключіть ESP32 до BMS по UART, і дані з'являться на вашому телефоні в реальному часі — де б ви не знаходились."
            : "BMS Monitor is an app for LiFePO₄ and Li-Ion battery pack owners using a JBD BMS controller. Connect an ESP32 to the BMS via UART and data appears on your phone in real time — wherever you are."}
        </Text>
      </View>

      {/* Features */}
      <Text style={styles.sectionTitle}>
        {uk ? "Можливості" : "Features"}
      </Text>
      <View style={styles.card}>
        {features.map((f, i) => (
          <React.Fragment key={f.title}>
            <FeatureRow {...f} />
            {i < features.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </View>

      {/* How it works */}
      <Text style={styles.sectionTitle}>
        {uk ? "Як це працює" : "How it works"}
      </Text>
      <View style={styles.card}>
        {[
          {
            step: "1",
            color: Colors.dark.tint,
            text: uk
              ? "ESP32 підключається до JBD BMS по UART (9600 бод) та зчитує дані кожні 5 секунд"
              : "ESP32 connects to JBD BMS via UART (9600 baud) and reads data every 5 seconds",
          },
          {
            step: "2",
            color: Colors.dark.accent,
            text: uk
              ? "Дані надсилаються на хмарний сервер або прямо на телефон через WiFi"
              : "Data is sent to the cloud server or directly to the phone via WiFi",
          },
          {
            step: "3",
            color: Colors.dark.success,
            text: uk
              ? "Dodatok отримує дані, будує графіки та зберігає historію в Supabase"
              : "The app receives data, builds charts and saves history to Supabase",
          },
        ].map((s) => (
          <View key={s.step} style={styles.stepRow}>
            <View style={[styles.stepNum, { backgroundColor: s.color + "22" }]}>
              <Text style={[styles.stepNumText, { color: s.color }]}>{s.step}</Text>
            </View>
            <Text style={styles.stepText}>{s.text}</Text>
          </View>
        ))}
      </View>

      {/* Supported hardware */}
      <Text style={styles.sectionTitle}>
        {uk ? "Підтримуване залізо" : "Supported Hardware"}
      </Text>
      <View style={styles.card}>
        {[
          { label: "BMS", value: "JBD / Jiabaida (будь-яка модель)" },
          { label: "MCU", value: "ESP32 (будь-яка плата)" },
          { label: "Хімія", value: "LiFePO₄, Li-Ion, LiPo" },
          { label: "Комірки", value: "до 32 послідовних" },
        ].map((r) => (
          <View key={r.label} style={styles.hwRow}>
            <Text style={styles.hwLabel}>{r.label}</Text>
            <Text style={styles.hwValue}>{r.value}</Text>
          </View>
        ))}
      </View>

      {/* GitHub */}
      <Pressable
        style={({ pressed }) => [styles.githubBtn, pressed && { opacity: 0.7 }]}
        onPress={() => Linking.openURL(GITHUB_URL)}
      >
        <Ionicons name="logo-github" size={20} color={Colors.dark.text} />
        <Text style={styles.githubText}>GitHub</Text>
        <Ionicons name="open-outline" size={14} color={Colors.dark.textMuted} />
      </Pressable>

      <Text style={styles.footer}>
        {uk ? "Зроблено з ❤️ для DIY-спільноти" : "Made with ❤️ for the DIY community"}
      </Text>

      <View style={{ height: Platform.OS === "web" ? 34 : 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16 },

  hero: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  appIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: Colors.dark.tint + "18",
    borderWidth: 1,
    borderColor: Colors.dark.tint + "30",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  appName: {
    color: Colors.dark.text,
    fontSize: 28,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
  },
  appTagline: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    textAlign: "center",
  },
  versionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.dark.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  versionText: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    fontWeight: "600" as const,
  },

  sectionTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: "600" as const,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 16,
    gap: 12,
  },
  cardText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },

  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  featureText: { flex: 1, gap: 2 },
  featureTitle: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: "600" as const,
  },
  featureDesc: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: 2,
  },

  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  stepNumText: {
    fontSize: 14,
    fontWeight: "700" as const,
  },
  stepText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
    paddingTop: 4,
  },

  hwRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hwLabel: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    fontWeight: "500" as const,
  },
  hwValue: {
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: "500" as const,
  },

  githubBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    paddingVertical: 14,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  githubText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "600" as const,
  },

  footer: {
    textAlign: "center",
    color: Colors.dark.textMuted,
    fontSize: 12,
    marginTop: 16,
  },
});
