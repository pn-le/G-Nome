import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { colors } from "./colors";
import type { GenerationStep } from "./types";

const STEPS: GenerationStep[] = [
  { label: "Analyzing selfie...", completed: false },
  { label: "Mapping facial features...", completed: false },
  { label: "Generating Mii style...", completed: false },
  { label: "Applying colors...", completed: false },
  { label: "Final touches...", completed: false },
];

type GenerationProgressProps = {
  visible: boolean;
};

export function GenerationProgress({ visible }: GenerationProgressProps) {
  const [activeStep, setActiveStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setActiveStep(0);
      fadeAnim.setValue(0);
      return;
    }

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 700);

    return () => clearInterval(interval);
  }, [visible, fadeAnim]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
      {STEPS.map((step, i) => {
        const isActive = i === activeStep;
        const isDone = i < activeStep;
        return (
          <View key={step.label} style={styles.stepRow}>
            <View
              style={[
                styles.dot,
                isDone && styles.dotDone,
                isActive && styles.dotActive,
              ]}
            />
            <Text
              style={[
                styles.stepLabel,
                isActive && styles.stepLabelActive,
                isDone && styles.stepLabelDone,
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </Animated.View>
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
    gap: 14,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  dotDone: {
    backgroundColor: colors.success,
  },
  dotActive: {
    backgroundColor: colors.secondary,
  },
  stepLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  stepLabelActive: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  stepLabelDone: {
    color: colors.success,
  },
});
