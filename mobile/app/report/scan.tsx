import React, { useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useReport } from "../../lib/context";
import { Colors } from "../../lib/colors";
import { SectionCard } from "../../components/SectionCard";
import { RiskMeter } from "../../components/RiskMeter";
import { EquityBadge } from "../../components/EquityBadge";
import { Disclaimer } from "../../components/Disclaimer";
import { analyzeSelfie, analyzeSkin } from "../../lib/api";

export default function ScanTab() {
  const { report } = useReport();
  const [selfieResult, setSelfieResult] = useState<any>(null);
  const [skinResult, setSkinResult] = useState<any>(null);
  const [loading, setLoading] = useState<"selfie" | "skin" | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [skinImage, setSkinImage] = useState<string | null>(null);

  if (!report) return null;
  const sessionId = report.parse.session_id;

  async function pickAndAnalyze(type: "selfie" | "skin") {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
    setLoading(type);

    try {
      if (type === "selfie") {
        setSelfieImage(uri);
        const res = await analyzeSelfie(sessionId, uri);
        setSelfieResult(res);
      } else {
        setSkinImage(uri);
        const res = await analyzeSkin(sessionId, uri);
        setSkinResult(res);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>CV Scan</Text>
        <Text style={styles.subheading}>Computer vision + genetic fusion</Text>

        {/* Selfie Section */}
        <SectionCard
          title="Selfie Phenotype Check"
          subtitle="Compare your DNA prediction to your actual appearance"
        >
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => pickAndAnalyze("selfie")}
            disabled={loading !== null}
          >
            <Text style={styles.scanButtonText}>
              {selfieResult ? "Retake Selfie" : "Take Selfie"}
            </Text>
          </TouchableOpacity>

          {loading === "selfie" && (
            <ActivityIndicator style={styles.loader} color={Colors.primary} />
          )}

          {selfieResult && (
            <View style={styles.resultBlock}>
              {selfieImage && (
                <Image source={{ uri: selfieImage }} style={styles.previewImage} />
              )}
              <Text style={styles.resultTitle}>Genetic Prediction</Text>
              <View style={styles.predictionRow}>
                <PredictionItem label="Eye Color" value={selfieResult.genetic_prediction.eye_color} />
                <PredictionItem label="Hair Color" value={selfieResult.genetic_prediction.hair_color} />
                <PredictionItem label="Skin Tone" value={selfieResult.genetic_prediction.skin_tone} />
              </View>

              {selfieResult.confidence_pct !== null && (
                <Text style={styles.matchText}>
                  Match confidence: {selfieResult.confidence_pct}%
                </Text>
              )}

              {selfieResult.equity_note && (
                <View style={{ marginTop: 8 }}>
                  <EquityBadge ancestry="Non-European" />
                  <Text style={styles.equityNote}>{selfieResult.equity_note}</Text>
                </View>
              )}
            </View>
          )}
        </SectionCard>

        {/* Skin Scan Section */}
        <SectionCard
          title="Skin Lesion Scanner"
          subtitle="AI classification + MC1R genetic risk fusion"
          disclaimer="Not a dermatological assessment. Consult a clinician for any skin concern."
        >
          <TouchableOpacity
            style={[styles.scanButton, { backgroundColor: Colors.pink }]}
            onPress={() => pickAndAnalyze("skin")}
            disabled={loading !== null}
          >
            <Text style={styles.scanButtonText}>
              {skinResult ? "Scan Another" : "Photograph a Mole"}
            </Text>
          </TouchableOpacity>

          {loading === "skin" && (
            <ActivityIndicator style={styles.loader} color={Colors.pink} />
          )}

          {skinResult && (
            <View style={styles.resultBlock}>
              {skinImage && (
                <Image source={{ uri: skinImage }} style={styles.previewImage} />
              )}
              <View style={styles.fusedRow}>
                <RiskMeter
                  value={skinResult.fused_risk_pct}
                  label="fused risk"
                  color={skinResult.color}
                  size={100}
                />
                <View style={styles.fusedInfo}>
                  <Text style={[styles.urgencyLabel, { color: skinResult.color }]}>
                    {skinResult.urgency_label}
                  </Text>
                  {skinResult.mc1r_variant_detected && (
                    <Text style={styles.mc1rNote}>
                      MC1R variant detected — {skinResult.genetic_multiplier}x risk multiplier applied
                    </Text>
                  )}
                </View>
              </View>

              <Text style={styles.resultTitle}>Classification</Text>
              {skinResult.classifications.slice(0, 4).map((c: any) => (
                <View key={c.class} style={styles.classRow}>
                  <Text style={styles.className}>{c.label}</Text>
                  <View style={styles.barBg}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${c.probability_pct}%`,
                          backgroundColor:
                            c.class === "MEL" ? Colors.danger : Colors.primary,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.classPct}>{c.probability_pct}%</Text>
                </View>
              ))}
            </View>
          )}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function PredictionItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.predItem}>
      <Text style={styles.predLabel}>{label}</Text>
      <Text style={styles.predValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 18, paddingBottom: 32 },
  heading: { fontSize: 24, fontWeight: "800", color: Colors.textPrimary },
  subheading: { fontSize: 14, color: Colors.textSecondary, marginTop: 2, marginBottom: 16 },
  scanButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  scanButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  loader: { marginTop: 16 },
  resultBlock: { marginTop: 16 },
  previewImage: { width: "100%", height: 180, borderRadius: 12, marginBottom: 12 },
  resultTitle: { fontSize: 15, fontWeight: "700", color: Colors.textPrimary, marginBottom: 8 },
  predictionRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  predItem: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  predLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: "600" },
  predValue: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary, marginTop: 3 },
  matchText: { fontSize: 14, fontWeight: "600", color: Colors.primary },
  equityNote: { fontSize: 12, color: Colors.textSecondary, marginTop: 6, lineHeight: 17 },
  fusedRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  fusedInfo: { flex: 1 },
  urgencyLabel: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  mc1rNote: { fontSize: 12, color: Colors.warning, fontWeight: "500" },
  classRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  className: { fontSize: 11, color: Colors.textSecondary, width: 110 },
  barBg: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 4 },
  classPct: { fontSize: 11, fontWeight: "600", color: Colors.textPrimary, width: 36, textAlign: "right" },
});
