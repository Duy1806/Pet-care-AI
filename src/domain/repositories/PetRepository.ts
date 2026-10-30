/**
 * PawCare AI — Pet Repository Interface
 */
import type { Pet } from '../entities/Pet';

export type CreatePetInput = Omit<Pet, 'id' | 'createdAt'>;

export interface PetRepository {
  getAll(): Promise<Pet[]>;
  getById(id: string): Promise<Pet | null>;
  create(input: CreatePetInput): Promise<Pet>;
  update(id: string, input: Partial<CreatePetInput>): Promise<Pet>;
  delete(id: string): Promise<void>;
}
