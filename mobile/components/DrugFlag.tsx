import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors, severityColor } from "../lib/colors";
import type { DrugFlag as DrugFlagType } from "../lib/api";

interface Props {
  flag: DrugFlagType;
  gene: string;
}

export function DrugFlag({ flag, gene }: Props) {
  const color = severityColor(flag.severity);

  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.header}>
        <View style={[styles.severityBadge, { backgroundColor: color }]}>
          <Text style={styles.severityText}>{flag.severity}</Text>
        </View>
        <Text style={styles.gene}>{gene}</Text>
      </View>
      <Text style={styles.drug}>{flag.drug}</Text>
      <Text style={styles.action}>{flag.action}</Text>
      <Text style={styles.reason}>{flag.reason}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  gene: { fontSize: 12, color: Colors.textSecondary, fontWeight: "600" },
  drug: { fontSize: 16, fontWeight: "700", color: Colors.textPrimary, marginBottom: 4 },
  action: { fontSize: 13, color: Colors.primary, fontWeight: "600", marginBottom: 4 },
  reason: { fontSize: 12, color: Colors.textSecondary },
});
