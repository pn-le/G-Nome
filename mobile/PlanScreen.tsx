import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { useFonts } from 'expo-font';
import { InriaSerif_400Regular, InriaSerif_700Bold } from '@expo-google-fonts/inria-serif';
import { useApp } from './lib/AppContext';
import { generateMealPlan } from './lib/api';

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
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const p = await generateMealPlan(sessionId as string);
      setPlan(p);
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
        {!plan && !loading && !error && (
          <View style={styles.center}>
            <Text style={[styles.heading, { fontFamily: serifBold }]}>Personalized For You</Text>
            <Text style={[styles.desc, { fontFamily: serif }]}>
              Generate a strict 7-day meal and lifestyle plan completely personalized to your genetic traits.
            </Text>
            <TouchableOpacity style={styles.genBtn} onPress={handleGenerate}>
              <Text style={[styles.genBtnText, { fontFamily: serifBold }]}>Generate Plan</Text>
            </TouchableOpacity>
          </View>
        )}

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
          <View style={styles.markdownBox}>
            <Text style={[styles.planText, { fontFamily: serif }]}>{plan}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

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
  content: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  heading: { fontSize: 24, color: C.primary, marginBottom: 12, textAlign: 'center' },
  desc: { fontSize: 16, color: C.secondary, textAlign: 'center', marginBottom: 32, lineHeight: 24 },
  genBtn: { backgroundColor: C.olive, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  genBtnText: { color: C.surface, fontSize: 18 },
  loadingText: { marginTop: 16, color: C.secondary, fontSize: 16 },
  error: { color: 'red', fontSize: 16, textAlign: 'center', marginBottom: 16 },
  retryBtn: { padding: 12, backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  retryText: { color: C.primary, fontWeight: 'bold' },
  markdownBox: { backgroundColor: C.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: C.border },
  planText: { color: C.primary, fontSize: 16, lineHeight: 26 },
});
