/**
 * Insiders Tab – Apple Design System. Pagination (5 per page), Faheem summary from API.
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, TYPO } from '../../constants/theme';
import { useTheme } from '../../contexts/ThemeContext';
import { useExpertise } from '../../contexts/ExpertiseContext';
import { TypewriterText } from '../../src/components';
import { getFaheemInsiders, toFaheemMode } from '../../src/services/aiService';

const ROWS_PER_PAGE = 5;

/** API returns insider_transactions with full_name, transaction_type (e.g. "Sale", "Buy", "Purchase"), date, etc. */
export type InsiderTx = {
  full_name?: string;
  name?: string;
  insiderName?: string;
  insider_name?: string;
  position?: string;
  role?: string;
  action?: string;
  transaction_type?: string;
  shares?: number;
  value?: number | string;
  totalValue?: number | string;
  total_value?: number | string;
  transaction_value?: number | string;
  price?: number | string;
  price_per_share?: number | string;
  transaction_price?: number | string;
  date?: string;
  filing_date?: string;
  transaction_date?: string;
  transactionDate?: string;
  filingDate?: string;
  reported_date?: string;
  report_date?: string;
  reportDate?: string;
  reportedDate?: string;
  acquisition_date?: string;
  disposal_date?: string;
  reporting_date?: string;
};

/** API response shape: { insider_transactions: InsiderTx[] } */
export type InsidersApiResponse = { insider_transactions?: InsiderTx[]; insiderTransactions?: InsiderTx[] };

export interface InsidersTabProps {
  symbol: string;
  /** Raw API response { insider_transactions: [...] } */
  insiders: InsidersApiResponse | null;
  loading: boolean;
}

/** Normalize list from API: response.insider_transactions (snake_case) or insiderTransactions (camelCase). */
function getInsidersList(insiders: InsidersApiResponse | null): InsiderTx[] {
  if (insiders == null) return [];
  return insiders.insider_transactions ?? insiders.insiderTransactions ?? [];
}

function formatValue(value: number | string | undefined): string {
  if (value === undefined || value === null) return '—';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[$,]/g, '')) : Number(value);
  if (Number.isNaN(num) || num <= 0) return '—';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toLocaleString()}`;
}

function parseNum(x: number | string | undefined): number {
  if (x === undefined || x === null) return 0;
  const n = typeof x === 'number' ? x : parseFloat(String(x).replace(/[$,]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

/** Value = totalValue / value / total_value / transaction_value, or shares * price when available */
function getTransactionValue(tx: InsiderTx): number {
  const explicit =
    parseNum(tx.value) ||
    parseNum((tx as Record<string, unknown>).totalValue) ||
    parseNum((tx as Record<string, unknown>).total_value) ||
    parseNum((tx as Record<string, unknown>).transaction_value);
  if (explicit > 0) return explicit;
  const shares = parseNum(tx.shares);
  const price =
    parseNum(tx.price) ||
    parseNum((tx as Record<string, unknown>).price_per_share) ||
    parseNum((tx as Record<string, unknown>).transaction_price);
  if (shares > 0 && price > 0) return shares * price;
  return 0;
}

/** API sends transaction_type e.g. "Sale", "Buy", "Purchase", "P", "S". Prefer BUY when ambiguous (e.g. "A" = acquisition). */
function normalizeAction(transactionType: string | undefined, action?: string): 'BUY' | 'SELL' {
  const raw = (transactionType ?? action ?? '').trim();
  if (!raw) return 'SELL';
  const t = raw.toLowerCase();
  if (t === 'sale' || t === 'sell' || t === 's' || t === 'disposition' || t === 'disposal') return 'SELL';
  if (
    t === 'buy' || t === 'purchase' || t === 'p' || t === 'acquired' || t === 'acquisition' ||
    t === 'option exercise' || t === 'option_exercise' || t === 'exercise' || t === 'gift (receipt)' ||
    t === 'a' || t.startsWith('buy') || t.startsWith('purchase') || t.startsWith('acquire')
  ) return 'BUY';
  const u = raw.toUpperCase();
  if (u === 'P' || u === 'B' || u === 'A' || u.startsWith('P') || u.startsWith('B') || u.startsWith('A')) return 'BUY';
  if (u === 'S' || u === 'D' || u.startsWith('S') || u.startsWith('D')) return 'SELL';
  return 'SELL';
}

/** Date for display: prefer transaction_date / transactionDate (API), then filing_date, report_date, etc. */
function getDateStr(tx: InsiderTx): string | undefined {
  const t = tx as Record<string, unknown>;
  return (
    tx.transaction_date ??
    tx.transactionDate ??
    tx.filing_date ??
    tx.filingDate ??
    tx.report_date ??
    tx.reportDate ??
    tx.reported_date ??
    tx.reportedDate ??
    tx.date ??
    (t.acquisition_date as string) ??
    (t.disposal_date as string) ??
    (t.reporting_date as string)
  );
}

const MMM = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Format as MMM DD (e.g. "Feb 12") for table display */
function formatDateMMMDD(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return `${MMM[date.getMonth()]} ${date.getDate()}`;
}

function FaheemInsidersSummary({
  symbol,
  list,
  summary,
  loading,
}: {
  symbol: string;
  list: InsiderTx[];
  summary: string;
  loading: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.summaryBlock, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>Faheem&apos;s Summary</Text>
      {loading ? (
        <Text style={[styles.summaryText, { color: colors.text }]}>Analyzing recent transactions…</Text>
      ) : (
        <TypewriterText
          text={summary || 'No summary available.'}
          style={[styles.summaryText, { color: colors.text }]}
          haptics={false}
        />
      )}
    </View>
  );
}

function ActionPill({ action }: { action: 'BUY' | 'SELL' }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, action === 'BUY' ? { backgroundColor: colors.neonMintDim } : { backgroundColor: colors.negativeDim }]}>
      <Text style={[styles.pillText, action === 'BUY' ? styles.pillTextBuy : styles.pillTextSell]}>
        {action}
      </Text>
    </View>
  );
}

function TableHeader() {
  const { colors } = useTheme();
  return (
    <View style={[styles.tableHeader, { borderBottomColor: colors.separator, backgroundColor: colors.background }]}>
      <Text style={[styles.th, styles.thWho, { color: colors.textTertiary }]}>Who</Text>
      <Text style={[styles.th, styles.thDate, { color: colors.textTertiary }]}>Date</Text>
      <Text style={[styles.th, styles.thAction, { color: colors.textTertiary }]}>Action</Text>
      <Text style={[styles.th, styles.thValue, { color: colors.textTertiary }]}>Value</Text>
    </View>
  );
}

function formatShares(shares: number | string | undefined): string {
  if (shares === undefined || shares === null) return '—';
  const n = typeof shares === 'string' ? parseInt(shares, 10) : Number(shares);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString();
}

function TransactionRow({ item }: { item: InsiderTx }) {
  const { colors } = useTheme();
  const name = item.full_name ?? item.name ?? item.insiderName ?? item.insider_name ?? '—';
  const role = item.role ?? item.position ?? '—';
  const who = role ? `${name}, ${role}` : name;
  const action = normalizeAction(item.transaction_type, item.action);
  const value = getTransactionValue(item);
  const sharesStr = formatShares(item.shares);

  const valueStr = value > 0 ? formatValue(value) : '—';

  return (
    <View style={[styles.tableRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.td, styles.tdWho, { color: colors.text }]} numberOfLines={1}>{who}</Text>
      <Text style={[styles.td, styles.tdDate, { color: colors.textSecondary }]}>{formatDateMMMDD(getDateStr(item))}</Text>
      <View style={styles.tdAction}>
        <ActionPill action={action} />
      </View>
      <View style={styles.tdValueWrap}>
        <Text style={[styles.td, styles.tdValue, { color: colors.text }]}>{valueStr}</Text>
        {sharesStr !== '—' && <Text style={[styles.tdShares, { color: colors.textTertiary }]}>{sharesStr} sh</Text>}
      </View>
    </View>
  );
}

export function InsidersTab({ symbol, insiders, loading }: InsidersTabProps) {
  const { colors } = useTheme();
  const { expertiseLevel } = useExpertise();
  const list = getInsidersList(insiders);
  const [currentPage, setCurrentPage] = useState(0);
  const [faheemSummary, setFaheemSummary] = useState('');
  const [faheemLoading, setFaheemLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(list.length / ROWS_PER_PAGE));
  const pageIndex = Math.min(currentPage, totalPages - 1);
  const start = pageIndex * ROWS_PER_PAGE;
  const pageRows = list.slice(start, start + ROWS_PER_PAGE);

  useEffect(() => {
    let cancelled = false;
    if (pageRows.length === 0) {
      setFaheemSummary(list.length === 0 ? 'No insider transactions to analyze.' : 'No transactions on this page.');
      setFaheemLoading(false);
      return;
    }
    setFaheemLoading(true);
    getFaheemInsiders(symbol, pageRows, toFaheemMode(expertiseLevel))
      .then((res) => {
        if (!cancelled) {
          const parts = [
            res.sentiment && `Sentiment: ${res.sentiment}`,
            res.suspicious_activity && `Suspicious activity: ${res.suspicious_activity}`,
          ].filter(Boolean);
          setFaheemSummary(parts.join('\n\n') || '');
        }
      })
      .catch(() => {
        if (!cancelled) setFaheemSummary('Unable to load AI summary.');
      })
      .finally(() => {
        if (!cancelled) setFaheemLoading(false);
      });
    return () => { cancelled = true; };
  }, [symbol, expertiseLevel, pageIndex, list.length]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.electricBlue} />
        <Text style={[styles.sub, { color: colors.textSecondary }]}>Loading insiders…</Text>
      </View>
    );
  }

  if (list.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.empty, { color: colors.textSecondary }]}>No recent insider data for {symbol}.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    >
      <FaheemInsidersSummary symbol={symbol} list={pageRows} summary={faheemSummary} loading={faheemLoading} />
      <View style={[styles.table, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TableHeader />
        {pageRows.map((item, i) => (
          <TransactionRow key={`${item.full_name ?? item.name ?? item.insiderName ?? start + i}-${getDateStr(item) ?? i}`} item={item} />
        ))}
      </View>
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <TouchableOpacity
            style={[styles.pageBtn, { backgroundColor: colors.electricBlueDim, borderColor: colors.electricBlue }, pageIndex <= 0 && styles.pageBtnDisabled]}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCurrentPage((p) => Math.max(0, p - 1));
            }}
            disabled={pageIndex <= 0}
          >
            <Text style={[styles.pageBtnText, { color: colors.electricBlue }]}>Prev</Text>
          </TouchableOpacity>
          <Text style={[styles.pageIndicator, { color: colors.textTertiary }]}>
            Page {pageIndex + 1} of {totalPages}
          </Text>
          <TouchableOpacity
            style={[styles.pageBtn, { backgroundColor: colors.electricBlueDim, borderColor: colors.electricBlue }, pageIndex >= totalPages - 1 && styles.pageBtnDisabled]}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
            }}
            disabled={pageIndex >= totalPages - 1}
          >
            <Text style={[styles.pageBtnText, { color: colors.electricBlue }]}>Next</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  list: { padding: 16, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  sub: { color: COLORS.textSecondary, marginTop: 12, fontSize: 15 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', fontSize: 15 },

  summaryBlock: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.textTertiary,
    marginBottom: 6,
  },
  summaryText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
  },

  table: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.separator,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.separator,
    backgroundColor: COLORS.background,
  },
  th: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textTertiary,
  },
  thWho: { flex: 1.4, minWidth: 0 },
  thDate: { width: 56 },
  thAction: { width: 56 },
  thValue: { width: 64, textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  td: {
    fontSize: 13,
    color: COLORS.text,
  },
  tdWho: { flex: 1.4, minWidth: 0 },
  tdDate: { width: 56, color: COLORS.textSecondary },
  tdAction: { width: 56 },
  tdValueWrap: { width: 64, alignItems: 'flex-end' },
  tdValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    ...TYPO.tabular,
  },
  tdShares: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 2,
    ...TYPO.tabular,
  },

  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  pillBuy: { backgroundColor: COLORS.neonMintDim },
  pillSell: { backgroundColor: COLORS.negativeDim },
  pillText: { fontSize: 11, fontWeight: '700' },
  pillTextBuy: { color: COLORS.positive },
  pillTextSell: { color: COLORS.negative },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    paddingVertical: 12,
  },
  pageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.electricBlueDim,
    borderWidth: 1,
    borderColor: COLORS.electricBlue,
  },
  pageBtnDisabled: { opacity: 0.5 },
  pageBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.electricBlue },
  pageIndicator: { fontSize: 13, color: COLORS.textTertiary, ...TYPO.tabular },
});
