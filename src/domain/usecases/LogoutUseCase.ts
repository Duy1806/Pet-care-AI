/**
 * PawCare AI — Logout Use Case
 */
import type { AuthRepository } from '../repositories/AuthRepository';

export class LogoutUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(): Promise<void> {
    return this.authRepository.signOut();
  }
}
