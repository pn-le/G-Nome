import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, SafeAreaView, StatusBar,
} from 'react-native';
import { useFonts } from 'expo-font';
import { InriaSerif_400Regular, InriaSerif_700Bold } from '@expo-google-fonts/inria-serif';
import { IBMPlexMono_400Regular, IBMPlexMono_700Bold } from '@expo-google-fonts/ibm-plex-mono';
import BottomNav, { TabKey } from './BottomNav';
import { useApp } from './lib/AppContext';
import { GeneResult, RiskCondition, CarrierResult, TraitResult } from './lib/types';
import { colors, radius, shadow } from './constants/theme';

// ─── Tab config ──────────────────────────────────────────────────────────────

const TABS = [
  { label: 'Drugs',      accent: colors.amber  },
  { label: 'Risk',       accent: colors.red    },
  { label: 'Carrier',    accent: colors.red    },
  { label: 'Traits',     accent: colors.blue   },
  { label: 'AI Summary', accent: colors.green  },
];

// ─── Shared helpers ──────────────────────────────────────────────────────────

interface FontProps {
  serif?:     string;
  serifBold?: string;
  mono?:      string;
  monoBold?:  string;
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={[bs.wrap, { backgroundColor: bg }]}>
      <Text style={[bs.text, { color }]}>{label}</Text>
    </View>
  );
}
const bs = StyleSheet.create({
  wrap: { borderRadius: radius.badge, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', flexShrink: 1 },
  text: { fontSize: 8, fontWeight: '700', letterSpacing: 0.4 },
});

function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 8 }} />;
}

function PercentileBar({ pct, accent }: { pct: number; accent: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <View style={{ marginTop: 8, marginBottom: 4 }}>
      <View style={pb.track}>
        <View style={[pb.fill, { width: `${clamped}%`, backgroundColor: accent }]} />
        <View style={[pb.dot,  { left: `${clamped}%`, marginLeft: -6, backgroundColor: accent }]} />
      </View>
      <View style={pb.labels}>
        <Text style={pb.label}>0th</Text>
        <Text style={pb.label}>50th</Text>
        <Text style={pb.label}>100th</Text>
      </View>
    </View>
  );
}
const pb = StyleSheet.create({
  track:  { height: 8, backgroundColor: colors.border, borderRadius: 4, position: 'relative' },
  fill:   { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: 4 },
  dot:    { position: 'absolute', top: -2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.surface },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  label:  { fontSize: 8, color: colors.textSecondary },
});

function SectionCard({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <View style={[sc.wrap, { borderLeftColor: accent }, shadow.card]}>
      {children}
    </View>
  );
}
const sc = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface, borderRadius: radius.card, borderLeftWidth: 4,
    marginBottom: 12, overflow: 'hidden',
  },
});

function EquityRow({ note, weights }: { note?: string; weights?: Record<string, number> }) {
  const parts = weights
    ? Object.entries(weights)
        .filter(([, v]) => (v as number) > 0.01)
        .map(([k, v]) => `${Math.round((v as number) * 100)}% ${k.replace('_', ' ')}`)
        .join(', ')
    : null;

  const text = parts ? `Weights: ${parts}` : note;
  if (!text) return null;

  return (
    <View style={eq.row}>
      <Text style={eq.icon}>🌍</Text>
      <Text style={eq.text}>{text}</Text>
    </View>
  );
}
const eq = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: colors.greenLightBg, borderRadius: 8,
    padding: 8, paddingHorizontal: 10, marginTop: 8,
  },
  icon: { fontSize: 12, marginTop: 1 },
  text: { fontSize: 9, color: colors.textSecondary, flex: 1, lineHeight: 14 },
});

function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

// ─── Severity helpers ────────────────────────────────────────────────────────

function drugSeverityStyle(s: string): { bg: string; fg: string } {
  if (s === 'HIGH')     return { bg: colors.red,   fg: '#fff' };
  if (s === 'MODERATE') return { bg: colors.amber, fg: '#fff' };
  return                       { bg: colors.green, fg: '#fff' };
}

function riskAccent(tier?: string): string {
  if (tier === 'high')     return colors.red;
  if (tier === 'moderate') return colors.amber;
  if (tier === 'low')      return colors.blue;
  return colors.green;
}

function riskBadgeLabel(tier?: string, label?: string): string {
  if (label) return label.toUpperCase();
  if (tier === 'high')     return 'HIGH RISK';
  if (tier === 'moderate') return 'ELEVATED';
  if (tier === 'average')  return 'AVERAGE';
  if (tier === 'low')      return 'LOW';
  return 'UNKNOWN';
}

function carrierAccent(status: string): string {
  if (status === 'carrier')  return colors.amber;
  if (status === 'affected') return colors.red;
  return colors.green;
}

function traitSeverityStyle(severity?: string): { bg: string; fg: string } {
  if (severity === 'ALERT') return { bg: colors.redBg,    fg: colors.red    };
  if (severity === 'WARN')  return { bg: colors.amberBg,  fg: colors.amber  };
  if (severity === 'OK')    return { bg: colors.greenLightBg, fg: colors.green };
  return                           { bg: colors.blueBg,   fg: colors.blue   };
}

// ─── DRUGS TAB ───────────────────────────────────────────────────────────────

function DrugsTab({ serif, serifBold, mono, monoBold }: FontProps) {
  const { report } = useApp();
  const allGenes: GeneResult[] = report?.pharmacogenomics.genes ?? [];
  const genes      = allGenes.filter(g => g.status !== 'not_callable');
  const notCallable = allGenes.filter(g => g.status === 'not_callable');
  const summary    = report?.pharmacogenomics.summary;

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.pageTitle, { fontFamily: serifBold }]}>Drugs</Text>
      {summary && (
        <View style={styles.summaryChips}>
          <View style={[styles.chip, { backgroundColor: colors.redBg }]}>
            <Text style={[styles.chipNum, { fontFamily: monoBold, color: colors.red }]}>{summary.high_risk_drugs}</Text>
            <Text style={[styles.chipLabel, { fontFamily: serif }]}>High risk</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: colors.amberBg }]}>
            <Text style={[styles.chipNum, { fontFamily: monoBold, color: colors.amber }]}>{summary.moderate_risk_drugs}</Text>
            <Text style={[styles.chipLabel, { fontFamily: serif }]}>Moderate</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: colors.greenLightBg }]}>
            <Text style={[styles.chipNum, { fontFamily: monoBold, color: colors.green }]}>{summary.genes_tested}</Text>
            <Text style={[styles.chipLabel, { fontFamily: serif }]}>Genes tested</Text>
          </View>
        </View>
      )}

      {genes.length === 0 && notCallable.length === 0 && <EmptyState text="No pharmacogenomics data available." />}

      {genes.map(gene => (
        <SectionCard key={gene.gene} accent={colors.amber}>
          <View style={styles.cardInner}>
            {/* Gene header */}
            <View style={styles.cardTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.geneName, { fontFamily: monoBold }]}>{gene.gene}</Text>
                <Text style={[styles.diplotype, { fontFamily: mono }]}>{gene.metabolizer_status}</Text>
              </View>
              <Badge
                label={(gene.status_label ?? '').toUpperCase()}
                bg={colors.amberBg}
                color="#B26E00"
              />
            </View>

            {(gene.drug_flags?.length ?? 0) > 0 && (
              <>
                <Divider />
                <Text style={[styles.subheading, { fontFamily: serif }]}>AFFECTED DRUGS</Text>
                {gene.drug_flags.map((flag, i) => {
                  const sev = drugSeverityStyle(flag.severity);
                  return (
                    <View key={i} style={[styles.drugItem, { backgroundColor: sev.bg + '33', borderLeftColor: sev.bg }]}>
                      <View style={styles.drugHeader}>
                        <Text style={[styles.drugName, { fontFamily: serifBold }]}>{flag.drug}</Text>
                        <Badge label={flag.severity} bg={sev.bg} color={sev.fg} />
                      </View>
                      <Text style={[styles.drugMeta, { fontFamily: serif }]}>⚠ {flag.action}</Text>
                      <Text style={[styles.drugMeta, { fontFamily: serif }]}>✓ {flag.reason}</Text>
                    </View>
                  );
                })}
              </>
            )}

            {(gene.drug_flags?.length ?? 0) === 0 && (
              <Text style={[styles.noFlags, { fontFamily: serif }]}>No drug interactions flagged for this gene.</Text>
            )}
          </View>
        </SectionCard>
      ))}

      {/* CYP2D6 / not-callable info box */}
      {notCallable.map(gene => (
        <View key={gene.gene} style={[styles.infoBox, { backgroundColor: colors.blueBg, borderLeftColor: colors.blue }]}>
          <Text style={[styles.infoBoxTitle, { fontFamily: monoBold, color: '#3366B2' }]}>{gene.gene} — Not Callable</Text>
          <Text style={[styles.infoBoxBody, { fontFamily: serif, color: '#3366B2', marginBottom: 6 }]}>{gene.disclaimer}</Text>
          {(gene.affected_drugs ?? []).map((drug, i) => (
            <Text key={i} style={[styles.infoBoxBody, { fontFamily: mono, color: '#3366B2' }]}>· {drug}</Text>
          ))}
        </View>
      ))}

      <View style={[styles.infoBox, { backgroundColor: colors.amberBg, borderLeftColor: colors.amber }]}>
        <Text style={[styles.infoBoxBody, { fontFamily: serif, color: '#7A5200' }]}>
          Discuss with your prescriber before making any medication changes.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── RISK TAB ────────────────────────────────────────────────────────────────

function RiskTab({ serif, serifBold, mono, monoBold }: FontProps) {
  const { report } = useApp();
  const conditions: RiskCondition[] = report?.disease_risk.conditions ?? [];
  const equityNote = report?.disease_risk.equity_note;
  const computed   = conditions.filter(c => c.status === 'computed');

  const elevated = computed.filter(c => c.risk_tier === 'high' || c.risk_tier === 'moderate').length;
  const low      = computed.filter(c => c.risk_tier === 'low').length;

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.pageTitle, { fontFamily: serifBold }]}>Risk</Text>

      {computed.length > 0 && (
        <View style={styles.summaryChips}>
          <View style={[styles.chip, { backgroundColor: colors.redBg }]}>
            <Text style={[styles.chipNum, { fontFamily: monoBold, color: colors.red }]}>{elevated}</Text>
            <Text style={[styles.chipLabel, { fontFamily: serif }]}>Elevated</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: colors.greenLightBg }]}>
            <Text style={[styles.chipNum, { fontFamily: monoBold, color: colors.green }]}>{low}</Text>
            <Text style={[styles.chipLabel, { fontFamily: serif }]}>Low risk</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: colors.border }]}>
            <Text style={[styles.chipNum, { fontFamily: monoBold, color: colors.textSecondary }]}>{computed.length}</Text>
            <Text style={[styles.chipLabel, { fontFamily: serif }]}>Assessed</Text>
          </View>
        </View>
      )}

      {computed.length === 0 && <EmptyState text="Risk scores not yet available." />}

      {computed.map((c, i) => (
        <SectionCard key={i} accent={riskAccent(c.risk_tier)}>
          <View style={styles.cardInner}>
            <View style={styles.cardTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.geneName, { fontFamily: serifBold }]}>
                  {c.label ?? c.condition}
                </Text>
                {c.description && (
                  <Text style={[styles.subtitle, { fontFamily: serif }]}>{c.description}</Text>
                )}
              </View>
              <Badge
                label={riskBadgeLabel(c.risk_tier, c.risk_label)}
                bg={riskAccent(c.risk_tier)}
                color="#fff"
              />
            </View>

            {c.percentile != null && (
              <>
                <Text style={[styles.percentileNum, { fontFamily: monoBold, color: riskAccent(c.risk_tier) }]}>
                  {c.percentile.toFixed(0)}th percentile
                </Text>
                <PercentileBar pct={c.percentile} accent={riskAccent(c.risk_tier)} />
              </>
            )}

            {(c.raw_score != null || c.snps_matched != null) && (
              <View style={styles.metaRow}>
                {c.raw_score    != null && <Text style={[styles.metaTag, { fontFamily: mono }]}>score {c.raw_score.toFixed(3)}</Text>}
                {c.snps_matched != null && <Text style={[styles.metaTag, { fontFamily: mono }]}>{c.snps_matched} SNPs</Text>}
              </View>
            )}

            <EquityRow
              note={(c as any).ancestry_adjustment?.note}
              weights={(c as any).ancestry_weights}
            />
          </View>
        </SectionCard>
      ))}

      {equityNote && (
        <View style={[styles.infoBox, { backgroundColor: colors.greenLightBg, borderLeftColor: colors.green }]}>
          <Text style={[styles.infoBoxTitle, { fontFamily: serifBold, color: colors.olive }]}>Equity & Accuracy Note</Text>
          <Text style={[styles.infoBoxBody,  { fontFamily: serif, color: colors.textSecondary }]}>{equityNote}</Text>
        </View>
      )}

      <View style={[styles.infoBox, { backgroundColor: colors.blueBg, borderLeftColor: colors.blue }]}>
        <Text style={[styles.infoBoxBody, { fontFamily: serif, color: '#3366B2' }]}>
          This is not a diagnosis. Risk scores indicate likelihood, not certainty.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── CARRIER TAB ─────────────────────────────────────────────────────────────

function CarrierTab({ serif, serifBold, mono, monoBold }: FontProps) {
  const { report } = useApp();
  const results: CarrierResult[] = report?.carrier_status.results ?? [];
  const summary = report?.carrier_status;

  const detected    = results.filter(r => r.status === 'carrier' || r.status === 'affected').length;
  const notDetected = results.filter(r => r.status === 'clear').length;

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      <Text style={[styles.pageTitle, { fontFamily: serifBold }]}>Carrier Status</Text>

      {summary && (
        <View style={styles.summaryChips}>
          <View style={[styles.chip, { backgroundColor: colors.amberBg }]}>
            <Text style={[styles.chipNum, { fontFamily: monoBold, color: colors.amber }]}>{detected}</Text>
            <Text style={[styles.chipLabel, { fontFamily: serif }]}>Detected</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: colors.greenLightBg }]}>
            <Text style={[styles.chipNum, { fontFamily: monoBold, color: colors.green }]}>{notDetected}</Text>
            <Text style={[styles.chipLabel, { fontFamily: serif }]}>Not detected</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: colors.border }]}>
            <Text style={[styles.chipNum, { fontFamily: monoBold, color: colors.textSecondary }]}>{summary.conditions_tested}</Text>
            <Text style={[styles.chipLabel, { fontFamily: serif }]}>Tested</Text>
          </View>
        </View>
      )}

      {results.length === 0 && <EmptyState text="No carrier data available." />}

      {results.map((r, i) => (
        <SectionCard key={i} accent={carrierAccent(r.status)}>
          <View style={styles.cardInner}>
            <View style={styles.cardTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.geneName, { fontFamily: monoBold }]}>{r.gene}</Text>
                <Text style={[styles.subtitle, { fontFamily: serif }]}>{r.condition}</Text>
              </View>
              <Badge
                label={r.status_label?.toUpperCase() ?? r.status.toUpperCase()}
                bg={carrierAccent(r.status) + '22'}
                color={carrierAccent(r.status)}
              />
            </View>

            {r.rsid && r.rsid !== 'N/A' && (
              <>
                <Divider />
                <View style={styles.variantBox}>
                  <Text style={[styles.rsid, { fontFamily: mono }]}>{r.rsid}</Text>
                  {r.genotype && (
                    <Text style={[styles.genotypeText, { fontFamily: mono, color: colors.purple }]}>{r.genotype}</Text>
                  )}
                </View>
              </>
            )}

            {r.detail && (
              <Text style={[styles.carrierNote, { fontFamily: serif }]}>{r.detail}</Text>
            )}
          </View>
        </SectionCard>
      ))}

      <View style={[styles.infoBox, { backgroundColor: colors.blueBg, borderLeftColor: colors.blue }]}>
        <Text style={[styles.infoBoxBody, { fontFamily: serif, color: '#3366B2' }]}>
          {summary?.disclaimer ?? 'We did not detect the specific variants we tested for. This does not mean you are not a carrier.'}
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── TRAITS TAB ──────────────────────────────────────────────────────────────

function TraitsTab({ serif, serifBold, mono, monoBold }: FontProps) {
  const { report } = useApp();
  const traits: TraitResult[] = (report?.nutrition_traits.traits ?? []).filter(t => t.status !== 'not_tested');

  const grouped: Record<string, TraitResult[]> = {};
  traits.forEach(t => {
    const cat = t.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  });

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {Object.keys(grouped).length === 0 && <EmptyState text="No trait data available." />}

      {Object.entries(grouped).map(([category, items]) => (
        <View key={category}>
          <Text style={[styles.sectionGroupLabel, { fontFamily: serifBold }]}>{category.toUpperCase()}</Text>
          {items.map((t, i) => {
            const sev = traitSeverityStyle((t as any).severity);
            return (
              <View key={i} style={[styles.traitCard, shadow.card]}>
                <View style={styles.traitCardInner}>
                  {/* Top row: name + result badge */}
                  <View style={styles.traitTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.traitName, { fontFamily: serifBold }]}>{t.name}</Text>
                      <Text style={[styles.traitGeneLine, { fontFamily: mono }]}>
                        {t.gene} · {t.rsid ?? ''}
                      </Text>
                    </View>
                    {t.label && (
                      <Badge label={t.label.toUpperCase()} bg={sev.bg} color={sev.fg} />
                    )}
                  </View>

                  {/* Genotype row — purple monospace */}
                  {(t as any).genotype && (t as any).genotype !== 'N/A' && (
                    <View style={styles.genotypeRow}>
                      <Text style={[styles.genotypeLabel, { fontFamily: serif }]}>Genotype</Text>
                      <Text style={[styles.genotypeValue, { fontFamily: monoBold, color: colors.purple }]}>
                        {(t as any).genotype}
                      </Text>
                    </View>
                  )}

                  {t.detail && (
                    <>
                      <Divider />
                      <Text style={[styles.traitBody, { fontFamily: serif }]}>{t.detail}</Text>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

// ─── AI SUMMARY TAB ──────────────────────────────────────────────────────────

function AISummaryTab({ serif, serifBold }: FontProps) {
  const { report } = useApp();
  const reportText = report?.report_text;
  const equityNote = report?.disease_risk.equity_note;

  return (
    <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* AI header label */}
      <View style={styles.aiHeaderRow}>
        <Text style={styles.aiHeaderIcon}>✨</Text>
        <View>
          <Text style={[styles.aiHeaderTitle, { fontFamily: serifBold }]}>AI Health Summary</Text>
          <Text style={[styles.aiHeaderSub, { fontFamily: serif }]}>Generated by Llama 3.3 · Based on your genomic profile</Text>
        </View>
      </View>

      <View style={[styles.summaryCard, shadow.card]}>
        {reportText?.llm_generated === false && (
          <View style={[styles.chip, { backgroundColor: colors.amberBg, alignSelf: 'flex-start', marginBottom: 8 }]}>
            <Text style={[styles.chipLabel, { fontFamily: serif, color: colors.amber }]}>
              AI summary unavailable — showing structured report
            </Text>
          </View>
        )}
        <Text style={[styles.summaryBody, { fontFamily: serif }]}>
          {reportText?.full_text ?? 'Generating your personalised report…'}
        </Text>
        <Image
          source={require('./assets/images/small gene tree.png')}
          style={styles.summaryDecor}
          resizeMode="contain"
        />
      </View>

      {equityNote && (
        <View style={[styles.infoBox, { backgroundColor: colors.greenLightBg, borderLeftColor: colors.green }]}>
          <Text style={[styles.infoBoxTitle, { fontFamily: serifBold, color: colors.olive }]}>
            Equity & Accuracy Note
          </Text>
          <Text style={[styles.infoBoxBody, { fontFamily: serif, color: colors.textSecondary }]}>{equityNote}</Text>
        </View>
      )}

      <View style={[styles.infoBox, { backgroundColor: colors.border, borderLeftColor: colors.textLight }]}>
        <Text style={[styles.infoBoxBody, { fontFamily: serif, color: colors.textSecondary }]}>
          Health guidance for informational purposes only. Not medical advice.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

interface Props {
  initialTab?: number;
  onBack?: () => void;
  onTabPress?: (tab: TabKey) => void;
}

export default function ReportsScreen({ initialTab = 0, onBack, onTabPress }: Props) {
  const [fontsLoaded] = useFonts({
    InriaSerif_400Regular,
    InriaSerif_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_700Bold,
  });
  const [activeTab, setActiveTab] = useState(initialTab);

  const serif     = fontsLoaded ? 'InriaSerif_400Regular'   : undefined;
  const serifBold = fontsLoaded ? 'InriaSerif_700Bold'       : undefined;
  const mono      = fontsLoaded ? 'IBMPlexMono_400Regular'   : undefined;
  const monoBold  = fontsLoaded ? 'IBMPlexMono_700Bold'      : undefined;
  const tabProps  = { serif, serifBold, mono, monoBold };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* ── Tab strip ──────────────────────────────────────────────────── */}
      <View style={styles.tabStrip}>
        <View style={styles.tabStripLine} />
        {TABS.map((t, i) => {
          const active = i === activeTab;
          return (
            <TouchableOpacity key={t.label} style={styles.tabBtn} onPress={() => setActiveTab(i)}>
              <Text style={[styles.tabLabel, {
                fontFamily: active ? serifBold : serif,
                color: active ? t.accent : colors.textLight,
              }]} numberOfLines={1}>
                {t.label}
              </Text>
              {active && <View style={[styles.tabUnderline, { backgroundColor: t.accent }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 0 && <DrugsTab     {...tabProps} />}
      {activeTab === 1 && <RiskTab      {...tabProps} />}
      {activeTab === 2 && <CarrierTab   {...tabProps} />}
      {activeTab === 3 && <TraitsTab    {...tabProps} />}
      {activeTab === 4 && <AISummaryTab {...tabProps} />}

      <BottomNav activeTab="reports" onTabPress={onTabPress ?? (() => {})} />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  tabStrip:     { flexDirection: 'row', position: 'relative', backgroundColor: colors.surface },
  tabStripLine: { position: 'absolute', bottom: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  tabBtn:       { flex: 1, alignItems: 'center', paddingVertical: 11, position: 'relative' },
  tabLabel:     { fontSize: 9 },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderRadius: 2 },

  tabContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 },
  pageTitle:  { fontSize: 20, color: colors.textPrimary, marginBottom: 14 },
  sectionGroupLabel: { fontSize: 10, color: colors.textLight, marginBottom: 10, marginTop: 4, letterSpacing: 0.5 },

  summaryChips: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  chip:      { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  chipNum:   { fontSize: 18 },
  chipLabel: { fontSize: 8, color: colors.textSecondary, marginTop: 2 },

  cardInner:  { padding: 14 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  geneName:   { fontSize: 15, color: colors.textPrimary },
  diplotype:  { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  subtitle:   { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },

  percentileNum: { fontSize: 20, marginTop: 4, marginBottom: 2 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  metaTag: { fontSize: 9, color: colors.textLight, backgroundColor: colors.border, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },

  subheading: { fontSize: 9, color: colors.textLight, marginBottom: 6, letterSpacing: 0.4 },
  noFlags:    { fontSize: 10, color: colors.textSecondary, fontStyle: 'italic' },

  drugItem: { borderRadius: 10, padding: 10, marginTop: 6, borderLeftWidth: 3 },
  drugHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5, gap: 8 },
  drugName:   { fontSize: 13, color: colors.textPrimary, flex: 1 },
  drugMeta:   { fontSize: 10, color: colors.textSecondary, marginTop: 2, lineHeight: 15 },

  variantBox:    { backgroundColor: colors.bg, borderRadius: 8, padding: 10, marginBottom: 4 },
  rsid:          { fontSize: 12, color: colors.textSecondary, marginBottom: 3 },
  genotypeText:  { fontSize: 13 },
  carrierNote:   { fontSize: 10, color: colors.textSecondary, lineHeight: 15, marginTop: 4 },

  traitCard:      { backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden', marginBottom: 10 },
  traitCardInner: { padding: 14 },
  traitTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  traitName:      { fontSize: 13, color: colors.textPrimary, marginBottom: 2 },
  traitGeneLine:  { fontSize: 9,  color: colors.textLight },
  traitBody:      { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },

  genotypeRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  genotypeLabel: { fontSize: 9, color: colors.textLight },
  genotypeValue: { fontSize: 13 },

  aiHeaderRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  aiHeaderIcon: { fontSize: 20 },
  aiHeaderTitle: { fontSize: 15, color: colors.textPrimary },
  aiHeaderSub:   { fontSize: 9, color: colors.textSecondary },

  summaryCard:   { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, marginBottom: 14 },
  summaryBody:   { fontSize: 12, color: colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  summaryDecor:  { width: 80, height: 60, alignSelf: 'center', opacity: 0.6 },

  emptyBox:  { backgroundColor: colors.greenLightBg, borderRadius: radius.card, padding: 16, marginBottom: 12, alignItems: 'center' },
  emptyText: { fontSize: 11, color: colors.textSecondary },

  infoBox:       { borderLeftWidth: 4, borderRadius: radius.card - 2, padding: 12, marginBottom: 12 },
  infoBoxTitle:  { fontSize: 10, marginBottom: 4 },
  infoBoxBody:   { fontSize: 9, lineHeight: 15 },
});
