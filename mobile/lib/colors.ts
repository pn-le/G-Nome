export const Colors = {
  background: "#F7F6F3",
  surface: "#FFFFFF",
  primary: "#7C3AED",       // purple — gene nodes
  danger: "#EF4444",        // red/coral — high risk
  warning: "#F59E0B",       // amber — moderate
  success: "#10B981",       // teal/green — low risk
  info: "#3B82F6",          // blue — info
  pink: "#EC4899",          // pink — CV scan
  navy: "#1E293B",          // dark navy — center node
  textPrimary: "#1E293B",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  cardBg: "#FFFFFF",
  disclaimerBg: "#FFFBEB",
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
