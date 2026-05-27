import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../lib/colors";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  disclaimer?: string;
}

export function SectionCard({ title, subtitle, children, disclaimer }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={styles.content}>{children}</View>
      {disclaimer && (
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>{disclaimer}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: { fontSize: 18, fontWeight: "700", color: Colors.textPrimary, marginBottom: 2 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 10 },
  content: { marginTop: 8 },
  disclaimer: {
    marginTop: 12,
    backgroundColor: Colors.disclaimerBg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.disclaimerBorder,
    borderRadius: 6,
    padding: 10,
  },
  disclaimerText: { fontSize: 11, color: "#92400E", lineHeight: 16 },
});
