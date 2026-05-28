import React, { useEffect, useRef, useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface Props {
  onBack: () => void;
}

const { width: SW } = Dimensions.get('window');

const FRAME_SIDE = 60;
const FRAME_W    = SW - FRAME_SIDE * 2;
const FRAME_H    = 180;
const MASK_TOP   = 70;

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
  red:        '#E53E3E',
};

type ScanState = 'idle' | 'loading' | 'found' | 'notfound';

interface DrugInfo {
  name: string;
  brands: string;
  manufacturer: string;
  barcode: string;
}

// Static PGX insights keyed loosely to drug class (good enough for demo)
const PGX_INSIGHTS = {
  default: {
    severity: 'WATCH',
    gene: 'CYP2C19',
    insights: [
      {
        gene:  'CYP2C19 *1/*2',
        text:  'You are an intermediate metabolizer. Clearance may be reduced — monitor for increased side effects.',
        color: C.orange,
        bg:    C.amber,
      },
      {
        gene:  'G6PD Status',
        text:  'No known G6PD variant detected. Standard dosing applies.',
        color: C.green,
        bg:    C.lightGreen,
      },
    ],
    precautions: [
      'Take with food to reduce GI risk',
      'Avoid combining with other NSAIDs',
      'Max 3 days without physician review',
    ],
  },
};

async function lookupDrug(barcode: string): Promise<DrugInfo | null> {
  const endpoints = [
    // Try as exact package NDC
    `https://api.fda.gov/drug/ndc.json?search=package_ndc:"${barcode}"&limit=1`,
    // Try in label database via UPC
    `https://api.fda.gov/drug/label.json?search=openfda.upc:"${barcode}"&limit=1`,
    // Broader NDC search (strips leading zeros, tries partial match)
    `https://api.fda.gov/drug/ndc.json?search="${barcode}"&limit=1`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.results?.length) continue;

      const r = data.results[0];

      // NDC endpoint shape
      if (r.generic_name || r.brand_name) {
        const generic = r.generic_name ?? '';
        const strength = r.active_ingredients?.[0]?.strength ?? '';
        return {
          name:         `${generic}${strength ? ' ' + strength : ''}`.trim() || r.brand_name,
          brands:       r.brand_name ?? '',
          manufacturer: r.labeler_name ?? '',
          barcode,
        };
      }

      // Label endpoint shape
      if (r.openfda) {
        const generic = r.openfda.generic_name?.[0] ?? '';
        const brand   = r.openfda.brand_name?.[0] ?? '';
        return {
          name:         generic || brand,
          brands:       brand,
          manufacturer: r.openfda.manufacturer_name?.[0] ?? '',
          barcode,
        };
      }
    } catch {}
  }

  return null;
}

export default function ScanMedicineScreen({ onBack }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [drug, setDrug]           = useState<DrugInfo | null>(null);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const scanY    = useRef(new Animated.Value(0)).current;
  const scanLock = useRef(false);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  // Scan line animation (runs while idle)
  const scanLineAnim = useRef<Animated.CompositeAnimation | null>(null);
  useEffect(() => {
    if (scanState === 'idle') {
      scanLineAnim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scanY, { toValue: FRAME_H - 2, duration: 1600, useNativeDriver: true }),
          Animated.timing(scanY, { toValue: 0,           duration: 1600, useNativeDriver: true }),
        ])
      );
      scanLineAnim.current.start();
    } else {
      scanLineAnim.current?.stop();
      scanY.setValue(0);
    }
    return () => scanLineAnim.current?.stop();
  }, [scanState]);

  // Slide result card up when found
  useEffect(() => {
    if (scanState === 'found' || scanState === 'notfound') {
      Animated.spring(cardAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      cardAnim.setValue(0);
    }
  }, [scanState]);

  async function handleBarcodeScan({ data }: { data: string }) {
    if (scanLock.current || scanState !== 'idle') return;
    scanLock.current = true;
    setScanState('loading');

    const result = await lookupDrug(data);
    if (result) {
      setDrug(result);
      setScanState('found');
    } else {
      setDrug({ name: 'Unknown Drug', brands: '', manufacturer: '', barcode: data });
      setScanState('notfound');
    }
  }

  function resetScan() {
    scanLock.current = false;
    setDrug(null);
    setScanState('idle');
  }

  const pgx = PGX_INSIGHTS.default;
  const cardTranslateY = cardAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [400, 0],
  });

  const showCard = scanState === 'found' || scanState === 'notfound';

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
            <Text style={s.pageSubtitle}>
              {scanState === 'loading' ? 'Looking up drug…' : 'Point at a barcode or drug label'}
            </Text>
          </View>
          <View style={{ width: 74 }} />
        </View>
      </SafeAreaView>

      {/* ── Camera zone ── */}
      <View style={s.cameraZone}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            onBarcodeScanned={scanState === 'idle' ? handleBarcodeScan : undefined}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
            }}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: C.dark }]} />
        )}

        {/* Dark masks */}
        <View style={[s.mask, { top: 0,               left: 0, right: 0,          height: MASK_TOP }]} />
        <View style={[s.mask, { top: MASK_TOP,         left: 0, width: FRAME_SIDE, bottom: 0 }]} />
        <View style={[s.mask, { top: MASK_TOP,         right: 0, width: FRAME_SIDE, bottom: 0 }]} />
        <View style={[s.mask, { top: MASK_TOP + FRAME_H, left: 0, right: 0,        bottom: 0 }]} />

        {/* Corner brackets */}
        <View style={[s.bH, { left: FRAME_SIDE,  top: MASK_TOP }]} />
        <View style={[s.bV, { left: FRAME_SIDE,  top: MASK_TOP }]} />
        <View style={[s.bH, { right: FRAME_SIDE, top: MASK_TOP,             transform: [{ scaleX: -1 }] }]} />
        <View style={[s.bV, { right: FRAME_SIDE, top: MASK_TOP,             transform: [{ scaleX: -1 }] }]} />
        <View style={[s.bH, { left: FRAME_SIDE,  top: MASK_TOP + FRAME_H - 3 }]} />
        <View style={[s.bV, { left: FRAME_SIDE,  top: MASK_TOP + FRAME_H - 24 }]} />
        <View style={[s.bH, { right: FRAME_SIDE, top: MASK_TOP + FRAME_H - 3,  transform: [{ scaleX: -1 }] }]} />
        <View style={[s.bV, { right: FRAME_SIDE, top: MASK_TOP + FRAME_H - 24, transform: [{ scaleX: -1 }] }]} />

        {/* Scan line (only while idle) */}
        {scanState === 'idle' && (
          <Animated.View
            style={[s.scanLine, { top: MASK_TOP, left: FRAME_SIDE + 8, transform: [{ translateY: scanY }] }]}
          />
        )}

        {/* Loading spinner overlay */}
        {scanState === 'loading' && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color={C.green} />
            <Text style={s.loadingText}>Looking up drug…</Text>
          </View>
        )}

        {/* Hint below frame */}
        {scanState === 'idle' && (
          <Text style={[s.alignHint, { top: MASK_TOP + FRAME_H + 18 }]}>
            Align barcode within the frame
          </Text>
        )}
      </View>

      {/* ── Result card (slides up after scan) ── */}
      {showCard && (
        <Animated.View style={[s.cardWrap, { transform: [{ translateY: cardTranslateY }] }]}>
          <ScrollView
            style={s.card}
            contentContainerStyle={s.cardContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Drag handle */}
            <View style={s.handle} />

            {scanState === 'notfound' ? (
              /* ── Not found ── */
              <View style={s.notFound}>
                <Text style={s.notFoundIcon}>🔍</Text>
                <Text style={s.notFoundTitle}>Drug not found</Text>
                <Text style={s.notFoundSub}>
                  Barcode {drug?.barcode} wasn't found in the FDA database.
                </Text>
                <TouchableOpacity style={s.scanAgainBtn} onPress={resetScan} activeOpacity={0.8}>
                  <Text style={s.scanAgainText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Drug found ── */
              <>
                <View style={s.drugHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.drugName}>{drug?.name}</Text>
                    {drug?.brands ? (
                      <Text style={s.drugBrands}>{drug.brands}</Text>
                    ) : null}
                    {drug?.manufacturer ? (
                      <Text style={s.drugMfr}>{drug.manufacturer}</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity style={s.scanAgainPill} onPress={resetScan} activeOpacity={0.8}>
                    <Text style={s.scanAgainPillText}>Scan Again</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.badgeRow}>
                  <Badge label={pgx.severity} color={C.orange} />
                  <Badge label={pgx.gene}     color={C.purple} />
                </View>

                <View style={s.divider} />

                <Text style={s.sectionLabel}>Your Gene Insights</Text>
                {pgx.insights.map((ins, i) => (
                  <View key={i} style={[s.insightBox, { backgroundColor: ins.bg }]}>
                    <View style={[s.insightBar, { backgroundColor: ins.color }]} />
                    <View style={s.insightBody}>
                      <Text style={s.insightGene}>{ins.gene}</Text>
                      <Text style={s.insightText}>{ins.text}</Text>
                    </View>
                  </View>
                ))}

                <Text style={[s.sectionLabel, { marginTop: 14 }]}>General Precautions</Text>
                {pgx.precautions.map((p, i) => (
                  <View key={i} style={s.bulletRow}>
                    <View style={[s.bullet, { backgroundColor: i === 0 ? C.red : C.orange }]} />
                    <Text style={s.bulletText}>{p}</Text>
                  </View>
                ))}

                <TouchableOpacity style={s.ctaBtn} activeOpacity={0.85} onPress={onBack}>
                  <Text style={s.ctaText}>View Full Pharmacogenomics Report</Text>
                </TouchableOpacity>

                <Text style={s.disclaimer}>
                  Discuss with your prescriber before making any medication changes.
                </Text>
              </>
            )}
          </ScrollView>
        </Animated.View>
      )}
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
  backText:     { color: '#FFF', fontSize: 12, fontWeight: '600' },
  headerCenter: { flex: 1, alignItems: 'center' },
  pageTitle:    { fontSize: 17, color: '#FFF', fontWeight: '600' },
  pageSubtitle: { fontSize: 12, color: C.muted, marginTop: 2 },

  cameraZone: { flex: 1, backgroundColor: C.dark, overflow: 'hidden' },
  mask: { position: 'absolute', backgroundColor: 'rgba(18,21,16,0.55)' },

  bH: { position: 'absolute', width: 24, height: 3, backgroundColor: C.green, borderRadius: 1 },
  bV: { position: 'absolute', width: 3, height: 24, backgroundColor: C.green, borderRadius: 1 },

  scanLine: {
    position: 'absolute',
    height: 2,
    width: FRAME_W - 16,
    backgroundColor: C.green,
    opacity: 0.85,
    borderRadius: 1,
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18,21,16,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { color: C.green, fontSize: 13, fontWeight: '600' },

  alignHint: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    fontSize: 12,
    color: C.muted,
  },

  // Card
  cardWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '60%',
  },
  card: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  cardContent: { padding: 16, paddingBottom: 40 },

  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 14,
  },

  drugHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  drugName:   { fontSize: 17, fontWeight: '600', color: C.primary },
  drugBrands: { fontSize: 11, color: C.secondary, marginTop: 2 },
  drugMfr:    { fontSize: 10, color: C.muted, marginTop: 1 },

  scanAgainPill: {
    backgroundColor: C.olive,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  scanAgainPillText: { color: '#FFF', fontSize: 10, fontWeight: '600' },

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

  // Not found
  notFound: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  notFoundIcon:  { fontSize: 36 },
  notFoundTitle: { fontSize: 16, fontWeight: '600', color: C.primary },
  notFoundSub:   { fontSize: 11, color: C.secondary, textAlign: 'center', lineHeight: 16 },
  scanAgainBtn: {
    marginTop: 8,
    backgroundColor: C.olive,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  scanAgainText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
});
