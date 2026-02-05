import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import type { CommunityPost } from '../../services/api';

export interface CommunityTabProps {
  symbol: string;
  posts: CommunityPost[];
}

export function CommunityTab({ symbol, posts }: CommunityTabProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Community — {symbol}</Text>
      <Text style={styles.hint}>User thoughts and sentiment (mock data)</Text>
      {posts.length === 0 ? (
        <Text style={styles.empty}>No posts yet.</Text>
      ) : (
        posts.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.author}>{p.author}</Text>
              {p.sentiment && (
                <View style={[styles.sentiment, p.sentiment === 'bullish' ? styles.bullish : styles.bearish]}>
                  <Ionicons name={p.sentiment === 'bullish' ? 'trending-up' : 'trending-down'} size={14} color="#fff" />
                </View>
              )}
            </View>
            <Text style={styles.body}>{p.body}</Text>
            <Text style={styles.time}>{new Date(p.timestamp).toLocaleString()}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  header: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  hint: { fontSize: 12, color: COLORS.textTertiary, marginBottom: 16 },
  empty: { color: COLORS.textSecondary },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  author: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  sentiment: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  bullish: { backgroundColor: COLORS.positive },
  bearish: { backgroundColor: COLORS.negative },
  body: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  time: { fontSize: 11, color: COLORS.textTertiary, marginTop: 8 },
});
