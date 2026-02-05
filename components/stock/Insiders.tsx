import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { getRequest } from '../../services/api';

interface InsidersProps {
  symbol?: string;
  exchangeCode?: string; // e.g., "NASDAQ", "NYSE"
}

interface InsiderTransaction {
  date?: string;
  transactionDate?: string;
  insiderName?: string;
  insider_name?: string;
  name?: string;
  role?: string;
  position?: string;
  action?: string;
  transactionType?: string;
  shares?: number;
  sharesTraded?: number;
  value?: number;
  transactionValue?: number;
  ownership?: string;
  ownershipPercentage?: string;
  sentiment?: string;
  aiSentiment?: string;
}

export default function Insiders({ symbol = 'AAPL', exchangeCode = 'NASDAQ' }: InsidersProps) {
  const [transactions, setTransactions] = useState<InsiderTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInsiders();
  }, [exchangeCode]);

  const fetchInsiders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getRequest(
        `/api/stock/recent-insiders-transaction/${exchangeCode}?page=1&limit=10`
      );

      const data = response?.insiderTransactions || response?.data || [];
      setTransactions(data);
    } catch (err: any) {
      console.warn('Error fetching insiders:', err);
      setError(err?.message || 'Failed to load insider transactions');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatValue = (value?: number): string => {
    if (!value || value === 0) return 'N/A';
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const getActionColor = (action?: string): string => {
    const actionLower = (action || '').toLowerCase();
    if (actionLower === 'buy' || actionLower === 'purchase') {
      return '#10b981'; // Green
    }
    if (actionLower === 'sell' || actionLower === 'sale') {
      return '#ef4444'; // Red
    }
    return '#94a3b8'; // Gray
  };

  const renderTransaction = ({ item }: { item: InsiderTransaction }) => {
    const name = item.insiderName || item.insider_name || item.name || 'Unknown';
    const date = item.date || item.transactionDate || '';
    const action = item.action || item.transactionType || 'N/A';
    const value = item.value || item.transactionValue || 0;
    const actionColor = getActionColor(action);

    return (
      <View style={styles.transactionRow}>
        <View style={styles.leftSection}>
          <Text style={styles.nameText}>{name}</Text>
          <Text style={styles.dateText}>{formatDate(date)}</Text>
        </View>
        <View style={styles.rightSection}>
          <View
            style={[
              styles.actionPill,
              { backgroundColor: `${actionColor}20`, borderColor: actionColor },
            ]}
          >
            <Text style={[styles.actionText, { color: actionColor }]}>
              {action}
            </Text>
          </View>
          <Text style={styles.valueText}>{formatValue(value)}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Recent Insider Activity</Text>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Recent Insider Activity</Text>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recent Insider Activity</Text>
      {transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No recent insider trading</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item, index) =>
            `${item.insiderName || item.name || index}-${item.date || index}`
          }
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  errorContainer: {
    paddingVertical: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  leftSection: {
    flex: 1,
    marginRight: 16,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 8,
  },
  actionPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  valueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  separator: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
});
