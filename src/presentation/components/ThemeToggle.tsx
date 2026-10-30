/**
 * PawCare AI — ThemeToggle Component
 *
 * Cycles through system → light → dark with an animated icon.
 * Displays the current mode icon for visual feedback.
 */
import React from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '../theme';
import { useThemeStore, type ThemeMode } from '../stores/useThemeStore';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ThemeToggleProps {
  style?: ViewStyle;
  size?: number;
  color?: string;
}

const modeIcons: Record<ThemeMode, string> = {
  system: 'theme-light-dark',
  light: 'white-balance-sunny',
  dark: 'moon-waning-crescent',
};

export function ThemeToggle({ style, size = 24, color }: ThemeToggleProps) {
  const { colors } = useAppTheme();
  const { themeMode, toggleTheme } = useThemeStore();
  const rotation = useSharedValue(0);

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rotation.value = withSequence(
      withTiming(rotation.value + 120, { duration: 200 }),
    );
    toggleTheme();
  };

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const iconName = modeIcons[themeMode] as keyof typeof MaterialCommunityIcons.glyphMap;

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={[styles.button, animStyle, style]}
      accessibilityLabel={`Chế độ giao diện: ${themeMode}`}
      accessibilityRole="button"
      hitSlop={12}
    >
      <MaterialCommunityIcons
        name={iconName}
        size={size}
        color={color ?? colors.text}
      />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
  },
});

