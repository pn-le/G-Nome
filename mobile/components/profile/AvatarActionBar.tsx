import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "./colors";
import type { AvatarGenerationState } from "./types";

type AvatarActionBarProps = {
  state: AvatarGenerationState;
  onGenerate: () => void;
  onSave: () => void;
  onRegenerate: () => void;
  onRetry: () => void;
};

export function AvatarActionBar({
  state,
  onGenerate,
  onSave,
  onRegenerate,
  onRetry,
}: AvatarActionBarProps) {
  if (state === "idle") return null;

  return (
    <View style={styles.bar}>
      {state === "selfie_uploaded" && (
        <Pressable style={styles.primaryBtn} onPress={onGenerate}>
          <Text style={styles.primaryBtnText}>Generate Avatar</Text>
        </Pressable>
      )}

      {state === "generating" && (
        <View style={styles.disabledBtn}>
          <Text style={styles.disabledBtnText}>Generating...</Text>
        </View>
      )}

      {state === "generated" && (
        <View style={styles.row}>
          <Pressable style={styles.secondaryBtn} onPress={onRegenerate}>
            <Text style={styles.secondaryBtnText}>Regenerate</Text>
          </Pressable>
          <Pressable style={[styles.primaryBtn, styles.flex1]} onPress={onSave}>
            <Text style={styles.primaryBtnText}>Save Avatar</Text>
          </Pressable>
        </View>
      )}

      {state === "error" && (
        <Pressable style={styles.errorBtn} onPress={onRetry}>
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  flex1: { flex: 1 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "600",
  },
  disabledBtn: {
    backgroundColor: colors.cardSoft,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    opacity: 0.6,
  },
  disabledBtnText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: "600",
  },
  errorBtn: {
    backgroundColor: colors.error,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
});
