/**
 * PawCare AI — Dependency Injection Container
 *
 * Swaps mock or Supabase implementations based on EXPO_PUBLIC_USE_MOCK.
 */
import { AuthRepositoryMock } from '../data/repositories/AuthRepositoryMock';
import { AuthRepositorySupabase } from '../data/repositories/AuthRepositorySupabase';
import { InMemoryPetRepository } from '../data/repositories/InMemoryPetRepository';
import { PetRepositorySupabase } from '../data/repositories/PetRepositorySupabase';
import { BreedRepositorySupabase } from '../data/repositories/BreedRepositorySupabase';
import { VaccinationRepositorySupabase } from '../data/repositories/VaccinationRepositorySupabase';
import type { AuthRepository } from '../domain/repositories/AuthRepository';
import type { PetRepository } from '../domain/repositories/PetRepository';
import type { BreedRepository } from '../domain/repositories/BreedRepository';
import type { VaccinationRepository } from '../domain/repositories/VaccinationRepository';
import { ForgotPasswordUseCase } from '../domain/usecases/ForgotPasswordUseCase';
import { GetPets } from '../domain/usecases/GetPets';
import { LoginUseCase } from '../domain/usecases/LoginUseCase';
import { LogoutUseCase } from '../domain/usecases/LogoutUseCase';
import { RegisterUseCase } from '../domain/usecases/RegisterUseCase';
import { RestoreSessionUseCase } from '../domain/usecases/RestoreSessionUseCase';

/** Whether to use mock implementations (default: false when real Supabase is configured) */
const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

// --- Repository singletons ---

function createAuthRepository(): AuthRepository {
  if (USE_MOCK) {
    return new AuthRepositoryMock();
  }
  return new AuthRepositorySupabase();
}

function createPetRepository(): PetRepository {
  if (USE_MOCK) {
    return new InMemoryPetRepository();
  }
  return new PetRepositorySupabase();
}

function createBreedRepository(): BreedRepository {
  return new BreedRepositorySupabase();
}

function createVaccinationRepository(): VaccinationRepository {
  return new VaccinationRepositorySupabase();
}

const authRepository = createAuthRepository();
const petRepository = createPetRepository();
const breedRepository = createBreedRepository();
const vaccinationRepository = createVaccinationRepository();

// --- Use-case singletons ---

export const loginUseCase = new LoginUseCase(authRepository);
export const registerUseCase = new RegisterUseCase(authRepository);
export const forgotPasswordUseCase = new ForgotPasswordUseCase(authRepository);
export const logoutUseCase = new LogoutUseCase(authRepository);
export const restoreSessionUseCase = new RestoreSessionUseCase(authRepository);
export const getPets = new GetPets(petRepository);

// Export repository instances for direct access where needed
export { authRepository, petRepository, breedRepository, vaccinationRepository };
