import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { postRequest, getRequest } from '../../services/api';

interface OverviewProps {
  symbol?: string;
}

interface StockProfile {
  profile?: {
    name?: { en?: string; ar?: string };
    symbol?: string;
    exchange?: string;
    industry?: { en?: string; ar?: string };
    sector?: { en?: string; ar?: string };
    address?: string;
    CEO?: string;
    description?: { en?: string; ar?: string };
  };
  statistics?: {
    currentPrice?: number;
    marketCap?: string;
    dividendYield?: number;
    freeFloat?: string;
    volume?: string;
    peRatio?: number;
    sharesOutstanding?: string;
    roe?: number;
    fiftyTwoWeekHigh?: string;
    fiftyTwoWeekLow?: string;
    aiSentimentScore?: string;
    exDividendDate?: string;
    beta?: number;
  };
}

export default function Overview({ symbol = 'AAPL' }: OverviewProps) {
  const [faheemMessage, setFaheemMessage] = useState({
    en: 'Analyzing market data. Insights will be ready soon...',
    ar: 'جارٍ تحليل بيانات السوق. ستكون الرؤى جاهزة قريبًا...',
  });
  const [stockProfile, setStockProfile] = useState<StockProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle');
  const [activeTime, setActiveTime] = useState('5min');

  // TODO: Get from context/state instead of hardcoding
  const selectedStockSymbol = symbol;
  const isRTL = false; // TODO: Get from i18n context

  useEffect(() => {
    getFaheemInsights();
    fetchStockProfile();
  }, [selectedStockSymbol]);

  const fetchStockProfile = async () => {
    try {
      setIsLoadingProfile(true);
      // TODO: Replace with actual API endpoint for stock profile
      const response = await getRequest(`/api/stock/detail?symbol=${selectedStockSymbol}`);
      if (response?.data) {
        setStockProfile(response.data);
      }
    } catch (error) {
      console.warn('Error fetching stock profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const getFaheemInsights = async () => {
    setFaheemMessage({
      en: 'Analyzing market data. Insights will be ready soon...',
      ar: 'جارٍ تحليل بيانات السوق. ستكون الرؤى جاهزة قريبًا...',
    });
    try {
      const resp = await postRequest('/api/faheem/analyze', {
        category: 'stock_overview',
        ticker: selectedStockSymbol,
        tier: 'pro',
      });
      if (resp?.data) {
        setFaheemMessage(resp.data);
      }
    } catch (error) {
      console.warn('Error getting Faheem insights:', error);
    }
  };

  // Build TradingView widget URL for the chart
  const getChartUrl = () => {
    // Use TradingView's advanced chart widget
    const exchange = 'NASDAQ'; // TODO: Get from stock profile
    const symbolWithExchange = `${exchange}:${selectedStockSymbol}`;
    
    // Map timeframes to TradingView intervals
    const intervalMap: { [key: string]: string } = {
      '5min': '5',
      '1h': '60',
      '1day': 'D',
      '1week': 'W',
      '1month': 'M',
    };
    
    const interval = intervalMap[activeTime] || 'D';
    const chartStyle = chartType === 'candle' ? '1' : '2';
    
    // TradingView Advanced Chart Widget
    return `https://www.tradingview.com/widgetembed/?symbol=${symbolWithExchange}&interval=${interval}&theme=dark&style=${chartStyle}&locale=en&backgroundColor=%230f172a&hide_top_toolbar=0&hide_legend=0&save_image=0&toolbar_bg=%230f172a&enable_publishing=0`;
  };

  const statistics = stockProfile?.statistics;
  const insightCards = statistics
    ? [
        { label: 'Current Price', value: Number(statistics.currentPrice || 0).toFixed(2), unit: 'USD' },
        { label: 'Market Cap', value: statistics.marketCap || 'N/A', unit: 'USD' },
        { label: 'Dividend Yield', value: parseFloat(String(statistics.dividendYield || 0)).toFixed(2), unit: '%' },
        { label: 'Free Float', value: statistics.freeFloat || 'N/A', unit: 'USD' },
        { label: 'Volume', value: statistics.volume || 'N/A', unit: '' },
        { label: 'P/E Ratio', value: parseFloat(String(statistics.peRatio || 0)).toFixed(2), unit: '' },
        { label: 'Shares Outstanding', value: statistics.sharesOutstanding || 'N/A', unit: 'USD' },
        { label: 'ROE', value: parseFloat(String(statistics.roe || 0)).toFixed(2), unit: '%' },
        { label: '52W High', value: statistics.fiftyTwoWeekHigh || 'N/A', unit: 'USD' },
        { label: '52W Low', value: statistics.fiftyTwoWeekLow || 'N/A', unit: 'USD' },
        { label: 'Beta', value: statistics.beta ? parseFloat(String(statistics.beta)).toFixed(2) : 'N/A', unit: '' },
        { label: 'Ex-Dividend Date', value: statistics.exDividendDate || 'N/A', unit: '' },
      ].filter((card) => card.value !== 'N/A' && card.value !== 'NaN' && card.value !== 'null')
    : [];

  const timeFrames = [
    { label: '1D', value: '5min' },
    { label: '1W', value: '1h' },
    { label: '1M', value: '1day' },
    { label: '1Y', value: '1week' },
    { label: 'Max', value: '1month' },
  ];

  const description = stockProfile?.profile?.description?.en || stockProfile?.profile?.description?.ar || '';
  const shouldTruncate = description.length > 150;

  return (
    <View style={styles.container}>
      {/* Stock Chart */}
      <View style={styles.chartContainer}>
        {/* Chart Controls */}
        <View style={styles.chartControls}>
          <View style={styles.timeFrameContainer}>
            {timeFrames.map((frame) => (
              <TouchableOpacity
                key={frame.label}
                onPress={() => setActiveTime(frame.value)}
                style={[
                  styles.timeFrameButton,
                  activeTime === frame.value && styles.timeFrameButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.timeFrameText,
                    activeTime === frame.value && styles.timeFrameTextActive,
                  ]}
                >
                  {frame.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.chartTypeContainer}>
            <TouchableOpacity
              onPress={() => setChartType('line')}
              style={[
                styles.chartTypeButton,
                chartType === 'line' && styles.chartTypeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.chartTypeText,
                  chartType === 'line' && styles.chartTypeTextActive,
                ]}
              >
                Line
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setChartType('candle')}
              style={[
                styles.chartTypeButton,
                chartType === 'candle' && styles.chartTypeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.chartTypeText,
                  chartType === 'candle' && styles.chartTypeTextActive,
                ]}
              >
                Candle
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* WebView Chart */}
        <WebView
          source={{ uri: getChartUrl() }}
          style={styles.chartWebView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.chartLoading}>
              <ActivityIndicator size="large" color="#38bdf8" />
              <Text style={styles.chartLoadingText}>Loading chart...</Text>
            </View>
          )}
        />
      </View>

      {/* Faheem AI Banner */}
      <View style={styles.faheemBanner}>
        <View style={styles.faheemHeader}>
          <Text style={styles.faheemTitle}>Faheem AI Analysis</Text>
        </View>
        <Text style={styles.faheemMessage}>
          {faheemMessage.en}
        </Text>
        <Text style={styles.faheemDisclaimer}>
          Disclaimer: Responses are AI-generated by Faheem and may contain inaccuracies. Not financial advice.
        </Text>
      </View>

      {/* Key Statistics Grid */}
      {insightCards.length > 0 && (
        <View style={styles.statisticsSection}>
          <Text style={styles.sectionTitle}>Key Insights</Text>
          <View style={styles.statisticsGrid}>
            {insightCards.map((card, index) => (
              <View key={index} style={styles.statCard}>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {card.label}
                </Text>
                <View style={styles.statValueContainer}>
                  <Text style={styles.statValue}>{card.value}</Text>
                  {card.unit && <Text style={styles.statUnit}>{card.unit}</Text>}
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Company Profile & Key Executives */}
      {stockProfile?.profile && (
        <View style={styles.profileSection}>
          {/* Company Profile Card */}
          <View style={styles.profileCard}>
            <Text style={styles.cardTitle}>Company Profile</Text>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Company Name:</Text>
              <Text style={styles.profileValue}>
                {stockProfile.profile.name?.en || stockProfile.profile.name?.ar || 'N/A'}
              </Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Symbol:</Text>
              <Text style={styles.profileValue}>
                {stockProfile.profile.symbol}
                {stockProfile.profile.exchange && ` (${stockProfile.profile.exchange})`}
              </Text>
            </View>
            {stockProfile.profile.industry && (
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Industry:</Text>
                <Text style={styles.profileValue}>
                  {stockProfile.profile.industry.en || stockProfile.profile.industry.ar || 'N/A'}
                </Text>
              </View>
            )}
            {stockProfile.profile.sector && (
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Sector:</Text>
                <Text style={styles.profileValue}>
                  {stockProfile.profile.sector.en || stockProfile.profile.sector.ar || 'N/A'}
                </Text>
              </View>
            )}
            {stockProfile.profile.address && (
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Headquarters:</Text>
                <Text style={styles.profileValue}>{stockProfile.profile.address}</Text>
              </View>
            )}
          </View>

          {/* Key Executives Card */}
          <View style={styles.profileCard}>
            <Text style={styles.cardTitle}>Key Executives</Text>
            {stockProfile.profile.CEO && (
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>CEO:</Text>
                <Text style={styles.profileValue}>{stockProfile.profile.CEO}</Text>
              </View>
            )}
            {description && (
              <View style={styles.descriptionContainer}>
                <Text
                  style={styles.descriptionText}
                  numberOfLines={showFullDescription ? undefined : 3}
                >
                  {description}
                </Text>
                {shouldTruncate && (
                  <TouchableOpacity
                    onPress={() => setShowFullDescription(!showFullDescription)}
                    style={styles.readMoreButton}
                  >
                    <Text style={styles.readMoreText}>
                      {showFullDescription ? 'Read Less' : 'Read More'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      )}

      {isLoadingProfile && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Loading stock data...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 8,
  },
  chartContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chartControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  timeFrameContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  timeFrameButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  timeFrameButtonActive: {
    backgroundColor: '#38bdf8',
  },
  timeFrameText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },
  timeFrameTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  chartTypeContainer: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 2,
    gap: 4,
  },
  chartTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chartTypeButtonActive: {
    backgroundColor: '#334155',
  },
  chartTypeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },
  chartTypeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  chartWebView: {
    height: 300,
    backgroundColor: '#0f172a',
    borderRadius: 8,
  },
  chartLoading: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  chartLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#94a3b8',
  },
  faheemBanner: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  faheemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  faheemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  faheemMessage: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
    marginBottom: 8,
  },
  faheemDisclaimer: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  statisticsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  statisticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 6,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  statUnit: {
    fontSize: 11,
    color: '#4ade80',
    fontWeight: '500',
  },
  profileSection: {
    gap: 16,
  },
  profileCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  profileRow: {
    marginBottom: 10,
  },
  profileLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 4,
  },
  profileValue: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  descriptionContainer: {
    marginTop: 8,
  },
  descriptionText: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  readMoreButton: {
    marginTop: 8,
  },
  readMoreText: {
    fontSize: 13,
    color: '#38bdf8',
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94a3b8',
  },
});
