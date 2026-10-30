/**
 * PawCare AI — Forgot Password Screen (4 Steps)
 *
 * Step 1: Input email + calm pet photo, "Gửi mã xác nhận"
 * Step 2: 6-digit OTP boxes, 60s countdown timer, "Gửi lại mã"
 * Step 3: New password + confirm password, strength meter, rules checklist
 * Step 4: Success state with Lottie checkmark, "Quay lại đăng nhập"
 *
 * Features: Step progress bar, back navigation on every step, staggered animations.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeOutLeft,
} from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';

import { AuthHeader } from '@/presentation/components/AuthHeader';
import { AppTextField } from '@/presentation/components/AppTextField';
import { PrimaryButton } from '@/presentation/components/PrimaryButton';
import { PasswordStrengthBar } from '@/presentation/components/PasswordStrengthBar';
import { NetworkBanner } from '@/presentation/components/NetworkBanner';
import { useAppTheme } from '@/presentation/theme';
import { useAuthStore } from '@/presentation/stores/useAuthStore';
import { supabase } from '@/data/remote/supabaseClient';
import {
  forgotPasswordEmailSchema,
  resetPasswordSchema,
  type ForgotPasswordEmailData,
  type ResetPasswordData,
} from '@/presentation/validation';

const TOTAL_STEPS = 4;

function parseUrlParams(rawUrl: string): Record<string, string> {
  const params: Record<string, string> = {};
  const segments = rawUrl.split(/[#?&]/);
  for (const seg of segments) {
    const eqIdx = seg.indexOf('=');
    if (eqIdx !== -1) {
      const key = decodeURIComponent(seg.substring(0, eqIdx));
      const val = decodeURIComponent(seg.substring(eqIdx + 1));
      if (key && val) {
        params[key] = val;
      }
    }
  }
  return params;
}

export default function ForgotPasswordScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ step?: string }>();
  const incomingUrl = Linking.useURL();

  const {
    forgotPasswordStep,
    forgotPasswordEmail,
    isLoading,
    error,
    clearError,
    sendResetCode,
    resetPassword,
    resetForgotPasswordFlow,
  } = useAuthStore();

  // Local state for countdown
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Password visibility for step 3
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Form for step 1
  const emailForm = useForm<ForgotPasswordEmailData>({
    resolver: zodResolver(forgotPasswordEmailSchema),
    defaultValues: { email: '' },
  });

  // Form for step 3
  const passwordForm = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const newPasswordValue = useWatch({ control: passwordForm.control, name: 'password' }) ?? '';

  // Listen to deep linking and recovery tokens
  useEffect(() => {
    const handleUrl = async (urlStr: string | null) => {
      if (!urlStr) return;
      const parsed = parseUrlParams(urlStr);

      if (parsed.access_token && parsed.refresh_token) {
        try {
          await supabase.auth.setSession({
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token,
          });
          useAuthStore.setState({ forgotPasswordStep: 'new-password' });
        } catch {
          // ignore session setting failure
        }
      } else if (parsed.step === 'new-password' || parsed.type === 'recovery') {
        useAuthStore.setState({ forgotPasswordStep: 'new-password' });
      }
    };

    if (incomingUrl) {
      void handleUrl(incomingUrl);
    }

    if (params.step === 'new-password') {
      useAuthStore.setState({ forgotPasswordStep: 'new-password' });
    }

    // Also listen to Supabase recovery auth event
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'PASSWORD_RECOVERY') {
          useAuthStore.setState({ forgotPasswordStep: 'new-password' });
        }
      },
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [incomingUrl, params.step]);

  // Step 2 countdown timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (forgotPasswordStep === 'otp' && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [forgotPasswordStep, countdown]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      resetForgotPasswordFlow();
    };
  }, [resetForgotPasswordFlow]);

  const currentStepNumber =
    forgotPasswordStep === 'email'
      ? 1
      : forgotPasswordStep === 'otp'
        ? 2
        : forgotPasswordStep === 'new-password'
          ? 3
          : 4;

  const handleBack = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearError();
    if (forgotPasswordStep === 'email') {
      router.back();
    } else if (forgotPasswordStep === 'otp') {
      useAuthStore.setState({ forgotPasswordStep: 'email' });
    } else if (forgotPasswordStep === 'new-password') {
      useAuthStore.setState({ forgotPasswordStep: 'otp' });
    } else {
      router.replace('/(auth)/login' as any);
    }
  }, [forgotPasswordStep, clearError]);

  // Step 1: Submit email
  const onEmailSubmit = useCallback(
    async (data: ForgotPasswordEmailData) => {
      clearError();
      const ok = await sendResetCode(data.email);
      if (ok) {
        setCountdown(60);
        setCanResend(false);
      }
    },
    [sendResetCode, clearError],
  );

  // Step 2: Resend email
  const handleResendEmail = useCallback(async () => {
    if (!canResend) return;
    clearError();
    const ok = await sendResetCode(forgotPasswordEmail);
    if (ok) {
      setCountdown(60);
      setCanResend(false);
    }
  }, [canResend, forgotPasswordEmail, sendResetCode, clearError]);

  // Step 3: Submit new password
  const onPasswordSubmit = useCallback(
    async (data: ResetPasswordData) => {
      clearError();
      await resetPassword(data.password);
    },
    [resetPassword, clearError],
  );

  // Step 4: Finish and return to login
  const handleFinish = useCallback(() => {
    resetForgotPasswordFlow();
    router.replace('/(auth)/login' as any);
  }, [resetForgotPasswordFlow]);

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
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        >
          {/* Header image */}
          <AuthHeader
            image={require('@/assets/images/auth/forgot-hero.jpg')}
            title="Khôi phục mật khẩu"
            subtitle="Chúng tôi sẽ hỗ trợ bạn lấy lại quyền truy cập"
            height={260}
          />

          <View style={[styles.content, { paddingHorizontal: spacing.lg }]}>
            {/* Top navigation row: Back button & Step Progress */}
            <View style={[styles.stepBarRow, { marginVertical: spacing.md }]}>
              {currentStepNumber < 4 ? (
                <Pressable
                  onPress={handleBack}
                  hitSlop={12}
                  style={styles.backButton}
                  accessibilityLabel="Quay lại"
                >
                  <MaterialCommunityIcons
                    name="arrow-left"
                    size={24}
                    color={colors.text}
                  />
                </Pressable>
              ) : (
                <View style={{ width: 24 }} />
              )}

              {/* Progress dots / bars */}
              <View style={[styles.progressBarContainer, { gap: spacing.xs }]}>
                {Array.from({ length: TOTAL_STEPS }).map((_, idx) => {
                  const stepIndex = idx + 1;
                  const isActive = stepIndex === currentStepNumber;
                  const isCompleted = stepIndex < currentStepNumber;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.progressSegment,
                        {
                          backgroundColor: isCompleted || isActive
                            ? colors.primary
                            : colors.border,
                          height: 4,
                          borderRadius: radius.full,
                          flex: 1,
                        },
                      ]}
                    />
                  );
                })}
              </View>

              <Text style={[typo.labelMedium, { color: colors.textSecondary }]}>
                {currentStepNumber}/{TOTAL_STEPS}
              </Text>
            </View>

            {/* Error banner */}
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

            {/* STEP 1: Input Email */}
            {forgotPasswordStep === 'email' && (
              <Animated.View
                entering={FadeInRight.duration(300)}
                exiting={FadeOutLeft.duration(200)}
              >
                <Text
                  style={[
                    typo.headlineMedium,
                    { color: colors.text, marginBottom: spacing.xs },
                  ]}
                >
                  Nhập địa chỉ email
                </Text>
                <Text
                  style={[
                    typo.bodyMedium,
                    { color: colors.textSecondary, marginBottom: spacing.lg },
                  ]}
                >
                  Đường dẫn đặt lại mật khẩu sẽ được gửi trực tiếp về email liên kết với tài khoản của bạn.
                </Text>

                <Controller
                  control={emailForm.control}
                  name="email"
                  render={({ field: { onChange, value } }) => (
                    <AppTextField
                      label="Địa chỉ Email"
                      value={value}
                      onChangeText={onChange}
                      error={emailForm.formState.errors.email?.message}
                      leftIcon="email-outline"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      textContentType="emailAddress"
                    />
                  )}
                />

                <PrimaryButton
                  title="Gửi link khôi phục"
                  onPress={emailForm.handleSubmit(onEmailSubmit)}
                  loading={isLoading}
                  style={{ marginTop: spacing.md }}
                />
              </Animated.View>
            )}

            {/* STEP 2: Check Email */}
            {forgotPasswordStep === 'otp' && (
              <Animated.View
                entering={FadeInRight.duration(300)}
                exiting={FadeOutLeft.duration(200)}
                style={{ alignItems: 'center' }}
              >
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: colors.primaryContainer,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginVertical: spacing.md,
                  }}
                >
                  <MaterialCommunityIcons
                    name="email-fast-outline"
                    size={44}
                    color={colors.primary}
                  />
                </View>

                <Text
                  style={[
                    typo.headlineMedium,
                    { color: colors.text, marginBottom: spacing.xs, textAlign: 'center' },
                  ]}
                >
                  Kiểm tra hòm thư của bạn
                </Text>
                <Text
                  style={[
                    typo.bodyMedium,
                    { color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
                  ]}
                >
                  Chúng tôi đã gửi email xác nhận kèm đường dẫn đặt lại mật khẩu tới{' '}
                  <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
                    {forgotPasswordEmail}
                  </Text>
                  .
                </Text>

                {/* Instructions Box */}
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    width: '100%',
                    marginBottom: spacing.lg,
                    gap: spacing.sm,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <MaterialCommunityIcons
                      name="numeric-1-circle"
                      size={20}
                      color={colors.primary}
                      style={{ marginRight: spacing.xs, marginTop: 2 }}
                    />
                    <Text style={[typo.bodySmall, { color: colors.text, flex: 1 }]}>
                      Mở ứng dụng <Text style={{ fontWeight: '700' }}>Gmail</Text> hoặc hòm thư trên điện thoại này.
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <MaterialCommunityIcons
                      name="numeric-2-circle"
                      size={20}
                      color={colors.primary}
                      style={{ marginRight: spacing.xs, marginTop: 2 }}
                    />
                    <Text style={[typo.bodySmall, { color: colors.text, flex: 1 }]}>
                      Bấm vào nút <Text style={{ fontWeight: '700' }}>Reset Password</Text> (hoặc đường link) trong thư.
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <MaterialCommunityIcons
                      name="numeric-3-circle"
                      size={20}
                      color={colors.primary}
                      style={{ marginRight: spacing.xs, marginTop: 2 }}
                    />
                    <Text style={[typo.bodySmall, { color: colors.text, flex: 1 }]}>
                      Điện thoại sẽ tự động mở lại Expo Go và hiển thị màn hình tạo mật khẩu mới.
                    </Text>
                  </View>
                </View>

                {/* Resend Countdown */}
                <View style={{ marginVertical: spacing.sm }}>
                  {canResend ? (
                    <Pressable onPress={handleResendEmail} hitSlop={8}>
                      <Text
                        style={[
                          typo.labelLarge,
                          { color: colors.primary, textDecorationLine: 'underline' },
                        ]}
                      >
                        Chưa nhận được? Gửi lại email
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                      Gửi lại sau{' '}
                      <Text style={{ color: colors.primary, fontWeight: '700' }}>
                        {countdown}s
                      </Text>
                    </Text>
                  )}
                </View>

                {/* Direct shortcut button for convenience / testing */}
                <Pressable
                  onPress={() => useAuthStore.setState({ forgotPasswordStep: 'new-password' })}
                  style={{
                    marginTop: spacing.md,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: colors.surfaceElevated,
                  }}
                >
                  <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>
                    👉 Đã bấm link trên điện thoại? Chuyển sang bước Đặt lại mật khẩu
                  </Text>
                </Pressable>
              </Animated.View>
            )}

            {/* STEP 3: Set New Password */}
            {forgotPasswordStep === 'new-password' && (
              <Animated.View
                entering={FadeInRight.duration(300)}
                exiting={FadeOutLeft.duration(200)}
              >
                <Text
                  style={[
                    typo.headlineMedium,
                    { color: colors.text, marginBottom: spacing.xs },
                  ]}
                >
                  Đặt lại mật khẩu mới
                </Text>
                <Text
                  style={[
                    typo.bodyMedium,
                    { color: colors.textSecondary, marginBottom: spacing.lg },
                  ]}
                >
                  Tạo mật khẩu mạnh mới để bảo vệ an toàn cho tài khoản của bạn.
                </Text>

                <Controller
                  control={passwordForm.control}
                  name="password"
                  render={({ field: { onChange, value } }) => (
                    <AppTextField
                      label="Mật khẩu mới"
                      value={value}
                      onChangeText={onChange}
                      error={passwordForm.formState.errors.password?.message}
                      leftIcon="lock-outline"
                      rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      onRightIconPress={() => setShowPassword(!showPassword)}
                      secureTextEntry={!showPassword}
                    />
                  )}
                />

                <PasswordStrengthBar password={newPasswordValue} />

                {/* Password rules checklist */}
                <View
                  style={[
                    styles.rulesBox,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      marginVertical: spacing.md,
                    },
                  ]}
                >
                  <Text style={[typo.labelMedium, { color: colors.text, marginBottom: spacing.xs }]}>
                    Yêu cầu mật khẩu:
                  </Text>
                  <RuleItem
                    passed={newPasswordValue.length >= 8}
                    label="Tối thiểu 8 ký tự"
                  />
                  <RuleItem
                    passed={/[A-Z]/.test(newPasswordValue) && /[a-z]/.test(newPasswordValue)}
                    label="Bao gồm cả chữ hoa và chữ thường"
                  />
                  <RuleItem
                    passed={/\d/.test(newPasswordValue)}
                    label="Chứa ít nhất 1 chữ số"
                  />
                </View>

                <Controller
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field: { onChange, value } }) => (
                    <AppTextField
                      label="Xác nhận mật khẩu mới"
                      value={value}
                      onChangeText={onChange}
                      error={passwordForm.formState.errors.confirmPassword?.message}
                      leftIcon="lock-check-outline"
                      rightIcon={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                      onRightIconPress={() => setShowConfirm(!showConfirm)}
                      secureTextEntry={!showConfirm}
                    />
                  )}
                />

                <PrimaryButton
                  title="Cập nhật mật khẩu"
                  onPress={passwordForm.handleSubmit(onPasswordSubmit)}
                  loading={isLoading}
                  style={{ marginTop: spacing.md }}
                />
              </Animated.View>
            )}

            {/* STEP 4: Success State */}
            {forgotPasswordStep === 'success' && (
              <Animated.View
                entering={FadeInRight.duration(300)}
                style={styles.successContainer}
              >
                <View style={styles.lottieBox}>
                  {Platform.OS !== 'web' ? (
                    <LottieView
                      source={require('@/assets/animations/success-check.json')}
                      autoPlay
                      loop={false}
                      style={styles.lottieAnimation}
                    />
                  ) : (
                    <View
                      style={[
                        styles.webCheckCircle,
                        {
                          backgroundColor: colors.primaryContainer,
                          borderColor: colors.primary,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="check"
                        size={56}
                        color={colors.primary}
                      />
                    </View>
                  )}
                </View>

                <Text
                  style={[
                    typo.displayMedium,
                    { color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
                  ]}
                >
                  Thành công!
                </Text>

                <Text
                  style={[
                    typo.bodyLarge,
                    {
                      color: colors.textSecondary,
                      textAlign: 'center',
                      marginBottom: spacing.xxl,
                      lineHeight: 24,
                    },
                  ]}
                >
                  Mật khẩu của bạn đã được cập nhật thành công. Hãy đăng nhập với thông tin mới.
                </Text>

                <PrimaryButton
                  title="Quay lại đăng nhập"
                  onPress={handleFinish}
                  style={{ width: '100%' }}
                />
              </Animated.View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function RuleItem({ passed, label }: { passed: boolean; label: string }) {
  const { colors, typography: typo, spacing } = useAppTheme();
  return (
    <View style={[styles.ruleRow, { marginTop: spacing.xs }]}>
      <MaterialCommunityIcons
        name={passed ? 'check-circle' : 'circle-outline'}
        size={16}
        color={passed ? colors.success : colors.textTertiary}
        style={{ marginRight: spacing.xs }}
      />
      <Text
        style={[
          typo.bodySmall,
          { color: passed ? colors.success : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { marginTop: -16 },
  stepBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  progressBarContainer: {
    flex: 1,
    flexDirection: 'row',
    marginHorizontal: 16,
  },
  progressSegment: {},
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rulesBox: {
    borderWidth: 1,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  lottieBox: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  lottieAnimation: {
    width: 120,
    height: 120,
  },
  webCheckCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
