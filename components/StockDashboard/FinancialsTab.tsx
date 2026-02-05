/**
 * Financials Tab – Apple Design System.
 * Annual/Quarterly toggle + Fiscal Year selector. Nested data mapping (assets, liabilities, cash flow).
 * Ratios calculated from raw values. Faheem's Audit, accordion sections, sparklines.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TYPO } from '../../constants/theme';
import { useStockDetail } from '../../contexts/StockDetailContext';
import { useExpertise } from '../../contexts/ExpertiseContext';
import { getFaheemFinancials, toFaheemMode } from '../../src/services/aiService';

type CardItem = { title?: { en?: string }; value?: string | number };

/** Deep nested paths: balance_sheet row has assets.total_assets, liabilities.total_liabilities, etc. */
type BalanceRow = {
  assets?: { total_assets?: number; current_assets?: { total_current_assets?: number } };
  liabilities?: { total_liabilities?: number; current_liabilities?: { total_current_liabilities?: number } };
  shareholders_equity?: { total_shareholders_equity?: number };
  total_assets?: number;
  total_liabilities?: number;
  equity?: number;
  debt?: number;
  [k: string]: unknown;
};

type IncomeRow = {
  sales?: number;
  revenue?: number;
  gross_profit?: number;
  operating_income?: number;
  net_income?: number;
  eps?: number;
  [k: string]: unknown;
};

type CashRow = {
  operating_activities?: { operating_cash_flow?: number };
  investing_activities?: { cash_flow?: number };
  financing_activities?: { cash_flow?: number };
  free_cash_flow?: number;
  operating_cash_flow?: number;
  investing_cash_flow?: number;
  financing_cash_flow?: number;
  [k: string]: unknown;
};

/** Get value at path like 'assets.total_assets' or 'liabilities.current_liabilities.total_current_liabilities'. */
function getNested(obj: unknown, path: string): number | undefined {
  if (obj == null || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const p of parts) {
    current = current != null && typeof current === 'object' && p in current
      ? (current as Record<string, unknown>)[p]
      : undefined;
  }
  const n = Number(current);
  return Number.isFinite(n) ? n : undefined;
}

/** First non-undefined number from paths. */
function firstNum(obj: unknown, ...paths: string[]): number | undefined {
  for (const path of paths) {
    const v = path.includes('.') ? getNested(obj, path) : (obj as Record<string, unknown>)?.[path] as number | undefined;
    if (v != null && Number.isFinite(v)) return v;
  }
  return undefined;
}

/** Format number for display (B/M/T or plain). */
function formatLargeNumber(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n <= -1e9) return `-${(Math.abs(n) / 1e9).toFixed(2)}B`;
  if (n <= -1e6) return `-${(Math.abs(n) / 1e6).toFixed(2)}M`;
  return n.toLocaleString();
}

// ——— Ratio calculations (from raw values) ———
function grossMarginPct(sales: number | undefined, grossProfit: number | undefined): string {
  if (sales == null || grossProfit == null || sales === 0) return '—';
  return `${((grossProfit / sales) * 100).toFixed(2)}%`;
}
function operatingMarginPct(sales: number | undefined, operatingIncome: number | undefined): string {
  if (sales == null || operatingIncome == null || sales === 0) return '—';
  return `${((operatingIncome / sales) * 100).toFixed(2)}%`;
}
function netMarginPct(sales: number | undefined, netIncome: number | undefined): string {
  if (sales == null || netIncome == null || sales === 0) return '—';
  return `${((netIncome / sales) * 100).toFixed(2)}%`;
}
function roePct(netIncome: number | undefined, equity: number | undefined): string {
  if (equity == null || netIncome == null || equity === 0) return '—';
  return `${((netIncome / equity) * 100).toFixed(2)}%`;
}
function debtToEquityRatio(totalLiab: number | undefined, equity: number | undefined): string {
  if (equity == null || totalLiab == null || equity === 0) return '—';
  return (totalLiab / equity).toFixed(2);
}
function currentRatio(currentAssets: number | undefined, currentLiab: number | undefined): string {
  if (currentLiab == null || currentAssets == null || currentLiab === 0) return '—';
  return (currentAssets / currentLiab).toFixed(2);
}

/** EBITDA margin if we have ebitda and sales; otherwise — */
function ebitdaMarginPct(sales: number | undefined, ebitda: number | undefined): string {
  if (sales == null || ebitda == null || sales === 0) return '—';
  return `${((ebitda / sales) * 100).toFixed(2)}%`;
}
function roaPct(netIncome: number | undefined, totalAssets: number | undefined): string {
  if (totalAssets == null || netIncome == null || totalAssets === 0) return '—';
  return `${((netIncome / totalAssets) * 100).toFixed(2)}%`;
}
function quickRatio(currentAssets: number | undefined, inventory: number | undefined, currentLiab: number | undefined): string {
  if (currentLiab == null || currentLiab === 0) return '—';
  const quick = (currentAssets ?? 0) - (inventory ?? 0);
  return (quick / currentLiab).toFixed(2);
}

export type FinancialsData = {
  incomeStatement?: { cards?: CardItem[]; data?: IncomeRow[] };
  balanceSheet?: { cards?: CardItem[]; data?: BalanceRow[] };
  cashFlow?: { cards?: CardItem[]; data?: BalanceRow[] };
};

/** API may return { income_statement: { income_statement: [] }, balance_sheet: { balance_sheet: [] }, cash_flow: { cash_flow: [] } } */
export type FinancialsApiResponse = {
  income_statement?: { income_statement?: IncomeRow[] };
  balance_sheet?: { balance_sheet?: BalanceRow[] };
  cash_flow?: { cash_flow?: CashRow[] };
};

export interface FinancialsTabProps {
  symbol: string;
  financials: (FinancialsData & { data?: FinancialsData }) | FinancialsApiResponse | null;
  loading: boolean;
}

const SPARKLINE_W = 64;
const SPARKLINE_H = 28;

function SegmentedControl({
  selected,
  onSelect,
}: {
  selected: 'annual' | 'quarterly';
  onSelect: (v: 'annual' | 'quarterly') => void;
}) {
  const onPress = (v: 'annual' | 'quarterly') => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(v);
  };
  return (
    <View style={styles.segmentedWrap}>
      <TouchableOpacity
        style={[styles.segmentedBtn, selected === 'annual' && styles.segmentedBtnActive]}
        onPress={() => onPress('annual')}
        activeOpacity={0.8}
      >
        <Text style={[styles.segmentedLabel, selected === 'annual' && styles.segmentedLabelActive]}>Annual</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.segmentedBtn, selected === 'quarterly' && styles.segmentedBtnActive]}
        onPress={() => onPress('quarterly')}
        activeOpacity={0.8}
      >
        <Text style={[styles.segmentedLabel, selected === 'quarterly' && styles.segmentedLabelActive]}>Quarterly</Text>
      </TouchableOpacity>
    </View>
  );
}

function YearSelector({
  periods,
  selectedIndex,
  onSelect,
  isQuarterly,
}: {
  periods: { label: string; index: number }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  isQuarterly: boolean;
}) {
  if (periods.length === 0) return null;
  return (
    <View style={styles.yearSelectorWrap}>
      <Text style={styles.yearSelectorTitle}>{isQuarterly ? 'Fiscal Quarter' : 'Fiscal Year'}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearScroll}>
        {periods.map(({ label, index }) => {
          const selected = selectedIndex === index;
          return (
            <TouchableOpacity
              key={index}
              style={[styles.yearPill, selected && styles.yearPillActive]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(index);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.yearPillLabel, selected && styles.yearPillLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function getPeriodLabel(row: IncomeRow | BalanceRow | CashRow, isQuarterly: boolean): string {
  const r = row as Record<string, unknown>;
  const date = r.fiscal_date ?? r.period ?? r.fiscal_year ?? r.date;
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m] = date.split('-');
      return isQuarterly ? `Q${Math.ceil(Number(m) / 3)} ${y}` : `FY ${y}`;
    }
    return String(date);
  }
  if (typeof date === 'number') return isQuarterly ? `Q${date}` : `FY ${date}`;
  return '';
}

/** Parse row date to timestamp for sorting (newest first). */
function getRowSortKey(row: IncomeRow | BalanceRow | CashRow): number {
  const r = row as Record<string, unknown>;
  const date = r.fiscal_date ?? r.period ?? r.fiscal_year ?? r.date;
  if (typeof date === 'string') {
    const t = new Date(date).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof date === 'number') return date;
  return 0;
}

function sortByDateDesc<T extends IncomeRow | BalanceRow | CashRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => getRowSortKey(b) - getRowSortKey(a));
}

const MAX_QUARTERS = 8;

function SparklineBar({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(...values.map(Math.abs), 1);
  const w = SPARKLINE_W / values.length;
  return (
    <Svg width={SPARKLINE_W} height={SPARKLINE_H} style={styles.sparklineSvg}>
      {values.map((v, i) => {
        const h = Math.max(2, (Math.abs(v) / max) * (SPARKLINE_H - 4));
        const y = v >= 0 ? SPARKLINE_H - 2 - h : SPARKLINE_H - 2;
        return (
          <Rect
            key={i}
            x={i * w + 1}
            y={y}
            width={Math.max(w - 1, 2)}
            height={h}
            fill={v >= 0 ? COLORS.positive : COLORS.negative}
            rx={1}
          />
        );
      })}
    </Svg>
  );
}

function AccordionSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const onPress = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOpen((o) => !o);
  };
  return (
    <View style={styles.accordionBlock}>
      <TouchableOpacity style={styles.accordionHeader} onPress={onPress} activeOpacity={0.8}>
        <Text style={styles.accordionTitle}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textTertiary} />
      </TouchableOpacity>
      {open ? <View style={styles.accordionBody}>{children}</View> : null}
    </View>
  );
}

function RowWithSparkline({
  label,
  value,
  trendValues,
  first,
  valueColor,
}: {
  label: string;
  value: string | number;
  trendValues?: number[];
  first?: boolean;
  valueColor?: 'green' | 'red' | null;
}) {
  const valueStyle = valueColor === 'green' ? styles.dataRowValuePositive : valueColor === 'red' ? styles.dataRowValueNegative : undefined;
  return (
    <View style={[styles.dataRow, !first && styles.dataRowBorder]}>
      <View style={styles.dataRowLeft}>
        <Text style={styles.dataRowLabel}>{label}</Text>
        {trendValues && trendValues.length > 0 && <SparklineBar values={trendValues} />}
      </View>
      <Text style={[styles.dataRowValue, TYPO.tabular, valueStyle]}>{value}</Text>
    </View>
  );
}

function DataRow({ label, value, first, valueColor }: { label: string; value: string | number; first?: boolean; valueColor?: 'green' | 'red' | null }) {
  const valueStyle = valueColor === 'green' ? styles.dataRowValuePositive : valueColor === 'red' ? styles.dataRowValueNegative : undefined;
  return (
    <View style={[styles.dataRow, !first && styles.dataRowBorder]}>
      <Text style={styles.dataRowLabel}>{label}</Text>
      <Text style={[styles.dataRowValue, TYPO.tabular, valueStyle]}>{value}</Text>
    </View>
  );
}

function isApiShape(raw: unknown): raw is FinancialsApiResponse {
  const r = raw as FinancialsApiResponse;
  return r != null && typeof r === 'object' && ('income_statement' in r || 'balance_sheet' in r || 'cash_flow' in r);
}

export function FinancialsTab({ symbol, financials, loading }: FinancialsTabProps) {
  const { loadFinancials } = useStockDetail();
  const { expertiseLevel } = useExpertise();
  const [period, setPeriod] = useState<'annual' | 'quarterly'>('annual');
  const [selectedYearIndex, setSelectedYearIndex] = useState(0);
  const [faheemAudit, setFaheemAudit] = useState<string>('');
  const [faheemLoading, setFaheemLoading] = useState(false);

  useEffect(() => {
    loadFinancials(period);
    setSelectedYearIndex(0);
  }, [period, symbol, loadFinancials]);

  // Faheem audit: must run unconditionally (Rules of Hooks). Parse and fetch inside effect.
  useEffect(() => {
    let cancelled = false;
    const raw = financials && typeof financials === 'object' && 'data' in financials
      ? (financials as { data?: unknown }).data
      : financials;
    if (!raw || typeof raw !== 'object' || !symbol) {
      setFaheemAudit('');
      return;
    }
    let incArray: IncomeRow[] = [];
    let balArray: BalanceRow[] = [];
    let cashArray: CashRow[] = [];
    if (isApiShape(raw)) {
      incArray = sortByDateDesc((raw.income_statement?.income_statement ?? []).filter(Boolean) as IncomeRow[]);
      balArray = sortByDateDesc((raw.balance_sheet?.balance_sheet ?? []).filter(Boolean) as BalanceRow[]);
      cashArray = sortByDateDesc((raw.cash_flow?.cash_flow ?? []).filter(Boolean) as CashRow[]);
    } else {
      const leg = raw as FinancialsData;
      incArray = sortByDateDesc((leg.incomeStatement?.data ?? []).filter(Boolean) as IncomeRow[]);
      balArray = sortByDateDesc((leg.balanceSheet?.data ?? []).filter(Boolean) as BalanceRow[]);
      cashArray = sortByDateDesc((leg.cashFlow?.data ?? []).filter(Boolean) as CashRow[]);
    }
    const isQ = period === 'quarterly';
    if (isQ) {
      incArray = incArray.slice(0, MAX_QUARTERS);
      balArray = balArray.slice(0, MAX_QUARTERS);
      cashArray = cashArray.slice(0, MAX_QUARTERS);
    }
    const maxIndex = Math.max(0, incArray.length - 1, balArray.length - 1, cashArray.length - 1);
    const idx = Math.min(Math.max(0, selectedYearIndex), maxIndex);
    const incRow = incArray[idx] ?? {};
    const balRow = balArray[idx] ?? {};
    const cashRow = cashArray[idx] ?? {};
    const visibleData = { income: incRow, balance: balRow, cash: cashRow };
    setFaheemLoading(true);
    getFaheemFinancials(symbol, visibleData, toFaheemMode(expertiseLevel))
      .then((res) => {
        if (!cancelled) setFaheemAudit(res.rationale ?? '');
      })
      .catch(() => {
        if (!cancelled) setFaheemAudit('Key ratios and liquidity look stable. No major red flags from this snapshot.');
      })
      .finally(() => {
        if (!cancelled) setFaheemLoading(false);
      });
    return () => { cancelled = true; };
  }, [symbol, period, selectedYearIndex, expertiseLevel, financials]);

  const raw = financials && typeof financials === 'object' && 'data' in financials
    ? (financials as { data?: unknown }).data
    : financials;

  if (loading && !financials) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.electricBlue} />
        <Text style={styles.sub}>Loading financials…</Text>
      </View>
    );
  }

  if (!raw || typeof raw !== 'object') {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>No financial data for {symbol}.</Text>
      </View>
    );
  }

  let incArray: IncomeRow[] = [];
  let balArray: BalanceRow[] = [];
  let cashArray: CashRow[] = [];

  if (isApiShape(raw)) {
    incArray = sortByDateDesc((raw.income_statement?.income_statement ?? []).filter(Boolean) as IncomeRow[]);
    balArray = sortByDateDesc((raw.balance_sheet?.balance_sheet ?? []).filter(Boolean) as BalanceRow[]);
    cashArray = sortByDateDesc((raw.cash_flow?.cash_flow ?? []).filter(Boolean) as CashRow[]);
  } else {
    const leg = raw as FinancialsData;
    incArray = sortByDateDesc((leg.incomeStatement?.data ?? []).filter(Boolean) as IncomeRow[]);
    balArray = sortByDateDesc((leg.balanceSheet?.data ?? []).filter(Boolean) as BalanceRow[]);
    cashArray = sortByDateDesc((leg.cashFlow?.data ?? []).filter(Boolean) as CashRow[]);
  }

  const isQuarterly = period === 'quarterly';
  if (isQuarterly) {
    incArray = incArray.slice(0, MAX_QUARTERS);
    balArray = balArray.slice(0, MAX_QUARTERS);
    cashArray = cashArray.slice(0, MAX_QUARTERS);
  }

  const periodLabels = incArray.map((row, i) => ({
    label: getPeriodLabel(row, isQuarterly) || (isQuarterly ? `Q${i + 1}` : `FY ${i + 1}`),
    index: i,
  }));
  const maxIndex = Math.max(0, incArray.length - 1, balArray.length - 1, cashArray.length - 1);
  const idx = Math.min(Math.max(0, selectedYearIndex), maxIndex);

  const incRow = incArray[idx] ?? {};
  const balRow = balArray[idx] ?? {};
  const cashRow = cashArray[idx] ?? {};

  // ——— Nested extraction (per your paths) ———
  const sales = firstNum(incRow, 'sales', 'revenue', 'revenue');
  const grossProfit = firstNum(incRow, 'gross_profit', 'gross profit');
  const operatingIncome = firstNum(incRow, 'operating_income', 'operating income');
  const netIncome = firstNum(incRow, 'net_income', 'net income');
  const eps = firstNum(incRow, 'eps');
  const ebitda = firstNum(incRow, 'ebitda');

  const totalAssets = firstNum(balRow, 'assets.total_assets', 'total_assets', 'total assets') ?? getNested(balRow, 'assets.total_assets');
  const currentAssets = firstNum(balRow, 'assets.current_assets.total_current_assets', 'current_assets') ?? getNested(balRow, 'assets.current_assets.total_current_assets');
  const totalLiab = firstNum(balRow, 'liabilities.total_liabilities', 'total_liabilities', 'total liabilities') ?? getNested(balRow, 'liabilities.total_liabilities');
  const currentLiab = firstNum(balRow, 'liabilities.current_liabilities.total_current_liabilities', 'current_liabilities') ?? getNested(balRow, 'liabilities.current_liabilities.total_current_liabilities');
  const equity = firstNum(balRow, 'shareholders_equity.total_shareholders_equity', 'equity', 'total_shareholders_equity') ?? getNested(balRow, 'shareholders_equity.total_shareholders_equity');
  const debt = firstNum(balRow, 'debt', 'total_debt', 'long_term_debt');

  const operatingCf = firstNum(cashRow, 'operating_activities.operating_cash_flow', 'operating_cash_flow', 'operating cash flow') ?? getNested(cashRow, 'operating_activities.operating_cash_flow');
  const investingCf = firstNum(cashRow, 'investing_activities.cash_flow', 'investing_cash_flow', 'investing activities') ?? getNested((cashRow as Record<string, unknown>).investing_activities as object, 'cash_flow');
  const financingCf = firstNum(cashRow, 'financing_activities.cash_flow', 'financing_cash_flow', 'financing activities') ?? getNested((cashRow as Record<string, unknown>).financing_activities as object, 'cash_flow');
  const fcf = firstNum(cashRow, 'free_cash_flow', 'fcf');

  // ——— Calculated ratios ———
  const grossMargin = grossMarginPct(sales, grossProfit);
  const operatingMargin = operatingMarginPct(sales, operatingIncome);
  const netMargin = netMarginPct(sales, netIncome);
  const ebitdaMargin = ebitdaMarginPct(sales, ebitda);
  const roe = roePct(netIncome, equity);
  const roa = roaPct(netIncome, totalAssets);
  const debtToEquity = debtToEquityRatio(totalLiab, equity);
  const currentRat = currentRatio(currentAssets, currentLiab);
  const inventory = firstNum(balRow, 'inventory', 'assets.current_assets.inventory') ?? getNested(balRow, 'assets.current_assets.inventory');
  const quickRat = quickRatio(currentAssets, inventory, currentLiab);

  const revenueTrend = incArray.map((r) => firstNum(r, 'revenue', 'sales') ?? 0);
  const netProfitTrend = incArray.map((r) => firstNum(r, 'net_income', 'net income') ?? 0);

  const prevIncRow = incArray[idx + 1] ?? {};
  const prevSales = firstNum(prevIncRow, 'sales', 'revenue');
  const prevGrossProfit = firstNum(prevIncRow, 'gross_profit', 'gross profit');
  const prevNetIncome = firstNum(prevIncRow, 'net_income', 'net income');
  const revenueGrowth = sales != null && prevSales != null && prevSales !== 0 ? (sales - prevSales) / prevSales : null;
  const grossProfitGrowth = grossProfit != null && prevGrossProfit != null && prevGrossProfit !== 0 ? (grossProfit - prevGrossProfit) / prevGrossProfit : null;
  const netIncomeGrowth = netIncome != null && prevNetIncome != null && prevNetIncome !== 0 ? (netIncome - prevNetIncome) / prevNetIncome : null;
  const revenueColor: 'green' | 'red' | null = revenueGrowth != null ? (revenueGrowth >= 0 ? 'green' : 'red') : null;
  const grossProfitColor: 'green' | 'red' | null = grossProfitGrowth != null ? (grossProfitGrowth >= 0 ? 'green' : 'red') : null;
  const netIncomeColor: 'green' | 'red' | null = netIncomeGrowth != null ? (netIncomeGrowth >= 0 ? 'green' : 'red') : null;

  const hasData = sales != null || grossProfit != null || netIncome != null || totalAssets != null || totalLiab != null || equity != null || operatingCf != null;
  if (!hasData && incArray.length === 0 && balArray.length === 0 && cashArray.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>No financial data for {symbol}.</Text>
      </View>
    );
  }

  const formatVal = (n: number | undefined) => (n != null && Number.isFinite(n) ? formatLargeNumber(n) : '—');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <SegmentedControl selected={period} onSelect={setPeriod} />
      <YearSelector
        periods={periodLabels}
        selectedIndex={selectedYearIndex}
        onSelect={setSelectedYearIndex}
        isQuarterly={isQuarterly}
      />
      <View style={styles.faheemCard}>
        <Text style={styles.faheemLabel}>Faheem&apos;s Audit</Text>
        {faheemLoading ? (
          <Text style={styles.faheemText}>Faheem is reviewing the visible data…</Text>
        ) : (
          <Text style={styles.faheemText}>{faheemAudit || 'No audit available for this period.'}</Text>
        )}
      </View>

      <AccordionSection title="Income Statement" defaultOpen>
        <View style={styles.table}>
          <RowWithSparkline first label="Revenue" value={formatVal(sales)} trendValues={revenueTrend.length > 0 ? revenueTrend : undefined} valueColor={revenueColor} />
          <DataRow label="Gross Profit" value={formatVal(grossProfit)} valueColor={grossProfitColor} />
          <RowWithSparkline label="Net Profit" value={formatVal(netIncome)} trendValues={netProfitTrend.length > 0 ? netProfitTrend : undefined} valueColor={netIncomeColor} />
          <DataRow label="EPS" value={eps != null ? String(eps) : '—'} />
        </View>
      </AccordionSection>

      <AccordionSection title="Income Ratios">
        <View style={styles.table}>
          <DataRow first label="Gross Margin" value={grossMargin} />
          <DataRow label="Operating Margin" value={operatingMargin} />
          <DataRow label="Net Margin" value={netMargin} />
          <DataRow label="EBITDA Margin" value={ebitdaMargin} />
          <DataRow label="ROE" value={roe} />
          <DataRow label="ROA" value={roa} />
        </View>
      </AccordionSection>

      <AccordionSection title="Balance Sheet">
        <View style={styles.table}>
          <DataRow first label="Total Assets" value={formatVal(totalAssets)} />
          <DataRow label="Liabilities" value={formatVal(totalLiab)} />
          <DataRow label="Equity" value={formatVal(equity)} />
          <DataRow label="Debt" value={formatVal(debt)} />
        </View>
      </AccordionSection>

      <AccordionSection title="Balance Sheet Ratios">
        <View style={styles.table}>
          <DataRow first label="Current Ratio" value={currentRat} />
          <DataRow label="Quick Ratio" value={quickRat} />
          <DataRow label="Debt-to-Equity" value={debtToEquity} />
        </View>
      </AccordionSection>

      <AccordionSection title="Cash Flow">
        <View style={styles.table}>
          <DataRow first label="Operating" value={formatVal(operatingCf)} />
          <DataRow label="Investing" value={formatVal(investingCf)} />
          <DataRow label="Financing" value={formatVal(financingCf)} />
          <DataRow label="Free Cash Flow (FCF)" value={formatVal(fcf)} />
        </View>
      </AccordionSection>

      <AccordionSection title="Cash Flow Ratios">
        <View style={styles.table}>
          <DataRow first label="FCF / Interest Coverage" value={fcf != null && fcf !== 0 ? formatVal(fcf) : '—'} />
        </View>
      </AccordionSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  sub: { color: COLORS.textSecondary, marginTop: 12 },
  empty: { color: COLORS.textSecondary, textAlign: 'center' },
  segmentedWrap: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.separator,
  },
  segmentedBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segmentedBtnActive: { backgroundColor: COLORS.electricBlueDim },
  segmentedLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  segmentedLabelActive: { color: COLORS.electricBlue },
  yearSelectorWrap: { marginBottom: 12 },
  yearSelectorTitle: { fontSize: 13, color: COLORS.textTertiary, marginBottom: 8 },
  yearScroll: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  yearPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.separator,
  },
  yearPillActive: { backgroundColor: COLORS.electricBlueDim, borderColor: COLORS.electricBlue },
  yearPillLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  yearPillLabelActive: { color: COLORS.electricBlue },
  faheemCard: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.electricBlue,
  },
  faheemLabel: { fontSize: 12, fontWeight: '600', color: COLORS.electricBlue, marginBottom: 4 },
  faheemText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
  accordionBlock: { marginBottom: 8 },
  accordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.separator,
  },
  accordionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  accordionBody: { paddingTop: 4, paddingBottom: 12 },
  table: { backgroundColor: COLORS.card, borderRadius: 10, marginLeft: 4, marginRight: 4, borderWidth: 1, borderColor: COLORS.separator },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  dataRowBorder: { borderTopWidth: 1, borderTopColor: COLORS.separator },
  dataRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dataRowLabel: { fontSize: 14, color: COLORS.text, flex: 1 },
  dataRowValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  dataRowValuePositive: { color: COLORS.positive },
  dataRowValueNegative: { color: COLORS.negative },
  sparklineSvg: { marginLeft: 4 },
});
