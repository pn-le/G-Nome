import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, SafeAreaView, StatusBar, Dimensions,
} from 'react-native';
import { useFonts } from 'expo-font';
import { InriaSerif_400Regular, InriaSerif_700Bold } from '@expo-google-fonts/inria-serif';
import Svg, { Circle } from 'react-native-svg';
import BottomNav, { TabKey } from './BottomNav';
import { useApp } from './lib/AppContext';
import { RiskCondition } from './lib/types';
import { getLifestylePlan } from './lib/api';

const C = {
  bg:            '#F7F6F2',
  surface:       '#FFFFFF',
  textPrimary:   '#1A1B14',
  textSecondary: '#686760',
  textLight:     '#A6A59F',
  green:         '#44A353',
  olive:         '#363E28',
  red:           '#EB412A',
  amber:         '#F5A62B',
  border:        '#E5E2DB',
  lightGreen:    '#EEF2E9',
};

const { width: SCREEN_W } = Dimensions.get('window');

// Badge color from risk tier
function riskAccent(tier?: string): string {
  switch (tier) {
    case 'high':     return C.red;
    case 'moderate': return C.amber;
    case 'low':      return '#4A90F9';
    default:         return C.green;
  }
}

function riskBadgeLabel(tier?: string, label?: string): string {
  if (label) return label.toUpperCase();
  switch (tier) {
    case 'high':     return 'HIGH RISK';
    case 'moderate': return 'ELEVATED';
    case 'average':  return 'AVERAGE';
    case 'low':      return 'LOW';
    default:         return 'UNKNOWN';
  }
}

const REPORT_TABS: { key: number; accent: string }[] = [
  { key: 0, accent: C.amber  },
  { key: 1, accent: C.red    },
  { key: 2, accent: '#9966FE'},
  { key: 3, accent: '#4A90F9'},
  { key: 4, accent: C.green  },
];

interface Props {
  onOpenReport?: (tab: number) => void;
  onTabPress?: (tab: TabKey) => void;
  onOpenChat?: () => void;
  onOpenPlan?: () => void;
  onOpenCultural?: () => void;
}

export default function DashboardScreen({ onOpenReport, onTabPress, onOpenChat, onOpenPlan, onOpenCultural }: Props) {
  const [fontsLoaded] = useFonts({ InriaSerif_400Regular, InriaSerif_700Bold });
  const { report, parseResult, healthScore, dominantAncestry, sessionId } = useApp();

  const serif     = fontsLoaded ? 'InriaSerif_400Regular' : undefined;
  const serifBold = fontsLoaded ? 'InriaSerif_700Bold'    : undefined;

  // Saved plan preview
  const [savedPlan, setSavedPlan] = useState<string | null>(null);
  const [planDate, setPlanDate] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const res = await getLifestylePlan(sessionId);
        if (res.plan) {
          setSavedPlan(res.plan);
          setPlanDate(res.created_at ? new Date(res.created_at).toLocaleDateString() : null);
        }
      } catch {}
    })();
  }, [sessionId]);

  // — Derived data —
  const conditions = report?.disease_risk.conditions ?? [];
  const computedConditions = conditions.filter(c => c.status === 'computed' && c.percentile != null);

  const topPriority: RiskCondition | null =
    computedConditions.length > 0
      ? [...computedConditions].sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0))[0]
      : null;

  const topPercentile = topPriority?.percentile ?? 72;

  const pgx    = report?.pharmacogenomics;
  const carrier = report?.carrier_status;
  const traits  = report?.nutrition_traits;

  const reportRows = [
    { label: 'Drug Interactions', subtitle: pgx    ? `${pgx.summary.genes_tested} genes`  : '—', accent: C.red,   icon: '💊', tab: 0 },
    { label: 'Disease Risk',      subtitle: pgx    ? `${computedConditions.length} risks` : '—', accent: C.amber, icon: '⚠️', tab: 1 },
    { label: 'Carrier Status',    subtitle: carrier ? `${carrier.conditions_tested} tests` : '—', accent: '#9966FE', icon: '🧬', tab: 2 },
  ];

  const source = parseResult?.source ?? 'DNA file';
  const snpCount = parseResult?.snp_count;
  
  // Gauge rendering math
  const radius = 55;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthScore / 100) * circumference;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { fontFamily: serifBold }]}>Good morning, Alex</Text>
            {snpCount && (
              <Text style={[styles.subGreeting, { fontFamily: serif }]}>
                {snpCount.toLocaleString()} SNPs analyzed
              </Text>
            )}
          </View>
        </View>

        {/* ── Health Score Gauge ───────────────────────────────────────── */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{ position: 'relative', width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={140} height={140} viewBox="0 0 140 140">
              <Circle cx="70" cy="70" r={radius} stroke="#EBEBEB" strokeWidth={strokeWidth} fill="none" />
              <Circle 
                cx="70" cy="70" r={radius} 
                stroke={C.green} strokeWidth={strokeWidth} fill="none" 
                strokeDasharray={circumference} 
                strokeDashoffset={strokeDashoffset} 
                strokeLinecap="round" 
                transform="rotate(-90 70 70)" 
              />
            </Svg>
            <View style={{ position: 'absolute', alignItems: 'center' }}>
              <Text style={{ fontSize: 36, fontFamily: serifBold, color: C.textPrimary, marginBottom: -6 }}>{healthScore}</Text>
              <Text style={{ fontSize: 13, fontFamily: serif, color: C.textSecondary }}>/100</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, fontFamily: serif, color: C.textSecondary, marginTop: 4 }}>
            {topPercentile.toFixed(0)}nd percentile
          </Text>
        </View>

        {/* ── Top Priority ────────────────────────────────────────────── */}
        {topPriority ? (
          <TouchableOpacity style={styles.priorityCard} onPress={() => onOpenReport?.(1)} activeOpacity={0.8}>
            <View style={[styles.accentBar, { backgroundColor: riskAccent(topPriority.risk_tier) }]} />
            <View style={styles.priorityContent}>
              <View style={styles.priorityTopRow}>
                <Text style={[styles.geneName, { fontFamily: serifBold }]}>
                  {topPriority.label ?? topPriority.condition}
                </Text>
                <View style={[styles.riskBadge, { backgroundColor: riskAccent(topPriority.risk_tier) }]}>
                  <Text style={[styles.riskBadgeText, { fontFamily: serifBold }]}>
                    {riskBadgeLabel(topPriority.risk_tier, topPriority.risk_label)}
                  </Text>
                </View>
              </View>
              {topPriority.description ? (
                <Text style={[styles.priorityDesc, { fontFamily: serif }]}>Increased risk for breast cancer</Text>
              ) : null}
              <Text style={[styles.priorityLink, { fontFamily: serif, marginTop: 4 }]}>See full report →</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.priorityCard}>
            <View style={[styles.accentBar, { backgroundColor: C.green }]} />
            <View style={styles.priorityContent}>
              <Text style={[styles.geneName, { fontFamily: serifBold }]}>No high-risk findings</Text>
              <Text style={[styles.priorityDesc, { fontFamily: serif }]}>
                Your risk scores are within normal range. Keep up healthy habits.
              </Text>
            </View>
          </View>
        )}
        
        {/* Ancestry Adjusted Note */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.lightGreen, padding: 12, borderRadius: 12, marginBottom: 20 }}>
          <Text style={{ fontSize: 18, marginRight: 12 }}>⚖️</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.textPrimary }}>Ancestry Adjusted Scores</Text>
            <Text style={{ fontSize: 10, color: C.textSecondary, marginTop: 2 }}>Risk calculations use your Ancestry population weights</Text>
          </View>
        </View>

        {/* ── AI Features (Side by Side) ─────────────────────────────────────────── */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
          <TouchableOpacity style={[styles.actionCard, { backgroundColor: C.olive }]} onPress={onOpenChat} activeOpacity={0.8}>
            <Text style={{ fontSize: 20, marginBottom: 8 }}>💬</Text>
            <Text style={[styles.actionCardTitle, { fontFamily: serifBold }]}>Ask Your DNA</Text>
            <Text style={[styles.actionCardDesc, { fontFamily: serif }]}>Powered by your genomic profile</Text>
            <View style={{ marginTop: 'auto', alignSelf: 'flex-end' }}>
              <Text style={{ color: '#fff', fontSize: 16 }}>→</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionCard, { backgroundColor: C.green }]} onPress={onOpenPlan} activeOpacity={0.8}>
            <Text style={{ fontSize: 20, marginBottom: 8 }}>📅</Text>
            <Text style={[styles.actionCardTitle, { fontFamily: serifBold }]}>7 Day Plan</Text>
            <Text style={[styles.actionCardDesc, { fontFamily: serif }]}>Tailored to your DNA & ancestry</Text>
            <View style={{ marginTop: 'auto', alignSelf: 'flex-end' }}>
              <Text style={{ color: '#fff', fontSize: 16 }}>→</Text>
            </View>
          </TouchableOpacity>
        </View>
        
        {/* Cultural Nutrition button */}
        <TouchableOpacity style={[styles.priorityCard, { marginBottom: 24, height: 70 }]} onPress={onOpenCultural} activeOpacity={0.8}>
          <View style={[styles.accentBar, { backgroundColor: '#0D9488' }]} />
          <View style={{ padding: 12, justifyContent: 'center', flex: 1 }}>
            <Text style={[styles.geneName, { fontFamily: serifBold, marginBottom: 2 }]}>🌏  Cultural Nutrition</Text>
            <Text style={[styles.priorityDesc, { fontFamily: serif, marginBottom: 0 }]}>Cuisine-aware food recs from your DNA</Text>
          </View>
        </TouchableOpacity>

        {/* ── Explore Reports ─────────────────────────────────────────── */}

        <Text style={[styles.sectionHeader, { fontFamily: serifBold, fontSize: 14, color: C.textPrimary }]}>Explore Your Reports</Text>

        <View style={styles.reportsList}>
          {reportRows.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={styles.reportRow}
              activeOpacity={0.7}
              onPress={() => onOpenReport?.(item.tab)}
            >
              <View style={styles.reportIconContainer}>
                <Text style={{ fontSize: 16 }}>{item.icon}</Text>
              </View>
              <Text style={[styles.reportTitle, { fontFamily: serifBold }]}>{item.label}</Text>
              <Text style={[styles.reportSubtitle, { fontFamily: serif }]}>{item.subtitle}</Text>
              <Text style={[styles.chevron, { fontFamily: serif }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <BottomNav activeTab="home" onTabPress={onTabPress ?? (() => {})} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 16 },

  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, marginTop: 10 },
  greeting: { fontSize: 23, color: C.textPrimary },
  subGreeting: { fontSize: 11, color: C.textSecondary, marginTop: 2 },

  sectionHeader: { fontSize: 10, color: C.textSecondary, marginBottom: 8, letterSpacing: 0.2 },

  priorityCard: {
    backgroundColor: C.surface, borderRadius: 11, flexDirection: 'row',
    marginBottom: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  accentBar: { width: 4 },
  priorityContent: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  priorityTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 5, gap: 8 },
  geneName: { fontSize: 13, color: C.textPrimary, flex: 1, flexWrap: 'wrap' },
  riskBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, flexShrink: 0 },
  riskBadgeText: { color: '#fff', fontSize: 8, letterSpacing: 0.3 },
  priorityDesc: { fontSize: 10, color: C.textSecondary, marginBottom: 3 },
  priorityLink: { fontSize: 10, color: C.green },

  actionCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 110,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  actionCardTitle: { fontSize: 14, color: '#fff', marginBottom: 4 },
  actionCardDesc: { fontSize: 10, color: 'rgba(255,255,255,0.85)', lineHeight: 14 },

  reportsList: { gap: 10, marginTop: 4 },
  reportRow: { 
    flexDirection: 'row', alignItems: 'center', height: 60, 
    backgroundColor: C.surface, borderRadius: 12, paddingHorizontal: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  reportIconContainer: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F9F9F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  reportTitle:    { fontSize: 13, color: C.textPrimary, flex: 1 },
  reportSubtitle: { fontSize: 10,  color: C.textLight, marginRight: 8 },
  chevron: { fontSize: 18, color: C.textLight, marginTop: -2 },
});
