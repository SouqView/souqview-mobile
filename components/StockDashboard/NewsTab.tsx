import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../../constants/theme';

type NewsItem = {
  id?: string;
  title?: string;
  summary?: string;
  url?: string;
  published_at?: string;
  source?: string;
};

export interface NewsTabProps {
  symbol: string;
  news: NewsItem[] | null;
  loading: boolean;
}

export function NewsTab({ symbol, news, loading }: NewsTabProps) {
  const list = Array.isArray(news) ? news : [];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.electricBlue} />
        <Text style={styles.sub}>Loading news for {symbol}…</Text>
      </View>
    );
  }

  if (!list.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>No headlines for this ticker yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={list}
      keyExtractor={(item, i) => item.id || item.url || `news-${i}`}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.title} numberOfLines={2}>{item.title || 'No title'}</Text>
          {item.summary ? (
            <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text>
          ) : null}
          <Text style={styles.meta}>
            {item.source || 'News'} • {item.published_at
              ? new Date(item.published_at).toLocaleDateString()
              : ''}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  sub: { color: COLORS.textSecondary, marginTop: 12 },
  empty: { color: COLORS.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  summary: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6 },
  meta: { fontSize: 12, color: COLORS.textTertiary, marginTop: 8 },
});
