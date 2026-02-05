import { View, StyleSheet } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { COLORS } from '../constants/theme';

const W = 56;
const H = 28;

interface MiniSparklineProps {
  data?: number[];
  percentChange?: number;
  positiveColor?: string;
  negativeColor?: string;
}

export function MiniSparkline({
  data = [],
  percentChange = 0,
  positiveColor = COLORS.positive,
  negativeColor = COLORS.negative,
}: MiniSparklineProps) {
  const isPositive = percentChange >= 0;
  const color = isPositive ? positiveColor : negativeColor;

  let points = '';
  if (data.length >= 2) {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = W / (data.length - 1);
    data.forEach((y, i) => {
      const x = i * step;
      const py = H - 4 - ((y - min) / range) * (H - 8);
      points += `${x},${py} `;
    });
  } else {
    const mid = H / 2;
    points = isPositive ? `0,${H - 4} ${W},4` : `0,4 ${W},${H - 4}`;
  }

  return (
    <View style={styles.wrap}>
      <Svg width={W} height={H}>
        <Polyline
          points={points.trim()}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: W, height: H },
});
