/**
 * PawCare AI — OtpInput Component
 *
 * 6-digit OTP input with auto-focus advance, paste support,
 * and backspace handling. Each digit gets its own styled box.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '../theme';

const OTP_LENGTH = 6;

interface OtpInputProps {
  /** Current OTP value */
  value: string;
  /** Called when the full value changes */
  onChange: (otp: string) => void;
  /** Error message to display */
  error?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

export function OtpInput({ value, onChange, error, disabled }: OtpInputProps) {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const inputRef = useRef<any>(null);

  // Shake animation for errors
  const shakeX = useSharedValue(0);

  useEffect(() => {
    if (error) {
      shakeX.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [error, shakeX]);

  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const handleChangeText = useCallback(
    (text: string) => {
      // Filter to digits only
      const digits = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
      onChange(digits);

      if (digits.length === OTP_LENGTH) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    },
    [onChange],
  );

  const handlePress = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Derive individual digits from the value
  const digits = value.split('');

  return (
    <View style={[styles.wrapper, { marginBottom: spacing.md }]}>
      <Pressable onPress={handlePress} accessibilityLabel="Nhập mã OTP">
        <Animated.View style={[styles.container, containerAnimStyle, { gap: spacing.sm }]}>
          {Array.from({ length: OTP_LENGTH }).map((_, index) => {
            const isFilled = index < digits.length;
            const isCurrent = index === digits.length && !disabled;

            return (
              <View
                key={index}
                style={[
                  styles.box,
                  {
                    borderRadius: radius.md,
                    borderColor: error
                      ? colors.error
                      : isCurrent
                        ? colors.primary
                        : isFilled
                          ? colors.primary
                          : colors.border,
                    borderWidth: isCurrent ? 2 : 1,
                    backgroundColor: isFilled
                      ? colors.primaryContainer
                      : colors.inputBackground,
                  },
                ]}
              >
                <Text
                  style={[
                    typo.displayMedium,
                    { color: colors.text, textAlign: 'center' },
                  ]}
                >
                  {digits[index] ?? ''}
                </Text>
              </View>
            );
          })}
        </Animated.View>
      </Pressable>

      {/* Hidden text input that captures all keyboard input */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        autoFocus
        editable={!disabled}
        style={styles.hiddenInput}
        caretHidden
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
      />

      {error ? (
        <Text
          style={[
            typo.bodySmall,
            { color: colors.error, marginTop: spacing.sm, textAlign: 'center' },
          ]}
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  box: {
    width: 48,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
  },
});

