/**
 * SouqView Mobile – Apple Human Interface Guidelines (HIG)
 * US Market, Demo Trading, pixel-perfect Apple aesthetic
 */

/** Apple HIG: Off-White background, Pure White cards, high contrast text */
export const COLORS = {
  background: '#F2F2F7',
  backgroundSecondary: '#F2F2F7',
  card: '#FFFFFF',
  electricBlue: '#007AFF',
  electricBlueDim: 'rgba(0, 122, 255, 0.15)',
  neonMint: '#34C759',
  neonMintDim: 'rgba(52, 199, 89, 0.15)',
  text: '#1C1C1E',
  textSecondary: '#3A3A3C',
  textTertiary: '#8E8E93',
  positive: '#34C759',
  negative: '#FF3B30',
  border: 'rgba(0, 0, 0, 0.08)',
} as const;

/** Apple minimum touch target */
export const MIN_TOUCH_TARGET = 44;

export const XP_PER_TRADE = 50;
/** Demo trading: $10,000 USD fake money (US market only) */
export const INITIAL_DEMO_BALANCE_USD = 10_000;
