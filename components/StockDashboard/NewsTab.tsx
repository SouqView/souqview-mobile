/**
 * News Tab – Apple Design System (Dark Mode).
 * API: Twelve Data /news (via backend /news/stock/:ticker).
 * Faheem's Sentiment: progress bar [ Bullish 70% | Bearish 30% ] + keyword summary.
 * Tap card → open article in WebBrowser.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { COLORS } from '../../constants/theme';

/** API returns items with title, url, image (and optionally source, published_at, etc.) */
export type NewsItem = {
  id?: string;
  title?: string;
  summary?: string;
  url?: string;
  published_at?: string;
  time_published?: string;
  source?: string;
  image_url?: string;
  image?: string;
};

/** API response shape: { data: NewsItem[] } */
export type NewsApiResponse = { data?: NewsItem[] };

export interface NewsTabProps {
  symbol: string;
  /** Either the array of items or the raw API response { data: [...] } */
  news: NewsItem[] | NewsApiResponse | null;
  loading: boolean;
}

/** Normalize news from API: response.data or raw array. Handles missing data. */
function getNewsList(news: NewsItem[] | NewsApiResponse | null): NewsItem[] {
  if (news == null) return [];
  if (Array.isArray(news)) return news;
  const data = (news as NewsApiResponse).data;
  return Array.isArray(data) ? data : [];
}

const BULLISH_WORDS = [
  'surge', 'gain', 'beat', 'growth', 'buy', 'upgrade', 'rally', 'soar', 'rise',
  'record', 'high', 'strong', 'profit', 'revenue', 'outperform', 'bullish', 'momentum',
];
const BEARISH_WORDS = [
  'fall', 'drop', 'miss', 'cut', 'downgrade', 'sell', 'decline', 'loss', 'low',
  'weak', 'bearish', 'crash', 'plunge', 'layoff', 'warning', 'caution',
];

function analyzeHeadlineSentiment(headlines: string[]): {
  bullishPct: number;
  bearishPct: number;
  keyKeyword: string;
  isPositive: boolean;
} {
  if (headlines.length === 0) {
    return { bullishPct: 50, bearishPct: 50, keyKeyword: 'headlines', isPositive: true };
  }
  let bullish = 0;
  let bearish = 0;
  const bullishFound: string[] = [];
  const bearishFound: string[] = [];
  const lower = (t: string) => t.toLowerCase();

  for (const h of headlines) {
    const text = lower(h || '');
    const bWords = BULLISH_WORDS.filter((w) => text.includes(w));
    const rWords = BEARISH_WORDS.filter((w) => text.includes(w));
    if (bWords.length > rWords.length) {
      bullish += 1;
      bullishFound.push(...bWords);
    } else if (rWords.length > bWords.length) {
      bearish += 1;
      bearishFound.push(...rWords);
    }
  }

  const total = bullish + bearish || 1;
  const bullishPct = Math.round((bullish / total) * 100);
  const bearishPct = Math.round((bearish / total) * 100);

  // Pick most frequent keyword for summary (capitalize first letter)
  const isPositive = bullishPct >= bearishPct;
  const wordList = isPositive ? bullishFound : bearishFound;
  const counts: Record<string, number> = {};
  wordList.forEach((w) => { counts[w] = (counts[w] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const keyKeyword = sorted[0]?.[0] ?? (isPositive ? 'momentum' : 'caution');
  const keyKeywordCap = keyKeyword.charAt(0).toUpperCase() + keyKeyword.slice(1);

  return {
    bullishPct: isPositive ? bullishPct : 100 - bearishPct,
    bearishPct: isPositive ? bearishPct : 100 - bullishPct,
    keyKeyword: keyKeywordCap,
    isPositive,
  };
}

function formatSourceTime(source: string | undefined, dateStr: string | undefined): string {
  const parts: string[] = [];
  if (source) parts.push(source);
  if (dateStr) {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      parts.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }
  }
  return parts.join(' · ') || 'News';
}

function NewsCard({ item }: { item: NewsItem }) {
  const headline = item.title || 'No title';
  const source = item.source || 'News';
  const imageUri = item.image_url || item.image || undefined;
  const rawTime = item.time_published || item.published_at;
  const sourceTime = formatSourceTime(source, rawTime);

  const onPress = async () => {
    const url = item.url;
    if (url) {
      try {
        await WebBrowser.openBrowserAsync(url);
      } catch {
        // fallback handled by caller if needed
      }
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      {imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
      )}
      <View style={styles.cardRight}>
        <Text style={styles.headline} numberOfLines={2}>{headline}</Text>
        <Text style={styles.sourceTime} numberOfLines={1}>{sourceTime}</Text>
      </View>
    </TouchableOpacity>
  );
}

function FaheemSentiment({ headlines }: { headlines: string[] }) {
  const { bullishPct, bearishPct, keyKeyword, isPositive } = useMemo(
    () => analyzeHeadlineSentiment(headlines),
    [headlines]
  );

  const summaryText = isPositive
    ? `Faheem detects positive momentum due to ${keyKeyword}.`
    : `Faheem detects caution due to ${keyKeyword}.`;

  return (
    <View style={styles.sentimentWrap}>
      <View style={styles.sentimentBar}>
        <View style={[styles.sentimentSegmentBullish, { flex: bullishPct }]}>
          <Text style={styles.sentimentSegmentText} numberOfLines={1}>
            Bullish News {bullishPct}%
          </Text>
        </View>
        <View style={[styles.sentimentSegmentBearish, { flex: bearishPct }]}>
          <Text style={styles.sentimentSegmentText} numberOfLines={1}>
            Bearish {bearishPct}%
          </Text>
        </View>
      </View>
      <Text style={styles.sentimentSummary}>{summaryText}</Text>
    </View>
  );
}

export function NewsTab({ symbol, news, loading }: NewsTabProps) {
  const list = useMemo(() => getNewsList(news), [news]);
  const headlines = useMemo(() => list.map((n) => n.title || '').filter(Boolean), [list]);

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
      ListHeaderComponent={<FaheemSentiment headlines={headlines} />}
      renderItem={({ item }) => <NewsCard item={item} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  sub: { color: COLORS.textSecondary, marginTop: 12, fontSize: 15 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', fontSize: 15 },

  sentimentWrap: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sentimentBar: {
    flexDirection: 'row',
    height: 32,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: COLORS.background,
  },
  sentimentSegmentBullish: {
    backgroundColor: COLORS.positive,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sentimentSegmentBearish: {
    backgroundColor: COLORS.negative,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sentimentSegmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  sentimentSummary: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 12,
    lineHeight: 22,
  },

  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 88,
  },
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  thumbnailPlaceholder: {
    backgroundColor: COLORS.background,
  },
  cardRight: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  headline: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  sourceTime: {
    fontSize: 12,
    color: COLORS.textTertiary,
  },
});
