import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../contexts/AuthContext';
import { PortfolioProvider } from '../contexts/PortfolioContext';
import { AuthGate } from '../components/AuthGate';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { COLORS } from '../constants/theme';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PortfolioProvider>
          <AuthGate>
            <StatusBar style="dark" backgroundColor={COLORS.background} />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: COLORS.background }, headerTitleStyle: { color: COLORS.text },
                headerTintColor: COLORS.electricBlue,
                headerShadowVisible: false,
                contentStyle: { backgroundColor: COLORS.background },
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
                options={{
                  title: '',
                  headerBackTitle: 'Watchlist',
                  headerTintColor: COLORS.electricBlue,
                }}
              />
            </Stack>
          </AuthGate>
        </PortfolioProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
