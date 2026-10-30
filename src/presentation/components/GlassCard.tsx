/**
 * PawCare AI — GlassCard Component
 *
 * A glassmorphism card with blur backdrop.
 * Uses expo-blur (BlurView) for cross-platform frosted glass effect.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

import { useAppTheme } from '../theme';

interface GlassCardProps {
  children: React.ReactNode;
  /** Override blur intensity (0-100) */
  intensity?: number;
  /** Additional container style */
  style?: StyleProp<ViewStyle>;
  /** Padding preset */
  padding?: 'sm' | 'md' | 'lg';
}

export function GlassCard({
  children,
  intensity = 40,
  style,
  padding = 'lg',
}: GlassCardProps) {
  const { colors, radius, spacing, isDark } = useAppTheme();

  const paddingValue =
    padding === 'sm'
      ? spacing.smd
      : padding === 'md'
        ? spacing.md
        : spacing.lg;

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: radius.xl,
          borderColor: colors.glassBorder,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.glass },
        ]}
      />
      <View style={{ padding: paddingValue, position: 'relative' }}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});

