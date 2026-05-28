import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  SafeAreaView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useFonts } from "expo-font";
import {
  PlayfairDisplay_700Bold,
} from "@expo-google-fonts/playfair-display";
import {
  InriaSerif_400Regular,
} from "@expo-google-fonts/inria-serif";

import { useApp } from "./lib/AppContext";
import { RiskMeter } from "./components/RiskMeter";
import { EquityBadge } from "./components/EquityBadge";
import { analyzeSelfie, analyzeSkin, getScans } from "./lib/api";
import { ScanResult } from "./lib/types";
import BottomNav, { TabKey } from "./BottomNav";

interface Props {
  onTabPress: (tab: TabKey) => void;
  onNewUpload?: () => void;
  onScanMedicine?: () => void;
}

const C = {
  bg:         "#F7F6F2",
  surface:    "#FFFFFF",
  primary:    "#1A1B14",
  secondary:  "#686760",
  green:      "#44A353",
  olive:      "#363E28",
  purple:     "#9966FE",
  orange:     "#F5A62B",
  border:     "#E5E2DB",
  lightGreen: "#EEF2EA",
  muted:      "#A6A59F",
};

export default function ScanScreen({ onTabPress, onNewUpload, onScanMedicine }: Props) {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    InriaSerif_400Regular,
  });
  const playfair = fontsLoaded ? "PlayfairDisplay_700Bold" : undefined;
  const serif    = fontsLoaded ? "InriaSerif_400Regular"   : undefined;

  const { sessionId } = useApp();
  const [selfieResult, setSelfieResult] = useState<any>(null);
  const [skinResult,   setSkinResult]   = useState<any>(null);
  const [loading,      setLoading]      = useState<"selfie" | "skin" | null>(null);
  const [selfieImage,  setSelfieImage]  = useState<string | null>(null);
  const [skinImage,    setSkinImage]    = useState<string | null>(null);
  const [history,      setHistory]      = useState<ScanResult[]>([]);

  const fetchHistory = async () => {
    if (!sessionId) return;
    try {
      const scans = await getScans(sessionId);
      setHistory(scans);
    } catch {}
  };

  useEffect(() => { fetchHistory(); }, [sessionId]);

  async function pickAndAnalyze(type: "selfie" | "skin") {
    if (!sessionId) {
      Alert.alert("No session", "Upload a DNA report first.");
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/png", "image/jpg"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;

    const uri     = result.assets[0].uri;
    const webFile = (result.assets[0] as any).file;
    setLoading(type);

    try {
      if (type === "selfie") {
        setSelfieImage(uri);
        setSelfieResult(await analyzeSelfie(sessionId, uri, webFile));
      } else {
        setSkinImage(uri);
        setSkinResult(await analyzeSkin(sessionId, uri, webFile));
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Analysis failed.");
    } finally {
      setLoading(null);
      fetchHistory();
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* ── Header ── */}
        <Text style={[s.title, { fontFamily: playfair }]}>Scan</Text>
        <Text style={[s.subtitle, { fontFamily: serif }]}>Choose a scan mode</Text>

        {/* ── Scan Medicine ── */}
        <TouchableOpacity
          style={s.medicineCard}
          activeOpacity={0.8}
          onPress={() => onScanMedicine?.()}
        >
          <View style={s.accentBar} />
          <View style={[s.iconCircle, { backgroundColor: "#F5F0E8" }]}>
            <Text style={s.emoji}>💊</Text>
          </View>
          <View style={s.cardBody}>
            <View style={s.titleRow}>
              <Text style={[s.cardTitle, { fontWeight: "600" }]}>Scan Medicine</Text>
              <Badge label="NEW" color={C.green} />
            </View>
            <Text style={[s.cardDesc, { fontFamily: serif }]}>
              Scan a drug barcode to check for gene interactions and safety warnings
            </Text>
            <Text style={[s.cardCta, { fontFamily: serif }]}>
              Tap to scan a medicine barcode →
            </Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </TouchableOpacity>

        <View style={s.divider} />

        {/* ── Scan Skin ── */}
        <TouchableOpacity
          style={[s.card, { marginTop: 8 }]}
          activeOpacity={0.8}
          onPress={() => pickAndAnalyze("skin")}
          disabled={loading !== null}
        >
          <View style={[s.iconCircle, { backgroundColor: "#F0EEFF" }]}>
            <Text style={s.emoji}>🔬</Text>
          </View>
          <View style={s.cardBody}>
            <View style={s.titleRow}>
              <Text style={[s.cardTitle, { fontWeight: "600" }]}>Scan Skin</Text>
              <Badge label="BETA" color={C.purple} />
            </View>
            <Text style={[s.cardDesc, { fontFamily: serif }]}>
              Scan skin for lesion analysis with MC1R genetic risk fusion
            </Text>
          </View>
          {loading === "skin"
            ? <ActivityIndicator color={C.purple} size="small" />
            : <Text style={s.chevron}>›</Text>
          }
        </TouchableOpacity>

        {/* ── Scan Face ── */}
        <TouchableOpacity
          style={[s.card, { marginTop: 8 }]}
          activeOpacity={0.8}
          onPress={() => pickAndAnalyze("selfie")}
          disabled={loading !== null}
        >
          <View style={[s.iconCircle, { backgroundColor: "#EAF0FB" }]}>
            <Text style={s.emoji}>🧬</Text>
          </View>
          <View style={s.cardBody}>
            <View style={s.titleRow}>
              <Text style={[s.cardTitle, { fontWeight: "600" }]}>Scan Face</Text>
            </View>
            <Text style={[s.cardDesc, { fontFamily: serif }]}>
              Upload a selfie to compare DNA-predicted vs. actual phenotype
            </Text>
          </View>
          {loading === "selfie"
            ? <ActivityIndicator color={C.olive} size="small" />
            : <Text style={s.chevron}>›</Text>
          }
        </TouchableOpacity>

        {/* ── Skin result ── */}
        {skinResult && (
          <View style={[s.resultCard]}>
            <View style={s.resultHeader}>
              <Text style={[s.cardTitle, { fontWeight: "600" }]}>Skin Scan Result</Text>
              <Text style={{ fontSize: 11, color: skinResult.color, fontWeight: "700" }}>
                {skinResult.urgency_label}
              </Text>
            </View>
            {skinImage && (
              <Image source={{ uri: skinImage }} style={s.preview} />
            )}
            <View style={s.fusedRow}>
              <RiskMeter
                value={skinResult.fused_risk_pct}
                label="fused risk"
                color={skinResult.color}
                size={88}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                {skinResult.mc1r_variant_detected && (
                  <Text style={{ fontSize: 11, color: C.orange, marginBottom: 4 }}>
                    MC1R variant · {skinResult.genetic_multiplier}× multiplier applied
                  </Text>
                )}
                <Text style={{ fontSize: 10, color: C.secondary, lineHeight: 14 }}>
                  Not a dermatological assessment. Consult a clinician for any skin concern.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Selfie result ── */}
        {selfieResult && (
          <View style={[s.resultCard]}>
            <Text style={[s.cardTitle, { fontWeight: "600", marginBottom: 10 }]}>
              Selfie Phenotype
            </Text>
            {selfieImage && (
              <Image source={{ uri: selfieImage }} style={s.preview} />
            )}
            <View style={s.predRow}>
              {[
                { label: "Eye",  value: selfieResult.genetic_prediction?.eye_color  },
                { label: "Hair", value: selfieResult.genetic_prediction?.hair_color },
                { label: "Skin", value: selfieResult.genetic_prediction?.skin_tone  },
              ].map(p => (
                <View key={p.label} style={s.predItem}>
                  <Text style={{ fontSize: 9, color: C.secondary }}>{p.label}</Text>
                  <Text style={{ fontSize: 12, color: C.primary, marginTop: 2 }}>{p.value}</Text>
                </View>
              ))}
            </View>
            {selfieResult.equity_note && (
              <>
                <EquityBadge ancestryCode={0} ancestryLabel="Non-European" />
                <Text style={{ fontSize: 11, color: C.secondary, marginTop: 6, lineHeight: 16 }}>
                  {selfieResult.equity_note}
                </Text>
              </>
            )}
          </View>
        )}

        {/* ── Recent Scans ── */}
        {history.length > 0 && (
          <>
            <Text style={[s.sectionLabel, { fontFamily: serif }]}>Recent Scans</Text>
            {history.slice(0, 5).map(scan => {
              const urgency = scan.urgency ?? "Low";
              const dotColor =
                urgency === "Urgent" || urgency === "High" ? "#E53E3E"
                : urgency === "Moderate" ? C.orange
                : C.green;
              const badgeLabel =
                urgency === "Urgent" || urgency === "High" ? "URGENT"
                : urgency === "Moderate" ? "WATCH"
                : "CLEAR";
              const label = scan.scan_type === "skin" ? "Skin Lesion Scan" : "Selfie Phenotype";
              const ts    = new Date(scan.created_at).toLocaleDateString();
              return (
                <View key={scan.id} style={s.recentRow}>
                  <View style={[s.recentDot, { backgroundColor: dotColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: C.primary }}>{label}</Text>
                    <Text style={{ fontSize: 9, color: C.secondary, marginTop: 2 }}>{ts}</Text>
                  </View>
                  <Badge label={badgeLabel} color={dotColor} />
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <BottomNav activeTab="scan" onTabPress={onTabPress} />
    </SafeAreaView>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.badge, { backgroundColor: color }]}>
      <Text style={s.badgeText}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  scroll:  { paddingHorizontal: 20, paddingTop: 70, paddingBottom: 20 },
  title:   { fontSize: 28, color: C.olive, fontWeight: "bold" },
  subtitle:{ fontSize: 13, color: C.secondary, marginTop: 4, marginBottom: 18 },

  // Medicine card (featured — has accent bar + CTA)
  medicineCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.09,
    shadowRadius: 16,
    elevation: 3,
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: C.olive,
  },

  // Standard card
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
    marginRight: 12,
  },
  emoji:    { fontSize: 22 },
  cardBody: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle:{ fontSize: 15, color: C.primary },
  cardDesc: { fontSize: 10, color: C.secondary, lineHeight: 14 },
  cardCta:  { fontSize: 10, color: C.green, marginTop: 5 },
  chevron:  { fontSize: 20, color: C.muted, marginLeft: 8 },

  divider: {
    height: 1,
    backgroundColor: C.lightGreen,
    marginTop: 0,
    marginBottom: 0,
  },

  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  badgeText: { fontSize: 8, color: "#FFF", fontWeight: "700" },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: C.secondary,
    marginTop: 28,
    marginBottom: 8,
  },
  recentRow: {
    backgroundColor: C.surface,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  recentDot: { width: 12, height: 12, borderRadius: 3, marginRight: 12 },

  resultCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  preview:  { width: "100%", height: 160, borderRadius: 10, marginBottom: 12 },
  fusedRow: { flexDirection: "row", alignItems: "center" },
  predRow:  { flexDirection: "row", gap: 8, marginTop: 4 },
  predItem: {
    flex: 1,
    backgroundColor: "#EEF2E9",
    borderRadius: 8,
    padding: 8,
    alignItems: "center",
  },
});
