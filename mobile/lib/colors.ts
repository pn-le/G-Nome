export const Colors = {
  background: "#0B1120", // Deep navy/charcoal background
  surface: "#111827",    // Slightly lighter dark card background
  primary: "#2DD4BF",    // Glowing Teal
  secondary: "#A855F7",  // Amethyst Purple
  danger: "#F43F5E",     // Rose/Red for high risk
  warning: "#FBBF24",    // Amber for moderate
  success: "#10B981",    // Emerald for low risk
  info: "#38BDF8",       // Sky blue for info
  pink: "#EC4899",       // Pink for CV
  navy: "#0F172A",       // Darker navy
  textPrimary: "#F8FAFC", // Off-white text
  textSecondary: "#94A3B8", // Slate text
  textMuted: "#475569",    // Dark slate text
  border: "#1E293B",       // Subtle border
  cardBg: "rgba(17, 24, 39, 0.7)", // Semi-transparent card
  disclaimerBg: "rgba(251, 191, 36, 0.1)", // Amber tint
  disclaimerBorder: "#F59E0B",
} as const;

export function severityColor(severity: string): string {
  switch (severity) {
    case "HIGH": return Colors.danger;
    case "MODERATE": return Colors.warning;
    case "LOW": return Colors.success;
    default: return Colors.textMuted;
  }
}

export function riskTierColor(tier: string): string {
  switch (tier) {
    case "high": return Colors.danger;
    case "moderate": return Colors.warning;
    case "average": return Colors.success;
    case "low": return Colors.info;
    default: return Colors.textMuted;
  }
}

export function carrierStatusColor(status: string): string {
  switch (status) {
    case "carrier": return Colors.warning;
    case "two_copies": return Colors.danger;
    case "not_detected": return Colors.success;
    default: return Colors.textMuted;
  }
}
