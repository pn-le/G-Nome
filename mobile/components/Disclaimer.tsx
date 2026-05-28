import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Colors } from "../lib/colors";

export function Disclaimer({ text }: { text: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.disclaimerBg,
    borderLeftWidth: 3,
    borderLeftColor: Colors.disclaimerBorder,
    borderRadius: 6,
    padding: 10,
    marginVertical: 8,
  },
  text: { fontSize: 11, color: "#92400E", lineHeight: 16 },
});
