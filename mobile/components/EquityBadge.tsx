import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../lib/colors";

interface Props {
  ancestry: string;
  confidence?: string;
  compact?: boolean;
}

export function EquityBadge({ ancestry, confidence, compact }: Props) {
  return (
    <View style={[styles.badge, compact && styles.compact]}>
      <Text style={styles.icon}>🧬</Text>
      <View>
        <Text style={styles.text}>Adjusted for: {ancestry}</Text>
        {confidence && !compact && (
          <Text style={styles.confidence}>
            Data confidence: {confidence}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3E8FF",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  compact: { paddingVertical: 3, paddingHorizontal: 6 },
  icon: { fontSize: 14 },
  text: { fontSize: 11, color: Colors.primary, fontWeight: "600" },
  confidence: { fontSize: 10, color: Colors.textSecondary, marginTop: 1 },
});
