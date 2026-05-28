import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, Dimensions,
} from 'react-native';
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
  lightOlive:'#DAE4CF',
  border:    '#E5E2DB',
  red:       '#EB412A',
};

const { width: W } = Dimensions.get('window');

const SETTINGS = [
  { section: 'Account',  items: ['Edit Profile', 'Change Email', 'Privacy Settings'] },
  { section: 'Data',     items: ['Download My Data', 'Delete My Data', 'Re-upload DNA File'] },
  { section: 'App',      items: ['Notifications', 'Appearance', 'About G-Nome'] },
];

interface Props {
  onTabPress: (tab: TabKey) => void;
}

export default function ProfileScreen({ onTabPress }: Props) {
  const [fontsLoaded] = useFonts({ InriaSerif_400Regular, InriaSerif_700Bold });
  const serif     = fontsLoaded ? 'InriaSerif_400Regular' : undefined;
  const serifBold = fontsLoaded ? 'InriaSerif_700Bold'    : undefined;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── Header / Centered Profile ──────────────────────────────── */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
            <Text style={[styles.avatarInitialLarge, { fontFamily: serifBold }]}>A</Text>
          </View>
          <Text style={[styles.nameCentered, { fontFamily: serifBold }]}>Alex Johnson</Text>
          <Text style={[styles.emailCentered, { fontFamily: serif }]}>alex@example.com</Text>
          <TouchableOpacity style={styles.editBtnCentered} activeOpacity={0.7}>
            <Text style={[styles.editBtnText, { fontFamily: serifBold }]}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats grid ────────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          {[
            { val: '20k+', label: 'Genes',      color: C.green },
            { val: '14',   label: 'Conditions', color: C.olive },
            { val: '42',   label: 'Traits',     color: '#4A90F9' },
            { val: '3',    label: 'Scans',      color: C.red },
          ].map(s => (
            <View key={s.label} style={styles.statBox}>
              <Text style={[styles.statVal, { fontFamily: serifBold, color: s.color }]}>{s.val}</Text>
              <Text style={[styles.statLabel, { fontFamily: serif }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── DNA file info ───────────────────────────────────────────── */}
        <View style={styles.dnaCard}>
          <View style={[styles.dnaAccent, { backgroundColor: C.green }]} />
          <View style={styles.dnaContent}>
            <Text style={[styles.dnaTitle, { fontFamily: serifBold }]}>DNA File</Text>
            <Text style={[styles.dnaSource, { fontFamily: serif }]}>Source: 23andMe</Text>
            <Text style={[styles.dnaDate, { fontFamily: serif }]}>Uploaded: May 28, 2026</Text>
          </View>
          <View style={styles.dnaBadge}>
            <Text style={[styles.dnaBadgeText, { fontFamily: serifBold }]}>ACTIVE</Text>
          </View>
        </View>

        {/* ── Achievements (Mock) ─────────────────────────────────────── */}
        <View style={styles.achievementsSection}>
          <Text style={[styles.sectionTitle, { fontFamily: serifBold }]}>Achievements</Text>
          <View style={styles.achievementsGrid}>
            {['🧬', '🥦', '🏃', '🌙', '💧'].map((emoji, i) => (
              <View key={i} style={styles.achievementBadge}>
                <Text style={styles.achievementEmoji}>{emoji}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Action List ─────────────────────────────────────────────── */}
        <View style={styles.settingsSection}>
          <View style={styles.settingsCard}>
            {['Export Health Data', 'Share with Doctor', 'Delete Account'].map((item, i) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.settingsRow,
                  i < 2 && styles.settingsRowBorder,
                ]}
                activeOpacity={0.6}
              >
                <Text style={[styles.settingsItem, { fontFamily: serif, color: item === 'Delete Account' ? C.red : C.primary }]}>{item}</Text>
                <Text style={[styles.chevron, { fontFamily: serif }]}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Sign out ────────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.7}>
          <Text style={[styles.signOutText, { fontFamily: serifBold }]}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 16 }} />
      </ScrollView>

      <BottomNav activeTab="profile" onTabPress={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 18, paddingBottom: 16 },

  // Centered Profile Header
  profileHeader: {
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 24,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.lightOlive,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitialLarge: { fontSize: 36, color: C.olive },
  nameCentered:  { fontSize: 24, color: C.primary, marginBottom: 4 },
  emailCentered: { fontSize: 14, color: C.secondary, marginBottom: 16 },
  editBtnCentered: {
    backgroundColor: C.lightGreen,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  editBtnText: { fontSize: 13, color: C.green },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
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
  statVal:   { fontSize: 18 },
  statLabel: { fontSize: 10, color: C.secondary, marginTop: 4, textAlign: 'center' },

  // DNA card
  dnaCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  dnaAccent:  { width: 4 },
  dnaContent: { flex: 1, padding: 14 },
  dnaTitle:   { fontSize: 15, color: C.primary, marginBottom: 4 },
  dnaSource:  { fontSize: 12, color: C.secondary, marginBottom: 2 },
  dnaDate:    { fontSize: 12, color: C.secondary },
  dnaBadge: {
    backgroundColor: C.lightGreen,
    margin: 14,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'center',
  },
  dnaBadgeText: { fontSize: 10, color: C.green, letterSpacing: 0.5 },

  // Achievements
  achievementsSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, color: C.primary, marginBottom: 12 },
  achievementsGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  achievementBadge: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  achievementEmoji: { fontSize: 24 },

  // Settings
  settingsSection: { marginBottom: 20 },
  settingsCard: {
    backgroundColor: C.surface,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  settingsRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  settingsItem: { fontSize: 15, color: C.primary },
  chevron:      { fontSize: 20, color: C.light },

  // Sign out
  signOutBtn: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  signOutText: { fontSize: 15, color: C.red },
});
