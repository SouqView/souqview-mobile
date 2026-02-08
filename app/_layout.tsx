import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { ExpertiseProvider } from '../contexts/ExpertiseContext';
import { PortfolioProvider } from '../contexts/PortfolioContext';
import { StockPriceProvider } from '../src/store/StockPriceStore';
import { AuthGate } from '../components/AuthGate';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { handleOAuthRedirect } from '../src/services/supabase';

function DeepLinkHandler() {
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleOAuthRedirect(url);
    });
    return () => sub.remove();
  }, []);
  return null;
}

function StackWithTheme() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text },
          headerTintColor: colors.electricBlue,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="login"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="stock/[symbol]"
                options={({ route }: { route: { params?: { symbol?: string } } }) => ({
                  title: route.params?.symbol ?? 'Stock',
                  headerBackTitle: 'Watchlist',
                  headerTintColor: colors.electricBlue,
                  headerStyle: { backgroundColor: colors.background },
                  headerTitleStyle: { fontSize: 17, fontWeight: '600', color: colors.text },
                  headerShadowVisible: false,
                })}
              />
            </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DeepLinkHandler />
        <ThemeProvider>
        <ExpertiseProvider>
        <PortfolioProvider>
          <StockPriceProvider>
            <AuthGate>
              <StackWithTheme />
            </AuthGate>
          </StockPriceProvider>
        </PortfolioProvider>
        </ExpertiseProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
