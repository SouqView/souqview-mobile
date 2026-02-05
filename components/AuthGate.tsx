import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../constants/theme';

/**
 * Set to true to require login before accessing (tabs) and stock screens.
 * Set to false to allow browsing without login (login still available from Settings).
 */
const REQUIRE_LOGIN = false;

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!REQUIRE_LOGIN || isLoading) return;
    const onLoginScreen = segments[0] === 'login';
    if (!isAuthenticated && !onLoginScreen) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  if (REQUIRE_LOGIN && isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.electricBlue} />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
