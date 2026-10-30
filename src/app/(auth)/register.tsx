/**
 * PawCare AI — Register Screen
 *
 * Features: hero photo, full registration form with floating labels,
 * password strength meter, pet preference chips, terms checkbox,
 * staggered animations. All text in Vietnamese.
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
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { AuthHeader } from '@/presentation/components/AuthHeader';
import { AppTextField } from '@/presentation/components/AppTextField';
import { PrimaryButton } from '@/presentation/components/PrimaryButton';
import { PasswordStrengthBar } from '@/presentation/components/PasswordStrengthBar';
import { NetworkBanner } from '@/presentation/components/NetworkBanner';
import { OtpInput } from '@/presentation/components/OtpInput';
import { useAppTheme } from '@/presentation/theme';
import { useAuthStore } from '@/presentation/stores/useAuthStore';
import { registerSchema, type RegisterFormData } from '@/presentation/validation';
import type { PetPreference } from '@/domain/entities/User';

const PET_OPTIONS: { value: PetPreference; label: string; icon: string }[] = [
  { value: 'dog', label: 'Chó', icon: 'dog' },
  { value: 'cat', label: 'Mèo', icon: 'cat' },
  { value: 'other', label: 'Khác', icon: 'paw' },
];

export default function RegisterScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const {
    register: signUp,
    isLoading,
    error,
    clearError,
    isVerifyingSignUp,
    signUpEmail,
    verifySignUpOtp,
    resendSignUpOtp,
    cancelSignUpVerification,
  } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [countdown, setCountdown] = useState(60);
  const canResend = countdown <= 0;

  // Countdown timer for resend OTP
  useEffect(() => {
    if (!isVerifyingSignUp || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isVerifyingSignUp, countdown]);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false as unknown as true,
      petPreferences: [],
    },
  });

  const password = useWatch({ control, name: 'password' }) ?? '';

  useEffect(() => {
    clearError();
  }, [clearError]);

  const onSubmit = useCallback(
    async (data: RegisterFormData) => {
      clearError();
      const result = await signUp({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        phone: data.phone,
        petPreferences: data.petPreferences,
      });
      if (result === 'success') {
        router.replace('/(app)' as any);
      } else if (result === 'requires_verification') {
        setCountdown(60);
        setOtpValue('');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    [signUp, clearError],
  );

  const onOtpSubmit = useCallback(async () => {
    if (otpValue.length !== 6) return;
    clearError();
    const ok = await verifySignUpOtp(otpValue);
    if (ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(app)' as any);
    }
  }, [otpValue, verifySignUpOtp, clearError]);

  const handleResendOtp = useCallback(async () => {
    if (!canResend) return;
    clearError();
    const ok = await resendSignUpOtp();
    if (ok) {
      setCountdown(60);
      setOtpValue('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [canResend, resendSignUpOtp, clearError]);

  const handleCancelVerification = useCallback(() => {
    clearError();
    cancelSignUpVerification();
    setOtpValue('');
  }, [cancelSignUpVerification, clearError]);

  const handleLogin = useCallback(() => {
    router.push('/(auth)/login' as any);
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
          <AuthHeader
            image={require('@/assets/images/auth/register-hero.jpg')}
            title={isVerifyingSignUp ? 'Xác thực email' : 'Tạo tài khoản mới'}
            subtitle={
              isVerifyingSignUp
                ? 'Nhập mã 6 chữ số để kích hoạt tài khoản'
                : 'Bắt đầu hành trình chăm sóc thú cưng'
            }
            height={260}
          />

          <View style={[styles.formContainer, { paddingHorizontal: spacing.lg }]}>
            {/* Store error */}
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

            {isVerifyingSignUp ? (
              <Animated.View entering={FadeInDown.duration(300)}>
                {/* Back button to re-edit info */}
                <Pressable
                  onPress={handleCancelVerification}
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons name="arrow-left" size={20} color={colors.primary} />
                  <Text style={[typo.labelLarge, { color: colors.primary, marginLeft: spacing.xs }]}>
                    Thay đổi thông tin đăng ký
                  </Text>
                </Pressable>

                <Text style={[typo.headlineMedium, { color: colors.text, marginBottom: spacing.xs }]}>
                  Kiểm tra hòm thư của bạn
                </Text>
                <Text
                  style={[
                    typo.bodyMedium,
                    { color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 22 },
                  ]}
                >
                  Mã OTP xác thực đã được gửi tới{' '}
                  <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
                    {signUpEmail}
                  </Text>
                  . Vui lòng nhập mã để hoàn tất đăng ký tài khoản.
                </Text>

                {/* Helpful hint for test / mock mode */}
                <View
                  style={{
                    backgroundColor: colors.primaryContainer,
                    borderRadius: radius.md,
                    padding: spacing.smd,
                    marginBottom: spacing.lg,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={20}
                    color={colors.primary}
                    style={{ marginRight: spacing.sm }}
                  />
                  <Text style={[typo.bodySmall, { color: colors.text, flex: 1 }]}>
                    Mã xác nhận thử nghiệm (Mock):{' '}
                    <Text style={{ fontWeight: '700', color: colors.primary }}>123456</Text>
                  </Text>
                </View>

                {/* OTP Input */}
                <OtpInput
                  value={otpValue}
                  onChange={setOtpValue}
                  error={error ?? undefined}
                />

                {/* Resend OTP countdown */}
                <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
                  {canResend ? (
                    <Pressable onPress={handleResendOtp} hitSlop={8}>
                      <Text
                        style={[
                          typo.labelLarge,
                          { color: colors.primary, textDecorationLine: 'underline' },
                        ]}
                      >
                        Gửi lại mã xác nhận
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                      Gửi lại mã sau{' '}
                      <Text style={{ color: colors.primary, fontWeight: '700' }}>
                        {countdown}s
                      </Text>
                    </Text>
                  )}
                </View>

                {/* Submit OTP */}
                <PrimaryButton
                  title="Xác nhận & Bắt đầu"
                  onPress={onOtpSubmit}
                  loading={isLoading}
                  disabled={otpValue.length !== 6}
                />
              </Animated.View>
            ) : (
              <>

            {/* Full name */}
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <Controller
                control={control}
                name="fullName"
                render={({ field: { onChange, value } }) => (
                  <AppTextField
                    label="Họ và tên"
                    value={value}
                    onChangeText={onChange}
                    error={errors.fullName?.message}
                    leftIcon="account-outline"
                    autoCapitalize="words"
                    autoComplete="name"
                    textContentType="name"
                  />
                )}
              />
            </Animated.View>

            {/* Email */}
            <Animated.View entering={FadeInDown.delay(150).duration(400)}>
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

            {/* Phone */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, value } }) => (
                  <AppTextField
                    label="Số điện thoại"
                    value={value}
                    onChangeText={onChange}
                    error={errors.phone?.message}
                    leftIcon="phone-outline"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                  />
                )}
              />
            </Animated.View>

            {/* Password + strength bar */}
            <Animated.View entering={FadeInDown.delay(250).duration(400)}>
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
                    autoComplete="new-password"
                    textContentType="newPassword"
                  />
                )}
              />
              <PasswordStrengthBar password={password} />
            </Animated.View>

            {/* Confirm password */}
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, value } }) => (
                  <AppTextField
                    label="Xác nhận mật khẩu"
                    value={value}
                    onChangeText={onChange}
                    error={errors.confirmPassword?.message}
                    leftIcon="lock-check-outline"
                    rightIcon={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                    onRightIconPress={() => setShowConfirm(!showConfirm)}
                    secureTextEntry={!showConfirm}
                  />
                )}
              />
            </Animated.View>

            {/* Pet preference chips */}
            <Animated.View entering={FadeInDown.delay(350).duration(400)}>
              <Text
                style={[
                  typo.labelLarge,
                  { color: colors.text, marginBottom: spacing.sm },
                ]}
              >
                Bạn nuôi loài nào? (tuỳ chọn)
              </Text>
              <Controller
                control={control}
                name="petPreferences"
                render={({ field: { onChange, value } }) => (
                  <View style={[styles.chipRow, { marginBottom: spacing.md }]}>
                    {PET_OPTIONS.map((opt) => {
                      const selected = value?.includes(opt.value) ?? false;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => {
                            void Haptics.selectionAsync();
                            const newVal = selected
                              ? (value ?? []).filter((v) => v !== opt.value)
                              : [...(value ?? []), opt.value];
                            onChange(newVal);
                          }}
                          accessibilityLabel={opt.label}
                          accessibilityState={{ selected }}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: selected
                                ? colors.primaryContainer
                                : colors.surface,
                              borderColor: selected
                                ? colors.primary
                                : colors.border,
                              borderRadius: radius.full,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={opt.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                            size={18}
                            color={selected ? colors.primary : colors.textSecondary}
                          />
                          <Text
                            style={[
                              typo.labelMedium,
                              {
                                color: selected
                                  ? colors.primary
                                  : colors.textSecondary,
                                marginLeft: spacing.xs,
                              },
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              />
            </Animated.View>

            {/* Terms checkbox */}
            <Animated.View entering={FadeInDown.delay(400).duration(400)}>
              <Controller
                control={control}
                name="agreeTerms"
                render={({ field: { onChange, value } }) => (
                  <Pressable
                    onPress={() => onChange(!value)}
                    style={[styles.checkboxRow, { marginBottom: spacing.md }]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: value as boolean }}
                  >
                    <MaterialCommunityIcons
                      name={value ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={24}
                      color={
                        errors.agreeTerms
                          ? colors.error
                          : value
                            ? colors.primary
                            : colors.textTertiary
                      }
                    />
                    <Text
                      style={[
                        typo.bodySmall,
                        {
                          color: colors.textSecondary,
                          marginLeft: spacing.sm,
                          flex: 1,
                        },
                      ]}
                    >
                      Tôi đồng ý với{' '}
                      <Text style={{ color: colors.primary }}>
                        Điều khoản dịch vụ
                      </Text>{' '}
                      &{' '}
                      <Text style={{ color: colors.primary }}>
                        Chính sách bảo mật
                      </Text>
                    </Text>
                  </Pressable>
                )}
              />
              {errors.agreeTerms ? (
                <Text
                  style={[
                    typo.bodySmall,
                    {
                      color: colors.error,
                      marginBottom: spacing.md,
                      marginLeft: spacing.xl,
                    },
                  ]}
                >
                  {errors.agreeTerms.message}
                </Text>
              ) : null}
            </Animated.View>

            {/* Register button */}
            <Animated.View entering={FadeInDown.delay(450).duration(400)}>
              <PrimaryButton
                title="Đăng ký"
                onPress={handleSubmit(onSubmit)}
                loading={isLoading}
              />
            </Animated.View>

            {/* Login link */}
            <Pressable
              onPress={handleLogin}
              style={[styles.footer, { minHeight: 48, marginTop: spacing.lg }]}
              accessibilityLabel="Đã có tài khoản? Đăng nhập"
            >
              <Text style={[typo.bodyMedium, { color: colors.textSecondary }]}>
                Đã có tài khoản?{' '}
                <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
                  Đăng nhập
                </Text>
              </Text>
            </Pressable>
            </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  formContainer: { marginTop: -16 },
  errorBanner: { flexDirection: 'row', alignItems: 'center' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  footer: { alignItems: 'center', justifyContent: 'center' },
});

