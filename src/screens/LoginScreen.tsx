/**
 * SouqView – Apple-style login screen.
 * Montserrat font, clean minimalist layout, Sign in with Google prominent.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useFonts, Montserrat_400Regular, Montserrat_600SemiBold } from '@expo-google-fonts/montserrat';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';

export function LoginScreen() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signInWithGoogle } = useAuth();
  const router = useRouter();

  const [fontsLoaded] = useFonts({ Montserrat_400Regular, Montserrat_600SemiBold });

  const handleSignInWithGoogle = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await signInWithGoogle();
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in with Google failed.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!fontsLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.electricBlue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>SouqView</Text>
          <Text style={styles.subtitle}>
            US markets, demo trading{'\n'}and AI insights.
          </Text>
        </View>

        <View style={styles.spacer} />

        <TouchableOpacity
          style={[styles.googleButton, isLoading && styles.googleButtonDisabled]}
          onPress={handleSignInWithGoogle}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#3C4043" size="small" />
          ) : (
            <>
              <View style={styles.googleLogo}>
                <Text style={styles.googleLogoText}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Sign in with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By continuing, you agree to our Terms and Privacy Policy.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 32,
  },
  header: {
    marginTop: 24,
  },
  title: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 34,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 17,
    color: COLORS.textSecondary,
    marginTop: 8,
    lineHeight: 24,
  },
  spacer: {
    flex: 1,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    minHeight: 56,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  googleButtonDisabled: {
    opacity: 0.7,
  },
  googleLogo: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  googleLogoText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: '#4285F4',
  },
  googleButtonText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 17,
    color: '#3C4043',
  },
  error: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: COLORS.negative,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
  },
  footer: {
    marginTop: 32,
    paddingHorizontal: 8,
  },
  footerText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
