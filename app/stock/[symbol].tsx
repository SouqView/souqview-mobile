import { useLocalSearchParams } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { StockDetailView } from '../../components/StockDashboard/StockDetailView';
import { useTheme } from '../../contexts/ThemeContext';

export default function StockScreen() {
  const { colors } = useTheme();
  const { symbol, name, initialPrice, initialChange, lastClose } = useLocalSearchParams<{
    symbol: string;
    name?: string;
    initialPrice?: string;
    initialChange?: string;
    lastClose?: string;
  }>();
  const ticker = symbol ?? '';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StockDetailView
        symbol={ticker}
        initialName={name}
        initialPrice={initialPrice}
        initialChange={initialChange}
        initialLastClose={lastClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
