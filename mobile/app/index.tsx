import React, { useState } from "react";
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
import { useRouter } from "expo-router";
import { Colors } from "../lib/colors";
import { parseFile, getReport } from "../lib/api";
import { useReport } from "../lib/context";
import { Disclaimer } from "../components/Disclaimer";

type Stage = "idle" | "parsing" | "analyzing" | "done" | "error";

export default function UploadScreen() {
  const router = useRouter();
  const { setReport } = useReport();
  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [snpCount, setSnpCount] = useState(0);

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
      setReport({ parse: parseResult, report: reportResult });
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
        <View style={styles.hero}>
          <Text style={styles.logo}>G-Nome</Text>
          <Text style={styles.tagline}>Your Genomic Health Passport</Text>
          <Text style={styles.description}>
            Upload your 23andMe or AncestryDNA raw data file to get a
            personalized report covering drug safety, disease risk, carrier
            status, and nutrition — adjusted for your ancestry.
          </Text>
        </View>

        <Disclaimer
          text="Before uploading: This app provides health guidance for informational purposes only, not medical advice. Your genomic data is processed in memory and not stored persistently. Discuss any findings with your healthcare provider."
        />

        <TouchableOpacity
          style={[
            styles.uploadButton,
            stage !== "idle" && stage !== "error" && styles.uploadDisabled,
          ]}
          onPress={handleUpload}
          disabled={stage !== "idle" && stage !== "error"}
          activeOpacity={0.8}
        >
          <Text style={styles.uploadIcon}>
            {stage === "idle" || stage === "error" ? "📂" : "🧬"}
          </Text>
          <Text style={styles.uploadText}>
            {stage === "idle"
              ? "Upload DNA File"
              : stage === "error"
              ? "Try Again"
              : stage === "parsing"
              ? "Parsing your DNA..."
              : stage === "analyzing"
              ? `Analyzing ${snpCount.toLocaleString()} SNPs...`
              : "Done!"}
          </Text>
          <Text style={styles.uploadSubtext}>
            {stage === "idle"
              ? "23andMe (.txt) or AncestryDNA (.csv)"
              : fileName}
          </Text>
        </TouchableOpacity>

        {(stage === "parsing" || stage === "analyzing") && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>
              {stage === "parsing"
                ? "Reading your DNA file..."
                : "Running pharmacogenomics, risk scores, carrier screening, and trait analysis..."}
            </Text>
          </View>
        )}

        {stage === "error" && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.features}>
          <Text style={styles.featuresTitle}>What you'll get</Text>
          {[
            { icon: "💊", title: "Drug Safety", desc: "Flags for dangerous drug interactions based on your CYP genes" },
            { icon: "📊", title: "Disease Risk", desc: "Ancestry-adjusted polygenic risk scores for 3 conditions" },
            { icon: "🧬", title: "Carrier Status", desc: "Screening for 5 genetic conditions" },
            { icon: "🥗", title: "Nutrition", desc: "Lactose, caffeine, alcohol, vitamin D, folate, celiac" },
            { icon: "📷", title: "Skin Scanner", desc: "AI skin lesion analysis fused with your MC1R genetics" },
          ].map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.equitySection}>
          <Text style={styles.equityTitle}>Built for everyone</Text>
          <Text style={styles.equityText}>
            78-80% of genetic risk algorithms are built on European data. G-Nome
            explicitly corrects for this — showing you which population weights
            your scores use and adjusting calculations for your actual ancestry.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 24, paddingBottom: 48 },
  hero: { alignItems: "center", marginBottom: 20, marginTop: 40 },
  logo: { fontSize: 48, fontWeight: "900", color: Colors.primary, letterSpacing: 2 },
  tagline: { fontSize: 16, color: Colors.textSecondary, marginTop: 4, fontWeight: "500" },
  description: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  uploadButton: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginTop: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  uploadDisabled: { opacity: 0.7 },
  uploadIcon: { fontSize: 32, marginBottom: 8 },
  uploadText: { fontSize: 20, fontWeight: "700", color: "#fff" },
  uploadSubtext: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 },
  loading: { alignItems: "center", marginTop: 24, gap: 12 },
  loadingText: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  errorBox: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
  },
  errorText: { color: "#991B1B", fontSize: 13 },
  features: { marginTop: 32 },
  featuresTitle: { fontSize: 18, fontWeight: "700", color: Colors.textPrimary, marginBottom: 14 },
  featureRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 12 },
  featureIcon: { fontSize: 24 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: "600", color: Colors.textPrimary },
  featureDesc: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  equitySection: {
    marginTop: 28,
    backgroundColor: "#F3E8FF",
    borderRadius: 16,
    padding: 18,
  },
  equityTitle: { fontSize: 16, fontWeight: "700", color: Colors.primary, marginBottom: 6 },
  equityText: { fontSize: 13, color: Colors.textPrimary, lineHeight: 20 },
});
