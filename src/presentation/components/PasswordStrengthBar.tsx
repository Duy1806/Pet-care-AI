/**
 * PawCare AI — PasswordStrengthBar Component
 *
 * Animated 3-segment bar indicating password strength.
 * Shows Vietnamese labels: Yếu / Trung bình / Mạnh.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '../theme';
import {
  getPasswordStrength,
  strengthColors,
  strengthLabels,
} from '../validation';

interface PasswordStrengthBarProps {
  /** The current password value */
  password: string;
}

export function PasswordStrengthBar({ password }: PasswordStrengthBarProps) {
  const { typography: typo, spacing, radius } = useAppTheme();
  const strength = getPasswordStrength(password);

  if (!password) return null;

  return (
    <View style={[styles.container, { marginBottom: spacing.sm }]}>
      <View style={[styles.barContainer, { gap: spacing.xs }]}>
        {([1, 2, 3] as const).map((level) => (
          <SegmentBar
            key={level}
            active={strength >= level}
            color={strengthColors[strength]}
            radius={radius.sm}
          />
        ))}
      </View>
      <Text
        style={[
          typo.caption,
          { color: strengthColors[strength], marginTop: spacing.xs },
        ]}
      >
        {strengthLabels[strength]}
      </Text>
    </View>
  );
}

/** Individual animated bar segment */
function SegmentBar({
  active,
  color,
  radius: r,
}: {
  active: boolean;
  color: string;
  radius: number;
}) {
  const { colors } = useAppTheme();

  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(active ? color : colors.border, {
      duration: 300,
    }),
    flex: 1,
    height: 4,
    borderRadius: r,
  }));

  return <Animated.View style={animStyle} />;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  barContainer: {
    flexDirection: 'row',
  },
});

