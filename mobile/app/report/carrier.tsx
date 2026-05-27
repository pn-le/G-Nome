import React from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReport } from "../../lib/context";
import { Colors, carrierStatusColor } from "../../lib/colors";
import { SectionCard } from "../../components/SectionCard";

export default function CarrierTab() {
  const { report } = useReport();
  if (!report) return null;

  const carrier = report.report.carrier_status;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Carrier Status</Text>
        <Text style={styles.subheading}>
          Tested {carrier.conditions_tested} conditions &middot;{" "}
          {carrier.carriers_found} carrier variant{carrier.carriers_found !== 1 ? "s" : ""} detected
        </Text>

        {carrier.results.map((r) => {
          const color = carrierStatusColor(r.status);

          return (
            <SectionCard
              key={r.condition}
              title={r.condition}
              subtitle={`${r.gene} — ${r.rsid}`}
              disclaimer={r.disclaimer}
            >
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: color }]} />
                <Text style={[styles.statusLabel, { color }]}>
                  {r.status_label}
                </Text>
                <Text style={styles.genotype}>{r.genotype}</Text>
              </View>
              <Text style={styles.detail}>{r.detail}</Text>
              <Text style={styles.notes}>{r.notes}</Text>
            </SectionCard>
          );
        })}

        <View style={styles.globalDisclaimer}>
          <Text style={styles.globalDisclaimerText}>{carrier.disclaimer}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 18, paddingBottom: 32 },
  heading: { fontSize: 24, fontWeight: "800", color: Colors.textPrimary },
  subheading: { fontSize: 14, color: Colors.textSecondary, marginTop: 2, marginBottom: 16 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 15, fontWeight: "700" },
  genotype: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted,
    fontFamily: "monospace",
    marginLeft: "auto",
  },
  detail: { fontSize: 13, color: Colors.textPrimary, lineHeight: 19, marginBottom: 6 },
  notes: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17, fontStyle: "italic" },
  globalDisclaimer: {
    backgroundColor: Colors.disclaimerBg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.disclaimerBorder,
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
  },
  globalDisclaimerText: { fontSize: 12, color: "#92400E", lineHeight: 18 },
});
