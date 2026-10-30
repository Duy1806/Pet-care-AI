/**
 * PawCare AI — Forgot Password Use Case
 * Orchestrates the 3 server calls in the password reset flow.
 */
import type { AuthRepository } from '../repositories/AuthRepository';

export class ForgotPasswordUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  /** Step 1: Send the OTP to the user's email */
  async sendCode(email: string): Promise<void> {
    if (!email.trim()) throw new Error('Email không được để trống');
    return this.authRepository.sendPasswordResetCode(email.trim().toLowerCase());
  }

  /** Step 2: Verify the OTP code */
  async verifyOtp(email: string, otp: string): Promise<void> {
    if (otp.length !== 6) throw new Error('Mã xác nhận phải có 6 chữ số');
    return this.authRepository.verifyResetOtp(email.trim().toLowerCase(), otp);
  }

  /** Step 3: Set a new password */
  async resetPassword(email: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) throw new Error('Mật khẩu mới phải có ít nhất 8 ký tự');
    return this.authRepository.resetPassword(email.trim().toLowerCase(), newPassword);
  }
}
