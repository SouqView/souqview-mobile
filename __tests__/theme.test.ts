import { COLORS, MIN_TOUCH_TARGET, XP_PER_TRADE, INITIAL_DEMO_BALANCE_USD } from '../constants/theme';

describe('theme', () => {
  it('defines required colors', () => {
    expect(COLORS.background).toBeDefined();
    expect(COLORS.text).toBeDefined();
    expect(COLORS.electricBlue).toBeDefined();
    expect(COLORS.positive).toBeDefined();
    expect(COLORS.negative).toBeDefined();
  });

  it('MIN_TOUCH_TARGET meets Apple HIG (44pt)', () => {
    expect(MIN_TOUCH_TARGET).toBe(44);
  });

  it('XP_PER_TRADE is 50', () => {
    expect(XP_PER_TRADE).toBe(50);
  });

  it('INITIAL_DEMO_BALANCE_USD is 10000', () => {
    expect(INITIAL_DEMO_BALANCE_USD).toBe(10_000);
  });
});
