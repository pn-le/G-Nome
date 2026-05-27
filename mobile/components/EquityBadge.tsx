import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";

// ---------------------------------------------------------------------------
// Pan-UKBB Ancestry Types & Constants
// ---------------------------------------------------------------------------

/** Pan-UKBB ancestry code (0–5) */
type AncestryCode = 0 | 1 | 2 | 3 | 4 | 5;

interface AncestryInfo {
  label: string;
  displayName: string;
  gwasWeight: number;
}

const ANCESTRY_DATA: Record<AncestryCode, AncestryInfo> = {
  0: { label: "EUR", displayName: "European", gwasWeight: 1.0 },
  1: { label: "AFR", displayName: "African", gwasWeight: 0.3 },
  2: { label: "CSA", displayName: "Central/South Asian", gwasWeight: 0.4 },
  3: { label: "EAS", displayName: "East Asian", gwasWeight: 0.5 },
  4: { label: "MID", displayName: "Middle Eastern", gwasWeight: 0.25 },
  5: { label: "AMR", displayName: "Admixed American", gwasWeight: 0.35 },
};

// ---------------------------------------------------------------------------
// Confidence Tier Classification
// ---------------------------------------------------------------------------

type ConfidenceTier = "HIGH" | "MODERATE" | "LOW";

interface TierConfig {
  label: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  indicatorColor: string;
  showWarning: boolean;
}

const TIER_CONFIG: Record<ConfidenceTier, TierConfig> = {
  HIGH: {
    label: "High Data Confidence",
    color: "#15803d",
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderColor: "rgba(34, 197, 94, 0.25)",
    indicatorColor: "#22c55e",
    showWarning: false,
  },
  MODERATE: {
    label: "Moderate Data Confidence",
    color: "#b45309",
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderColor: "rgba(245, 158, 11, 0.25)",
    indicatorColor: "#f59e0b",
    showWarning: true,
  },
  LOW: {
    label: "Low Data Confidence",
    color: "#dc2626",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.25)",
    indicatorColor: "#ef4444",
    showWarning: true,
  },
};

/**
 * Classify confidence tier from GWAS representation weight.
 *
 * - Green (HIGH):     weight >= 0.7
 * - Amber (MODERATE): 0.4 <= weight < 0.7
 * - Red (LOW):        weight < 0.4
 */
function classifyConfidenceTier(gwasWeight: number): ConfidenceTier {
  if (gwasWeight >= 0.7) return "HIGH";
  if (gwasWeight >= 0.4) return "MODERATE";
  return "LOW";
}

// ---------------------------------------------------------------------------
// Component Props
// ---------------------------------------------------------------------------

export interface EquityBadgeProps {
  /** Pan-UKBB ancestry code (0–5) */
  ancestryCode: number;
  /** Human-readable ancestry label (e.g., "Central/South Asian") */
  ancestryLabel: string;
  /** Server-computed confidence score (0.0–1.0), used as override if provided */
  confidenceScore?: number;
  /** Optional container style overrides */
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// EquityBadge Component
// ---------------------------------------------------------------------------

/**
 * EquityBadge — Visual indicator of genomic data equity confidence.
 *
 * Evaluates the user's ancestry breakdown against the European data
 * density baseline in standard GWAS datasets. Renders a color-coded
 * status card with contextual explanation for non-European ancestries.
 *
 * Designed to slot into the five-tab report dashboard layout.
 */
const EquityBadge: React.FC<EquityBadgeProps> = ({
  ancestryCode,
  ancestryLabel,
  confidenceScore,
  style,
}) => {
  // Resolve ancestry data
  const validCode = (
    ancestryCode >= 0 && ancestryCode <= 5 ? ancestryCode : 0
  ) as AncestryCode;

  const ancestryInfo = ANCESTRY_DATA[validCode];

  // Compute confidence: use server score if provided, else derive from weight
  const gwasWeight = ancestryInfo.gwasWeight;
  const effectiveScore = confidenceScore ?? gwasWeight;
  const tier = classifyConfidenceTier(effectiveScore);
  const config = TIER_CONFIG[tier];

  // Format score as percentage
  const scorePercent = `${Math.round(effectiveScore * 100)}%`;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        },
        style,
      ]}
    >
      {/* Header Row: Indicator + Status */}
      <View style={styles.headerRow}>
        {/* Color-coded circular indicator */}
        <View
          style={[
            styles.indicator,
            { backgroundColor: config.indicatorColor },
          ]}
        />

        <View style={styles.headerText}>
          <Text style={[styles.statusLabel, { color: config.color }]}>
            {config.label}
          </Text>
          <Text style={styles.ancestryLabel}>
            {ancestryLabel || ancestryInfo.displayName} · {scorePercent}
          </Text>
        </View>
      </View>

      {/* Warning explanation for non-high confidence */}
      {config.showWarning && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            This score features lower statistical confidence due to historic
            European bias in genomic datasets. G-Nome has applied Pan-UKBB
            local ancestry weights to compensate.
          </Text>
        </View>
      )}

      {/* GWAS Representation Bar */}
      <View style={styles.barContainer}>
        <View style={styles.barLabels}>
          <Text style={styles.barLabel}>GWAS Representation</Text>
          <Text style={[styles.barValue, { color: config.color }]}>
            {Math.round(gwasWeight * 100)}%
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                width: `${Math.round(gwasWeight * 100)}%`,
                backgroundColor: config.indicatorColor,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 0,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  indicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 10,
    // Subtle glow effect
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  headerText: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  ancestryLabel: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
    fontWeight: "500",
  },
  warningContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(0, 0, 0, 0.03)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  warningIcon: {
    fontSize: 14,
    marginRight: 8,
    marginTop: 1,
  },
  warningText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: "#4b5563",
    fontWeight: "400",
  },
  barContainer: {
    marginTop: 4,
  },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  barValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  barTrack: {
    height: 6,
    backgroundColor: "rgba(0, 0, 0, 0.06)",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
    minWidth: 4,
  },
});

export { EquityBadge };
export default EquityBadge;
