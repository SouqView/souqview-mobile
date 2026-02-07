import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { usePortfolio } from '../contexts/PortfolioContext';
import { useTheme } from '../contexts/ThemeContext';
import { COLORS } from '../constants/theme';

interface TradeButtonProps {
  symbol: string;
  currentPrice: number | null;
}

export function TradeButton({ symbol, currentPrice }: TradeButtonProps) {
  const { colors } = useTheme();
  const { buyStock, sellStock, cashBalance, getPosition } = usePortfolio();
  const [visible, setVisible] = useState(false);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const confettiRef = useRef<ConfettiCannon>(null);

  const price = typeof currentPrice === 'number' && Number.isFinite(currentPrice)
    ? currentPrice
    : (currentPrice != null ? Number(currentPrice) : 0) || 0;
  const qty = Math.max(0, Math.floor(parseFloat(quantity) || 0));
  const total = price * qty;
  const position = getPosition(symbol);
  const canBuy = cashBalance >= total && qty > 0 && price > 0;
  const canSell = side === 'sell' && position && position.quantity >= qty && qty > 0;

  const triggerSuccessFeedback = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    confettiRef.current?.start();
  };

  const handleExecute = async () => {
    setErrorMessage(null);
    if (side === 'buy' && !canBuy) return;
    if (side === 'sell' && !canSell) return;
    setSubmitting(true);
    try {
      if (side === 'buy') {
        const result = buyStock(symbol, price, qty);
        if ('error' in result) {
          setErrorMessage(result.error);
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
          return;
        }
        triggerSuccessFeedback();
        setVisible(false);
        setQuantity('');
      } else {
        const result = sellStock(symbol, price, qty);
        if ('error' in result) {
          setErrorMessage(result.error);
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
          return;
        }
        triggerSuccessFeedback();
        setVisible(false);
        setQuantity('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVisible(false);
  };

  return (
    <>
      <SafeAreaView style={[styles.stickyBarSafe, { backgroundColor: colors.electricBlue }]} edges={['bottom']}>
        <TouchableOpacity
          style={styles.stickyBar}
          onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setVisible(true);
          setErrorMessage(null);
        }}
        activeOpacity={0.9}
        >
          <Text style={styles.stickyBarLabel}>Trade</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <Modal visible={visible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <ConfettiCannon
            ref={confettiRef}
            count={80}
            origin={{ x: -10, y: 0 }}
            fadeOut
            autoStart={false}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Buy {symbol}</Text>
              <TouchableOpacity
                onPress={closeModal}
                hitSlop={12}
                onPressIn={() => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              >
                <Ionicons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.availableCash, { color: colors.textTertiary }]}>Available Cash: $100,000</Text>
            <Text style={[styles.priceLine, { color: colors.textSecondary }]}>
              Price: <Text style={[styles.priceValue, { color: colors.neonMint }]}>{price > 0 ? price.toFixed(2) : '—'} USD</Text>
            </Text>

            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, { backgroundColor: colors.card, borderColor: colors.border }, side === 'buy' && styles.toggleBtnActive]}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSide('buy');
                }}
              >
                <Text style={[styles.toggleText, { color: colors.textSecondary }, side === 'buy' && styles.toggleTextActive]}>Buy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, { backgroundColor: colors.card, borderColor: colors.border }, side === 'sell' && styles.toggleBtnActiveSell]}
                onPress={() => {
                  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSide('sell');
                }}
              >
                <Text style={[styles.toggleText, { color: colors.textSecondary }, side === 'sell' && styles.toggleTextActiveSell]}>Sell</Text>
              </TouchableOpacity>
            </View>

            {side === 'sell' && position && (
              <Text style={[styles.holding, { color: colors.textTertiary }]}>You have {position.quantity} shares</Text>
            )}

            <Text style={[styles.label, { color: colors.textSecondary }]}>Share quantity or USD amount</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              value={quantity}
              onChangeText={(t) => { setQuantity(t); setErrorMessage(null); }}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textTertiary}
            />

            {qty > 0 && price > 0 && (
              <Text style={[styles.total, { color: colors.text }]}>Total: {total.toFixed(2)} USD</Text>
            )}

            {errorMessage ? (
              <Text style={[styles.errorText, { color: colors.negative }]}>{errorMessage}</Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (side === 'buy' ? canBuy : canSell) ? [styles.submitBtnActive, { backgroundColor: colors.electricBlue }] : styles.submitBtnDisabled,
              ]}
              onPress={handleExecute}
              disabled={!(side === 'buy' ? canBuy : canSell) || submitting}
              onPressIn={() => (side === 'buy' ? canBuy : canSell) && Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[(side === 'buy' ? canBuy : canSell) ? styles.submitTextActive : [styles.submitTextDisabled, { color: colors.textTertiary }]]}>
                  Confirm {side === 'buy' ? 'Buy' : 'Sell'}
                </Text>
              )}
            </TouchableOpacity>
            <Text style={[styles.xpHint, { color: colors.neonMint }]}>+50 XP per trade</Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  stickyBarSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  /** Trade bar: single source of truth for all tabs (StockDetailView + StockDashboard). Height 50, full width, no extra padding. */
  stickyBar: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyBarLabel: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: '700' },
  availableCash: { fontSize: 15, marginBottom: 8 },
  priceLine: { fontSize: 14, marginBottom: 16 },
  priceValue: { fontWeight: '700' },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  toggleBtnActive: { backgroundColor: COLORS.neonMintDim, borderColor: COLORS.neonMint },
  toggleBtnActiveSell: { backgroundColor: COLORS.negative + '30', borderColor: COLORS.negative },
  toggleText: { fontSize: 16, fontWeight: '600' },
  toggleTextActive: { color: COLORS.neonMint },
  toggleTextActiveSell: { color: COLORS.negative },
  holding: { fontSize: 13, marginBottom: 12 },
  label: { fontSize: 14, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    marginBottom: 12,
  },
  total: { fontSize: 15, fontWeight: '600', marginBottom: 20 },
  errorText: { fontSize: 14, marginBottom: 12 },
  submitBtn: {
    backgroundColor: COLORS.textTertiary,
    minHeight: 44,
    paddingVertical: 14,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnActive: {},
  submitBtnDisabled: {},
  submitTextActive: { fontSize: 17, fontWeight: '700', color: '#fff' },
  submitTextDisabled: { fontSize: 17, fontWeight: '700' },
  xpHint: { fontSize: 12, textAlign: 'center', marginTop: 12 },
});
