import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { postRequest } from '../../services/api';

interface ForecastAiProps {
  symbol?: string;
}

interface ChartDataPoint {
  time: string;
  value: number;
  rawTime: string;
}

export default function ForecastAi({ symbol = 'AAPL' }: ForecastAiProps) {
  const [faheemMessage, setFaheemMessage] = useState({
    en: 'Analyzing market data. Insights will be ready soon...',
    ar: 'جارٍ تحليل بيانات السوق. ستكون الرؤى جاهزة قريبًا...',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [activeTime, setActiveTime] = useState('1D');
  const [chartLoading, setChartLoading] = useState(false);
  const [noPriceData, setNoPriceData] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  // TODO: Get from context/state instead of hardcoding
  const selectedStockSymbol = symbol;
  const isRTL = false; // TODO: Get from i18n context
  const currency = 'USD'; // TODO: Get from stock context

  const timePeriods = [
    { label: '1D', value: '1D', apiValue: '1m' },
    { label: '1W', value: '1W', apiValue: '1w' },
    { label: '1M', value: '1M', apiValue: '1m' },
  ];

  // Pulsing animation for loading dots
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    getFaheemInsights();
    fetchChartData();
  }, [selectedStockSymbol, activeTime]);

  const getFaheemInsights = async () => {
    setIsLoading(true);
    setFaheemMessage({
      en: 'Analyzing market data. Insights will be ready soon...',
      ar: 'جارٍ تحليل بيانات السوق. ستكون الرؤى جاهزة قريبًا...',
    });
    try {
      const resp = await postRequest('/api/faheem/analyze', {
        category: 'company_forecast',
        ticker: selectedStockSymbol,
        tier: 'pro',
      });
      if (resp?.data) {
        setFaheemMessage(resp.data);
      }
    } catch (error) {
      console.warn('Error getting Faheem insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChartData = async () => {
    if (!selectedStockSymbol) {
      setChartData([]);
      setNoPriceData(true);
      return;
    }

    setChartLoading(true);
    setNoPriceData(false);

    try {
      const timeframe = timePeriods.find((p) => p.value === activeTime)?.apiValue || '1m';
      const resp = await postRequest('/api/faheem/chart', {
        category: 'prices',
        ticker: selectedStockSymbol,
        timeframe,
      });

      if (resp?.data?.price_available && resp?.data?.prices && resp.data.prices.length > 0) {
        const formattedData = resp.data.prices.map((item: any) => ({
          time: formatDate(item.time, activeTime),
          value: item.close,
          rawTime: item.time,
        }));
        setChartData(formattedData);
        setNoPriceData(false);
      } else {
        setChartData([]);
        setNoPriceData(true);
      }
    } catch (error) {
      console.warn('Error fetching chart data:', error);
      setChartData([]);
      setNoPriceData(true);
    } finally {
      setChartLoading(false);
    }
  };

  const formatDate = (dateString: string, timeframe: string): string => {
    const date = new Date(dateString);
    switch (timeframe) {
      case '1D':
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      case '1W':
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      case '1M':
        return `Week ${Math.ceil(date.getDate() / 7)}`;
      default:
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Calculate sentiment from chart data
  const getSentiment = () => {
    if (chartData.length < 2) return null;
    const firstValue = chartData[0].value;
    const lastValue = chartData[chartData.length - 1].value;
    const percentChange = firstValue > 0 ? (((lastValue - firstValue) / firstValue) * 100).toFixed(2) : '0.00';
    const isPositive = lastValue >= firstValue;
    return { isPositive, percentChange, lastValue };
  };

  const sentiment = getSentiment();

  // Simple markdown-like text formatting
  const formatText = (text: string): string => {
    if (!text) return '';
    // Remove markdown asterisks, convert to plain text
    return text.replace(/\*\*/g, '').replace(/\*/g, '').trim();
  };

  // Build chart HTML for WebView
  const getChartHtml = () => {
    if (chartData.length === 0) return '';

    const values = chartData.map((d) => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const isPositive = sentiment?.isPositive || false;
    const color = isPositive ? '#10b981' : '#ef4444';

    const dataPoints = chartData.map((d, i) => ({
      x: (i / (chartData.length - 1)) * 100,
      y: 100 - ((d.value - min) / (max - min)) * 100,
      value: d.value,
      time: d.time,
    }));

    const pathData = dataPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 0;
              background: #0f172a;
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            }
            svg {
              width: 100%;
              height: 100%;
            }
            .chart-container {
              width: 100%;
              height: 300px;
              background: #0f172a;
            }
          </style>
        </head>
        <body>
          <div class="chart-container">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style="stop-color:${color};stop-opacity:0.3" />
                  <stop offset="100%" style="stop-color:${color};stop-opacity:0" />
                </linearGradient>
              </defs>
              <path d="${pathData} L 100 100 L 0 100 Z" fill="url(#gradient)" />
              <path d="${pathData}" stroke="${color}" stroke-width="0.5" fill="none" />
            </svg>
          </div>
        </body>
      </html>
    `;
  };

  return (
    <View style={styles.container}>
      {/* Price Forecast Chart */}
      <View style={styles.chartContainer}>
        {/* Time Period Selector */}
        <View style={styles.timePeriodContainer}>
          {timePeriods.map((period) => (
            <TouchableOpacity
              key={period.value}
              onPress={() => setActiveTime(period.value)}
              style={[
                styles.timePeriodButton,
                activeTime === period.value && styles.timePeriodButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.timePeriodText,
                  activeTime === period.value && styles.timePeriodTextActive,
                ]}
              >
                {period.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sentiment Card */}
        {sentiment && (
          <View
            style={[
              styles.sentimentCard,
              sentiment.isPositive ? styles.sentimentCardBullish : styles.sentimentCardBearish,
            ]}
          >
            <View style={styles.sentimentContent}>
              {sentiment.isPositive ? (
                <MaterialIcons name="trending-up" size={20} color="#10b981" />
              ) : (
                <MaterialIcons name="trending-down" size={20} color="#ef4444" />
              )}
              <View style={styles.sentimentTextContainer}>
                <Text style={styles.sentimentLabel}>
                  {sentiment.isPositive ? 'Bullish' : 'Bearish'}
                </Text>
                <Text style={styles.sentimentValue}>
                  {sentiment.isPositive ? '+' : ''}
                  {sentiment.percentChange}%
                </Text>
              </View>
              <Text style={styles.sentimentPrice}>
                {currency} {sentiment.lastValue.toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Chart */}
        {chartLoading ? (
          <View style={styles.chartLoading}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.chartLoadingText}>Loading forecast chart...</Text>
          </View>
        ) : noPriceData ? (
          <View style={styles.chartEmpty}>
            <Text style={styles.chartEmptyText}>No chart data available</Text>
            <Text style={styles.chartEmptySubtext}>
              Price data is not available for {selectedStockSymbol} in the {activeTime} timeframe
            </Text>
          </View>
        ) : chartData.length > 0 ? (
          <WebView
            source={{ html: getChartHtml() }}
            style={styles.chartWebView}
            scrollEnabled={false}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        ) : null}
      </View>

      {/* Faheem AI Analysis Banner */}
      <View style={styles.faheemBanner}>
        <View style={styles.faheemHeader}>
          <Text style={styles.faheemTitle}>AI Forecast</Text>
        </View>

        {isLoading ? (
          <View style={styles.thinkingContainer}>
            <Text style={styles.thinkingText}>Faheem is thinking...</Text>
            <View style={styles.dotsContainer}>
              {[0, 1, 2].map((dot) => (
                <Animated.View
                  key={dot}
                  style={[
                    styles.thinkingDot,
                    {
                      opacity: pulseAnim,
                      transform: [
                        {
                          translateY: pulseAnim.interpolate({
                            inputRange: [0.3, 1],
                            outputRange: [8, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.faheemMessage} selectable>
            {formatText(faheemMessage.en || faheemMessage.ar)}
          </Text>
        )}

        <Text style={styles.faheemDisclaimer}>
          Disclaimer: Responses are AI-generated by Faheem and may contain inaccuracies. Not financial advice.
        </Text>
      </View>
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
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timePeriodContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  timePeriodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  timePeriodButtonActive: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8',
  },
  timePeriodText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94a3b8',
  },
  timePeriodTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  sentimentCard: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  sentimentCardBullish: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  sentimentCardBearish: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  sentimentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sentimentTextContainer: {
    flex: 1,
  },
  sentimentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 2,
  },
  sentimentValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  sentimentPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cbd5e1',
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
    borderRadius: 8,
  },
  chartLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94a3b8',
  },
  chartEmpty: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 24,
  },
  chartEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
  },
  chartEmptySubtext: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
  },
  faheemBanner: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  faheemHeader: {
    marginBottom: 12,
  },
  faheemTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  thinkingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  thinkingText: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  thinkingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38bdf8',
  },
  faheemMessage: {
    fontSize: 16,
    lineHeight: 24,
    color: '#cbd5e1',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  faheemDisclaimer: {
    fontSize: 11,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 8,
  },
});
