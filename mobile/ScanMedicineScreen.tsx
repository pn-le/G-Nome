import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface Props {
  onBack: () => void;
}

const { width: SW } = Dimensions.get('window');

const FRAME_SIDE = 60;
const FRAME_W    = SW - FRAME_SIDE * 2;
const FRAME_H    = 180;
const MASK_TOP   = 70; // dark mask height above frame

const C = {
  dark:       '#121510',
  surface:    '#FFFFFF',
  primary:    '#1A1B14',
  secondary:  '#686760',
  green:      '#44A353',
  olive:      '#363E28',
  orange:     '#F5A62B',
  purple:     '#8D8DF9',
  border:     '#E5E2DB',
  amber:      '#FEF8EE',
  lightGreen: '#F0F8F1',
  muted:      '#99A68C',
};

const MOCK = {
  name:     'Ibuprofen 400mg',
  brands:   'Advil · Motrin · Nurofen',
  severity: 'WATCH',
  gene:     'CYP2C19',
  insights: [
    {
      gene:  'CYP2C19 *1/*2',
      text:  'You are an intermediate metabolizer. Ibuprofen clearance may be reduced — monitor for increased side effects.',
      color: C.orange,
      bg:    C.amber,
    },
    {
      gene:  'G6PD Status',
      text:  'No known G6PD variant. Standard dosing applies.',
      color: C.green,
      bg:    C.lightGreen,
    },
  ],
  precautions: [
    'Avoid if taking blood thinners',
    'Take with food to reduce GI risk',
    'Max 3 days without physician review',
  ],
};

export default function ScanMedicineScreen({ onBack }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const scanY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, { toValue: FRAME_H - 2, duration: 1600, useNativeDriver: true }),
        Animated.timing(scanY, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={s.root}>
      {/* ── Header ── */}
      <SafeAreaView style={s.safeHeader}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backPill} onPress={onBack} activeOpacity={0.8}>
            <Text style={s.backText}>← Scan</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.pageTitle}>Scan Medicine</Text>
            <Text style={s.pageSubtitle}>Point at a barcode or drug label</Text>
          </View>
          {/* spacer to balance back pill */}
          <View style={{ width: 74 }} />
        </View>
      </SafeAreaView>

      {/* ── Camera zone ── */}
      <View style={s.cameraZone}>
        {permission?.granted ? (
          <CameraView style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: C.dark }]} />
        )}

        {/* Dark masks around the scanning frame */}
        <View style={[s.mask, { top: 0,              left: 0,          right: 0,         height: MASK_TOP }]} />
        <View style={[s.mask, { top: MASK_TOP,        left: 0,          width: FRAME_SIDE, bottom: 0 }]} />
        <View style={[s.mask, { top: MASK_TOP,        right: 0,         width: FRAME_SIDE, bottom: 0 }]} />
        <View style={[s.mask, { top: MASK_TOP + FRAME_H, left: 0,       right: 0,         bottom: 0 }]} />

        {/* Corner brackets — top-left */}
        <View style={[s.bH, { left: FRAME_SIDE,       top: MASK_TOP }]} />
        <View style={[s.bV, { left: FRAME_SIDE,       top: MASK_TOP }]} />
        {/* top-right */}
        <View style={[s.bH, { right: FRAME_SIDE,      top: MASK_TOP, transform: [{ scaleX: -1 }] }]} />
        <View style={[s.bV, { right: FRAME_SIDE,      top: MASK_TOP, transform: [{ scaleX: -1 }] }]} />
        {/* bottom-left */}
        <View style={[s.bH, { left: FRAME_SIDE,       top: MASK_TOP + FRAME_H - 3 }]} />
        <View style={[s.bV, { left: FRAME_SIDE,       top: MASK_TOP + FRAME_H - 24 }]} />
        {/* bottom-right */}
        <View style={[s.bH, { right: FRAME_SIDE,      top: MASK_TOP + FRAME_H - 3, transform: [{ scaleX: -1 }] }]} />
        <View style={[s.bV, { right: FRAME_SIDE,      top: MASK_TOP + FRAME_H - 24, transform: [{ scaleX: -1 }] }]} />

        {/* Animated scan line */}
        <Animated.View
          style={[s.scanLine, { top: MASK_TOP, left: FRAME_SIDE + 8, transform: [{ translateY: scanY }] }]}
        />

        {/* Hint below frame */}
        <Text style={[s.alignHint, { top: MASK_TOP + FRAME_H + 18 }]}>
          Align barcode within the frame
        </Text>
      </View>

      {/* ── Result card ── */}
      <ScrollView
        style={s.card}
        contentContainerStyle={s.cardContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.drugName}>{MOCK.name}</Text>
        <Text style={s.drugBrands}>{MOCK.brands}</Text>

        <View style={s.badgeRow}>
          <Badge label={MOCK.severity} color={C.orange} />
          <Badge label={MOCK.gene}     color={C.purple} />
        </View>

        <View style={s.divider} />

        <Text style={s.sectionLabel}>Your Gene Insights</Text>
        {MOCK.insights.map((ins, i) => (
          <View key={i} style={[s.insightBox, { backgroundColor: ins.bg }]}>
            <View style={[s.insightBar, { backgroundColor: ins.color }]} />
            <View style={s.insightBody}>
              <Text style={s.insightGene}>{ins.gene}</Text>
              <Text style={s.insightText}>{ins.text}</Text>
            </View>
          </View>
        ))}

        <Text style={[s.sectionLabel, { marginTop: 14 }]}>General Precautions</Text>
        {MOCK.precautions.map((p, i) => (
          <View key={i} style={s.bulletRow}>
            <View style={[s.bullet, { backgroundColor: i === 0 ? '#E53E3E' : C.orange }]} />
            <Text style={s.bulletText}>{p}</Text>
          </View>
        ))}

        <TouchableOpacity style={s.ctaBtn} activeOpacity={0.85} onPress={onBack}>
          <Text style={s.ctaText}>View Full Pharmacogenomics Report</Text>
        </TouchableOpacity>

        <Text style={s.disclaimer}>
          Discuss with your prescriber before making any medication changes.
        </Text>
      </ScrollView>
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.badge, { backgroundColor: color }]}>
      <Text style={s.badgeText}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.dark },

  // Header
  safeHeader: { backgroundColor: C.dark },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 12 : 4,
    paddingBottom: 8,
  },
  backPill: {
    backgroundColor: 'rgba(54,62,40,0.85)',
    borderRadius: 15,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  backText:    { color: '#FFF', fontSize: 12, fontWeight: '600' },
  headerCenter:{ flex: 1, alignItems: 'center' },
  pageTitle:   { fontSize: 17, color: '#FFF', fontWeight: '600' },
  pageSubtitle:{ fontSize: 12, color: C.muted, marginTop: 2 },

  // Camera zone
  cameraZone: { flex: 1, backgroundColor: C.dark, overflow: 'hidden' },
  mask: { position: 'absolute', backgroundColor: 'rgba(18,21,16,0.55)' },

  // Corner bracket pieces
  bH: { position: 'absolute', width: 24, height: 3, backgroundColor: C.green, borderRadius: 1 },
  bV: { position: 'absolute', width: 3, height: 24, backgroundColor: C.green, borderRadius: 1 },

  // Scan line
  scanLine: {
    position: 'absolute',
    height: 2,
    width: FRAME_W - 16,
    backgroundColor: C.green,
    opacity: 0.85,
    borderRadius: 1,
  },

  alignHint: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    fontSize: 12,
    color: C.muted,
  },

  // Result card
  card: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '55%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  cardContent: { padding: 16, paddingBottom: 36 },

  drugName:   { fontSize: 17, fontWeight: '600', color: C.primary },
  drugBrands: { fontSize: 11, color: C.secondary, marginTop: 2, marginBottom: 10 },

  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  badge:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
  badgeText:{ fontSize: 8, color: '#FFF', fontWeight: '700' },

  divider: { height: 1, backgroundColor: C.border, marginVertical: 10 },

  sectionLabel: { fontSize: 13, fontWeight: '600', color: C.primary, marginBottom: 8 },

  insightBox: {
    flexDirection: 'row',
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
    minHeight: 62,
  },
  insightBar:  { width: 3 },
  insightBody: { flex: 1, padding: 10 },
  insightGene: { fontSize: 10, fontWeight: '600', color: C.primary, marginBottom: 4 },
  insightText: { fontSize: 9, color: C.secondary, lineHeight: 13 },

  bulletRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingLeft: 4 },
  bullet:    { width: 6, height: 6, borderRadius: 3, marginRight: 10 },
  bulletText:{ fontSize: 10, color: C.secondary, flex: 1 },

  ctaBtn: {
    backgroundColor: C.olive,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  ctaText:    { color: '#FFF', fontSize: 11, fontWeight: '600' },
  disclaimer: { fontSize: 9, color: C.muted, textAlign: 'center', lineHeight: 13 },
});
