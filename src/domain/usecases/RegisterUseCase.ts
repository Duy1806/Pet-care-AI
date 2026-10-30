/**
 * PawCare AI — Register Use Case
 */
import type { LoginResult, RegisterResult } from '../entities/User';
import type { AuthRepository, SignUpParams } from '../repositories/AuthRepository';

export class RegisterUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(params: SignUpParams): Promise<RegisterResult> {
    if (!params.fullName.trim()) throw new Error('Họ và tên không được để trống');
    if (!params.email.trim()) throw new Error('Email không được để trống');
    if (!params.password) throw new Error('Mật khẩu không được để trống');
    if (params.password.length < 8) throw new Error('Mật khẩu phải có ít nhất 8 ký tự');
    return this.authRepository.signUp({
      ...params,
      email: params.email.trim().toLowerCase(),
      fullName: params.fullName.trim(),
    });
  }

  async verifyOtp(email: string, otp: string): Promise<LoginResult> {
    if (!email.trim()) throw new Error('Email không được để trống');
    if (!otp.trim() || otp.length !== 6) throw new Error('Mã OTP phải có đúng 6 chữ số');
    return this.authRepository.verifySignUpOtp(email.trim().toLowerCase(), otp.trim());
  }

  async resendOtp(email: string): Promise<void> {
    if (!email.trim()) throw new Error('Email không được để trống');
    return this.authRepository.resendSignUpOtp(email.trim().toLowerCase());
  }
}
