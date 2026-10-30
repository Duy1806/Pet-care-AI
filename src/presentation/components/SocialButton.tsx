/**
 * PawCare AI — SocialButton Component
 *
 * OAuth sign-in buttons (Google, Apple) — UI only in Phase 1.
 * Follows platform design guidelines for branded buttons.
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SocialButtonProps {
  /** 'google' or 'apple' */
  provider: 'google' | 'apple';
  /** Press handler */
  onPress: () => void;
  /** Additional style */
  style?: StyleProp<ViewStyle>;
}

const providerConfig = {
  google: {
    label: 'Tiếp tục với Google',
    icon: 'google' as const,
    iconColor: '#4285F4',
  },
  apple: {
    label: 'Tiếp tục với Apple',
    icon: 'apple' as const,
    iconColor: '#000000',
  },
};

export function SocialButton({ provider, onPress, style }: SocialButtonProps) {
  const { colors, typography: typo, radius, layout: layoutConst, applyShadow: shadow, shadows: shadowPresets, isDark } = useAppTheme();
  const scale = useSharedValue(1);
  const config = providerConfig[provider];

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Apple button is inverted in dark mode
  const appleIconColor = provider === 'apple' && isDark ? '#FFFFFF' : config.iconColor;

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={config.label}
      accessibilityRole="button"
      style={[animStyle, style]}
    >
      <View
        style={[
          styles.button,
          {
            height: layoutConst.buttonHeight,
            borderRadius: radius.md,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            ...shadow(shadowPresets.sm),
          },
        ]}
      >
        <MaterialCommunityIcons
          name={config.icon}
          size={layoutConst.iconSize}
          color={appleIconColor}
          style={styles.icon}
        />
        <Text style={[typo.labelLarge, { color: colors.text }]}>
          {config.label}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  icon: {
    marginRight: 12,
  },
});

