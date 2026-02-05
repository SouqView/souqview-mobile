import React, { useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { COLORS } from '../../constants/theme';
import { StockDetailProvider, useStockDetail } from '../../contexts/StockDetailContext';
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

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.symbol}>{symbol}</Text>
          {(nameStr || sectorStr) && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {nameStr ?? ''}{sectorStr ? ` • ${sectorStr}` : ''}
            </Text>
          )}
        </View>
        <View style={styles.priceCol}>
          {loadingDetail ? (
            <Text style={styles.price}>—</Text>
          ) : (
            <>
              <Text style={styles.price}>{price ? price.toFixed(2) : '—'} USD</Text>
              <Text style={[styles.change, isPositive ? styles.positive : styles.negative]}>
                {price ? `${isPositive ? '+' : ''}${change?.toFixed(2) ?? '0'}%` : ''}
              </Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function OverviewScreen() {
  const { symbol, detail, historical, loadingDetail } = useStockDetail();
  return (
    <OverviewTab
      symbol={symbol}
      detail={detail as OverviewTabProps['detail']}
      historical={historical as OverviewTabProps['historical']}
      loading={loadingDetail}
    />
  );
}

function NewsScreen() {
  const { symbol, news, loadingNews, loadNews } = useStockDetail();
  useEffect(() => { loadNews(); }, [loadNews]);
  const list = Array.isArray(news) ? news : (news as { data?: unknown[] })?.data ?? null;
  return <NewsTab symbol={symbol} news={list} loading={loadingNews} />;
}

function FinancialsScreen() {
  const { symbol, financials, loadingFinancials, loadFinancials } = useStockDetail();
  useEffect(() => { loadFinancials(); }, [loadFinancials]);
  return <FinancialsTab symbol={symbol} financials={financials as FinancialsTabProps['financials']} loading={loadingFinancials} />;
}

function TechnicalsScreen() {
  const { symbol, technicals, loadingTechnicals, loadTechnicals } = useStockDetail();
  useEffect(() => { loadTechnicals(); }, [loadTechnicals]);
  return <TechnicalsTab symbol={symbol} technicals={technicals} loading={loadingTechnicals} />;
}

function ForecastAIScreen() {
  const { symbol } = useStockDetail();
  return <ForecastAITab symbol={symbol} />;
}

function InsidersScreen() {
  const { symbol, insiders, loadingInsiders, loadInsiders } = useStockDetail();
  useEffect(() => { loadInsiders(); }, [loadInsiders]);
  return <InsidersTab symbol={symbol} insiders={insiders} loading={loadingInsiders} />;
}

function CommunityScreen() {
  const { symbol, community } = useStockDetail();
  return <CommunityTab symbol={symbol} posts={community} />;
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
            tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
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
    backgroundColor: COLORS.card,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  symbol: { fontSize: 28, fontWeight: '700', color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  priceCol: { alignItems: 'flex-end' },
  price: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  change: { fontSize: 14, marginTop: 2 },
  positive: { color: COLORS.positive },
  negative: { color: COLORS.negative },
});
