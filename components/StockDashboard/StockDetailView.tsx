import React, { useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { COLORS, TYPO } from '../../constants/theme';
import { StockDetailProvider, useStockDetail } from '../../contexts/StockDetailContext';
import { useExpertise } from '../../contexts/ExpertiseContext';
import { toFaheemMode } from '../../src/services/aiService';
import { OverviewTab } from './OverviewTab';
import type { OverviewTabProps } from './OverviewTab';
import { NewsTab } from './NewsTab';
import { FinancialsTab } from './FinancialsTab';
import type { FinancialsTabProps } from './FinancialsTab';
import { TechnicalsTab } from './TechnicalsTab';
import { ForecastAITab } from './ForecastAITab';
import { InsidersTab } from './InsidersTab';
import { CommunityTab } from './CommunityTab';
import { TradeButton } from '../TradeButton';

const Tab = createMaterialTopTabNavigator();

function PriceHeader() {
  const { detail, loadingDetail, symbol } = useStockDetail();
  const stats = detail?.statistics;
  const price = stats?.currentPrice ?? 0;
  const change = stats?.percent_change ?? 0;
  const isPositive = change >= 0;
  const profile = detail?.profile as { name?: string | { en?: string }; sector?: string | { en?: string }; description?: string | { en?: string } } | undefined;
  const nameStr = typeof profile?.name === 'string' ? profile.name : profile?.name?.en;
  const sectorStr = typeof profile?.sector === 'string' ? profile.sector : profile?.sector?.en;

  const changeStr = price ? `${isPositive ? '+' : ''}${change?.toFixed(2) ?? '0'}%` : '—';
  return (
    <View style={styles.header}>
      <Text style={styles.largeTitle}>{nameStr || symbol}</Text>
      {(nameStr && sectorStr) && (
        <Text style={styles.subtitle} numberOfLines={1}>{sectorStr}</Text>
      )}
      <View style={styles.priceRow}>
        {loadingDetail ? (
          <Text style={styles.price}>—</Text>
        ) : (
          <>
            <Text style={styles.price} numberOfLines={1}>
              {price ? price.toFixed(2) : '—'}
            </Text>
            <View style={[styles.pill, isPositive ? styles.pillGreen : styles.pillRed]}>
              <Text style={[styles.pillText, isPositive ? styles.positive : styles.negative]}>
                {changeStr}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function OverviewScreen() {
  const { expertiseLevel } = useExpertise();
  const { symbol, detail, historical, loadingDetail } = useStockDetail();
  const mode = toFaheemMode(expertiseLevel);
  return (
    <OverviewTab
      symbol={symbol}
      detail={detail as OverviewTabProps['detail']}
      historical={historical as OverviewTabProps['historical']}
      loading={loadingDetail}
      faheemMode={mode}
    />
  );
}

function NewsScreen() {
  const { symbol, news, loadingNews, loadNews } = useStockDetail();
  useEffect(() => { loadNews(); }, [loadNews]);
  return <NewsTab symbol={symbol} news={news} loading={loadingNews} />;
}

function FinancialsScreen() {
  const { symbol, financials, loadingFinancials, loadFinancials } = useStockDetail();
  useEffect(() => { loadFinancials(); }, [loadFinancials]);
  return <FinancialsTab symbol={symbol} financials={financials as FinancialsTabProps['financials']} loading={loadingFinancials} />;
}

function TechnicalsScreen() {
  const { symbol, technicals, loadingTechnicals, loadTechnicals, historical } = useStockDetail();
  useEffect(() => { loadTechnicals(); }, [loadTechnicals]);
  return <TechnicalsTab symbol={symbol} technicals={technicals} loading={loadingTechnicals} historical={historical} />;
}

function ForecastAIScreen() {
  const { symbol, historical, detail } = useStockDetail();
  const currentPrice = (detail?.statistics as { currentPrice?: number | null } | undefined)?.currentPrice ?? null;
  return (
    <ForecastAITab
      symbol={symbol}
      historical={historical}
      currentPrice={currentPrice}
    />
  );
}

function InsidersScreen() {
  const { symbol, insiders, loadingInsiders, loadInsiders } = useStockDetail();
  useEffect(() => { loadInsiders(); }, [loadInsiders]);
  return <InsidersTab symbol={symbol} insiders={insiders} loading={loadingInsiders} />;
}

function CommunityScreen() {
  const { symbol } = useStockDetail();
  return <CommunityTab symbol={symbol} />;
}

export interface StockDetailViewProps {
  symbol: string;
}

function TradeButtonWrapper() {
  const { symbol, detail } = useStockDetail();
  const currentPrice = (detail?.statistics as { currentPrice?: number | null } | undefined)?.currentPrice ?? null;
  return <TradeButton symbol={symbol} currentPrice={currentPrice} />;
}

export function StockDetailView({ symbol }: StockDetailViewProps) {
  const { width } = useWindowDimensions();

  return (
    <StockDetailProvider symbol={symbol}>
      <View style={styles.container}>
        <PriceHeader />
        <Tab.Navigator
          screenOptions={{
            tabBarScrollEnabled: true,
            tabBarStyle: { backgroundColor: COLORS.background },
            tabBarIndicatorStyle: { backgroundColor: COLORS.electricBlue },
            tabBarLabelStyle: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
            tabBarItemStyle: { width: width > 400 ? undefined : 72 },
          }}
        >
          <Tab.Screen name="Overview" component={OverviewScreen} />
          <Tab.Screen name="News" component={NewsScreen} />
          <Tab.Screen name="Financials" component={FinancialsScreen} />
          <Tab.Screen name="Technicals" component={TechnicalsScreen} />
          <Tab.Screen name="Forecast AI" component={ForecastAIScreen} />
          <Tab.Screen name="Insiders" component={InsidersScreen} />
          <Tab.Screen name="Community" component={CommunityScreen} />
        </Tab.Navigator>
        <TradeButtonWrapper />
      </View>
    </StockDetailProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  largeTitle: {
    ...TYPO.header,
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 13, color: '#8E8E93', marginTop: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  price: {
    ...TYPO.price,
    color: COLORS.text,
    fontVariant: ['tabular-nums'],
  },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  pillGreen: { backgroundColor: 'rgba(52, 199, 89, 0.2)' },
  pillRed: { backgroundColor: 'rgba(255, 59, 48, 0.2)' },
  pillText: { fontSize: 15, fontWeight: '600' },
  positive: { color: COLORS.positive },
  negative: { color: COLORS.negative },
});
