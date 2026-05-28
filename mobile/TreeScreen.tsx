import React from 'react';
import { View, Text, StyleSheet, Image, SafeAreaView, StatusBar, ScrollView } from 'react-native';
import { useFonts } from 'expo-font';
import { InriaSerif_400Regular, InriaSerif_700Bold } from '@expo-google-fonts/inria-serif';
import BottomNav, { TabKey } from './BottomNav';

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
  amber:     '#F59E0B',
  teal:      '#0D9488',
};

interface Props {
  onTabPress: (tab: TabKey) => void;
}

export default function TreeScreen({ onTabPress }: Props) {
  const [fontsLoaded] = useFonts({ InriaSerif_400Regular, InriaSerif_700Bold });
  const serif     = fontsLoaded ? 'InriaSerif_400Regular' : undefined;
  const serifBold = fontsLoaded ? 'InriaSerif_700Bold'    : undefined;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={styles.header}>
        <Text style={[styles.title, { fontFamily: serifBold }]}>Genomic Family Tree</Text>
        <Image
          source={require('./assets/images/small gene tree.png')}
          style={styles.leafDecor}
          resizeMode="contain"
        />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        <View style={{ alignItems: 'center' }}>
          <Image
            source={require('./assets/images/gnome and tree.png')}
            style={styles.illustration}
            resizeMode="contain"
          />

          <View style={styles.badge}>
            <Text style={[styles.badgeText, { fontFamily: serifBold }]}>COMING SOON</Text>
          </View>

          <Text style={[styles.heading, { fontFamily: serifBold }]}>
            Your Family Tree is Growing
          </Text>
          <Text style={[styles.body2, { fontFamily: serif }]}>
            We're mapping your genomic ancestry across generations. Your interactive family
            tree will appear here once processing is complete.
          </Text>

          <View style={styles.statRow}>
            {[
              { value: '23', label: 'Chromosomes' },
              { value: '4M+', label: 'SNPs analyzed' },
              { value: '3', label: 'Regions found' },
            ].map(s => (
              <View key={s.label} style={styles.statBox}>
                <Text style={[styles.statVal, { fontFamily: serifBold }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { fontFamily: serif }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.regionalSection}>
          <Text style={[styles.regionalTitle, { fontFamily: serifBold }]}>Regional Breakdown</Text>
          
          {[
            { region: 'European', percent: 64, color: C.green },
            { region: 'East Asian', percent: 21, color: C.amber },
            { region: 'African', percent: 15, color: C.teal },
          ].map((item, i) => (
            <View key={i} style={styles.regionRow}>
              <View style={styles.regionHeader}>
                <Text style={[styles.regionName, { fontFamily: serif }]}>{item.region}</Text>
                <Text style={[styles.regionPercent, { fontFamily: serifBold }]}>{item.percent}%</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${item.percent}%`, backgroundColor: item.color }]} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <BottomNav activeTab="tree" onTabPress={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: { fontSize: 24, color: C.primary },
  leafDecor: { width: 42, height: 42, opacity: 0.8 },
  body: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
  },
  illustration: { width: 240, height: 200 },
  badge: {
    backgroundColor: C.lightGreen,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 16,
  },
  badgeText: { fontSize: 9, color: C.green, letterSpacing: 1 },
  heading: { fontSize: 18, color: C.primary, textAlign: 'center', marginBottom: 10 },
  body2: { fontSize: 13, color: C.secondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  statRow: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 30 },
  statBox: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statVal:   { fontSize: 22, color: C.olive },
  statLabel: { fontSize: 10,  color: C.secondary, marginTop: 4 },
  
  regionalSection: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  regionalTitle: { fontSize: 18, color: C.primary, marginBottom: 16 },
  regionRow: { marginBottom: 14 },
  regionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  regionName: { fontSize: 14, color: C.primary },
  regionPercent: { fontSize: 14, color: C.primary },
  progressBarBg: { height: 8, backgroundColor: C.lightGreen, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
});
