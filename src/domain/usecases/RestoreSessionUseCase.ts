/**
 * PawCare AI — Restore Session Use Case
 * Called on app start to restore a persisted auth session.
 */
import type { AuthSession } from '../entities/User';
import type { AuthRepository } from '../repositories/AuthRepository';

export class RestoreSessionUseCase {
  constructor(private readonly authRepository: AuthRepository) {}

  async execute(): Promise<AuthSession | null> {
    return this.authRepository.restoreSession();
  }
}
