import { useLocalSearchParams } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { StockDetailView } from '../../components/StockDashboard/StockDetailView';
import { COLORS } from '../../constants/theme';

export default function StockScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const ticker = symbol ?? '';

  return (
    <View style={styles.container}>
      <StockDetailView symbol={ticker} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
});
