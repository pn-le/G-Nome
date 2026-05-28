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
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { fontFamily: serifBold }]}>7-Day Plan</Text>
        <View style={{width: 50}} />
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
              Generate a strict 7-day meal and lifestyle plan completely personalized to your genetic traits.
            </Text>
            <TouchableOpacity style={styles.genBtn} onPress={handleGenerate}>
              <Text style={[styles.genBtnText, { fontFamily: serifBold }]}>Generate Plan</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.green} />
            <Text style={[styles.loadingText, { fontFamily: serif }]}>Generating your 7-day plan...</Text>
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
      return <Text key={i} style={{ fontFamily: boldFont, color: C.olive }}>{part.slice(2, -2)}</Text>;
    }
    return <Text key={i} style={{ fontFamily: regFont }}>{part}</Text>;
  });
};

const SimpleMarkdown = ({ content, serifBold, serif }: { content: string, serifBold?: string, serif?: string }) => {
  const lines = content.split('\n');
  
  return (
    <View>
      {lines.map((line, idx) => {
        const key = `line-${idx}`;
        const trimmed = line.trim();
        
        if (trimmed.startsWith('# ')) {
          return <Text key={key} style={[styles.mdH1, { fontFamily: serifBold }]}>{trimmed.replace(/^# /, '')}</Text>;
        }
        if (trimmed.startsWith('## ')) {
          return (
            <View key={key} style={styles.mdH2Box}>
               <Text style={[styles.mdH2, { fontFamily: serifBold }]}>{trimmed.replace(/^## /, '')}</Text>
            </View>
          );
        }
        if (trimmed.startsWith('### ')) {
          return <Text key={key} style={[styles.mdH3, { fontFamily: serifBold }]}>{trimmed.replace(/^### /, '')}</Text>;
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
        
        if (trimmed === '') return <View key={key} style={{ height: 12 }} />;
        
        return <Text key={key} style={[styles.mdText, { fontFamily: serif, marginBottom: 8 }]}>{renderBold(trimmed, serifBold, serif)}</Text>;
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  backBtn: { padding: 8 },
  backText: { color: C.secondary, fontSize: 16 },
  title: { fontSize: 20, color: C.primary },
  body: { flex: 1 },
  content: { padding: 24, flexGrow: 1, paddingBottom: 60 },
  center: { alignItems: 'center', justifyContent: 'center', flex: 1, marginTop: 40 },
  heading: { fontSize: 24, color: C.primary, marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 16, color: C.secondary, textAlign: 'center', marginBottom: 32, lineHeight: 24 },
  genBtn: { backgroundColor: C.olive, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  genBtnText: { color: C.surface, fontSize: 18 },
  loadingText: { marginTop: 16, color: C.secondary, fontSize: 16 },
  error: { color: 'red', fontSize: 16, textAlign: 'center', marginBottom: 16 },
  retryBtn: { padding: 12, backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  retryText: { color: C.primary, fontWeight: 'bold' },
  planContainer: { width: '100%' },
  planDateLabel: { color: C.secondary, fontSize: 13, textAlign: 'center', marginBottom: 16 },
  
  // Markdown Styles
  mdH1: { fontSize: 26, color: C.primary, marginBottom: 16, marginTop: 12, textAlign: 'center' },
  mdH2Box: { backgroundColor: C.lightGreen, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginTop: 24, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: C.green },
  mdH2: { fontSize: 20, color: C.olive },
  mdH3: { fontSize: 17, color: C.primary, marginTop: 16, marginBottom: 8 },
  mdText: { fontSize: 16, color: C.secondary, lineHeight: 24 },
  mdBulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6, paddingLeft: 8 },
  mdBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green, marginTop: 10, marginRight: 10 },
});
