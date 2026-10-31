/**
 * PawCare AI — AppTextField Component
 *
 * Premium floating-label text input with:
 * - Prefix/suffix icons
 * - Focus glow animation (primary color border)
 * - Clear error states with shake animation
 * - Accessibility labels and tap targets >= 48dp
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '../theme';

const AnimatedView = Animated.createAnimatedComponent(View);

interface AppTextFieldProps extends Omit<TextInputProps, 'style'> {
  /** Field label (floats above on focus) */
  label: string;
  /** Current field value */
  value: string;
  /** Change handler */
  onChangeText: (text: string) => void;
  /** Validation error message */
  error?: string;
  /** Left icon name (MaterialCommunityIcons) */
  leftIcon?: string;
  /** Right icon name (e.g., eye toggle) */
  rightIcon?: string;
  /** Handler for right icon press */
  onRightIconPress?: () => void;
  /** Whether this is a password field */
  secureTextEntry?: boolean;
  /** Keyboard type */
  keyboardType?: KeyboardTypeOptions;
  /** Accessibility label override */
  accessibilityLabel?: string;
  /** Auto-capitalize mode */
  autoCapitalize?: TextInputProps['autoCapitalize'];
}

export function AppTextField({
  label,
  value,
  onChangeText,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry,
  keyboardType,
  accessibilityLabel,
  autoCapitalize = 'none',
  ...rest
}: AppTextFieldProps) {
  const { colors, typography: typo, spacing, radius, layout: layoutConst } = useAppTheme();
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<any>(null);

  // Shake animation for errors
  const shakeX = useSharedValue(0);
  const borderColorAnim = useSharedValue(0);

  const isActive = isFocused || value.length > 0;

  // Trigger shake on error
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

  // Animate border on focus
  useEffect(() => {
    borderColorAnim.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
  }, [isFocused, borderColorAnim]);

  const containerAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => setIsFocused(false), []);

  const borderColor = error
    ? colors.error
    : isFocused
      ? colors.primary
      : colors.border;

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="none"
    >
      <AnimatedView style={[containerAnimStyle, { marginBottom: spacing.md }]}>
        <View
          style={[
            styles.inputContainer,
            {
              borderColor,
              backgroundColor: colors.inputBackground,
              borderRadius: radius.md,
              minHeight: layoutConst.inputHeight,
              paddingHorizontal: spacing.md,
              borderWidth: isFocused ? 2 : 1,
            },
          ]}
        >
          {/* Left icon */}
          {leftIcon ? (
            <MaterialCommunityIcons
              name={leftIcon as keyof typeof MaterialCommunityIcons.glyphMap}
              size={layoutConst.iconSizeSm}
              color={isFocused ? colors.primary : colors.textTertiary}
              style={{ marginRight: spacing.sm }}
            />
          ) : null}

          {/* Input area */}
          <View style={styles.inputWrapper}>
            {/* Floating label */}
            <Text
              pointerEvents="none"
              style={[
                styles.label,
                isActive ? typo.caption : typo.bodyMedium,
                {
                  color: error
                    ? colors.error
                    : isFocused
                      ? colors.primary
                      : colors.textTertiary,
                  top: isActive ? 6 : 18,
                },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>

            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              onFocus={handleFocus}
              onBlur={handleBlur}
              secureTextEntry={secureTextEntry}
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize}
              placeholder={isActive ? rest.placeholder : undefined}
              style={[
                typo.bodyLarge,
                styles.input,
                {
                  color: colors.text,
                  paddingTop: isActive ? 22 : 16,
                },
              ]}
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.primary}
              {...rest}
            />
          </View>

          {/* Right icon (e.g., password toggle) */}
          {rightIcon ? (
            <Pressable
              onPress={onRightIconPress}
              hitSlop={12}
              accessibilityLabel={
                secureTextEntry ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'
              }
              style={styles.rightIconBtn}
            >
              <MaterialCommunityIcons
                name={rightIcon as keyof typeof MaterialCommunityIcons.glyphMap}
                size={layoutConst.iconSizeSm}
                color={colors.textTertiary}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Error message */}
        {error ? (
          <Text
            style={[
              typo.bodySmall,
              { color: colors.error, marginTop: spacing.xs, marginLeft: spacing.xs },
            ]}
            accessibilityRole="alert"
          >
            {error}
          </Text>
        ) : null}
      </AnimatedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    left: 0,
  },
  input: {
    flex: 1,
    paddingBottom: 6,
    paddingTop: 22,
  },
  rightIconBtn: {
    padding: 8,
    marginLeft: 4,
  },
});

