import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFonts } from 'expo-font';
import { InriaSerif_400Regular, InriaSerif_700Bold } from '@expo-google-fonts/inria-serif';
import { colors } from './constants/theme';

export type TabKey = 'home' | 'tree' | 'reports' | 'scan' | 'profile';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'home',    label: 'Home',    icon: '⌂'  },
  { key: 'tree',    label: 'Tree',    icon: '🌿'  },
  { key: 'reports', label: 'Reports', icon: '📋'  },
  { key: 'scan',    label: 'Scan',    icon: '🔬'  },
  { key: 'profile', label: 'Profile', icon: '👤'  },
];

interface Props {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
}

export default function BottomNav({ activeTab, onTabPress }: Props) {
  const [fontsLoaded] = useFonts({ InriaSerif_400Regular, InriaSerif_700Bold });
  const serif     = fontsLoaded ? 'InriaSerif_400Regular' : undefined;
  const serifBold = fontsLoaded ? 'InriaSerif_700Bold'    : undefined;

  return (
    <View style={styles.bar}>
      {TABS.map(t => {
        const active = t.key === activeTab;
        return (
          <TouchableOpacity
            key={t.key}
            style={styles.tab}
            onPress={() => onTabPress(t.key)}
            activeOpacity={0.7}
          >
            {/* Active indicator dot */}
            {active && <View style={styles.activeDot} />}

            {/* Icon bubble */}
            <View style={[styles.iconBubble, active && styles.iconBubbleActive]}>
              <Text style={[styles.icon, active && styles.iconActive]}>{t.icon}</Text>
            </View>

            <Text style={[
              styles.label,
              { fontFamily: active ? serifBold : serif },
              { color: active ? colors.olive : colors.textLight },
            ]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    top: -8,
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.green,
  },
  iconBubble: {
    width: 36,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleActive: {
    backgroundColor: colors.greenLightBg,
  },
  icon:       { fontSize: 16 },
  iconActive: { fontSize: 16 },
  label:      { fontSize: 8 },
});
