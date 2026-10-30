/**
 * PawCare AI — Zod Validation Schemas
 *
 * All validation messages are in Vietnamese.
 * Used with react-hook-form via @hookform/resolvers.
 */
import { z } from 'zod';

/** Vietnamese phone number regex (10 digits starting with 0) */
const vnPhoneRegex = /^0\d{9}$/;

/** Password must be >= 8 chars with upper, lower, and digit */
const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
  .regex(/[a-z]/, 'Mật khẩu phải có ít nhất 1 chữ thường')
  .regex(/\d/, 'Mật khẩu phải có ít nhất 1 chữ số');

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email không được để trống')
    .email('Email không hợp lệ'),
  password: z.string().min(1, 'Mật khẩu không được để trống'),
  rememberMe: z.boolean().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(1, 'Họ và tên không được để trống')
      .min(2, 'Họ và tên phải có ít nhất 2 ký tự'),
    email: z
      .string()
      .min(1, 'Email không được để trống')
      .email('Email không hợp lệ'),
    phone: z
      .string()
      .min(1, 'Số điện thoại không được để trống')
      .regex(vnPhoneRegex, 'Số điện thoại không hợp lệ (VD: 0901234567)'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
    agreeTerms: z.literal(true, {
      message: 'Bạn phải đồng ý với Điều khoản & Chính sách bảo mật',
    }),
    petPreferences: z.array(z.enum(['dog', 'cat', 'other'])).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

export const forgotPasswordEmailSchema = z.object({
  email: z
    .string()
    .min(1, 'Email không được để trống')
    .email('Email không hợp lệ'),
});

export type ForgotPasswordEmailData = z.infer<typeof forgotPasswordEmailSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

/**
 * Evaluate password strength for the meter UI.
 * Returns 0 (empty), 1 (weak), 2 (medium), 3 (strong).
 */
export function getPasswordStrength(password: string): 0 | 1 | 2 | 3 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return score as 0 | 1 | 2 | 3;
}

/** Vietnamese labels for password strength levels */
export const strengthLabels: Record<0 | 1 | 2 | 3, string> = {
  0: '',
  1: 'Yếu',
  2: 'Trung bình',
  3: 'Mạnh',
};

/** Colors for password strength (use theme colors where possible) */
export const strengthColors: Record<0 | 1 | 2 | 3, string> = {
  0: 'transparent',
  1: '#DC2626',
  2: '#D97706',
  3: '#059669',
};

