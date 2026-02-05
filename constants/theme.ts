/**
 * SouqView – Apple Design System (iOS Stocks app style)
 * Dark: Pure Black. Light: White / Dark Blue text.
 */

export type ThemeColors = {
  background: string;
  backgroundSecondary: string;
  card: string;
  electricBlue: string;
  electricBlueDim: string;
  neonMint: string;
  neonMintDim: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  positive: string;
  negative: string;
  border: string;
  separator: string;
};

/** Dark theme – Pure Black (#000000) background. */
export const COLORS: ThemeColors = {
  background: '#000000',
  backgroundSecondary: '#000000',
  card: '#1C1C1E',
  electricBlue: '#007AFF',
  electricBlueDim: 'rgba(0, 122, 255, 0.2)',
  neonMint: '#34C759',
  neonMintDim: 'rgba(52, 199, 89, 0.2)',
  text: '#FFFFFF',
  textSecondary: '#EBEBF5',
  textTertiary: '#8E8E93',
  positive: '#34C759',
  negative: '#FF3B30',
  border: 'rgba(255, 255, 255, 0.1)',
  separator: '#38383A',
};

/** Light theme – White background, dark blue text. */
export const LIGHT_COLORS: ThemeColors = {
  ...COLORS,
  background: '#FFFFFF',
  backgroundSecondary: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  textSecondary: '#3A3A3C',
  textTertiary: '#8E8E93',
  border: 'rgba(0, 0, 0, 0.1)',
  separator: '#C6C6C8',
};

/** Apple minimum touch target */
export const MIN_TOUCH_TARGET = 44;

export const XP_PER_TRADE = 50;
export const INITIAL_DEMO_BALANCE_USD = 10_000;

/** Typography – System Font (San Francisco on iOS) */
export const TYPO = {
  /** Big price: 34, bold */
  price: { fontSize: 34, fontWeight: '700' as const },
  /** Screen header (e.g. stock name) */
  header: { fontSize: 28, fontWeight: 'bold' as const },
  /** Labels – Apple System Grey */
  label: { fontSize: 13, color: '#8E8E93' },
  /** Tabular numbers for prices */
  tabular: { fontVariant: ['tabular-nums' as const] },
} as const;
