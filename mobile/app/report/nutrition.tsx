import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReport } from "../../lib/context";
import { Colors } from "../../lib/colors";
import { SectionCard } from "../../components/SectionCard";

function traitColor(status: string): string {
  switch (status) {
    case "intolerant":
    case "flush":
    case "reduced":
    case "elevated":
      return Colors.danger;
    case "mild_flush":
    case "slightly_reduced":
    case "slow":
    case "moderate":
      return Colors.warning;
    case "tolerant":
    case "normal":
    case "fast":
    case "low":
      return Colors.success;
    default:
      return Colors.textMuted;
  }
}

export default function NutritionTab() {
  const { report } = useReport();
  if (!report) return null;

  const { traits, total_tested } = report.report.nutrition_traits;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Nutrition & Traits</Text>
        <Text style={styles.subheading}>
          {total_tested} traits analyzed from your DNA
        </Text>

        {traits.map((t) => {
          const color = traitColor(t.status);

          return (
            <SectionCard
              key={t.rsid}
              title={t.name}
              subtitle={`${t.gene} — ${t.rsid}`}
            >
              <View style={styles.resultRow}>
                <View style={[styles.statusDot, { backgroundColor: color }]} />
                <Text style={[styles.resultLabel, { color }]}>{t.label}</Text>
                <Text style={styles.genotype}>{t.genotype}</Text>
              </View>
              {t.detail && (
                <Text style={styles.detail}>{t.detail}</Text>
              )}
            </SectionCard>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 18, paddingBottom: 32 },
  heading: { fontSize: 24, fontWeight: "800", color: Colors.textPrimary },
  subheading: { fontSize: 14, color: Colors.textSecondary, marginTop: 2, marginBottom: 16 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  resultLabel: { fontSize: 15, fontWeight: "700" },
  genotype: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted,
    fontFamily: "monospace",
    marginLeft: "auto",
  },
  detail: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
});
