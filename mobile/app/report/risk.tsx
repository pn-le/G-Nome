import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReport } from "../../lib/context";
import { Colors, riskTierColor } from "../../lib/colors";
import { SectionCard } from "../../components/SectionCard";
import { RiskMeter } from "../../components/RiskMeter";
import { EquityBadge } from "../../components/EquityBadge";

export default function RiskTab() {
  const { report } = useReport();
  if (!report) return null;

  const { conditions, equity_note } = report.report.disease_risk;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Disease Risk</Text>
        <Text style={styles.subheading}>
          Ancestry-adjusted polygenic risk scores
        </Text>

        <View style={styles.equityBanner}>
          <Text style={styles.equityText}>{equity_note}</Text>
        </View>

        {conditions.map((cond) => {
          if (cond.status !== "computed") {
            return (
              <SectionCard
                key={cond.condition}
                title={cond.label || cond.condition}
                subtitle={cond.description}
              >
                <Text style={styles.noData}>{cond.message || "Data not available"}</Text>
              </SectionCard>
            );
          }

          const color = riskTierColor(cond.risk_tier!);
          const adj = cond.ancestry_adjustment!;

          return (
            <SectionCard
              key={cond.condition}
              title={cond.label}
              subtitle={cond.description}
              disclaimer="This is not a diagnosis. Risk scores indicate likelihood, not certainty."
            >
              <View style={styles.meterRow}>
                <RiskMeter
                  value={cond.percentile!}
                  label="percentile"
                  color={color}
                  size={110}
                />
                <View style={styles.meterInfo}>
                  <Text style={[styles.riskLabel, { color }]}>{cond.risk_label}</Text>
                  <Text style={styles.stat}>
                    {cond.snps_matched?.toLocaleString()} of{" "}
                    {cond.snps_total?.toLocaleString()} SNPs matched
                  </Text>
                  <Text style={styles.stat}>Coverage: {cond.coverage_pct}%</Text>
                </View>
              </View>

              <EquityBadge
                ancestryCode={0}
                ancestryLabel={adj.population_used}
              />

              <Text style={styles.adjNote}>{adj.note}</Text>
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
  equityBanner: {
    backgroundColor: "#F3E8FF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  equityText: { fontSize: 13, color: Colors.primary, fontWeight: "500", lineHeight: 19 },
  meterRow: { flexDirection: "row", alignItems: "center", gap: 18, marginBottom: 14 },
  meterInfo: { flex: 1 },
  riskLabel: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  stat: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  adjNote: { fontSize: 12, color: Colors.textSecondary, marginTop: 8, lineHeight: 17 },
  noData: { fontSize: 13, color: Colors.textMuted, fontStyle: "italic" },
});
