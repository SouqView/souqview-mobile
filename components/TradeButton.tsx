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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { usePortfolio } from '../contexts/PortfolioContext';
import { COLORS } from '../constants/theme';

interface TradeButtonProps {
  symbol: string;
  currentPrice: number | null;
}

export function TradeButton({ symbol, currentPrice }: TradeButtonProps) {
  const { buyStock, sellStock, cashBalance, getPosition } = usePortfolio();
  const [visible, setVisible] = useState(false);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const confettiRef = useRef<ConfettiCannon>(null);

  const price = currentPrice ?? 0;
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

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setVisible(true);
          setErrorMessage(null);
        }}
        activeOpacity={0.9}
      >
        <Ionicons name="swap-horizontal" size={24} color="#000" />
        <Text style={styles.fabLabel}>Trade</Text>
      </TouchableOpacity>

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
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Demo Trade — {symbol}</Text>
              <TouchableOpacity onPress={() => setVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={28} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.priceLine}>
              Price: <Text style={styles.priceValue}>{price ? price.toFixed(2) : '—'} USD</Text>
            </Text>

            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, side === 'buy' && styles.toggleBtnActive]}
                onPress={() => setSide('buy')}
              >
                <Text style={[styles.toggleText, side === 'buy' && styles.toggleTextActive]}>Buy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, side === 'sell' && styles.toggleBtnActiveSell]}
                onPress={() => setSide('sell')}
              >
                <Text style={[styles.toggleText, side === 'sell' && styles.toggleTextActiveSell]}>Sell</Text>
              </TouchableOpacity>
            </View>

            {side === 'sell' && position && (
              <Text style={styles.holding}>You have {position.quantity} shares</Text>
            )}

            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={(t) => { setQuantity(t); setErrorMessage(null); }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={COLORS.textTertiary}
            />

            {qty > 0 && price > 0 && (
              <Text style={styles.total}>Total: {total.toFixed(2)} USD</Text>
            )}

            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (side === 'buy' ? canBuy : canSell) ? styles.submitBtnActive : styles.submitBtnDisabled,
              ]}
              onPress={handleExecute}
              disabled={!(side === 'buy' ? canBuy : canSell) || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[(side === 'buy' ? canBuy : canSell) ? styles.submitTextActive : styles.submitTextDisabled]}>
                  {side === 'buy' ? 'Buy' : 'Sell'} {symbol}
                </Text>
              )}
            </TouchableOpacity>
            <Text style={styles.xpHint}>+50 XP per trade</Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.electricBlue,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    shadowColor: COLORS.electricBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    gap: 6,
  },
  fabLabel: { fontSize: 16, fontWeight: '700', color: '#000' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.backgroundSecondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  priceLine: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 16 },
  priceValue: { color: COLORS.neonMint, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleBtnActive: { backgroundColor: COLORS.neonMintDim, borderColor: COLORS.neonMint },
  toggleBtnActiveSell: { backgroundColor: COLORS.negative + '30', borderColor: COLORS.negative },
  toggleText: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary },
  toggleTextActive: { color: COLORS.neonMint },
  toggleTextActiveSell: { color: COLORS.negative },
  holding: { fontSize: 13, color: COLORS.textTertiary, marginBottom: 12 },
  label: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    color: COLORS.text,
    marginBottom: 12,
  },
  total: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 20 },
  errorText: { fontSize: 14, color: COLORS.negative, marginBottom: 12 },
  submitBtn: {
    backgroundColor: COLORS.textTertiary,
    minHeight: 44,
    paddingVertical: 14,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnActive: { backgroundColor: COLORS.electricBlue },
  submitBtnDisabled: {},
  submitTextActive: { fontSize: 17, fontWeight: '700', color: '#fff' },
  submitTextDisabled: { fontSize: 17, fontWeight: '700', color: COLORS.textTertiary },
  xpHint: { fontSize: 12, color: COLORS.neonMint, textAlign: 'center', marginTop: 12 },
});
