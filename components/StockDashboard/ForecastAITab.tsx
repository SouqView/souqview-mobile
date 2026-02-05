import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';

export interface ForecastAITabProps {
  symbol: string;
}

export function ForecastAITab({ symbol }: ForecastAITabProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="sparkles" size={48} color={COLORS.electricBlue} />
        <Text style={styles.title}>Faheem Insight</Text>
        <Text style={styles.subtitle}>
          AI-powered forecast for {symbol} will appear here. This connects to Agent 1 (Faheem) when the AI service is ready.
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Coming soon</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginTop: 12 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  badge: { marginTop: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.electricBlueDim, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '600', color: COLORS.electricBlue },
});
