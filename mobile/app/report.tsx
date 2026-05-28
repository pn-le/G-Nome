import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useReport } from "../lib/context";
import { analyzeSelfie, analyzeSkin } from "../lib/api";
import { RiskMeter } from "../components/RiskMeter";

// ─── Ancestral Grove Design System ───────────────────────────────────────────

const colors = {
  background: "#F7F6F3",
  surface: "#FFFFFF",
  border: "#E5E2DB",
  textPrimary: "#1A1814",
  textSecondary: "#6B6760",
  textTertiary: "#A8A49E",
  riskUrgent: "#E8412A",
  riskHigh: "#F4845F",
  riskWatch: "#F5A623",
  riskClear: "#2ECC8F",
  trait: "#9B6FE8",
  cv: "#E87FA8",
  info: "#4A90D9",
};

const mono = Platform.OS === "ios" ? "Courier" : "monospace";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const getSeverityColor = (severity: string): string => {
  switch (severity?.toUpperCase()) {
    case "HIGH":
      return colors.riskHigh;
    case "URGENT":
      return colors.riskUrgent;
    case "MODERATE":
      return colors.riskWatch;
    case "LOW":
      return colors.riskClear;
    default:
      return colors.info;
  }
};

const getRiskColor = (tier: string): string => {
  switch (tier?.toLowerCase()) {
    case "high":
      return colors.riskUrgent;
    case "elevated":
    case "moderate":
      return colors.riskWatch;
    case "average":
    case "low":
    case "below average":
      return colors.riskClear;
    default:
      return colors.info;
  }
};

const traitStatusColor = (status: string): string => {
  switch (status) {
    case "intolerant":
    case "flush":
    case "reduced":
    case "high":
      return colors.riskHigh;
    case "mild_flush":
    case "slightly_reduced":
    case "slow":
    case "elevated":
      return colors.riskWatch;
    case "tolerant":
    case "normal":
    case "fast":
    case "low":
      return colors.riskClear;
    default:
      return colors.textTertiary;
  }
};

// ─── Reusable Components ─────────────────────────────────────────────────────

const Badge = ({ label, color }: { label: string; color: string }) => (
  <View
    style={{
      backgroundColor: hexToRgba(color, 0.15),
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: "flex-start",
    }}
  >
    <Text
      style={{
        color,
        fontSize: 11,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {label}
    </Text>
  </View>
);

const Card = ({
  children,
  accentColor,
}: {
  children: React.ReactNode;
  accentColor?: string;
}) => (
  <View
    style={[
      s.card,
      {
        borderLeftWidth: accentColor ? 4 : 1,
        borderLeftColor: accentColor ?? colors.border,
      },
    ]}
  >
    {children}
  </View>
);

const EmptyState = ({ title, body }: { title: string; body: string }) => (
  <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
    <Text style={{ fontSize: 28, marginBottom: 12 }}>🌿</Text>
    <Text
      style={{
        fontSize: 16,
        fontWeight: "600",
        color: colors.textPrimary,
        textAlign: "center",
        marginBottom: 8,
      }}
    >
      {title}
    </Text>
    <Text
      style={{
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: "center",
        lineHeight: 20,
      }}
    >
      {body}
    </Text>
  </View>
);

const PercentileBar = ({ percentile, color }: { percentile: number; color: string }) => (
  <View style={{ marginTop: 8 }}>
    <View style={s.barTrack}>
      <View
        style={[
          s.barFill,
          {
            width: `${Math.min(Math.max(percentile, 0), 100)}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
    <View style={s.barLabels}>
      <Text style={s.barLabelText}>0th</Text>
      <Text style={s.barLabelText}>50th</Text>
      <Text style={s.barLabelText}>100th</Text>
    </View>
  </View>
);

const LeafDivider = () => (
  <View style={{ alignItems: "center", paddingVertical: 12 }}>
    <Text style={{ fontSize: 12, color: colors.textTertiary }}>· 🌿 ·</Text>
  </View>
);

// ─── Tab 1: Drugs ────────────────────────────────────────────────────────────

function DrugsContent({ data }: { data: any }) {
  const pgx = data?.pharmacogenomics;
  if (!pgx?.genes?.length) {
    return (
      <EmptyState
        title="No drug flags found"
        body="Your pharmacogenomics report will appear here once available."
      />
    );
  }

  const { high_risk_drugs, moderate_risk_drugs, genes_tested } = pgx.summary ?? {};

  return (
    <>
      <View style={s.summaryRow}>
        <View style={[s.summaryPill, { backgroundColor: hexToRgba(colors.riskHigh, 0.12) }]}>
          <Text style={[s.summaryNum, { color: colors.riskHigh }]}>{high_risk_drugs ?? 0}</Text>
          <Text style={s.summaryLabel}>High Risk</Text>
        </View>
        <View style={[s.summaryPill, { backgroundColor: hexToRgba(colors.riskWatch, 0.12) }]}>
          <Text style={[s.summaryNum, { color: colors.riskWatch }]}>{moderate_risk_drugs ?? 0}</Text>
          <Text style={s.summaryLabel}>Moderate</Text>
        </View>
        <View style={[s.summaryPill, { backgroundColor: hexToRgba(colors.riskClear, 0.12) }]}>
          <Text style={[s.summaryNum, { color: colors.riskClear }]}>{genes_tested ?? 0}</Text>
          <Text style={s.summaryLabel}>Genes</Text>
        </View>
      </View>

      {pgx.genes.map((gene: any) => {
        if (gene.status === "not_callable") {
          return (
            <Card key="CYP2D6" accentColor={colors.info}>
              <View style={s.geneHeader}>
                <Text style={s.geneName}>{gene.gene ?? "CYP2D6"}</Text>
                <Badge label="Limited Data" color={colors.info} />
              </View>
              <Text style={s.diplotype}>Not reliably callable from SNP arrays</Text>
              {gene.affected_drugs?.map((d: string) => (
                <Text key={d} style={s.affectedDrug}>• {d}</Text>
              ))}
              <Text style={s.disclaimer}>{gene.disclaimer}</Text>
            </Card>
          );
        }

        const highestSeverity = gene.drug_flags?.reduce(
          (max: string, f: any) =>
            f.severity === "HIGH" ? "HIGH" : f.severity === "MODERATE" && max !== "HIGH" ? "MODERATE" : max,
          "LOW"
        );
        const accent =
          gene.drug_flags?.length > 0 ? getSeverityColor(highestSeverity) : colors.info;

        return (
          <Card key={gene.gene} accentColor={accent}>
            <View style={s.geneHeader}>
              <Text style={s.geneName}>{gene.gene}</Text>
              <Badge
                label={gene.status_label ?? gene.phenotype ?? ""}
                color={accent}
              />
            </View>
            {gene.diplotype && (
              <Text style={s.diplotype}>{gene.diplotype}</Text>
            )}
            {gene.drug_flags?.length > 0 ? (
              gene.drug_flags.map((flag: any, i: number) => (
                <View key={i}>
                  <View style={s.divider} />
                  <View style={s.drugRow}>
                    <Text style={s.drugName}>{flag.drug}</Text>
                    <Badge label={flag.severity} color={getSeverityColor(flag.severity)} />
                  </View>
                  <Text style={s.drugAction}>{flag.action}</Text>
                  <Text style={s.drugReason}>{flag.reason}</Text>
                </View>
              ))
            ) : (
              <Text style={s.noFlags}>No drug interactions flagged for this gene.</Text>
            )}
          </Card>
        );
      })}
    </>
  );
}

// ─── Tab 2: Risk ─────────────────────────────────────────────────────────────

function RiskContent({ data }: { data: any }) {
  const risk = data?.disease_risk;
  const conditions = risk?.conditions ?? [];

  if (conditions.length === 0) {
    return (
      <EmptyState
        title="No disease risk results yet"
        body="Risk insights will appear as your genomic tree grows."
      />
    );
  }

  return (
    <>
      {risk.equity_note && (
        <Card accentColor={colors.info}>
          <Text style={{ fontSize: 13, color: colors.info, fontWeight: "500", lineHeight: 19 }}>
            🌍 {risk.equity_note}
          </Text>
        </Card>
      )}

      {conditions.map((cond: any, idx: number) => {
        if (cond.status !== "computed") {
          return (
            <Card key={cond.condition}>
              <Text style={s.cardTitle}>{cond.label ?? cond.condition}</Text>
              <Text style={s.cardSubtext}>{cond.message ?? "Data not available"}</Text>
            </Card>
          );
        }

        const color = getRiskColor(cond.risk_tier);
        const adj = cond.ancestry_adjustment;

        return (
          <React.Fragment key={cond.condition}>
            <Card accentColor={color}>
              <View style={s.geneHeader}>
                <Text style={s.cardTitle}>{cond.label}</Text>
                <Badge label={cond.risk_label ?? cond.risk_tier} color={color} />
              </View>

              <Text style={[s.bigPercentile, { color }]}>
                {Math.round(cond.percentile ?? 0)}th percentile
              </Text>

              <PercentileBar percentile={cond.percentile ?? 0} color={color} />

              <View style={s.statRow}>
                {cond.snps_matched != null && (
                  <Text style={s.statText}>
                    SNPs matched: {cond.snps_matched?.toLocaleString()}
                    {cond.snps_total ? ` / ${cond.snps_total.toLocaleString()}` : ""}
                  </Text>
                )}
                {cond.raw_score != null && (
                  <Text style={s.statText}>Score: {cond.raw_score.toFixed(3)}</Text>
                )}
              </View>

              <Text style={s.riskExplainer}>
                This result suggests {cond.risk_label?.toLowerCase() ?? "typical"} genetic risk. Genetics is one part of your health story.
              </Text>

              {/* ML Driving Factors */}
              {cond.is_ml_model && cond.driving_factors && (
                <View style={s.mlFactorsContainer}>
                  <Text style={s.mlFactorsTitle}>Top ML Risk Drivers:</Text>
                  <View style={s.mlFactorsList}>
                    {cond.driving_factors.map((factor: string, idx: number) => (
                      <View key={idx} style={s.mlFactorBadge}>
                        <Text style={s.mlFactorText}>{factor}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {adj?.note && (
                <View style={s.ancestryBanner}>
                  <Text style={s.ancestryBannerText}>
                    🌍 {adj.note}
                  </Text>
                  <Text style={s.ancestryBannerSub}>
                    Population used: {adj.population_used} · Confidence: {adj.confidence}
                  </Text>
                </View>
              )}
            </Card>
            {idx < conditions.length - 1 && <LeafDivider />}
          </React.Fragment>
        );
      })}
    </>
  );
}

// ─── Tab 3: Carrier ──────────────────────────────────────────────────────────

function CarrierContent({ data }: { data: any }) {
  const carrier = data?.carrier_status;
  const results = carrier?.results ?? [];

  if (results.length === 0) {
    return (
      <EmptyState
        title="No carrier variants detected"
        body="Carrier status results will appear here."
      />
    );
  }

  return (
    <>
      <Text style={s.sectionMeta}>
        Tested {carrier.conditions_tested} conditions · {carrier.carriers_found} carrier variant
        {carrier.carriers_found !== 1 ? "s" : ""} detected
      </Text>

      {results.map((r: any) => {
        const isDetected = r.status === "carrier" || r.status === "two_copies";
        const accent = isDetected ? colors.riskWatch : colors.riskClear;
        const statusLabel =
          r.status === "two_copies"
            ? "TWO COPIES"
            : isDetected
            ? "VARIANT DETECTED"
            : "NOT DETECTED";

        return (
          <Card key={r.condition} accentColor={accent}>
            <View style={s.carrierHeader}>
              <View style={[s.statusDot, { backgroundColor: accent }]} />
              <Text style={s.geneName}>{r.gene}</Text>
              <Badge label={statusLabel} color={accent} />
            </View>
            <Text style={s.cardTitle}>{r.condition}</Text>
            {r.rsid !== "multiple" && r.rsid !== "N/A" && (
              <Text style={s.monoSub}>{r.rsid} · {r.genotype}</Text>
            )}
            <Text style={s.detailText}>{r.detail}</Text>
            {r.notes ? <Text style={s.notesText}>{r.notes}</Text> : null}
            {r.disclaimer ? <Text style={s.disclaimer}>{r.disclaimer}</Text> : null}
          </Card>
        );
      })}

      {carrier.disclaimer && (
        <View style={s.globalDisclaimer}>
          <Text style={s.globalDisclaimerText}>{carrier.disclaimer}</Text>
        </View>
      )}
    </>
  );
}

// ─── Tab 4: Traits ───────────────────────────────────────────────────────────

function TraitsContent({ data }: { data: any }) {
  const nutrition = data?.nutrition_traits;
  const traits = nutrition?.traits ?? [];
  const appearance = (nutrition as any)?.appearance;

  if (traits.length === 0 && !appearance) {
    return (
      <EmptyState
        title="No trait predictions yet"
        body="Trait insights will appear here once processed."
      />
    );
  }

  const testedTraits = traits.filter((t: any) => t.status !== "not_tested");
  const untestedTraits = traits.filter((t: any) => t.status === "not_tested");

  return (
    <>
      {/* Nutrition & Metabolism */}
      {traits.length > 0 && (
        <>
          <Text style={s.groupHeader}>🌿 Nutrition & Metabolism</Text>
          {testedTraits.map((t: any) => (
            <Card key={t.rsid} accentColor={colors.trait}>
              <View style={s.traitHeader}>
                <Text style={s.traitName}>{t.name}</Text>
                <Text style={s.monoSmall}>{t.gene}</Text>
              </View>
              <Text style={[s.traitResult, { color: traitStatusColor(t.status) }]}>
                {t.label}
              </Text>
              {t.detail && <Text style={s.traitDetail}>{t.detail}</Text>}
              <Text style={s.monoSub}>{t.rsid} · {t.genotype}</Text>
            </Card>
          ))}
          {untestedTraits.map((t: any) => (
            <Card key={t.rsid}>
              <View style={s.traitHeader}>
                <Text style={s.traitName}>{t.name}</Text>
                <Text style={s.monoSmall}>{t.gene}</Text>
              </View>
              <Text style={[s.traitResult, { color: colors.textTertiary, fontStyle: "italic" }]}>
                Not Tested
              </Text>
              <Text style={s.traitDetail}>{t.detail}</Text>
            </Card>
          ))}
        </>
      )}

      <LeafDivider />

      {/* Physical Traits */}
      {appearance && (
        <>
          <Text style={s.groupHeader}>🧬 Physical Traits</Text>
          {(["eye_color", "hair_color", "skin_tone"] as const).map((key) => {
            const pred = appearance[key];
            if (!pred) return null;
            const label = key === "eye_color" ? "Eye Color" : key === "hair_color" ? "Hair Color" : "Skin Tone";
            return (
              <Card key={key} accentColor={colors.trait}>
                <View style={s.traitHeader}>
                  <Text style={s.traitName}>{label}</Text>
                  <Text style={s.monoSmall}>{pred.gene}</Text>
                </View>
                <Text style={[s.traitResult, { color: colors.trait }]}>{pred.result}</Text>
                <Text style={s.monoSub}>{pred.rsid} · {pred.genotype}</Text>
              </Card>
            );
          })}
        </>
      )}
    </>
  );
}

// ─── Tab 5: AI Summary ──────────────────────────────────────────────────────

function AISummaryContent({ data }: { data: any }) {
  const reportText = data?.report_text;
  const narrative = reportText?.full_text;

  if (!narrative) {
    return (
      <EmptyState
        title="No AI summary available yet"
        body="Your plain-language genomic summary will appear here after analysis."
      />
    );
  }

  return (
    <>
      <Card>
        <Text style={s.summaryTitle}>🌿 Your Genomic Summary</Text>
        {reportText.llm_generated === false && (
          <Badge label="Structured Summary" color={colors.info} />
        )}
        <Text style={s.narrativeText}>{narrative}</Text>
      </Card>

      <Card accentColor={colors.info}>
        <Text style={[s.summaryTitle, { color: colors.info, fontSize: 14 }]}>
          🌍 Equity & Accuracy Note
        </Text>
        <Text style={s.equityText}>
          Most genomic research datasets have historically overrepresented people of European
          ancestry. G-Nome highlights ancestry context where possible so results are interpreted
          with more transparency.
        </Text>
      </Card>

      <Card accentColor={colors.border}>
        <Text style={[s.disclaimerHeader]}>ℹ Medical Disclaimer</Text>
        <Text style={s.disclaimerBody}>
          G-Nome provides educational health insights based on your DNA data. It is not a
          diagnosis and does not replace professional medical advice. Always consult a qualified
          healthcare provider before making any medical decisions.
        </Text>
      </Card>
    </>
  );
}

// ─── Tab 6: Scan ─────────────────────────────────────────────────────────────

function ScanContent({ sessionId }: { sessionId: string }) {
  const [selfieResult, setSelfieResult] = useState<any>(null);
  const [skinResult, setSkinResult] = useState<any>(null);
  const [loading, setLoading] = useState<"selfie" | "skin" | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [skinImage, setSkinImage] = useState<string | null>(null);

  async function pickAndAnalyze(type: "selfie" | "skin") {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setLoading(type);
    try {
      if (type === "selfie") {
        setSelfieImage(uri);
        setSelfieResult(await analyzeSelfie(sessionId, uri));
      } else {
        setSkinImage(uri);
        setSkinResult(await analyzeSkin(sessionId, uri));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      {/* Selfie */}
      <Card accentColor={colors.trait}>
        <Text style={s.cardTitle}>Selfie Phenotype Check</Text>
        <Text style={s.cardSubtext}>Compare your DNA prediction to your actual appearance</Text>
        <TouchableOpacity
          style={[s.scanBtn, { backgroundColor: colors.trait }]}
          onPress={() => pickAndAnalyze("selfie")}
          disabled={loading !== null}
        >
          <Text style={s.scanBtnText}>
            {selfieResult ? "Retake Selfie" : "Take Selfie"}
          </Text>
        </TouchableOpacity>
        {loading === "selfie" && <ActivityIndicator style={{ marginTop: 16 }} color={colors.trait} />}
        {selfieResult && (
          <View style={{ marginTop: 16 }}>
            {selfieImage && <Image source={{ uri: selfieImage }} style={s.previewImg} />}
            <Text style={s.scanResultTitle}>Genetic Prediction</Text>
            <View style={s.predRow}>
              {["eye_color", "hair_color", "skin_tone"].map((key) => (
                <View key={key} style={s.predItem}>
                  <Text style={s.predLabel}>
                    {key === "eye_color" ? "Eyes" : key === "hair_color" ? "Hair" : "Skin"}
                  </Text>
                  <Text style={s.predValue}>
                    {selfieResult.genetic_prediction?.[key] ?? "—"}
                  </Text>
                </View>
              ))}
            </View>
            {selfieResult.confidence_pct != null && (
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.trait, marginTop: 8 }}>
                Match confidence: {selfieResult.confidence_pct}%
              </Text>
            )}
          </View>
        )}
      </Card>

      <LeafDivider />

      {/* Skin Scan */}
      <Card accentColor={colors.cv}>
        <Text style={s.cardTitle}>Skin Lesion Scanner</Text>
        <Text style={s.cardSubtext}>AI classification + MC1R genetic risk fusion</Text>
        <TouchableOpacity
          style={[s.scanBtn, { backgroundColor: colors.cv }]}
          onPress={() => pickAndAnalyze("skin")}
          disabled={loading !== null}
        >
          <Text style={s.scanBtnText}>
            {skinResult ? "Scan Another" : "Photograph a Mole"}
          </Text>
        </TouchableOpacity>
        {loading === "skin" && <ActivityIndicator style={{ marginTop: 16 }} color={colors.cv} />}
        {skinResult && (
          <View style={{ marginTop: 16 }}>
            {skinImage && <Image source={{ uri: skinImage }} style={s.previewImg} />}
            <View style={s.fusedRow}>
              <RiskMeter
                value={skinResult.fused_risk_pct ?? 0}
                label="fused risk"
                color={skinResult.color ?? colors.cv}
                size={100}
              />
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={[s.urgencyLabel, { color: skinResult.color ?? colors.cv }]}>
                  {skinResult.urgency_label ?? skinResult.urgency}
                </Text>
                {skinResult.mc1r_variant_detected && (
                  <Text style={{ fontSize: 12, color: colors.riskWatch, fontWeight: "500", marginTop: 4 }}>
                    MC1R variant detected — {skinResult.genetic_multiplier}x risk multiplier
                  </Text>
                )}
              </View>
            </View>
            <Text style={s.scanResultTitle}>Classification</Text>
            {skinResult.classifications?.slice(0, 4).map((c: any) => (
              <View key={c.class} style={s.classRow}>
                <Text style={s.className}>{c.label}</Text>
                <View style={s.classBarBg}>
                  <View
                    style={[
                      s.classBarFill,
                      {
                        width: `${c.probability_pct ?? 0}%`,
                        backgroundColor: c.class === "MEL" ? colors.riskUrgent : colors.trait,
                      },
                    ]}
                  />
                </View>
                <Text style={s.classPct}>{c.probability_pct}%</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={[s.disclaimer, { marginTop: 12 }]}>
          Not a dermatological assessment. Consult a clinician for any skin concern.
        </Text>
      </Card>
    </>
  );
}

// ─── Main Report Screen ──────────────────────────────────────────────────────

const TABS = ["Drugs", "Risk", "Carrier", "Traits", "AI Summary", "Scan"];

export default function ReportScreen() {
  const { report } = useReport();
  const [activeTab, setActiveTab] = useState(0);

  if (!report) {
    return (
      <SafeAreaView style={s.safeCenter} edges={["bottom"]}>
        <ActivityIndicator size="large" color={colors.trait} />
      </SafeAreaView>
    );
  }

  const data = report.report;
  const sessionId = report.parse.session_id;

  const renderTab = () => {
    switch (activeTab) {
      case 0:
        return <DrugsContent data={data} />;
      case 1:
        return <RiskContent data={data} />;
      case 2:
        return <CarrierContent data={data} />;
      case 3:
        return <TraitsContent data={data} />;
      case 4:
        return <AISummaryContent data={data} />;
      case 5:
        return <ScanContent sessionId={sessionId} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["bottom"]}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>Your Genomic Passport</Text>
          <Text style={s.headerSub}>Rooted in ancestry. Guided by science.</Text>
        </View>

        {/* Tab Bar */}
        <View style={s.tabBar}>
          {TABS.map((tab, i) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(i)}
              style={s.tabItem}
            >
              <Text
                style={[
                  s.tabLabel,
                  {
                    fontWeight: activeTab === i ? "700" : "400",
                    color: activeTab === i ? colors.textPrimary : colors.textTertiary,
                  },
                ]}
              >
                {tab}
              </Text>
              {activeTab === i && <View style={s.tabIndicator} />}
            </Pressable>
          ))}
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
        >
          {renderTab()}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  safeCenter: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },
  headerSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  // Tab bar
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 10 },
  tabLabel: { fontSize: 11 },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    width: "60%",
    height: 2,
    backgroundColor: colors.textPrimary,
    borderRadius: 1,
  },

  // Content
  content: { padding: 16, paddingBottom: 32 },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  // Summary pills
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  summaryPill: { flex: 1, borderRadius: 14, padding: 14, alignItems: "center" },
  summaryNum: { fontSize: 28, fontWeight: "800" },
  summaryLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontWeight: "600" },

  // Gene/Drug cards
  geneHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  geneName: { fontSize: 18, fontWeight: "700", fontFamily: mono, color: colors.textPrimary },
  diplotype: { fontSize: 13, fontFamily: mono, color: colors.textSecondary, marginBottom: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  drugRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  drugName: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  drugAction: { fontSize: 13, color: colors.textSecondary, marginBottom: 2 },
  drugReason: { fontSize: 13, color: colors.textSecondary, fontStyle: "italic" },
  noFlags: { fontSize: 13, color: colors.textTertiary, marginTop: 8 },
  affectedDrug: { fontSize: 13, color: colors.textSecondary, marginBottom: 3 },

  // Risk
  bigPercentile: { fontSize: 32, fontWeight: "800", marginTop: 8 },
  barTrack: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4 },
  barLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  barLabelText: { fontSize: 11, color: colors.textTertiary },
  statRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  statText: { fontSize: 12, color: colors.textTertiary },
  riskExplainer: { fontSize: 13, color: colors.textSecondary, marginTop: 10, lineHeight: 18 },
  ancestryBanner: {
    backgroundColor: hexToRgba(colors.info, 0.1),
    borderLeftWidth: 3,
    borderLeftColor: colors.info,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  ancestryBannerText: { fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
  ancestryBannerSub: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  
  mlFactorsContainer: {
    backgroundColor: hexToRgba(colors.info, 0.1),
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: hexToRgba(colors.info, 0.2),
  },
  mlFactorsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.info,
    marginBottom: 8,
  },
  mlFactorsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mlFactorBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mlFactorText: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: "600",
  },

  // Carrier
  carrierHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  monoSub: { fontSize: 12, fontFamily: mono, color: colors.textTertiary, marginTop: 4 },
  detailText: { fontSize: 13, color: colors.textPrimary, lineHeight: 19, marginTop: 8 },
  notesText: { fontSize: 12, color: colors.textSecondary, lineHeight: 17, fontStyle: "italic", marginTop: 4 },
  sectionMeta: { fontSize: 14, color: colors.textSecondary, marginBottom: 14 },
  globalDisclaimer: {
    backgroundColor: hexToRgba(colors.riskWatch, 0.1),
    borderLeftWidth: 3,
    borderLeftColor: colors.riskWatch,
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
  },
  globalDisclaimerText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

  // Traits
  groupHeader: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 12, marginTop: 4 },
  traitHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  traitName: { fontSize: 15, fontWeight: "600", color: colors.textPrimary },
  monoSmall: { fontSize: 12, fontFamily: mono, color: colors.textTertiary },
  traitResult: { fontSize: 18, fontWeight: "700", marginTop: 6 },
  traitDetail: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginTop: 6 },

  // AI Summary
  summaryTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 10 },
  narrativeText: { fontSize: 15, lineHeight: 24, color: colors.textPrimary, marginTop: 8 },
  equityText: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  disclaimerHeader: { fontWeight: "700", fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
  disclaimerBody: { fontSize: 12, color: colors.textTertiary, lineHeight: 18 },
  disclaimer: { fontSize: 11, color: colors.textTertiary, fontStyle: "italic", marginTop: 8 },

  // Card generic
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, marginBottom: 2 },
  cardSubtext: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },

  // Scan
  scanBtn: { borderRadius: 12, padding: 14, alignItems: "center", marginTop: 10 },
  scanBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  previewImg: { width: "100%", height: 180, borderRadius: 12, marginBottom: 12 },
  scanResultTitle: { fontSize: 15, fontWeight: "700", color: colors.textPrimary, marginBottom: 8, marginTop: 8 },
  predRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  predItem: { flex: 1, backgroundColor: hexToRgba(colors.trait, 0.08), borderRadius: 10, padding: 10, alignItems: "center" },
  predLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: "600" },
  predValue: { fontSize: 14, fontWeight: "700", color: colors.textPrimary, marginTop: 3 },
  fusedRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  urgencyLabel: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  classRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  className: { fontSize: 11, color: colors.textSecondary, width: 110 },
  classBarBg: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" },
  classBarFill: { height: "100%", borderRadius: 4 },
  classPct: { fontSize: 11, fontWeight: "600", color: colors.textPrimary, width: 36, textAlign: "right" },
});
