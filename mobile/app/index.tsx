import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { 
  UploadCloud, 
  Dna, 
  Pill, 
  Activity, 
  Apple, 
  Camera, 
  FileText, 
  ChevronRight,
  ShieldCheck
} from "lucide-react-native";
import { Colors } from "../lib/colors";
import { parseFile, getReport } from "../lib/api";
import { useReport } from "../lib/context";
import { Disclaimer } from "../components/Disclaimer";
import { supabase } from "../lib/supabase";

type Stage = "idle" | "parsing" | "analyzing" | "done" | "error";

interface ReportRecord {
  id: string;
  created_at: string;
  session_id: string;
  file_name: string;
  report_data: any;
}

export default function UploadScreen() {
  const router = useRouter();
  const { setReport } = useReport();
  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [snpCount, setSnpCount] = useState(0);
  const [history, setHistory] = useState<ReportRecord[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setStage("idle");
      setFileName("");
      setError("");
      fetchHistory();
    }, [])
  );

  async function fetchHistory() {
    const { data, error } = await supabase
      .from("processed_genomic_results")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setHistory(data);
  }

  function loadHistoricalReport(record: ReportRecord) {
    setReport(record.report_data);
    router.push("/report");
  }

  async function handleUpload() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/plain", "text/csv", "application/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setFileName(file.name);
      setStage("parsing");
      setError("");

      const parseResult = await parseFile(file.uri, file.name);
      setSnpCount(parseResult.snp_count);
      setStage("analyzing");

      const reportResult = await getReport(parseResult.session_id);
      const fullData = { parse: parseResult, report: reportResult };
      setReport(fullData);
      
      // Save to Supabase
      const { error: insertError } = await supabase.from("processed_genomic_results").insert({
        session_id: parseResult.session_id,
        file_name: file.name,
        report_data: fullData,
      });
      if (insertError) {
        console.error("Supabase insert error:", insertError);
        Alert.alert("Database Error", "Failed to save history: " + insertError.message);
      }
      fetchHistory();

      setStage("done");
      router.push("/report");
    } catch (err: any) {
      setStage("error");
      setError(err.message || "Something went wrong");
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Header Section */}
        <View style={styles.hero}>
          <Text style={styles.logo}>G-Nome</Text>
          <Text style={styles.tagline}>Genomic Health Passport</Text>
          <Text style={styles.description}>
            Securely upload your raw DNA data to unlock precision health insights, personalized drug safety profiles, and ancestry-adjusted risk scores.
          </Text>
        </View>

        {/* Upload Button */}
        <TouchableOpacity
          style={[styles.uploadWrapper, (stage === "parsing" || stage === "analyzing") && styles.uploadDisabled]}
          onPress={handleUpload}
          disabled={stage === "parsing" || stage === "analyzing"}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.uploadGradientRing}
          >
            <View style={styles.uploadInner}>
              {stage === "idle" || stage === "error" ? (
                <UploadCloud color={Colors.primary} size={48} strokeWidth={1.5} />
              ) : (
                <Dna color={Colors.primary} size={48} strokeWidth={1.5} />
              )}
              
              <Text style={styles.uploadText}>
                {stage === "idle"
                  ? "Tap to Upload"
                  : stage === "error"
                  ? "Try Again"
                  : stage === "parsing"
                  ? "Parsing Data..."
                  : stage === "analyzing"
                  ? "Analyzing..."
                  : "Done!"}
              </Text>
              <Text style={styles.uploadSubtext}>
                {stage === "idle"
                  ? "23andMe or AncestryDNA files"
                  : fileName}
              </Text>

              {stage === "analyzing" && (
                <Text style={styles.uploadSubtext}>
                  {snpCount.toLocaleString()} SNPs matched
                </Text>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {(stage === "parsing" || stage === "analyzing") && (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>
              {stage === "parsing"
                ? "Reading and decoding sequence..."
                : "Computing polygenic risk & drug safety models..."}
            </Text>
          </View>
        )}

        {stage === "error" && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Security / Disclaimer Badge */}
        <View style={styles.securityBadge}>
          <ShieldCheck color={Colors.success} size={16} />
          <Text style={styles.securityText}>Processed in-memory. HIPAA-compliant architecture.</Text>
        </View>

        {/* Previous Reports (Glassmorphism) */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Previous Reports</Text>
            {history.map((record) => (
              <TouchableOpacity key={record.id} onPress={() => loadHistoricalReport(record)}>
                <BlurView intensity={20} tint="dark" style={styles.historyCard}>
                  <View style={styles.historyIcon}>
                    <FileText color={Colors.primary} size={20} />
                  </View>
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyFile} numberOfLines={1}>{record.file_name}</Text>
                    <Text style={styles.historyDate}>
                      {new Date(record.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <ChevronRight color={Colors.textSecondary} size={20} />
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Features Grid */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Platform Capabilities</Text>
          <View style={styles.featuresGrid}>
            {[
              { icon: <Pill color={Colors.primary} size={24} />, title: "Pharmacogenomics", desc: "CYP gene drug interactions" },
              { icon: <Activity color={Colors.secondary} size={24} />, title: "Disease Risk", desc: "Ancestry-adjusted PRS" },
              { icon: <Dna color={Colors.info} size={24} />, title: "Carrier Status", desc: "Pathogenic variant screening" },
              { icon: <Apple color={Colors.success} size={24} />, title: "Nutrigenomics", desc: "Dietary trait analysis" },
            ].map((f, i) => (
              <BlurView key={i} intensity={20} tint="dark" style={styles.featureCard}>
                <View style={styles.featureIconWrapper}>{f.icon}</View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </BlurView>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 24, paddingBottom: 60 },
  
  hero: { alignItems: "center", marginTop: 24, marginBottom: 32 },
  logo: { fontSize: 36, fontWeight: "900", color: Colors.textPrimary, letterSpacing: 1 },
  tagline: { fontSize: 16, color: Colors.primary, marginTop: 4, fontWeight: "600", letterSpacing: 0.5 },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
    paddingHorizontal: 8,
  },

  uploadWrapper: {
    alignItems: "center",
    marginVertical: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  uploadDisabled: { opacity: 0.6 },
  uploadGradientRing: {
    padding: 3,
    borderRadius: 100,
  },
  uploadInner: {
    backgroundColor: Colors.surface,
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  uploadText: { fontSize: 18, fontWeight: "700", color: Colors.textPrimary, marginTop: 12 },
  uploadSubtext: { fontSize: 12, color: Colors.textSecondary, marginTop: 4, textAlign: "center" },

  loading: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 24, gap: 12 },
  loadingText: { fontSize: 13, color: Colors.textSecondary, fontWeight: "500" },

  errorBox: {
    backgroundColor: "rgba(244, 63, 94, 0.1)",
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
  },
  errorText: { color: Colors.danger, fontSize: 13, textAlign: "center" },

  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  securityText: { fontSize: 12, color: Colors.success, fontWeight: "500" },

  sectionTitle: { fontSize: 18, fontWeight: "700", color: Colors.textPrimary, marginBottom: 16, marginTop: 32 },
  
  historySection: { marginTop: 16 },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(45, 212, 191, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  historyInfo: { flex: 1 },
  historyFile: { fontSize: 15, fontWeight: "600", color: Colors.textPrimary, marginBottom: 4 },
  historyDate: { fontSize: 12, color: Colors.textSecondary },

  featuresSection: { marginTop: 16 },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
  },
  featureCard: {
    width: "47%",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  featureIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  featureTitle: { fontSize: 14, fontWeight: "600", color: Colors.textPrimary, marginBottom: 4 },
  featureDesc: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
