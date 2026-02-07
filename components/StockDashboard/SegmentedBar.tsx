import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';

export type SegmentId = 'overview' | 'news' | 'financials' | 'forecast' | 'insiders';

export const SEGMENTS: { id: SegmentId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'news', label: 'News' },
  { id: 'financials', label: 'Financials' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'insiders', label: 'Insiders' },
];

interface SegmentedBarProps {
  selected: SegmentId;
  onSelect: (id: SegmentId) => void;
}

export function SegmentedBar({ selected, onSelect }: SegmentedBarProps) {
  const { colors } = useTheme();
  const handlePress = (id: SegmentId) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelect(id);
  };

  const content = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {SEGMENTS.map((seg) => {
        const isSelected = selected === seg.id;
        return (
          <TouchableOpacity
            key={seg.id}
            onPress={() => handlePress(seg.id)}
            style={[styles.segment, isSelected && { backgroundColor: colors.electricBlueDim }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentLabel, { color: colors.textSecondary }, isSelected && { color: colors.electricBlue }]}>
              {seg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
      <View style={styles.bar}>
        {content}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    minHeight: 44,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingRight: 20,
  },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexShrink: 0,
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
});
