import React, { useEffect, useRef } from "react";
import { View, Text, Image, Animated, StyleSheet } from "react-native";
import { colors } from "./colors";

type SpotlightAvatarProps = {
  generatedUri: string | null;
  isGenerating: boolean;
};

const DefaultAvatarEmoji = () => (
  <View style={styles.emojiWrap}>
    <Text style={styles.emoji}>🧑</Text>
    <Text style={styles.emojiLabel}>YOUR AVATAR</Text>
  </View>
);

export function SpotlightAvatar({ generatedUri, isGenerating }: SpotlightAvatarProps) {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -6, duration: 1200, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    float.start();
    return () => float.stop();
  }, [floatAnim]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 1400, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const hasRealImage = generatedUri !== null && generatedUri !== "placeholder";

  return (
    <View style={styles.stage}>
      {/* Spotlight cone */}
      <View style={styles.cone} />

      {/* Avatar */}
      <Animated.View
        style={[styles.avatarWrap, { transform: [{ translateY: floatAnim }] }]}
      >
        {hasRealImage ? (
          <Image source={{ uri: generatedUri }} style={styles.avatarImage} />
        ) : (
          <DefaultAvatarEmoji />
        )}
        {isGenerating && (
          <View style={styles.generatingOverlay}>
            <Text style={styles.generatingDots}>✨</Text>
          </View>
        )}
      </Animated.View>

      {/* Floor glow */}
      <Animated.View
        style={[styles.floorGlow, { transform: [{ scaleX: pulseAnim }] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    height: 280,
    overflow: "hidden",
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  cone: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    width: 0,
    height: 0,
    borderLeftWidth: 80,
    borderRightWidth: 80,
    borderTopWidth: 160,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "rgba(255,233,168,0.08)",
  },
  avatarWrap: {
    zIndex: 2,
    alignItems: "center",
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.secondary,
  },
  emojiWrap: { alignItems: "center" },
  emoji: { fontSize: 80, lineHeight: 88 },
  emojiLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    letterSpacing: 1,
  },
  floorGlow: {
    position: "absolute",
    bottom: 20,
    width: 160,
    height: 28,
    borderRadius: 80,
    backgroundColor: "rgba(255,233,168,0.18)",
  },
  generatingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  generatingDots: { fontSize: 32 },
});
