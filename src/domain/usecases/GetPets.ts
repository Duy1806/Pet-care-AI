import type { Pet } from '../entities/Pet';
import type { PetRepository } from '../repositories/PetRepository';

export class GetPets {
  constructor(private readonly repo: PetRepository) {}

  execute(): Promise<Pet[]> {
    return this.repo.getAll();
  }
}