import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  SafeAreaView, StatusBar, Alert, Animated, Dimensions, ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useFonts, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { InriaSerif_400Regular, InriaSerif_700Bold } from '@expo-google-fonts/inria-serif';
import { parseFile } from './lib/api';
import { useApp } from './lib/AppContext';
import { colors, radius } from './constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const ACCEPTED_TYPES = ['text/plain', 'text/csv', 'application/zip', 'application/x-zip-compressed', '*/*'];

interface Props {
  onFileSelected: () => void;
  onPastSessionSelected?: () => void;
}

export default function UploadScreen({ onFileSelected, onPastSessionSelected }: Props) {
  const { setParseResult, setReport, setError } = useApp();
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [pickedFileName, setPickedFileName] = useState<string | null>(null);
  const [parsing, setParsing]               = useState(false);
  const [errorMsg, setErrorMsg]             = useState<string | null>(null);
  const [buttonScale]                       = useState(new Animated.Value(1));
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    InriaSerif_400Regular,
    InriaSerif_700Bold,
  });

  const serif     = fontsLoaded ? 'InriaSerif_400Regular' : undefined;
  const serifBold = fontsLoaded ? 'InriaSerif_700Bold'    : undefined;

  React.useEffect(() => {
    getPastSessions().then(setPastSessions);
  }, []);

  const handleChooseFile = useCallback(async () => {
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;
      const asset = result.assets[0];

      const ext = asset.name.split('.').pop()?.toLowerCase();
      if (!['txt', 'csv', 'zip'].includes(ext ?? '')) {
        Alert.alert('Unsupported file', 'Please upload a TXT, CSV, or ZIP file from 23andMe or AncestryDNA.');
        return;
      }

      setPickedFileName(asset.name);
      setParsing(true);
      setErrorMsg(null);

      try {
        const parsed = await parseFile(asset.uri, asset.name, (asset as any).file ?? undefined);
        setParseResult(parsed);
        setTimeout(onFileSelected, 300);
      } catch (err: any) {
        setParsing(false);
        const msg: string = err?.message ?? 'Unknown error';
        setErrorMsg(msg);
        Alert.alert('Upload failed', msg);
      }
    } catch {
      Alert.alert('Error', 'Could not open file picker. Please try again.');
    }
  }, [buttonScale, onFileSelected]);

  const handleWhatIsThis = useCallback(() => {
    Alert.alert(
      'About G-Nome',
      'G-Nome turns your raw DNA data file into a personalised genomic health passport.\n\nWe support exports from 23andMe and AncestryDNA. Your file stays private — processing happens on-device.',
      [{ text: 'Got it' }],
    );
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <View style={styles.logoArea}>
        <Text style={[styles.logoText, fontsLoaded && styles.logoTextFont]}>G-Nome</Text>
        <Text style={[styles.tagline, { fontFamily: serif }]}>
          Your genome. Your story.{'\n'}Your Legacy
        </Text>
      </View>

      {/* ── Illustration ──────────────────────────────────────────────── */}
      <Image
        source={require('./assets/images/gnome_img.png')}
        style={styles.gnomeImage}
        resizeMode="contain"
      />

      {/* ── Upload Card ───────────────────────────────────────────────── */}
      {/* Outer wrapper holds the shadow; inner card holds the dashed border */}
      <View style={styles.cardShadow}>
        <View style={styles.card}>

          {/* DNA Upload Icon */}
          <View style={styles.iconWrapper}>
            <View style={styles.iconBg}>
              <View style={styles.arrowShaft} />
              <View style={styles.arrowHeadLeft} />
              <View style={styles.arrowHeadRight} />
            </View>
          </View>

          <Text style={[styles.uploadTitle, { fontFamily: serifBold }]}>
            Upload your DNA file
          </Text>

          {/* Source chips */}
          <View style={styles.sourceChipsRow}>
            <View style={[styles.sourceChip, { backgroundColor: colors.purpleBg }]}>
              <Text style={[styles.sourceChipText, { fontFamily: serifBold, color: colors.purple }]}>
                23andMe
              </Text>
            </View>
            <View style={[styles.sourceChip, { backgroundColor: colors.blueBg }]}>
              <Text style={[styles.sourceChipText, { fontFamily: serifBold, color: colors.blue }]}>
                AncestryDNA
              </Text>
            </View>
          </View>

          <Text style={[styles.fileTypes, { fontFamily: serif }]}>TXT  ·  CSV  ·  ZIP</Text>
          <Text style={[styles.dragHint, { fontFamily: serif }]}>or drag & drop your file here</Text>

          {/* Selected file feedback */}
          {pickedFileName && (
            <View style={[styles.selectedFileRow, errorMsg ? styles.selectedFileRowError : null]}>
              {parsing ? (
                <ActivityIndicator size="small" color={colors.green} />
              ) : errorMsg ? (
                <Text style={styles.errorDot}>✕</Text>
              ) : (
                <View style={styles.checkCircle}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
              )}
              <Text
                style={[styles.selectedFileName, { fontFamily: serifBold }, errorMsg ? { color: '#C73838' } : null]}
                numberOfLines={1}
              >
                {parsing ? `Parsing ${pickedFileName}…` : pickedFileName}
              </Text>
            </View>
          )}

          {errorMsg && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText} numberOfLines={5}>{errorMsg}</Text>
            </View>
          )}

          {/* Choose File button */}
          <Animated.View style={{ transform: [{ scale: buttonScale }], width: '100%' }}>
            <TouchableOpacity
              style={[styles.chooseButton, pickedFileName && !parsing && styles.chooseButtonDone]}
              onPress={handleChooseFile}
              activeOpacity={0.85}
              disabled={parsing}
            >
              {parsing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.chooseButtonText, { fontFamily: serifBold }]}>
                  {pickedFileName ? 'Change File' : 'Choose File'}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Trust signals */}
          <View style={styles.trustRow}>
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🔒</Text>
              <Text style={[styles.trustText, { fontFamily: serif }]}>Your data stays private</Text>
            </View>
            <View style={styles.trustDivider} />
            <View style={styles.trustItem}>
              <Text style={styles.trustIcon}>🛡</Text>
              <Text style={[styles.trustText, { fontFamily: serif }]}>Encrypted</Text>
            </View>
          </View>

          <TouchableOpacity onPress={handleWhatIsThis} hitSlop={{ top: 12, bottom: 12, left: 20, right: 20 }}>
            <Text style={[styles.whatIsThis, { fontFamily: serif }]}>What is this?</Text>
          </TouchableOpacity>
        </View>
      </View>

      {pastSessions.length > 0 && (
        <View style={{ width: SCREEN_W - 40, marginTop: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.textSecondary, marginBottom: 10 }}>Recent Records</Text>
          <ScrollView style={{ maxHeight: 200 }}>
            {pastSessions.map(session => (
              <TouchableOpacity
                key={session.id}
                style={{
                  backgroundColor: C.surface,
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 10,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 5,
                  elevation: 2,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}
                onPress={() => {
                  setParseResult(session.parse);
                  setReport(session.report);
                  if (onPastSessionSelected) onPastSessionSelected();
                }}
              >
                <Text style={{ fontSize: 24, marginRight: 12 }}>🧬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.textPrimary }}>{session.fileName}</Text>
                  <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
                    {new Date(session.date).toLocaleDateString()} • {session.parse.snp_count.toLocaleString()} SNPs
                  </Text>
                </View>
                <Text style={{ fontSize: 18, color: C.green }}>→</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center' },

  logoArea: { alignItems: 'center', marginTop: 16 },
  logoText: { fontSize: 38, fontWeight: '700', color: colors.olive },
  logoTextFont: { fontFamily: 'PlayfairDisplay_700Bold' },
  tagline: {
    fontSize: 13, color: colors.textSecondary, textAlign: 'center',
    lineHeight: 20, marginTop: 2, fontStyle: 'italic',
  },

  gnomeImage: { width: SCREEN_W * 0.62, height: 200, marginTop: 6 },

  // Shadow lives here (no border); dashed border lives on the inner card
  cardShadow: {
    width: SCREEN_W - 40,
    marginTop: 12,
    borderRadius: radius.card + 3,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  card: {
    borderRadius: radius.card + 3,
    borderWidth: 1.5,
    borderColor: colors.olive,
    borderStyle: 'dashed',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 24,
    alignItems: 'center',
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },

  iconWrapper: { marginBottom: 12 },
  iconBg: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.greenSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  arrowShaft: {
    position: 'absolute', width: 2.5, height: 14,
    backgroundColor: colors.green, borderRadius: 2, bottom: 13,
  },
  arrowHeadLeft: {
    position: 'absolute', width: 7, height: 2.5,
    backgroundColor: colors.green, borderRadius: 2,
    top: 12, left: 11, transform: [{ rotate: '-45deg' }],
  },
  arrowHeadRight: {
    position: 'absolute', width: 7, height: 2.5,
    backgroundColor: colors.green, borderRadius: 2,
    top: 12, right: 11, transform: [{ rotate: '45deg' }],
  },

  uploadTitle: {
    fontSize: 14, color: colors.textPrimary,
    textAlign: 'center', marginBottom: 10,
  },

  sourceChipsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  sourceChip:    { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  sourceChipText: { fontSize: 11 },

  fileTypes: {
    fontSize: 10, color: colors.textLight,
    textAlign: 'center', letterSpacing: 1.5,
  },
  dragHint: {
    fontSize: 9, color: colors.textLight,
    marginTop: 4, marginBottom: 4,
  },

  selectedFileRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.greenLightBg, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    marginTop: 12, width: '100%', gap: 10,
  },
  selectedFileRowError: { backgroundColor: colors.redBg },
  errorDot: { fontSize: 13, color: '#C73838', fontWeight: '700', width: 24, textAlign: 'center' },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  selectedFileName: { fontSize: 12, color: colors.textPrimary, flex: 1 },

  errorBanner: {
    backgroundColor: colors.redBg, borderRadius: 8,
    borderLeftWidth: 3, borderLeftColor: '#C73838',
    padding: 10, marginTop: 8, width: '100%',
  },
  errorText: { fontSize: 10, color: '#C73838', lineHeight: 15 },

  chooseButton: {
    width: '100%', height: 48, backgroundColor: colors.olive,
    borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center',
    marginTop: 16,
  },
  chooseButtonDone: { backgroundColor: colors.green },
  chooseButtonText: { fontSize: 14, color: '#FFFFFF' },

  trustRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 14, gap: 10,
  },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trustIcon: { fontSize: 11 },
  trustText:  { fontSize: 9, color: colors.textSecondary },
  trustDivider: { width: 1, height: 12, backgroundColor: colors.border },

  whatIsThis: { fontSize: 11, color: colors.green, marginTop: 12 },
});
