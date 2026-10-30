/**
 * PawCare AI — Breed Repository Interface
 */
import type { Breed } from '../entities/Breed';

export interface BreedRepository {
  getAll(species?: string): Promise<Breed[]>;
  getById(id: string): Promise<Breed | null>;
}

