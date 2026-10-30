/**
 * PawCare AI — PrimaryButton Component
 *
 * Gradient-filled CTA button with loading state, press scale animation,
 * and haptic feedback. Meets 48dp minimum touch target.
 */
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PrimaryButtonProps {
  /** Button label */
  title: string;
  /** Press handler */
  onPress: () => void;
  /** Show loading spinner instead of title */
  loading?: boolean;
  /** Disable the button */
  disabled?: boolean;
  /** Variant */
  variant?: 'primary' | 'accent' | 'outline';
  /** Additional style */
  style?: StyleProp<ViewStyle>;
  /** Accessibility label override */
  accessibilityLabel?: string;
}

export function PrimaryButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  accessibilityLabel,
}: PrimaryButtonProps) {
  const { colors, typography: typo, radius, layout: layoutConst, applyShadow: shadow, shadows: shadowPresets } = useAppTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePress = useCallback(() => {
    if (loading || disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [loading, disabled, onPress]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isOutline = variant === 'outline';
  const opacity = disabled ? 0.5 : 1;

  const gradientColors: readonly [string, string] =
    variant === 'accent'
      ? [colors.accent, colors.accentPressed]
      : [colors.primary, colors.primaryPressed];

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={[animStyle, { opacity }, style]}
    >
      {isOutline ? (
        <Animated.View
          style={[
            styles.button,
            {
              height: layoutConst.buttonHeight,
              borderRadius: radius.md,
              borderWidth: 2,
              borderColor: colors.primary,
              backgroundColor: 'transparent',
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={[typo.labelLarge, { color: colors.primary }]}>
              {title}
            </Text>
          )}
        </Animated.View>
      ) : (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.button,
            {
              height: layoutConst.buttonHeight,
              borderRadius: radius.md,
              ...shadow(shadowPresets.md),
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={[typo.labelLarge, { color: colors.onPrimary }]}>
              {title}
            </Text>
          )}
        </LinearGradient>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
});

