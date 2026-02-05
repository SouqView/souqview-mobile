import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

export default function FaheemScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Faheem</Text>
      <Text style={styles.subtitle}>Global AI assistant — coming soon</Text>
      <View style={styles.card}>
        <Text style={styles.cardText}>
          Chat with Faheem for market insights, stock analysis, and portfolio suggestions.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 24 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardText: { color: COLORS.textSecondary, fontSize: 15, lineHeight: 22 },
});
