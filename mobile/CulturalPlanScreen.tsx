import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, SafeAreaView, StatusBar, Animated, Easing,
  TextInput,
} from 'react-native';
import { useFonts } from 'expo-font';
import { InriaSerif_400Regular, InriaSerif_700Bold } from '@expo-google-fonts/inria-serif';
import { useApp } from './lib/AppContext';
import { getCulturalRecommendations } from './lib/api';
import {
  CulturalRecommendations, DietaryRecommendation,
  DrugFoodInteraction, SUPPORTED_CULTURES,
} from './lib/types';

// ─── Palette ────────────────────────────────────────────────────────────────

const C = {
  bg:          '#F7F6F2',
  surface:     '#FFFFFF',
  primary:     '#1A1B14',
  secondary:   '#686760',
  light:       '#A6A59F',
  green:       '#44A353',
  olive:       '#363E28',
  lightGreen:  '#EEF2E9',
  lightOlive:  '#DAE4CF',
  border:      '#E5E2DB',
  amber:       '#F5A62B',
  red:         '#EB412A',
  teal:        '#0D9488',
  tealBg:      '#E6FAF8',
  warmBg:      '#FEF7ED',
  warmAccent:  '#D97706',
  purpleBg:    '#F3E8FF',
  purpleText:  '#7C3AED',
  blueBg:      '#EFF6FF',
  blueText:    '#2563EB',
};

// ─── Culture picker icons (emoji flags) ─────────────────────────────────────

const CULTURE_EMOJI: Record<string, string> = {
  Vietnamese:      '🇻🇳',
  Japanese:        '🇯🇵',
  Korean:          '🇰🇷',
  Chinese:         '🇨🇳',
  Thai:            '🇹🇭',
  Filipino:        '🇵🇭',
  Indian:          '🇮🇳',
  Pakistani:       '🇵🇰',
  Brazilian:       '🇧🇷',
  Mexican:         '🇲🇽',
  German:          '🇩🇪',
  Italian:         '🇮🇹',
  French:          '🇫🇷',
  Greek:           '🇬🇷',
  Ethiopian:       '🇪🇹',
  Nigerian:        '🇳🇬',
  Caribbean:       '🌴',
  'Middle Eastern':'🕌',
  Turkish:         '🇹🇷',
  Persian:         '🇮🇷',
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function CulturePicker({ selected, onSelect, serif, serifBold }: {
  selected: string;
  onSelect: (c: string) => void;
  serif?: string;
  serifBold?: string;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customText, setCustomText] = useState('');

  const isPreset = SUPPORTED_CULTURES.includes(selected as any);
  const isCustomActive = showCustom || (selected !== '' && !isPreset);

  const handlePresetPress = (c: string) => {
    setShowCustom(false);
    setCustomText('');
    onSelect(c);
  };

  const handleCustomToggle = () => {
    setShowCustom(true);
    onSelect(customText);
  };

  const handleCustomChange = (text: string) => {
    setCustomText(text);
    onSelect(text);
  };

  return (
    <View style={pick.container}>
      <Text style={[pick.label, { fontFamily: serifBold }]}>What's in your kitchen?</Text>
      <Text style={[pick.hint, { fontFamily: serif }]}>
        Select the cuisine you eat most often. We will map your genetic risks directly to the foods and ingredients from this culture.
      </Text>
      <View style={pick.grid}>
        {SUPPORTED_CULTURES.map(c => {
          const active = c === selected && !showCustom;
          return (
            <TouchableOpacity
              key={c}
              style={[pick.chip, active && pick.chipActive]}
              onPress={() => handlePresetPress(c)}
              activeOpacity={0.7}
            >
              <Text style={pick.emoji}>{CULTURE_EMOJI[c] ?? '🍽️'}</Text>
              <Text style={[
                pick.chipText,
                { fontFamily: active ? serifBold : serif },
                active && pick.chipTextActive,
              ]}>
                {c}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* "Other" chip */}
        <TouchableOpacity
          style={[pick.chip, isCustomActive && pick.chipActive]}
          onPress={handleCustomToggle}
          activeOpacity={0.7}
        >
          <Text style={pick.emoji}>✏️</Text>
          <Text style={[
            pick.chipText,
            { fontFamily: isCustomActive ? serifBold : serif },
            isCustomActive && pick.chipTextActive,
          ]}>
            Other
          </Text>
        </TouchableOpacity>
      </View>

      {/* Custom input field */}
      {isCustomActive && (
        <View style={pick.customRow}>
          <TextInput
            style={[pick.customInput, { fontFamily: serif }]}
            placeholder="e.g. Moroccan, Haitian, Peruvian…"
            placeholderTextColor="#A6A59F"
            value={customText}
            onChangeText={handleCustomChange}
            autoFocus
            returnKeyType="done"
          />
        </View>
      )}
    </View>
  );
}

const pick = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { fontSize: 18, color: C.primary, marginBottom: 6 },
  hint: { fontSize: 12, color: C.secondary, lineHeight: 18, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.surface, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1.5, borderColor: C.border,
  },
  chipActive: {
    backgroundColor: C.lightGreen, borderColor: C.green,
  },
  emoji: { fontSize: 16 },
  chipText: { fontSize: 12, color: C.secondary },
  chipTextActive: { color: C.olive },
  customRow: {
    marginTop: 12,
  },
  customInput: {
    backgroundColor: C.surface, borderRadius: 14,
    borderWidth: 1.5, borderColor: C.green,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: C.primary,
  },
});


function DietaryCard({ rec, index, serif, serifBold }: {
  rec: DietaryRecommendation; index: number;
  serif?: string; serifBold?: string;
}) {
  const condColor = rec.condition.toLowerCase().includes('diabetes') ? C.amber
    : rec.condition.toLowerCase().includes('coronary') ? C.red
    : C.teal;

  return (
    <View style={dc.card}>
      <View style={[dc.accent, { backgroundColor: condColor }]} />
      <View style={dc.body}>
        <View style={dc.topRow}>
          <View style={[dc.condBadge, { backgroundColor: condColor + '18' }]}>
            <Text style={[dc.condText, { fontFamily: serifBold, color: condColor }]}>
              {rec.condition.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={[dc.advice, { fontFamily: serif }]}>{rec.advice}</Text>

        {rec.culturally_relevant_foods.length > 0 && (
          <View style={dc.foodsRow}>
            <Text style={[dc.foodsLabel, { fontFamily: serifBold }]}>Try: </Text>
            {rec.culturally_relevant_foods.map((f, i) => (
              <View key={i} style={dc.foodChip}>
                <Text style={[dc.foodChipText, { fontFamily: serif }]}>{f}</Text>
              </View>
            ))}
          </View>
        )}

        {rec.foods_to_limit.length > 0 && (
          <View style={dc.foodsRow}>
            <Text style={[dc.limitLabel, { fontFamily: serifBold }]}>Limit: </Text>
            {rec.foods_to_limit.map((f, i) => (
              <View key={i} style={dc.limitChip}>
                <Text style={[dc.limitChipText, { fontFamily: serif }]}>{f}</Text>
              </View>
            ))}
          </View>
        )}

        {rec.evidence_source.length > 0 && (
          <View style={dc.evidenceRow}>
            {rec.evidence_source.map((src, i) => (
              <Text key={i} style={[dc.evidenceText, { fontFamily: serif }]}>📎 {src}</Text>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const dc = StyleSheet.create({
  card: {
    flexDirection: 'row', backgroundColor: C.surface, borderRadius: 14,
    marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  accent: { width: 4 },
  body: { flex: 1, padding: 14 },
  topRow: { flexDirection: 'row', marginBottom: 8 },
  condBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  condText: { fontSize: 8, letterSpacing: 0.4 },
  advice: { fontSize: 13, color: C.primary, lineHeight: 20, marginBottom: 8 },
  foodsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: 6, gap: 4 },
  foodsLabel: { fontSize: 10, color: C.green },
  foodChip: { backgroundColor: C.lightGreen, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  foodChipText: { fontSize: 10, color: C.olive },
  limitLabel: { fontSize: 10, color: C.red },
  limitChip: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  limitChipText: { fontSize: 10, color: C.red },
  evidenceRow: { marginTop: 4 },
  evidenceText: { fontSize: 9, color: C.light, marginBottom: 2 },
});


function InteractionCard({ interaction, serif, serifBold }: {
  interaction: DrugFoodInteraction;
  serif?: string; serifBold?: string;
}) {
  return (
    <View style={ic.card}>
      <View style={ic.header}>
        <Text style={ic.pill}>💊</Text>
        <Text style={[ic.drug, { fontFamily: serifBold }]}>{interaction.drug}</Text>
      </View>
      <Text style={[ic.interactionText, { fontFamily: serif }]}>{interaction.interaction}</Text>
      {interaction.cultural_note ? (
        <View style={ic.noteBox}>
          <Text style={[ic.noteText, { fontFamily: serif }]}>🍽️ {interaction.cultural_note}</Text>
        </View>
      ) : null}
      {interaction.evidence_source.length > 0 && (
        <View style={{ marginTop: 4 }}>
          {interaction.evidence_source.map((src, i) => (
            <Text key={i} style={[dc.evidenceText, { fontFamily: serif }]}>📎 {src}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const ic = StyleSheet.create({
  card: {
    backgroundColor: C.warmBg, borderRadius: 14, padding: 14, marginBottom: 12,
    borderLeftWidth: 4, borderLeftColor: C.warmAccent,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  pill: { fontSize: 18 },
  drug: { fontSize: 15, color: C.primary },
  interactionText: { fontSize: 12, color: C.secondary, lineHeight: 18, marginBottom: 6 },
  noteBox: { backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginTop: 4 },
  noteText: { fontSize: 11, color: C.warmAccent, lineHeight: 16 },
});


// ─── Main Screen ────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

export default function CulturalPlanScreen({ onBack }: Props) {
  const [fontsLoaded] = useFonts({ InriaSerif_400Regular, InriaSerif_700Bold });
  const serifBold = fontsLoaded ? 'InriaSerif_700Bold' : undefined;
  const serif = fontsLoaded ? 'InriaSerif_400Regular' : undefined;

  const { parseResult, report, culture, setCulture } = useApp();
  const [localCulture, setLocalCulture] = useState(culture || '');
  const [result, setResult] = useState<CulturalRecommendations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pulse animation for loading
  const pulseAnim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
  }, [loading]);

  const handleGenerate = useCallback(async () => {
    if (!localCulture) return;
    if (!parseResult || !report) {
      setError('Please upload DNA and generate a report first.');
      return;
    }
    setCulture(localCulture);
    setLoading(true);
    setError(null);
    try {
      const recs = await getCulturalRecommendations(parseResult, report, localCulture);
      setResult(recs);
    } catch (e: any) {
      setError(e.message || 'Failed to get cultural recommendations');
    } finally {
      setLoading(false);
    }
  }, [localCulture, parseResult, report]);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { fontFamily: serifBold }]}>Cultural Nutrition</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.content}>

        {/* ── Before generation: Culture picker + generate button ──── */}
        {!result && !loading && (
          <>
            {/* Hero card */}
            <View style={styles.heroCard}>
              <View style={styles.heroIconRow}>
                <Text style={styles.heroEmoji}>🧬</Text>
                <Text style={styles.heroPlus}>+</Text>
                <Text style={styles.heroEmoji}>🍲</Text>
              </View>
              <Text style={[styles.heroTitle, { fontFamily: serifBold }]}>
                DNA tells us your risks.{'\n'}Culture tells us what you eat.
              </Text>
              <Text style={[styles.heroSub, { fontFamily: serif }]}>
                Your raw DNA file reveals your biological traits, but it doesn't tell us your ethnic origins or what you cook at home. 
              </Text>
              <View style={styles.heroHighlightBox}>
                <Text style={[styles.heroHighlightText, { fontFamily: serifBold }]}>
                  Tell us what you eat, and we'll tell you how your genes respond to it.
                </Text>
              </View>
            </View>

            <CulturePicker
              selected={localCulture}
              onSelect={setLocalCulture}
              serif={serif}
              serifBold={serifBold}
            />

            {error && (
              <View style={styles.errorBox}>
                <Text style={[styles.errorText, { fontFamily: serif }]}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.genBtn, !localCulture && styles.genBtnDisabled]}
              onPress={handleGenerate}
              disabled={!localCulture}
              activeOpacity={0.8}
            >
              <Text style={[styles.genBtnText, { fontFamily: serifBold }]}>
                {localCulture ? `Get ${localCulture} Recommendations` : 'Select a cuisine first'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── Loading state ─────────────────────────────────────────── */}
        {loading && (
          <View style={styles.loadingContainer}>
            <Animated.View style={[styles.loadingPulse, {
              opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
              transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.05] }) }],
            }]}>
              <Text style={styles.loadingEmoji}>🧬</Text>
            </Animated.View>
            <ActivityIndicator size="large" color={C.green} style={{ marginTop: 16 }} />
            <Text style={[styles.loadingTitle, { fontFamily: serifBold }]}>
              Crafting your {localCulture} nutrition plan...
            </Text>
            <Text style={[styles.loadingHint, { fontFamily: serif }]}>
              Searching 2,933 evidence-backed food documents{'\n'}and generating personalized recommendations
            </Text>
          </View>
        )}

        {/* ── Results ───────────────────────────────────────────────── */}
        {result && !loading && (
          <>
            {/* Profile banner */}
            <View style={styles.profileBanner}>
              <Text style={styles.profileEmoji}>{CULTURE_EMOJI[result.cultural_profile] ?? '🍽️'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileTitle, { fontFamily: serifBold }]}>
                  {result.cultural_profile} Nutrition Plan
                </Text>
                <Text style={[styles.profileSub, { fontFamily: serif }]}>
                  Personalized to your genetics · {result.dietary_recommendations.length} dietary tips · {result.drug_food_interactions.length} drug interactions
                </Text>
              </View>
            </View>

            {/* Dietary recommendations */}
            {result.dietary_recommendations.length > 0 && (
              <>
                <Text style={[styles.sectionHeader, { fontFamily: serifBold }]}>
                  🥗  Dietary Recommendations
                </Text>
                {result.dietary_recommendations.map((rec, i) => (
                  <DietaryCard key={i} rec={rec} index={i} serif={serif} serifBold={serifBold} />
                ))}
              </>
            )}

            {/* Drug-food interactions */}
            {result.drug_food_interactions.length > 0 && (
              <>
                <Text style={[styles.sectionHeader, { fontFamily: serifBold, marginTop: 8 }]}>
                  💊  Drug-Food Interactions
                </Text>
                {result.drug_food_interactions.map((inter, i) => (
                  <InteractionCard key={i} interaction={inter} serif={serif} serifBold={serifBold} />
                ))}
              </>
            )}

            {/* Cultural note */}
            {result.cultural_note ? (
              <View style={styles.culturalNoteBox}>
                <Text style={[styles.culturalNoteTitle, { fontFamily: serifBold }]}>📝  Cultural Note</Text>
                <Text style={[styles.culturalNoteText, { fontFamily: serif }]}>{result.cultural_note}</Text>
              </View>
            ) : null}

            {/* Disclaimer */}
            <View style={styles.disclaimerBox}>
              <Text style={[styles.disclaimerText, { fontFamily: serif }]}>
                ⚠️  {result.disclaimer}
              </Text>
            </View>

            {/* Regenerate with different culture */}
            <TouchableOpacity
              style={styles.regenBtn}
              onPress={() => { setResult(null); setError(null); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.regenBtnText, { fontFamily: serifBold }]}>
                🔄  Try a different cuisine
              </Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderColor: C.border,
  },
  backBtn: { padding: 8 },
  backText: { color: C.secondary, fontSize: 16 },
  title: { fontSize: 20, color: C.primary },
  body: { flex: 1 },
  content: { padding: 20 },

  // Hero
  heroCard: {
    backgroundColor: C.surface, borderRadius: 16, padding: 20,
    alignItems: 'center', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  heroIconRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  heroEmoji: { fontSize: 32 },
  heroPlus: { fontSize: 24, color: C.light, fontWeight: 'bold' },
  heroTitle: { fontSize: 18, color: C.primary, textAlign: 'center', marginBottom: 10, lineHeight: 24 },
  heroSub: { fontSize: 13, color: C.secondary, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  heroHighlightBox: { backgroundColor: C.lightGreen, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  heroHighlightText: { fontSize: 12, color: C.olive, textAlign: 'center', lineHeight: 18 },

  // Error
  errorBox: {
    backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14, marginBottom: 12,
    borderLeftWidth: 4, borderLeftColor: C.red,
  },
  errorText: { fontSize: 12, color: C.red, lineHeight: 18 },

  // Generate button
  genBtn: {
    backgroundColor: C.olive, paddingHorizontal: 28, paddingVertical: 16,
    borderRadius: 30, alignItems: 'center', marginTop: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 5,
  },
  genBtnDisabled: { backgroundColor: C.light, shadowOpacity: 0 },
  genBtnText: { color: C.surface, fontSize: 16 },

  // Loading
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingPulse: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.lightGreen, alignItems: 'center', justifyContent: 'center' },
  loadingEmoji: { fontSize: 36 },
  loadingTitle: { fontSize: 18, color: C.primary, marginTop: 20, textAlign: 'center' },
  loadingHint: { fontSize: 12, color: C.secondary, marginTop: 8, textAlign: 'center', lineHeight: 18 },

  // Profile banner
  profileBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  profileEmoji: { fontSize: 36 },
  profileTitle: { fontSize: 18, color: C.primary, marginBottom: 4 },
  profileSub: { fontSize: 11, color: C.secondary, lineHeight: 16 },

  // Section headers
  sectionHeader: { fontSize: 15, color: C.primary, marginBottom: 12, marginTop: 4 },

  // Cultural note
  culturalNoteBox: {
    backgroundColor: C.purpleBg, borderRadius: 14, padding: 14, marginTop: 12, marginBottom: 12,
    borderLeftWidth: 4, borderLeftColor: C.purpleText,
  },
  culturalNoteTitle: { fontSize: 13, color: C.purpleText, marginBottom: 6 },
  culturalNoteText: { fontSize: 12, color: C.purpleText, lineHeight: 18 },

  // Disclaimer
  disclaimerBox: {
    backgroundColor: C.blueBg, borderRadius: 12, padding: 14, marginTop: 8, marginBottom: 12,
  },
  disclaimerText: { fontSize: 10, color: C.blueText, lineHeight: 16 },

  // Regenerate
  regenBtn: {
    backgroundColor: C.surface, borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1.5, borderColor: C.border,
    marginTop: 4,
  },
  regenBtnText: { fontSize: 14, color: C.secondary },
});
