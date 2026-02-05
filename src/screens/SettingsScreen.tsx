/**
 * SouqView – Settings screen: Appearance (Light/Dark), Knowledge Level (Beginner 🎓 | Pro 🚀).
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { MIN_TOUCH_TARGET } from '../../constants/theme';
import type { ThemeColors } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useExpertise } from '../../contexts/ExpertiseContext';
import type { ExpertiseLevel } from '../../services/profileService';

export function SettingsScreen() {
  const { colors, mode, setTheme } = useTheme();
  const { expertiseLevel, setExpertiseLevel, isLoading } = useExpertise();
  const styles = makeStyles(colors);

  const handleSelect = (level: ExpertiseLevel) => {
    if (level === expertiseLevel) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpertiseLevel(level);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Profile & preferences</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <Text style={styles.sectionHint}>Light or Dark theme for the app.</Text>
        <View style={styles.segmentWrap}>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'light' && styles.segmentBtnActive]}
            onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTheme('light'); }}
            activeOpacity={0.8}
          >
            <Text style={styles.segmentEmoji}>☀️</Text>
            <Text style={[styles.segmentLabel, mode === 'light' && styles.segmentLabelActive]}>Light</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, mode === 'dark' && styles.segmentBtnActivePro]}
            onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTheme('dark'); }}
            activeOpacity={0.8}
          >
            <Text style={styles.segmentEmoji}>🌙</Text>
            <Text style={[styles.segmentLabel, mode === 'dark' && styles.segmentLabelActivePro]}>Dark</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.electricBlue} />
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Knowledge Level</Text>
          <Text style={styles.sectionHint}>
            How Faheem explains the market — from simple to technical.
          </Text>
          <View style={styles.segmentWrap}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                expertiseLevel === 'beginner' && styles.segmentBtnActive,
              ]}
              onPress={() => handleSelect('beginner')}
              activeOpacity={0.8}
            >
              <Text style={styles.segmentEmoji}>🎓</Text>
              <Text style={[styles.segmentLabel, expertiseLevel === 'beginner' && styles.segmentLabelActive]}>
                Beginner
              </Text>
              <Text style={[styles.segmentDesc, expertiseLevel === 'beginner' && styles.segmentDescActive]}>
                Simple language. No jargon. Focus on learning.
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                expertiseLevel === 'pro' && styles.segmentBtnActivePro,
              ]}
              onPress={() => handleSelect('pro')}
              activeOpacity={0.8}
            >
              <Text style={styles.segmentEmoji}>🚀</Text>
              <Text style={[styles.segmentLabel, expertiseLevel === 'pro' && styles.segmentLabelActivePro]}>
                Pro
              </Text>
              <Text style={[styles.segmentDesc, expertiseLevel === 'pro' && styles.segmentDescActivePro]}>
                Technical terms. Dense data. Focus on analysis.
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Ionicons name="information-circle-outline" size={20} color={colors.textTertiary} />
        <Text style={styles.cardText}>
          Language, notifications, and account preferences will appear here.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 20 },
    title: { fontSize: 28, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 24 },
    loading: { paddingVertical: 32, alignItems: 'center' },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 4 },
    sectionHint: { fontSize: 13, color: colors.textTertiary, marginBottom: 12 },
    segmentWrap: { flexDirection: 'row', gap: 12 },
    segmentBtn: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: MIN_TOUCH_TARGET * 2,
    },
    segmentBtnActive: {
      borderColor: colors.electricBlue,
      backgroundColor: colors.electricBlueDim,
    },
    segmentBtnActivePro: {
      borderColor: colors.neonMint,
      backgroundColor: colors.neonMintDim,
    },
    segmentEmoji: { fontSize: 24, marginBottom: 6 },
    segmentLabel: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
    segmentLabelActive: { color: colors.electricBlue },
    segmentLabelActivePro: { color: colors.neonMint },
    segmentDesc: { fontSize: 12, color: colors.textTertiary, marginTop: 4, lineHeight: 16 },
    segmentDescActive: { color: colors.textSecondary },
    segmentDescActivePro: { color: colors.textSecondary },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardText: { flex: 1, color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
  });
}
