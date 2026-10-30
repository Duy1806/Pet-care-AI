/**
 * PawCare AI — Login Use Case
 */
import type { LoginResult } from '../entities/User';
import type { AuthRepository } from '../repositories/AuthRepository';

export class LoginUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(email: string, password: string): Promise<LoginResult> {
    if (!email.trim()) throw new Error('Email không được để trống');
    if (!password) throw new Error('Mật khẩu không được để trống');
    return this.authRepository.signIn(email.trim().toLowerCase(), password);
  }
}
