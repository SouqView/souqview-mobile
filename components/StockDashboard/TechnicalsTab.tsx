/**
 * Technicals Tab – Apple Design System.
 * Parses /api/stock/technicals multi-indicator response:
 *   rsi: { values: [ { datetime, rsi } ] }, macd: { values: [ { macd, signal } ] }, ma: { values: [ { ma } ] }
 * Extracts latest from values[0]. Heatmap: RSI>70 red, RSI<30 green, Price>MA green.
 * Timeframe pills trigger re-fetch with &timeframe= param.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, TYPO } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useStockDetail } from '../../contexts/StockDetailContext';
import { useExpertise } from '../../contexts/ExpertiseContext';
import { TypewriterText } from '../../src/components';
import { getFaheemTechnicals, toFaheemMode } from '../../src/services/aiService';

/** Backend combined response: RSI, MACD, MA, Bollinger Bands, Stochastic */
type TechnicalsData = {
  rsi?: { values?: Array<{ datetime?: string; rsi?: string }> };
  macd?: { values?: Array<{ macd?: string; signal?: string; histogram?: string }> };
  ma?: { values?: Array<{ ma?: string; ma_20?: string; ma_50?: string; ma_200?: string; datetime?: string }> };
  price?: number;
  data?: Array<{ name?: string; value?: string; status?: string }>;
  indicators?: Array<{ name?: string; value?: string; status?: string }>;
  moving_averages?: Record<string, number>;
  bollinger_bands?: { upper?: number; lower?: number; middle?: number };
  bollinger?: { values?: Array<{ upper?: number; lower?: number; middle?: number }> };
  stochastic?: { values?: Array<{ k?: number; d?: number; stoch_k?: number; stoch_d?: number }> };
  stoch?: { values?: Array<{ k?: number; d?: number }> };
};

type Candle = { close: number; open?: number; high?: number; low?: number };
/** ATR(period): average of true range over last `period` candles. */
function computeATR(candles: Array<{ high?: number; low?: number; close: number }>, period: number): number | null {
  if (!candles?.length || period < 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    const high = candles[i].high ?? candles[i].close;
    const low = candles[i].low ?? candles[i].close;
    const tr = Math.max(high - low, Math.abs(high - prev), Math.abs(low - prev));
    trs.push(tr);
  }
  if (trs.length < period) return null;
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export interface TechnicalsTabProps {
  symbol: string;
  technicals: TechnicalsData | null;
  loading: boolean;
  /** Optional historical candles for client-side SMA when backend doesn't send MAs */
  historical?: { data?: Candle[] } | null;
}

/** Parse string to number; return null if invalid */
function parseNum(s: string | number | undefined): number | null {
  if (s == null) return null;
  if (typeof s === 'number' && Number.isFinite(s)) return s;
  const n = parseFloat(String(s));
  return Number.isFinite(n) ? n : null;
}

/** Simple SMA from last N closes (newest at end). */
function simpleSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

const TIMEFRAMES = [
  { id: '5min', label: '5m' },
  { id: '15min', label: '15m' },
  { id: '30min', label: '30m' },
  { id: '1h', label: '1H' },
  { id: '4h', label: '4H' },
  { id: '1day', label: '1D' },
  { id: '1week', label: '1W' },
];

type SignalColor = 'green' | 'red' | 'neutral';

function TimeframePills({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsWrap}>
      {TIMEFRAMES.map((tf) => {
        const isSelected = selected === tf.id;
        return (
          <TouchableOpacity
            key={tf.id}
            style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.separator }, isSelected && { backgroundColor: colors.electricBlueDim, borderColor: colors.electricBlue }]}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(tf.id);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.pillLabel, { color: colors.textSecondary }, isSelected && { color: colors.electricBlue }]}>{tf.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function SignalCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string | number;
  color: SignalColor;
}) {
  const { colors } = useTheme();
  const bgStyle = color === 'green' ? styles.signalCardGreen : color === 'red' ? styles.signalCardRed : { backgroundColor: colors.card, borderColor: colors.separator };
  const textStyle = color === 'green' ? styles.signalTextGreen : color === 'red' ? styles.signalTextRed : { color: colors.text };
  return (
    <View style={[styles.signalCard, bgStyle]}>
      <Text style={[styles.signalCardLabel, { color: colors.textTertiary }]}>{title}</Text>
      <Text style={[styles.signalCardValue, TYPO.tabular, textStyle]}>{value}</Text>
    </View>
  );
}

function VerdictHeader({ verdict }: { verdict: 'Strong Buy' | 'Neutral' | 'Sell' }) {
  const { colors } = useTheme();
  const isBuy = verdict === 'Strong Buy';
  const isSell = verdict === 'Sell';
  return (
    <View style={[styles.verdictBlock, { backgroundColor: colors.card, borderColor: colors.separator }, isBuy && styles.verdictBlockBuy, isSell && styles.verdictBlockSell]}>
      <Text style={[styles.verdictText, { color: colors.text }, isBuy && styles.verdictBuy, isSell && styles.verdictSell]}>{verdict}</Text>
      <Text style={[styles.verdictHint, { color: colors.textTertiary }]}>Based on count of green vs red signals</Text>
    </View>
  );
}

/** Compute all derived indicator data from raw technicals + closes. Safe to call with empty {}. */
function computeDerived(
  raw: TechnicalsData,
  closes: number[],
  historicalCandles: Array<{ high?: number; low?: number; close: number }> = []
): {
  indicators: Array<{ name?: string; value?: string; status?: string }>;
  rsiVal: number | null;
  macdLatest: { macd?: string; signal?: string } | undefined;
  macdVal: string | undefined;
  macdNum: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  price: number | null;
  priceVsSma20: boolean | null;
  priceVsSma50: boolean | null;
  priceVsSma200: boolean | null;
  rsiColor: SignalColor;
  ma20Color: SignalColor;
  ma50Color: SignalColor;
  ma200Color: SignalColor;
  macdColor: SignalColor;
  bbDisplay: string;
  bbColor: SignalColor;
  stochDisplay: string;
  stochColor: SignalColor;
  atrDisplay: string;
  atrVal: number | null;
  fullDataset: Record<string, unknown>;
  verdict: 'Strong Buy' | 'Neutral' | 'Sell';
} {
  const indicators = raw.data ?? raw.indicators ?? [];
  const candles = historicalCandles.length >= 14 ? historicalCandles : (raw as { candles?: Array<{ high?: number; low?: number; close: number }> }).candles ?? [];
  const rsiLatest = raw.rsi?.values?.[0];
  const rsiVal = parseNum(rsiLatest?.rsi) ?? (typeof raw.rsi === 'number' ? raw.rsi : null) ?? parseNum(indicators.find((i: { name?: string }) => /rsi/i.test(i.name ?? ''))?.value);
  const macdLatest = raw.macd?.values?.[0];
  const macdNum = parseNum(macdLatest?.macd);
  const macdVal = macdLatest?.macd ?? macdLatest?.signal ?? indicators.find((i: { name?: string }) => /macd/i.test(i.name ?? ''))?.value;
  const macdBullish = macdNum != null && macdNum > 0;
  const macdBearish = macdNum != null && macdNum < 0;
  const maLatest = raw.ma?.values?.[0];
  const sma20Backend = parseNum(maLatest?.ma_20 ?? maLatest?.ma) ?? parseNum((raw.moving_averages as Record<string, number> | undefined)?.sma_20) ?? parseNum(indicators.find((i: { name?: string }) => /ma.*20|20.*ma/i.test(i.name ?? ''))?.value);
  const sma50Backend = parseNum(maLatest?.ma_50 ?? maLatest?.ma) ?? parseNum((raw.moving_averages as Record<string, number> | undefined)?.sma_50) ?? parseNum(indicators.find((i: { name?: string }) => /ma.*50|50.*ma/i.test(i.name ?? ''))?.value);
  const sma200Backend = parseNum(maLatest?.ma_200 ?? maLatest?.ma) ?? parseNum((raw.moving_averages as Record<string, number> | undefined)?.sma_200) ?? parseNum(indicators.find((i: { name?: string }) => /ma.*200|200.*ma/i.test(i.name ?? ''))?.value);
  const sma20 = sma20Backend ?? simpleSMA(closes, 20);
  const sma50 = sma50Backend ?? simpleSMA(closes, 50);
  const sma200 = sma200Backend ?? simpleSMA(closes, 200);
  const price = typeof raw.price === 'number' && Number.isFinite(raw.price) ? raw.price : (closes.length > 0 ? closes[closes.length - 1] : null);
  const priceVsSma20 = price != null && sma20 != null ? price > sma20 : null;
  const priceVsSma50 = price != null && sma50 != null ? price > sma50 : null;
  const priceVsSma200 = price != null && sma200 != null ? price > sma200 : null;
  const rsiColor: SignalColor = rsiVal == null ? 'neutral' : rsiVal > 70 ? 'red' : rsiVal < 30 ? 'green' : 'neutral';
  const ma200Color: SignalColor = priceVsSma200 === true ? 'green' : priceVsSma200 === false ? 'red' : 'neutral';
  const ma50Color: SignalColor = priceVsSma50 === true ? 'green' : priceVsSma50 === false ? 'red' : 'neutral';
  const ma20Color: SignalColor = priceVsSma20 === true ? 'green' : priceVsSma20 === false ? 'red' : 'neutral';
  const macdColor: SignalColor = macdBullish ? 'green' : macdBearish ? 'red' : 'neutral';
  const bb = raw.bollinger_bands ?? (raw as { bollinger?: { values?: Array<{ upper?: number; lower?: number; middle?: number }> } }).bollinger?.values?.[0];
  const bbUpper = bb && typeof bb === 'object' && 'upper' in bb ? (bb as { upper?: number }).upper : (raw.bollinger_bands as { upper?: number } | undefined)?.upper;
  const bbLower = bb && typeof bb === 'object' && 'lower' in bb ? (bb as { lower?: number }).lower : (raw.bollinger_bands as { lower?: number } | undefined)?.lower;
  const bbMiddle = bb && typeof bb === 'object' && 'middle' in bb ? (bb as { middle?: number }).middle : (raw.bollinger_bands as { middle?: number } | undefined)?.middle;
  const bbIndicator = indicators.find((i: { name?: string }) => /bollinger|bb/i.test(i.name ?? ''));
  const bbBullish = bbIndicator?.status === 'bullish';
  const bbBearish = bbIndicator?.status === 'bearish';
  const bbColor: SignalColor = bbBullish ? 'green' : bbBearish ? 'red' : 'neutral';
  const bbDisplay = [bbUpper, bbMiddle, bbLower].filter((n) => n != null && Number.isFinite(n)).length > 0
    ? `U:${bbUpper?.toFixed(2) ?? '—'} M:${bbMiddle?.toFixed(2) ?? '—'} L:${bbLower?.toFixed(2) ?? '—'}`
    : (bbIndicator?.value ?? '—');
  const stochValues = (raw.stochastic ?? raw.stoch)?.values?.[0] ?? indicators.find((i: { name?: string }) => /stoch/i.test(i.name ?? ''));
  const stochK = typeof stochValues === 'object' && stochValues != null ? (stochValues as { k?: number; stoch_k?: number }).k ?? (stochValues as { stoch_k?: number }).stoch_k : null;
  const stochD = typeof stochValues === 'object' && stochValues != null ? (stochValues as { d?: number; stoch_d?: number }).d ?? (stochValues as { stoch_d?: number }).stoch_d : null;
  const stochKNum = parseNum(stochK as string | number) ?? (typeof stochK === 'number' ? stochK : null);
  const stochDNum = parseNum(stochD as string | number) ?? (typeof stochD === 'number' ? stochD : null);
  const stochDisplay = (stochKNum != null || stochDNum != null)
    ? `%K ${stochKNum?.toFixed(1) ?? '—'}  %D ${stochDNum?.toFixed(1) ?? '—'}`
    : (typeof stochValues === 'object' && stochValues != null && 'value' in stochValues ? String((stochValues as { value?: string }).value ?? '—') : '—');
  const stochBullish = stochKNum != null && stochDNum != null && stochKNum > stochDNum && stochKNum < 20;
  const stochBearish = stochKNum != null && stochDNum != null && stochKNum < stochDNum && stochKNum > 80;
  const stochColor: SignalColor = stochBullish ? 'green' : stochBearish ? 'red' : 'neutral';
  const atrVal = candles.length >= 15 ? computeATR(candles, 14) : parseNum(indicators.find((i: { name?: string }) => /atr/i.test(i.name ?? ''))?.value);
  const atrDisplay = atrVal != null ? atrVal.toFixed(2) : '—';
  const fullDataset = {
    rsi: rsiVal,
    macd: macdNum,
    macdSignal: macdLatest?.signal,
    sma20: sma20 ?? undefined,
    sma50: sma50 ?? undefined,
    sma200: sma200 ?? undefined,
    price,
    bollinger: { upper: bbUpper, lower: bbLower, middle: bbMiddle },
    stochastic: { k: stochKNum ?? undefined, d: stochDNum ?? undefined },
    atr: atrVal ?? undefined,
  };
  const signals: SignalColor[] = [rsiColor, ma200Color, ma50Color, ma20Color, macdColor, bbColor, stochColor].filter((c) => c !== 'neutral');
  const greenCount = signals.filter((c) => c === 'green').length;
  const redCount = signals.filter((c) => c === 'red').length;
  const verdict: 'Strong Buy' | 'Neutral' | 'Sell' = greenCount > redCount ? 'Strong Buy' : redCount > greenCount ? 'Sell' : 'Neutral';
  return {
    indicators,
    rsiVal,
    macdLatest,
    macdVal,
    macdNum,
    sma20,
    sma50,
    sma200,
    price,
    priceVsSma20,
    priceVsSma50,
    priceVsSma200,
    rsiColor,
    ma20Color,
    ma50Color,
    ma200Color,
    macdColor,
    bbDisplay,
    bbColor,
    stochDisplay,
    stochColor,
    atrDisplay,
    atrVal,
    fullDataset,
    verdict,
  };
}

export function TechnicalsTab({ symbol, technicals, loading, historical }: TechnicalsTabProps) {
  const { colors } = useTheme();
  const { loadTechnicals } = useStockDetail();
  const { expertiseLevel } = useExpertise();
  const [timeframe, setTimeframe] = useState('1day');
  const [aiRationale, setAiRationale] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  const safeRaw = useMemo(() => technicals ?? {}, [technicals]);
  const closes = useMemo(() => (historical?.data ?? []).map((d) => d.close).filter((n) => Number.isFinite(n)), [historical?.data]);
  const historicalCandles = useMemo(() => (historical?.data ?? []).filter((d): d is { high?: number; low?: number; close: number } => typeof d?.close === 'number'), [historical?.data]);
  const derived = useMemo(() => computeDerived(safeRaw as TechnicalsData, closes, historicalCandles), [safeRaw, closes, historicalCandles]);

  useEffect(() => {
    loadTechnicals(timeframe);
  }, [timeframe, symbol, loadTechnicals]);

  useEffect(() => {
    let cancelled = false;
    if (!symbol) return;
    setAiLoading(true);
    getFaheemTechnicals(symbol, derived.fullDataset, toFaheemMode(expertiseLevel))
      .then((res) => {
        if (!cancelled) {
          const parts = [
            res.trend_strength && `Trend: ${res.trend_strength}`,
            res.key_levels && `Key levels: ${res.key_levels}`,
          ].filter(Boolean);
          setAiRationale(parts.join('\n\n') || '');
        }
      })
      .catch(() => {
        if (!cancelled) setAiRationale('');
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false);
      });
    return () => { cancelled = true; };
  }, [symbol, timeframe, expertiseLevel, technicals]);

  if (loading && !technicals) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
        <Text style={[styles.sub, { color: colors.textSecondary }]}>Loading RSI, MACD, MAs…</Text>
      </View>
    );
  }

  const { indicators, rsiVal, macdLatest, macdVal, sma20, sma50, sma200, price, priceVsSma20, priceVsSma50, priceVsSma200, rsiColor, ma20Color, ma50Color, ma200Color, macdColor, bbDisplay, bbColor, stochDisplay, stochColor, atrDisplay, verdict } = derived;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <TimeframePills selected={timeframe} onSelect={setTimeframe} />
      <VerdictHeader verdict={verdict} />

      <View style={styles.heatmapBlock}>
        <Text style={[styles.heatmapTitle, { color: colors.text }]}>6 Indicators (2-column grid)</Text>
        <View style={styles.indicatorsGrid}>
          <SignalCard title="RSI (14)" value={rsiVal != null ? rsiVal.toFixed(1) : '—'} color={rsiColor} />
          <SignalCard title="MACD" value={macdVal != null ? `${macdVal} / ${macdLatest?.signal ?? '—'}` : '—'} color={macdColor} />
          <SignalCard
            title="SMA"
            value={[sma20, sma50, sma200].some((n) => n != null) ? `20: ${sma20?.toFixed(2) ?? '—'} 50: ${sma50?.toFixed(2) ?? '—'} 200: ${sma200?.toFixed(2) ?? '—'}` : '—'}
            color={priceVsSma20 === true || priceVsSma50 === true || priceVsSma200 === true ? 'green' : priceVsSma20 === false || priceVsSma50 === false || priceVsSma200 === false ? 'red' : 'neutral'}
          />
          <SignalCard title="Bollinger Bands" value={bbDisplay} color={bbColor} />
          <SignalCard title="Stochastic" value={stochDisplay} color={stochColor} />
          <SignalCard title="ATR (14)" value={atrDisplay} color="neutral" />
        </View>
        {bbDisplay && /U:/.test(bbDisplay) && (
          <Text style={[styles.bbHint, { color: colors.textTertiary }]}>Upper / Middle / Lower bands shown above.</Text>
        )}
      </View>

      {(aiRationale || aiLoading) && (
        <View style={[styles.aiBlock, { backgroundColor: colors.card, borderLeftColor: colors.electricBlue }]}>
          <Text style={[styles.aiBlockTitle, { color: colors.electricBlue }]}>Faheem&apos;s Take</Text>
          {aiLoading ? (
            <Text style={[styles.aiBlockText, { color: colors.textSecondary }]}>Analyzing indicators…</Text>
          ) : (
            <TypewriterText
              text={aiRationale ?? ''}
              style={[styles.aiBlockText, { color: colors.textSecondary }]}
              haptics={false}
            />
          )}
        </View>
      )}

      {indicators.length > 0 && (
        <View style={styles.listBlock}>
          <Text style={[styles.listTitle, { color: colors.text }]}>All technicals</Text>
          {indicators.slice(0, 14).map((ind, i) => (
            <View key={i} style={[styles.row, { backgroundColor: colors.card }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.separator }]}>
              <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{ind.name ?? '—'}</Text>
              <Text style={[styles.rowValue, { color: colors.text }, ind.status === 'bullish' && styles.bullish, ind.status === 'bearish' && styles.bearish]}>
                {ind.value ?? '—'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  sub: { color: COLORS.textSecondary, marginTop: 12 },
  pillsWrap: { flexDirection: 'row', gap: 8, marginBottom: 20, paddingRight: 16 },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.separator,
  },
  pillActive: { backgroundColor: COLORS.electricBlueDim, borderColor: COLORS.electricBlue },
  pillLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  pillLabelActive: { color: COLORS.electricBlue },
  verdictBlock: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.separator,
  },
  verdictBlockBuy: { borderColor: COLORS.positive },
  verdictBlockSell: { borderColor: COLORS.negative },
  verdictText: { fontSize: 28, fontWeight: '700', color: COLORS.text },
  verdictBuy: { color: COLORS.positive },
  verdictSell: { color: COLORS.negative },
  verdictHint: { fontSize: 13, color: COLORS.textTertiary, marginTop: 8 },
  heatmapBlock: { marginBottom: 20 },
  heatmapTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  bbHint: { fontSize: 12, color: COLORS.textTertiary, marginTop: 8 },
  heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  indicatorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  signalCard: {
    width: '47%',
    minWidth: 140,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  signalCardGreen: { backgroundColor: COLORS.neonMintDim, borderColor: COLORS.positive },
  signalCardRed: { backgroundColor: COLORS.negativeDim, borderColor: COLORS.negative },
  signalCardNeutral: { backgroundColor: COLORS.card, borderColor: COLORS.separator },
  signalCardLabel: { fontSize: 13, color: COLORS.textTertiary, marginBottom: 4 },
  signalCardValue: { fontSize: 16, fontWeight: '700' },
  signalTextGreen: { color: COLORS.positive },
  signalTextRed: { color: COLORS.negative },
  signalTextNeutral: { color: COLORS.text },
  listBlock: { marginBottom: 20 },
  listTitle: { fontSize: 17, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: COLORS.card },
  rowBorder: { borderTopWidth: 1, borderTopColor: COLORS.separator },
  rowLabel: { fontSize: 14, color: COLORS.textSecondary },
  rowValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  bullish: { color: COLORS.positive },
  bearish: { color: COLORS.negative },
  aiBlock: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.electricBlue,
  },
  aiBlockTitle: { fontSize: 13, fontWeight: '600', color: COLORS.electricBlue, marginBottom: 6 },
  aiBlockText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
});
