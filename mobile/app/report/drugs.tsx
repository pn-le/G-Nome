import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReport } from "../../lib/context";
import { Colors, severityColor } from "../../lib/colors";
import { SectionCard } from "../../components/SectionCard";
import { DrugFlag } from "../../components/DrugFlag";
import { Disclaimer } from "../../components/Disclaimer";

export default function DrugsTab() {
  const { report } = useReport();
  if (!report) return null;

  const pgx = report.report.pharmacogenomics;
  const { high_risk_drugs, moderate_risk_drugs } = pgx.summary;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Pharmacogenomics</Text>
        <Text style={styles.subheading}>
          How your genes affect drug metabolism
        </Text>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, { backgroundColor: "#FEE2E2" }]}>
            <Text style={[styles.summaryNum, { color: Colors.danger }]}>
              {high_risk_drugs}
            </Text>
            <Text style={styles.summaryLabel}>High Risk</Text>
          </View>
          <View style={[styles.summaryPill, { backgroundColor: "#FEF3C7" }]}>
            <Text style={[styles.summaryNum, { color: Colors.warning }]}>
              {moderate_risk_drugs}
            </Text>
            <Text style={styles.summaryLabel}>Moderate</Text>
          </View>
          <View style={[styles.summaryPill, { backgroundColor: "#ECFDF5" }]}>
            <Text style={[styles.summaryNum, { color: Colors.success }]}>
              {pgx.summary.genes_tested}
            </Text>
            <Text style={styles.summaryLabel}>Genes Tested</Text>
          </View>
        </View>

        {pgx.genes.map((gene) => {
          // CYP2D6 special case
          if (gene.status === "not_callable") {
            return (
              <SectionCard
                key="CYP2D6"
                title="CYP2D6"
                subtitle="Not reliably callable from SNP arrays"
                disclaimer={gene.disclaimer || "CYP2D6 cannot be reliably determined from SNP array data. Results shown are partial."}
              >
                <Text style={styles.affectedLabel}>Affected drugs:</Text>
                {gene.affected_drugs?.map((d) => (
                  <Text key={d} style={styles.affectedDrug}>• {d}</Text>
                ))}
              </SectionCard>
            );
          }

          if (!gene.drug_flags || gene.drug_flags.length === 0) return null;

          return (
            <SectionCard
              key={gene.gene}
              title={gene.gene}
              subtitle={gene.status_label}
              disclaimer="Discuss with your prescriber before making any medication changes."
            >
              {gene.drug_flags.map((flag, i) => (
                <DrugFlag key={i} flag={flag} gene={gene.gene} />
              ))}
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
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  summaryPill: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  summaryNum: { fontSize: 28, fontWeight: "800" },
  summaryLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, fontWeight: "600" },
  affectedLabel: { fontSize: 13, fontWeight: "600", color: Colors.textPrimary, marginBottom: 6 },
  affectedDrug: { fontSize: 13, color: Colors.textSecondary, marginBottom: 3 },
});
