import { useLocalSearchParams } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { StockDetailView } from '../../components/StockDashboard/StockDetailView';
import { useTheme } from '../../contexts/ThemeContext';

export default function StockScreen() {
  const { colors } = useTheme();
  const { symbol, initialPrice, initialChange } = useLocalSearchParams<{
    symbol: string;
    initialPrice?: string;
    initialChange?: string;
  }>();
  const ticker = symbol ?? '';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StockDetailView
        symbol={ticker}
        initialPrice={initialPrice}
        initialChange={initialChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
