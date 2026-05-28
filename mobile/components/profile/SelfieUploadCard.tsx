import React from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { colors } from "./colors";

type SelfieUploadCardProps = {
  selfieUri: string | null;
  onTakeSelfie: () => void;
  onUploadPhoto: () => void;
  onChangePhoto: () => void;
  disabled: boolean;
};

export function SelfieUploadCard({
  selfieUri,
  onTakeSelfie,
  onUploadPhoto,
  onChangePhoto,
  disabled,
}: SelfieUploadCardProps) {
  if (selfieUri) {
    return (
      <View style={[styles.card, disabled && styles.disabled]}>
        <View style={styles.uploadedRow}>
          <Image source={{ uri: selfieUri }} style={styles.thumbnail} />
          <View style={styles.uploadedInfo}>
            <Text style={styles.readyText}>✅ Selfie ready</Text>
            <Text style={styles.readySubtext}>
              Looking good! Tap generate below.
            </Text>
          </View>
          <Pressable onPress={onChangePhoto} disabled={disabled}>
            <Text style={styles.changeBtn}>Change</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, disabled && styles.disabled]}>
      <Text style={styles.emptyEmoji}>📷</Text>
      <Text style={styles.emptyTitle}>Your Selfie</Text>
      <Text style={styles.emptySubtitle}>
        Add a selfie to personalize your avatar.
      </Text>
      <View style={styles.buttonRow}>
        <Pressable
          style={styles.outlineBtn}
          onPress={onTakeSelfie}
          disabled={disabled}
        >
          <Text style={styles.outlineBtnText}>Take Selfie</Text>
        </Pressable>
        <Pressable
          style={styles.outlineBtn}
          onPress={onUploadPhoto}
          disabled={disabled}
        >
          <Text style={styles.outlineBtnText}>Upload Photo</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 12,
  },
  disabled: { opacity: 0.4 },
  emptyEmoji: { fontSize: 36, textAlign: "center", marginBottom: 12 },
  emptyTitle: {
    fontWeight: "700",
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  buttonRow: { flexDirection: "row", gap: 12 },
  outlineBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  outlineBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  uploadedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  uploadedInfo: { flex: 1 },
  readyText: {
    fontWeight: "600",
    fontSize: 14,
    color: colors.success,
  },
  readySubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  changeBtn: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
});
