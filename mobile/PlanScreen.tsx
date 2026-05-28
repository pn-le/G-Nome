import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { useFonts } from 'expo-font';
import { InriaSerif_400Regular, InriaSerif_700Bold } from '@expo-google-fonts/inria-serif';
import { useApp } from './lib/AppContext';
import { generateMealPlan, getLifestylePlan } from './lib/api';

const C = {
  bg:        '#F7F6F2',
  surface:   '#FFFFFF',
  primary:   '#1A1B14',
  secondary: '#686760',
  light:     '#A6A59F',
  green:     '#44A353',
  olive:     '#363E28',
  lightGreen:'#EEF2E9',
  border:    '#E5E2DB',
};

interface Props {
  onBack: () => void;
}

export default function PlanScreen({ onBack }: Props) {
  const [fontsLoaded] = useFonts({ InriaSerif_400Regular, InriaSerif_700Bold });
  const serifBold = fontsLoaded ? 'InriaSerif_700Bold' : undefined;
  const serif = fontsLoaded ? 'InriaSerif_400Regular' : undefined;

  const { sessionId } = useApp();
  const [plan, setPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planDate, setPlanDate] = useState<string | null>(null);

  // Load existing plan on mount
  useEffect(() => {
    if (!sessionId) { setLoadingExisting(false); return; }
    (async () => {
      try {
        const saved = await getLifestylePlan(sessionId);
        if (saved.plan) {
          setPlan(saved.plan);
          setPlanDate(saved.created_at ? new Date(saved.created_at).toLocaleDateString() : null);
        }
      } catch {}
      finally { setLoadingExisting(false); }
    })();
  }, [sessionId]);

  const handleGenerate = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const p = await generateMealPlan(sessionId as string);
      setPlan(p);
      setPlanDate(new Date().toLocaleDateString());
    } catch (e: any) {
      setError(e.message || "Failed to generate plan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Dashboard</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { fontFamily: serifBold }]}>Your 7-Day Plan</Text>
        <Text style={[styles.subtitle, { fontFamily: serif }]}>Based on your genomic profile</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        {loadingExisting ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.green} />
            <Text style={[styles.loadingText, { fontFamily: serif }]}>Loading your plan...</Text>
          </View>
        ) : !plan && !loading && !error ? (
          <View style={styles.center}>
            <Text style={[styles.heading, { fontFamily: serifBold }]}>Personalized For You</Text>
            <Text style={[styles.desc, { fontFamily: serif }]}>
              A 7-day meal and lifestyle plan tailored to your genetic profile — drawn from 3,847 peer-reviewed nutrition records sourced from USDA FoodData Central, PubMed clinical literature, and WHO dietary guidelines.
            </Text>
            <View style={styles.sourcePillRow}>
              <View style={styles.sourcePill}><Text style={[styles.sourcePillText, { fontFamily: serifBold }]}>USDA</Text></View>
              <View style={styles.sourcePill}><Text style={[styles.sourcePillText, { fontFamily: serifBold }]}>PubMed</Text></View>
              <View style={styles.sourcePill}><Text style={[styles.sourcePillText, { fontFamily: serifBold }]}>WHO</Text></View>
            </View>
            <TouchableOpacity style={styles.genBtn} onPress={handleGenerate}>
              <Text style={[styles.genBtnText, { fontFamily: serifBold }]}>Generate Plan</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.green} />
            <Text style={[styles.loadingText, { fontFamily: serifBold }]}>Building your 7-day plan…</Text>
            <Text style={[styles.loadingSubText, { fontFamily: serif }]}>
              Cross-referencing your genetics against 3,847{'\n'}peer-reviewed records from USDA, PubMed & WHO
            </Text>
          </View>
        )}

        {error && (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleGenerate}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {plan && !loading && (
          <View>
            {planDate && (
              <Text style={[styles.planDateLabel, { fontFamily: serif }]}>Generated on {planDate}</Text>
            )}
            <View style={styles.planContainer}>
              <SimpleMarkdown content={plan} serifBold={serifBold} serif={serif} />
            </View>
            <TouchableOpacity style={[styles.genBtn, { alignSelf: 'center', marginTop: 30 }]} onPress={handleGenerate}>
              <Text style={[styles.genBtnText, { fontFamily: serifBold }]}>Regenerate Plan</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const renderBold = (text: string, boldFont?: string, regFont?: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <Text key={i} style={{ fontFamily: boldFont, color: C.primary }}>{part.slice(2, -2)}</Text>;
    }
    return <Text key={i} style={{ fontFamily: regFont }}>{part}</Text>;
  });
};

const SimpleMarkdown = ({ content, serifBold, serif }: { content: string, serifBold?: string, serif?: string }) => {
  const lines = content.split('\n');
  const sections: { title: string, content: string[] }[] = [];
  let currentSection = { title: '', content: [] as string[] };

  lines.forEach(line => {
    if (line.startsWith('## ')) {
      if (currentSection.title || currentSection.content.length > 0) sections.push(currentSection);
      currentSection = { title: line.replace(/^## /, ''), content: [] };
    } else {
      currentSection.content.push(line);
    }
  });
  if (currentSection.title || currentSection.content.length > 0) sections.push(currentSection);

  const renderLines = (lines: string[]) => {
    return lines.map((line, idx) => {
      const key = `line-${idx}`;
      const trimmed = line.trim();
      
      if (trimmed.startsWith('# ')) {
        return <Text key={key} style={[styles.mdH1, { fontFamily: serifBold }]}>{trimmed.replace(/^# /, '')}</Text>;
      }
      if (trimmed.startsWith('### ')) {
        const title = trimmed.replace(/^### /, '');
        let emoji = '🍽️';
        const lower = title.toLowerCase();
        if (lower.includes('breakfast')) emoji = '🌅';
        else if (lower.includes('lunch')) emoji = '🥗';
        else if (lower.includes('dinner')) emoji = '🌙';
        else if (lower.includes('snack')) emoji = '🍎';

        return (
          <View key={key} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8, gap: 8 }}>
            <Text style={{ fontSize: 16 }}>{emoji}</Text>
            <Text style={[styles.mdH3, { fontFamily: serifBold, marginTop: 0, marginBottom: 0 }]}>{title}</Text>
          </View>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const text = trimmed.substring(2);
        return (
          <View key={key} style={styles.mdBulletRow}>
            <View style={styles.mdBullet} />
            <Text style={[styles.mdText, { flex: 1, fontFamily: serif }]}>{renderBold(text, serifBold, serif)}</Text>
          </View>
        );
      }
      
      if (trimmed === '') return <View key={key} style={{ height: 6 }} />;
      
      return <Text key={key} style={[styles.mdText, { fontFamily: serif, marginBottom: 6 }]}>{renderBold(trimmed, serifBold, serif)}</Text>;
    });
  };

  return (
    <View>
      {sections.map((sec, idx) => {
        if (!sec.title) {
          return <View key={`sec-${idx}`}>{renderLines(sec.content)}</View>;
        }
        return (
          <View key={`sec-${idx}`} style={styles.dayCard}>
            <View style={styles.dayCardHeader}>
              <Text style={[styles.dayCardTitle, { fontFamily: serifBold }]}>{sec.title}</Text>
            </View>
            <View style={styles.dayCardBody}>
              {renderLines(sec.content)}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  backBtn: { padding: 8, alignSelf: 'flex-start', marginBottom: 4 },
  backText: { color: C.primary, fontSize: 14, fontWeight: '500' },
  title: { fontSize: 24, color: C.primary, marginBottom: 4 },
  subtitle: { fontSize: 12, color: C.secondary },
  body: { flex: 1 },
  content: { padding: 18, flexGrow: 1, paddingBottom: 60 },
  center: { alignItems: 'center', justifyContent: 'center', flex: 1, marginTop: 40 },
  heading: { fontSize: 24, color: C.primary, marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 16, color: C.secondary, textAlign: 'center', marginBottom: 32, lineHeight: 24 },
  genBtn: { backgroundColor: C.olive, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  genBtnText: { color: C.surface, fontSize: 18 },
  loadingText: { marginTop: 16, color: C.primary, fontSize: 16 },
  loadingSubText: { marginTop: 8, color: C.secondary, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  sourcePillRow: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  sourcePill: {
    backgroundColor: '#EEF2E9', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#DAE4CF',
  },
  sourcePillText: { fontSize: 10, color: '#363E28', letterSpacing: 0.3 },
  error: { color: 'red', fontSize: 16, textAlign: 'center', marginBottom: 16 },
  retryBtn: { padding: 12, backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  retryText: { color: C.primary, fontWeight: 'bold' },
  planContainer: { width: '100%' },
  planDateLabel: { color: C.secondary, fontSize: 13, textAlign: 'center', marginBottom: 16 },
  
  // Markdown Styles
  mdH1: { fontSize: 26, color: C.primary, marginBottom: 16, marginTop: 12, textAlign: 'center' },
  mdH3: { fontSize: 16, color: C.primary, marginTop: 16, marginBottom: 8 },
  mdText: { fontSize: 14, color: C.primary, lineHeight: 22 },
  mdBulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, paddingLeft: 8 },
  mdBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, marginTop: 8, marginRight: 10 },
  
  dayCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  dayCardHeader: {
    backgroundColor: C.olive,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dayCardTitle: {
    color: C.surface,
    fontSize: 18,
  },
  dayCardBody: {
    padding: 16,
    paddingTop: 4,
  },
});
