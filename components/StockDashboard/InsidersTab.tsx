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
import { useExpertise } from '../../contexts/ExpertiseContext';
import { getFaheemInsiders, toFaheemMode } from '../../src/services/aiService';

const ROWS_PER_PAGE = 5;
const LATEST_TRANSACTIONS_FOR_AI = 20;

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
  price?: number | string;
  date?: string;
  filing_date?: string;
  transaction_date?: string;
  reported_date?: string;
  report_date?: string;
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
  if (Number.isNaN(num)) return '—';
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toLocaleString()}`;
}

/** Value = shares * price when available; else use value field */
function getTransactionValue(tx: InsiderTx): number {
  const explicit = typeof tx.value === 'number' ? tx.value : parseFloat(String(tx.value || '0').replace(/[$,]/g, ''));
  if (!Number.isNaN(explicit) && explicit > 0) return explicit;
  const shares = Number(tx.shares) || 0;
  const price = typeof tx.price === 'number' ? tx.price : parseFloat(String(tx.price || '0').replace(/[$,]/g, ''));
  if (shares > 0 && !Number.isNaN(price) && price > 0) return shares * price;
  return 0;
}

/** API sends transaction_type e.g. "Sale", "Buy", "Purchase", "P", "S". */
function normalizeAction(transactionType: string | undefined, action?: string): 'BUY' | 'SELL' {
  const raw = (transactionType || action || '').trim();
  const t = raw.toLowerCase();
  if (t === 'sale' || t === 'sell' || t === 's') return 'SELL';
  if (t === 'buy' || t === 'purchase' || t === 'p' || t === 'acquired' || t === 'option exercise') return 'BUY';
  const u = raw.toUpperCase();
  if (u === 'P' || u === 'B' || u.startsWith('P') || u.startsWith('B')) return 'BUY';
  if (u === 'S' || u.startsWith('S')) return 'SELL';
  return 'SELL';
}

function getDateStr(tx: InsiderTx): string | undefined {
  return tx.transaction_date ?? tx.report_date ?? tx.reported_date ?? tx.filing_date ?? tx.date;
}

/** Format as YYYY-MM-DD for table display */
function formatDateYYYYMMDD(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
  return (
    <View style={styles.summaryBlock}>
      <Text style={styles.summaryLabel}>Faheem&apos;s Summary</Text>
      {loading ? (
        <Text style={styles.summaryText}>Analyzing recent transactions…</Text>
      ) : (
        <Text style={styles.summaryText}>{summary || 'No summary available.'}</Text>
      )}
    </View>
  );
}

function ActionPill({ action }: { action: 'BUY' | 'SELL' }) {
  return (
    <View style={[styles.pill, action === 'BUY' ? styles.pillBuy : styles.pillSell]}>
      <Text style={[styles.pillText, action === 'BUY' ? styles.pillTextBuy : styles.pillTextSell]}>
        {action}
      </Text>
    </View>
  );
}

function TableHeader() {
  return (
    <View style={styles.tableHeader}>
      <Text style={[styles.th, styles.thWho]}>Who</Text>
      <Text style={[styles.th, styles.thDate]}>Date</Text>
      <Text style={[styles.th, styles.thAction]}>Action</Text>
      <Text style={[styles.th, styles.thValue]}>Value</Text>
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
  const name = item.full_name ?? item.name ?? item.insiderName ?? item.insider_name ?? '—';
  const role = item.role ?? item.position ?? '—';
  const who = role ? `${name}, ${role}` : name;
  const action = normalizeAction(item.transaction_type, item.action);
  const value = getTransactionValue(item);
  const sharesStr = formatShares(item.shares);

  return (
    <View style={styles.tableRow}>
      <Text style={[styles.td, styles.tdWho]} numberOfLines={1}>{who}</Text>
      <Text style={[styles.td, styles.tdDate]}>{formatDateYYYYMMDD(getDateStr(item))}</Text>
      <View style={styles.tdAction}>
        <ActionPill action={action} />
      </View>
      <View style={styles.tdValueWrap}>
        <Text style={[styles.td, styles.tdValue]}>{formatValue(value)}</Text>
        {sharesStr !== '—' && <Text style={styles.tdShares}>{sharesStr} sh</Text>}
      </View>
    </View>
  );
}

export function InsidersTab({ symbol, insiders, loading }: InsidersTabProps) {
  const { expertiseLevel } = useExpertise();
  const list = getInsidersList(insiders);
  const [currentPage, setCurrentPage] = useState(0);
  const [faheemSummary, setFaheemSummary] = useState('');
  const [faheemLoading, setFaheemLoading] = useState(false);

  const latestForAi = useMemo(() => {
    const withDate = list
      .map((tx) => ({ tx, ts: getDateStr(tx) ? new Date(getDateStr(tx)!).getTime() : 0 }))
      .filter(({ ts }) => !Number.isNaN(ts));
    withDate.sort((a, b) => b.ts - a.ts);
    return withDate.slice(0, LATEST_TRANSACTIONS_FOR_AI).map(({ tx }) => tx);
  }, [list]);

  useEffect(() => {
    let cancelled = false;
    if (latestForAi.length === 0) {
      setFaheemSummary('No recent insider transactions to analyze.');
      setFaheemLoading(false);
      return;
    }
    setFaheemLoading(true);
    getFaheemInsiders(symbol, latestForAi, toFaheemMode(expertiseLevel))
      .then((res) => {
        if (!cancelled) setFaheemSummary(res.summary ?? res.rationale ?? '');
      })
      .catch(() => {
        if (!cancelled) setFaheemSummary('Unable to load AI summary.');
      })
      .finally(() => {
        if (!cancelled) setFaheemLoading(false);
      });
    return () => { cancelled = true; };
  }, [symbol, expertiseLevel, list.length]);

  const totalPages = Math.max(1, Math.ceil(list.length / ROWS_PER_PAGE));
  const page = Math.min(currentPage, totalPages - 1);
  const start = page * ROWS_PER_PAGE;
  const pageRows = list.slice(start, start + ROWS_PER_PAGE);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.electricBlue} />
        <Text style={styles.sub}>Loading insiders…</Text>
      </View>
    );
  }

  if (list.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>No recent insider data for {symbol}.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    >
      <FaheemInsidersSummary symbol={symbol} list={latestForAi} summary={faheemSummary} loading={faheemLoading} />
      <View style={styles.table}>
        <TableHeader />
        {pageRows.map((item, i) => (
          <TransactionRow key={`${item.full_name ?? item.name ?? item.insiderName ?? start + i}-${getDateStr(item) ?? i}`} item={item} />
        ))}
      </View>
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <TouchableOpacity
            style={[styles.pageBtn, page <= 0 && styles.pageBtnDisabled]}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCurrentPage((p) => Math.max(0, p - 1));
            }}
            disabled={page <= 0}
          >
            <Text style={styles.pageBtnText}>Prev</Text>
          </TouchableOpacity>
          <Text style={styles.pageIndicator}>
            Page {page + 1} of {totalPages}
          </Text>
          <TouchableOpacity
            style={[styles.pageBtn, page >= totalPages - 1 && styles.pageBtnDisabled]}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
            }}
            disabled={page >= totalPages - 1}
          >
            <Text style={styles.pageBtnText}>Next</Text>
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  pillSell: { backgroundColor: 'rgba(255, 59, 48, 0.2)' },
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
