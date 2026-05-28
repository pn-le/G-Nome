import React, { useState, useEffect } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Alert,
  SafeAreaView
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useFonts } from 'expo-font';
import { InriaSerif_400Regular, InriaSerif_700Bold } from '@expo-google-fonts/inria-serif';

import { useApp } from "./lib/AppContext";
import { Colors } from "./lib/colors";
import { SectionCard } from "./components/SectionCard";
import { RiskMeter } from "./components/RiskMeter";
import { EquityBadge } from "./components/EquityBadge";
import { Disclaimer } from "./components/Disclaimer";
import { analyzeSelfie, analyzeSkin, getScans } from "./lib/api";
import { ScanResult } from "./lib/types";
import BottomNav, { TabKey } from './BottomNav';

interface Props {
  onTabPress: (tab: TabKey) => void;
  onNewUpload?: () => void;
}

const C = {
  bg:        '#F7F6F2',
  surface:   '#FFFFFF',
  primary:   '#1A1B14',
  secondary: '#686760',
  green:     '#44A353',
  olive:     '#363E28',
  lightGreen:'#EEF2E9',
  border:    '#E5E2DB',
  lightOlive:'#DAE4CF',
};

export default function ScanScreen({ onTabPress, onNewUpload }: Props) {
  const [fontsLoaded] = useFonts({ InriaSerif_400Regular, InriaSerif_700Bold });
  const serif     = fontsLoaded ? 'InriaSerif_400Regular' : undefined;
  const serifBold = fontsLoaded ? 'InriaSerif_700Bold'    : undefined;

  const { sessionId } = useApp();
  const [selfieResult, setSelfieResult] = useState<any>(null);
  const [skinResult, setSkinResult] = useState<any>(null);
  const [loading, setLoading] = useState<"selfie" | "skin" | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [skinImage, setSkinImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = async () => {
    if (!sessionId) return;
    setLoadingHistory(true);
    try {
      const scans = await getScans(sessionId);
      setHistory(scans);
    } catch (err) {
      console.warn("Failed to fetch scan history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [sessionId]);

  async function pickAndAnalyze(type: "selfie" | "skin") {
    if (!sessionId) {
      setErrorMsg('No active session. Please upload a report first.');
      return;
    }
    setErrorMsg(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/jpg'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
    const webFile = (result.assets[0] as any).file;
    setLoading(type);

    try {
      if (type === "selfie") {
        setSelfieImage(uri);
        const res = await analyzeSelfie(sessionId, uri, webFile);
        setSelfieResult(res);
      } else {
        setSkinImage(uri);
        const res = await analyzeSkin(sessionId, uri, webFile);
        setSkinResult(res);
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.message || "Failed to analyze.");
    } finally {
      setLoading(null);
      fetchHistory(); // Refresh history after scan
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: serifBold }]}>CV Scan</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.subheading, { fontFamily: serif }]}>Computer vision + genetic fusion</Text>

        {errorMsg && <Text style={{color: 'red', textAlign: 'center', marginBottom: 10, fontFamily: serifBold}}>{errorMsg}</Text>}
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
            <Text style={[styles.scanButtonText, { fontFamily: serifBold }]}>
              {selfieResult ? "Upload New Selfie" : "Upload Selfie"}
            </Text>
          </TouchableOpacity>

          {loading === "selfie" && (
            <ActivityIndicator style={styles.loader} color={C.olive} />
          )}

          {selfieResult && (
            <View style={styles.resultBlock}>
              {selfieImage && (
                <Image source={{ uri: selfieImage }} style={styles.previewImage} />
              )}
              <Text style={[styles.resultTitle, { fontFamily: serifBold }]}>Genetic Prediction</Text>
              <View style={styles.predictionRow}>
                <PredictionItem label="Eye Color" value={selfieResult.genetic_prediction.eye_color} />
                <PredictionItem label="Hair Color" value={selfieResult.genetic_prediction.hair_color} />
                <PredictionItem label="Skin Tone" value={selfieResult.genetic_prediction.skin_tone} />
              </View>

              {selfieResult.confidence_pct !== null && (
                <Text style={[styles.matchText, { fontFamily: serifBold }]}>
                  Match confidence: {selfieResult.confidence_pct}%
                </Text>
              )}

              {selfieResult.equity_note && (
                <View style={{ marginTop: 8 }}>
                  <EquityBadge ancestryCode={0} ancestryLabel="Non-European" />
                  <Text style={[styles.equityNote, { fontFamily: serif }]}>{selfieResult.equity_note}</Text>
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
            style={[styles.scanButton, { backgroundColor: '#DB2777' }]}
            onPress={() => pickAndAnalyze("skin")}
            disabled={loading !== null}
          >
            <Text style={[styles.scanButtonText, { fontFamily: serifBold }]}>
              {skinResult ? "Upload Another" : "Upload Mole Image"}
            </Text>
          </TouchableOpacity>

          {loading === "skin" && (
            <ActivityIndicator style={styles.loader} color={'#DB2777'} />
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
                  <Text style={[styles.urgencyLabel, { color: skinResult.color, fontFamily: serifBold }]}>
                    {skinResult.urgency_label}
                  </Text>
                  {skinResult.mc1r_variant_detected && (
                    <Text style={[styles.mc1rNote, { fontFamily: serif }]}>
                      MC1R variant detected — {skinResult.genetic_multiplier}x risk multiplier applied
                    </Text>
                  )}
                </View>
              </View>

              <Text style={[styles.resultTitle, { fontFamily: serifBold }]}>Classification</Text>
              {skinResult.classifications.slice(0, 4).map((c: any) => (
                <View key={c.class} style={styles.classRow}>
                  <Text style={[styles.className, { fontFamily: serif }]}>{c.label}</Text>
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
                  <Text style={[styles.classPct, { fontFamily: serifBold }]}>{c.probability_pct}%</Text>
                </View>
              ))}
            </View>
          )}
        </SectionCard>

        {/* Skin Scan History */}
        {history.filter(s => s.scan_type === 'skin').length > 0 && (
          <SectionCard title="Previous Skin Scans" subtitle="History of your mole / lesion scans">
            {history.filter(s => s.scan_type === 'skin').map(scan => (
              <View key={scan.id} style={styles.historyItem}>
                {scan.image_url ? (
                  <Image source={{ uri: scan.image_url }} style={styles.historyImage} />
                ) : (
                  <View style={styles.historyImagePlaceholder} />
                )}
                <View style={styles.historyContent}>
                  <Text style={[styles.historyType, { fontFamily: serifBold }]}>Skin Lesion</Text>
                  <Text style={[styles.historyDate, { fontFamily: serif }]}>
                    {new Date(scan.created_at).toLocaleDateString()}
                  </Text>
                  <Text style={[styles.historyResult, { fontFamily: serif, color: scan.urgency === 'High' ? '#DB2777' : C.olive }]}>
                    Urgency: {scan.urgency} · Fused: {scan.fused_score?.toFixed(0)}%
                  </Text>
                </View>
              </View>
            ))}
          </SectionCard>
        )}

        {/* Selfie Phenotype History */}
        {history.filter(s => s.scan_type === 'selfie').length > 0 && (
          <SectionCard title="Previous Selfie Scans" subtitle="History of your phenotype checks">
            {history.filter(s => s.scan_type === 'selfie').map(scan => (
              <View key={scan.id} style={styles.historyItem}>
                {scan.image_url ? (
                  <Image source={{ uri: scan.image_url }} style={styles.historyImage} />
                ) : (
                  <View style={styles.historyImagePlaceholder} />
                )}
                <View style={styles.historyContent}>
                  <Text style={[styles.historyType, { fontFamily: serifBold }]}>Selfie Phenotype</Text>
                  <Text style={[styles.historyDate, { fontFamily: serif }]}>
                    {new Date(scan.created_at).toLocaleDateString()}
                  </Text>
                  <Text style={[styles.historyResult, { fontFamily: serif }]}>
                    Concordance: {scan.concordance ?? 'N/A'}
                  </Text>
                </View>
              </View>
            ))}
          </SectionCard>
        )}

        {/* Upload new file section */}
        <SectionCard title="New Report" subtitle="Scan a different DNA kit">
          <TouchableOpacity 
            style={styles.btnSecondary} 
            activeOpacity={0.8}
            onPress={() => onNewUpload && onNewUpload()}
          >
            <Text style={[styles.btnSecondaryText, { fontFamily: serifBold }]}>Upload New DNA File</Text>
          </TouchableOpacity>
        </SectionCard>

      </ScrollView>
      <BottomNav activeTab="scan" onTabPress={onTabPress} />
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
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  title:  { fontSize: 24, color: '#1A1B14' },
  container: { padding: 18, paddingBottom: 100 },
  subheading: { fontSize: 14, color: C.secondary, marginTop: 2, marginBottom: 16 },
  scanButton: {
    backgroundColor: C.olive,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  scanButtonText: { color: "#fff", fontSize: 15 },
  loader: { marginTop: 16 },
  resultBlock: { marginTop: 16 },
  previewImage: { width: "100%", height: 180, borderRadius: 12, marginBottom: 12 },
  resultTitle: { fontSize: 15, color: C.primary, marginBottom: 8 },
  predictionRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  predItem: {
    flex: 1,
    backgroundColor: C.lightGreen,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  predLabel: { fontSize: 10, color: C.secondary },
  predValue: { fontSize: 14, color: C.primary, marginTop: 3 },
  matchText: { fontSize: 14, color: C.olive },
  equityNote: { fontSize: 12, color: C.secondary, marginTop: 6, lineHeight: 17 },
  fusedRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 16 },
  fusedInfo: { flex: 1 },
  urgencyLabel: { fontSize: 16, marginBottom: 4 },
  mc1rNote: { fontSize: 12, color: '#F59E0B' },
  classRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  className: { fontSize: 11, color: C.secondary, width: 110 },
  barBg: {
    flex: 1,
    height: 8,
    backgroundColor: C.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 4 },
  classPct: { fontSize: 11, color: C.primary, width: 36, textAlign: "right" },
  btnSecondary: {
    width: '100%',
    height: 48,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: C.olive,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: { fontSize: 14, color: C.olive },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  historyImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  historyImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: C.border,
  },
  historyContent: {
    flex: 1,
  },
  historyType: {
    fontSize: 15,
    color: C.primary,
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 12,
    color: C.secondary,
    marginBottom: 4,
  },
  historyResult: {
    fontSize: 13,
    color: C.olive,
  },
});
