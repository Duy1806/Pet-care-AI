/**
 * PawCare AI — Login Screen
 *
 * Hero photo with curved bottom edge, form card overlapping the image.
 * Features: email/password fields, remember me, social login buttons (UI only),
 * gradient CTA button with loading state, staggered field animations.
 *
 * All text in Vietnamese.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { AuthHeader } from '@/presentation/components/AuthHeader';
import { AppTextField } from '@/presentation/components/AppTextField';
import { PrimaryButton } from '@/presentation/components/PrimaryButton';
import { SocialButton } from '@/presentation/components/SocialButton';
import { NetworkBanner } from '@/presentation/components/NetworkBanner';
import { useAppTheme } from '@/presentation/theme';
import { useAuthStore } from '@/presentation/stores/useAuthStore';
import { loginSchema, type LoginFormData } from '@/presentation/validation';

export default function LoginScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  // Clear store error when screen mounts
  useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      const success = await login(data.email, data.password);
      if (success) {
        router.replace('/(app)' as any);
      }
    },
    [login],
  );

  const handleForgotPassword = useCallback(() => {
    router.push('/(auth)/forgot-password' as any);
  }, []);

  const handleRegister = useCallback(() => {
    router.push('/(auth)/register' as any);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <NetworkBanner />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
        >
          {/* Hero image with curved bottom */}
          <AuthHeader
            image={require('@/assets/images/auth/login-hero.jpg')}
            title="Chào mừng trở lại!"
            subtitle="Đăng nhập để tiếp tục chăm sóc thú cưng"
            height={300}
          />

          {/* Form section */}
          <View style={[styles.formContainer, { paddingHorizontal: spacing.lg }]}>
            {/* Store-level error */}
            {error ? (
              <Animated.View
                entering={FadeInDown.duration(300)}
                style={[
                  styles.errorBanner,
                  {
                    backgroundColor: colors.errorContainer,
                    borderRadius: radius.md,
                    padding: spacing.smd,
                    marginBottom: spacing.md,
                  },
                ]}
              >
                <Text style={[typo.bodySmall, { color: colors.error }]}>
                  {error}
                </Text>
              </Animated.View>
            ) : null}

            {/* Email field */}
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <AppTextField
                    label="Email"
                    value={value}
                    onChangeText={onChange}
                    error={errors.email?.message}
                    leftIcon="email-outline"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                  />
                )}
              />
            </Animated.View>

            {/* Password field */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value } }) => (
                  <AppTextField
                    label="Mật khẩu"
                    value={value}
                    onChangeText={onChange}
                    error={errors.password?.message}
                    leftIcon="lock-outline"
                    rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    onRightIconPress={() => setShowPassword(!showPassword)}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    textContentType="password"
                  />
                )}
              />
            </Animated.View>

            {/* Remember me + Forgot password row */}
            <Animated.View
              entering={FadeInDown.delay(300).duration(400)}
              style={[styles.optionsRow, { marginBottom: spacing.lg }]}
            >
              <Controller
                control={control}
                name="rememberMe"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.rememberRow}>
                    <Switch
                      value={value ?? false}
                      onValueChange={onChange}
                      trackColor={{ false: colors.border, true: colors.primaryContainer }}
                      thumbColor={value ? colors.primary : colors.textTertiary}
                    />
                    <Text style={[typo.bodySmall, { color: colors.textSecondary, marginLeft: spacing.sm }]}>
                      Ghi nhớ đăng nhập
                    </Text>
                  </View>
                )}
              />
              <Pressable
                onPress={handleForgotPassword}
                hitSlop={8}
                accessibilityLabel="Quên mật khẩu"
              >
                <Text style={[typo.labelMedium, { color: colors.primary }]}>
                  Quên mật khẩu?
                </Text>
              </Pressable>
            </Animated.View>

            {/* Login button */}
            <Animated.View entering={FadeInDown.delay(400).duration(400)}>
              <PrimaryButton
                title="Đăng nhập"
                onPress={handleSubmit(onSubmit)}
                loading={isLoading}
              />
            </Animated.View>

            {/* Divider */}
            <Animated.View
              entering={FadeInDown.delay(500).duration(400)}
              style={[styles.dividerRow, { marginVertical: spacing.lg }]}
            >
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[typo.bodySmall, { color: colors.textTertiary, marginHorizontal: spacing.md }]}>
                hoặc
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </Animated.View>

            {/* Social buttons */}
            <Animated.View entering={FadeInDown.delay(600).duration(400)}>
              <SocialButton
                provider="google"
                onPress={() => {}}
                style={{ marginBottom: spacing.smd }}
              />
              <SocialButton provider="apple" onPress={() => {}} />
            </Animated.View>

            {/* Register link */}
            <Pressable
              onPress={handleRegister}
              style={[styles.footer, { minHeight: 48, marginTop: spacing.xl }]}
              accessibilityLabel="Chưa có tài khoản? Đăng ký"
            >
              <Text style={[typo.bodyMedium, { color: colors.textSecondary }]}>
                Chưa có tài khoản?{' '}
                <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
                  Đăng ký
                </Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  formContainer: {
    marginTop: -16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
