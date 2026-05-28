import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, SafeAreaView, StatusBar, Dimensions,
} from 'react-native';
import { useFonts } from 'expo-font';
import { InriaSerif_400Regular, InriaSerif_700Bold } from '@expo-google-fonts/inria-serif';
import { IBMPlexMono_400Regular, IBMPlexMono_700Bold } from '@expo-google-fonts/ibm-plex-mono';
import BottomNav, { TabKey } from './BottomNav';
import { useApp } from './lib/AppContext';
import { RiskCondition } from './lib/types';
import { colors, radius, shadow } from './constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

function riskAccent(tier?: string): string {
  switch (tier) {
    case 'high':     return colors.red;
    case 'moderate': return colors.amber;
    case 'low':      return colors.blue;
    default:         return colors.green;
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

interface Props {
  onOpenReport?: (tab: number) => void;
  onTabPress?: (tab: TabKey) => void;
  onOpenChat?: () => void;
  onOpenPlan?: () => void;

  onOpenCultural?: () => void;
}

export default function DashboardScreen({
  onOpenReport, onTabPress, onOpenChat, onOpenPlan, onOpenCultural,
}: Props) {
  const [fontsLoaded] = useFonts({
    InriaSerif_400Regular,
    InriaSerif_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_700Bold,
  });

  const { report, parseResult, healthScore, dominantAncestry } = useApp();

  const serif     = fontsLoaded ? 'InriaSerif_400Regular' : undefined;
  const serifBold = fontsLoaded ? 'InriaSerif_700Bold'    : undefined;
  const mono      = fontsLoaded ? 'IBMPlexMono_400Regular': undefined;

  const conditions = report?.disease_risk.conditions ?? [];
  const computedConditions = conditions.filter(c => c.status === 'computed' && c.percentile != null);
  const topPriority: RiskCondition | null =
    computedConditions.length > 0
      ? [...computedConditions].sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0))[0]
      : null;

  const topPercentile = topPriority?.percentile ?? 72;
  const pgx     = report?.pharmacogenomics;
  const carrier  = report?.carrier_status;
  const traits   = report?.nutrition_traits;
  const source   = parseResult?.source ?? 'DNA file';
  const snpCount = parseResult?.snp_count;

  // Plan reminder — not yet persisted; stub as null so the card stays hidden
  const savedPlan: string | null = null as string | null;
  const planDate:  string | null = null as string | null;

  const reportRows = [
    { label: 'Drug Interactions', icon: '💊', subtitle: pgx    ? `${pgx.summary.genes_tested} genes tested`          : 'Pharmacogenomics', accent: colors.amber,  tab: 0 },
    { label: 'Disease Risk',      icon: '🧬', subtitle: pgx    ? `${computedConditions.length} conditions assessed`   : 'Ancestry-adjusted', accent: colors.red,    tab: 1 },
    { label: 'Carrier Status',    icon: '🔬', subtitle: carrier ? `${carrier.conditions_tested} conditions screened`  : 'Genetic variants',  accent: colors.purple, tab: 2 },
    { label: 'Nutrition & Traits',icon: '🥗', subtitle: traits  ? `${traits.total_tested} traits analyzed`            : 'Food & lifestyle',  accent: colors.blue,   tab: 3 },
    { label: 'Ancestry',          icon: '🌍', subtitle: dominantAncestry !== 'Unknown' ? dominantAncestry            : 'Composition',       accent: colors.green,  tab: 4 },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { fontFamily: serifBold }]}>Good morning, Alex</Text>
            {snpCount ? (
              <Text style={[styles.subGreeting, { fontFamily: mono }]}>
                {snpCount.toLocaleString()} SNPs · {source}
              </Text>
            ) : null}
          </View>
          <Image source={require('./assets/images/small gene tree.png')} style={styles.leafDecor} resizeMode="contain" />
        </View>

        {/* ── Health Score ────────────────────────────────────────────── */}
        <View style={[styles.card, shadow.card]}>
          <Text style={[styles.sectionLabel, { fontFamily: serif }]}>HEALTH SCORE</Text>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreNum, { fontFamily: serifBold }]}>{healthScore}</Text>
            <Text style={[styles.scoreOf,  { fontFamily: serif }]}> /100</Text>
          </View>
          <Text style={[styles.percentile, { fontFamily: serif }]}>
            {topPercentile.toFixed(0)}th percentile
            {dominantAncestry !== 'Unknown' ? ` · ${dominantAncestry} ancestry` : ''}
          </Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${healthScore}%` as any }]} />
            <View style={[styles.barDot,  { left: `${healthScore}%` as any, marginLeft: -5.5 }]} />
          </View>
        </View>

        {/* ── Equity Callout ─────────────────────────────────────────── */}
        <View style={styles.equityBanner}>
          <Text style={styles.equityIcon}>🌍</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.equityTitle, { fontFamily: serifBold }]}>Ancestry-Adjusted Scores</Text>
            <Text style={[styles.equityBody, { fontFamily: serif }]}>
              Every risk score corrects for{dominantAncestry !== 'Unknown' ? ` ${dominantAncestry}` : ' multi-ancestry'} population weights — addressing the 78–80% European data bias in genomic research.
            </Text>
          </View>
        </View>

        {/* ── Top Priority ────────────────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { fontFamily: serifBold }]}>TOP PRIORITY</Text>

        {topPriority ? (
          <TouchableOpacity style={[styles.priorityCard, shadow.card]} onPress={() => onOpenReport?.(1)} activeOpacity={0.8}>
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
                <Text style={[styles.priorityDesc, { fontFamily: serif }]}>{topPriority.description}</Text>
              ) : null}
              <Text style={[styles.priorityRisk, { fontFamily: serifBold }]}>
                {topPriority.percentile?.toFixed(0)}th percentile risk
              </Text>
              <Text style={[styles.priorityLink, { fontFamily: serif }]}>See full report →</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={[styles.priorityCard, shadow.card]}>
            <View style={[styles.accentBar, { backgroundColor: colors.green }]} />
            <View style={styles.priorityContent}>
              <Text style={[styles.geneName, { fontFamily: serifBold }]}>No high-risk findings</Text>
              <Text style={[styles.priorityDesc, { fontFamily: serif }]}>
                Your risk scores are within normal range. Keep up healthy habits.
              </Text>
            </View>
          </View>
        )}

        {/* ── AI Assistant ────────────────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { fontFamily: serifBold, marginTop: 14 }]}>AI ASSISTANT</Text>
        <View style={styles.aiRow}>
          {/* Ask Your DNA — olive */}
          <TouchableOpacity style={[styles.aiCard, { backgroundColor: colors.olive }]} onPress={onOpenChat} activeOpacity={0.82}>
            <Text style={styles.aiCardIcon}>🧬</Text>
            <Text style={[styles.aiCardTitle, { fontFamily: serifBold }]}>Ask Your DNA</Text>
            <Text style={[styles.aiCardSub,   { fontFamily: serif }]}>Chat with AI</Text>
            <Text style={styles.aiCardArrow}>→</Text>
          </TouchableOpacity>
          {/* 7-Day Plan — green */}
          <TouchableOpacity style={[styles.aiCard, { backgroundColor: '#1E6B35' }]} onPress={onOpenPlan} activeOpacity={0.82}>
            <Text style={styles.aiCardIcon}>📅</Text>
            <Text style={[styles.aiCardTitle, { fontFamily: serifBold }]}>7-Day Plan</Text>
            <Text style={[styles.aiCardSub,   { fontFamily: serif }]}>Personalized meals</Text>
            <Text style={styles.aiCardArrow}>→</Text>
          </TouchableOpacity>

        </View>

        {/* Cultural Nutrition — teal */}
        <TouchableOpacity style={[styles.culturalCard, shadow.card]} onPress={onOpenCultural} activeOpacity={0.82}>
          <View style={[styles.accentBar, { backgroundColor: colors.teal }]} />
          <View style={styles.culturalInner}>
            <Text style={styles.culturalIcon}>🌏</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.culturalTitle, { fontFamily: serifBold }]}>Cultural Nutrition</Text>
              <Text style={[styles.culturalSub, { fontFamily: serif }]}>Cuisine-aware food recs from your DNA</Text>
            </View>
            <Text style={[styles.chevron, { fontFamily: serif }]}>›</Text>
          </View>
        </TouchableOpacity>

        {/* ── Saved Plan Reminder ──────────────────────────────────────── */}
        {savedPlan && (
          <TouchableOpacity style={styles.priorityCard} onPress={onOpenPlan} activeOpacity={0.8}>
            <View style={[styles.accentBar, { backgroundColor: colors.green }]} />
            <View style={{ padding: 12, flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[styles.geneName, { fontFamily: serifBold }]}>📋 Your 7-Day Plan</Text>
                {planDate && <Text style={[styles.priorityDesc, { fontFamily: serif }]}>{planDate}</Text>}
              </View>
              <Text style={[styles.priorityDesc, { fontFamily: serif }]} numberOfLines={2}>
                {savedPlan.slice(0, 120)}…
              </Text>
              <Text style={[styles.priorityLink, { fontFamily: serif }]}>View full plan →</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Explore Reports ─────────────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { fontFamily: serifBold, marginTop: 14 }]}>EXPLORE YOUR REPORTS</Text>

        <View style={[styles.reportsCard, shadow.card]}>
          {reportRows.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.reportRow, i < reportRows.length - 1 && styles.reportRowBorder]}
              activeOpacity={0.7}
              onPress={() => onOpenReport?.(item.tab)}
            >
              <View style={[styles.reportAccent, { backgroundColor: item.accent }]} />
              <View style={[styles.reportIconBubble, { backgroundColor: item.accent + '22' }]}>
                <Text style={styles.reportIconEmoji}>{item.icon}</Text>
              </View>
              <View style={styles.reportLabels}>
                <Text style={[styles.reportTitle, { fontFamily: serifBold }]}>{item.label}</Text>
                <Text style={[styles.reportSubtitle, { fontFamily: serif }]}>{item.subtitle}</Text>
              </View>
              <Text style={[styles.chevron, { fontFamily: serif }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <BottomNav activeTab="home" onTabPress={onTabPress ?? (() => {})} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 16 },

  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  greeting:   { fontSize: 22, color: colors.textPrimary },
  subGreeting: { fontSize: 10, color: colors.textSecondary, marginTop: 3 },
  leafDecor:  { width: 48, height: 48, opacity: 0.85 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.card, padding: 14, marginBottom: 14,
  },
  sectionLabel: { fontSize: 9, color: colors.textLight, marginBottom: 4, letterSpacing: 0.6 },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2 },
  scoreNum: { fontSize: 40, color: colors.textPrimary, lineHeight: 46 },
  scoreOf:  { fontSize: 15, color: colors.textSecondary, marginBottom: 8 },
  percentile: { fontSize: 10, color: colors.textSecondary, marginBottom: 10 },
  barTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, position: 'relative' },
  barFill:  { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.green, borderRadius: 3 },
  barDot:   { position: 'absolute', top: -3, width: 11, height: 11, borderRadius: 6, backgroundColor: colors.green },

  // Equity callout
  equityBanner: {
    backgroundColor: colors.greenLightBg,
    borderRadius: radius.card, padding: 12, marginBottom: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderWidth: 1, borderColor: colors.greenSoft,
  },
  equityIcon:  { fontSize: 18, marginTop: 1 },
  equityTitle: { fontSize: 11, color: colors.olive, marginBottom: 3 },
  equityBody:  { fontSize: 9,  color: colors.textSecondary, lineHeight: 14 },

  sectionHeader: { fontSize: 9, color: colors.textLight, marginBottom: 8, letterSpacing: 0.6 },

  priorityCard: {
    backgroundColor: colors.surface, borderRadius: radius.card, flexDirection: 'row',
    marginBottom: 14, overflow: 'hidden',
  },
  accentBar: { width: 4 },
  priorityContent: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  priorityTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 5, gap: 8 },
  geneName:   { fontSize: 13, color: colors.textPrimary, flex: 1, flexWrap: 'wrap' },
  riskBadge:  { borderRadius: radius.badge, paddingHorizontal: 7, paddingVertical: 3, flexShrink: 0 },
  riskBadgeText: { color: '#fff', fontSize: 8, letterSpacing: 0.3 },
  priorityDesc: { fontSize: 10, color: colors.textSecondary, marginBottom: 3 },
  priorityRisk: { fontSize: 10, color: colors.red, marginBottom: 4 },
  priorityLink: { fontSize: 10, color: colors.green },

  // AI cards
  aiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  aiCard: {
    flex: 1, borderRadius: radius.card, padding: 14,
    gap: 3, position: 'relative',
  },
  aiCardIcon:  { fontSize: 22, marginBottom: 4 },
  aiCardTitle: { fontSize: 13, color: '#fff' },
  aiCardSub:   { fontSize: 9,  color: 'rgba(255,255,255,0.75)' },
  aiCardArrow: { position: 'absolute', right: 12, top: 14, fontSize: 16, color: 'rgba(255,255,255,0.6)' },

  culturalCard: {
    backgroundColor: colors.surface, borderRadius: radius.card,
    flexDirection: 'row', marginBottom: 14, overflow: 'hidden',
  },
  culturalInner: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 10 },
  culturalIcon:  { fontSize: 22 },
  culturalTitle: { fontSize: 13, color: colors.textPrimary, marginBottom: 2 },
  culturalSub:   { fontSize: 9, color: colors.textSecondary },

  reportsCard: {
    backgroundColor: colors.surface, borderRadius: radius.card, overflow: 'hidden', marginBottom: 0,
  },
  reportRow: { flexDirection: 'row', alignItems: 'center', height: 56, paddingRight: 14, gap: 10 },
  reportRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  reportAccent:  { width: 4, alignSelf: 'stretch' },
  reportIconBubble: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  reportIconEmoji: { fontSize: 16 },
  reportLabels: { flex: 1 },
  reportTitle:    { fontSize: 12, color: colors.textPrimary, marginBottom: 2 },
  reportSubtitle: { fontSize: 9,  color: colors.textSecondary },
  chevron: { fontSize: 20, color: colors.textLight, marginTop: -1 },
});
