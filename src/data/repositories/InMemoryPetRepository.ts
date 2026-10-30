/**
 * PawCare AI — In-Memory Pet Repository (Mock)
 */
import type { Pet } from '../../domain/entities/Pet';
import type { PetRepository, CreatePetInput } from '../../domain/repositories/PetRepository';

export class InMemoryPetRepository implements PetRepository {
  private pets: Pet[] = [
    {
      id: '1',
      name: 'Milo',
      species: 'dog',
      breed: 'Poodle Toy',
      breedName: 'Poodle Toy',
      weightKg: 6.2,
      isNeutered: true,
      activityLevel: 'moderate',
    },
    {
      id: '2',
      name: 'Luna',
      species: 'cat',
      breed: 'Anh lông ngắn',
      breedName: 'Anh lông ngắn',
      weightKg: 4.1,
      isNeutered: true,
      activityLevel: 'low',
    },
  ];

  async getAll(): Promise<Pet[]> {
    return [...this.pets];
  }

  async getById(id: string): Promise<Pet | null> {
    return this.pets.find((p) => p.id === id) || null;
  }

  async create(input: CreatePetInput): Promise<Pet> {
    const newPet: Pet = {
      ...input,
      id: String(Date.now()),
      createdAt: new Date().toISOString(),
    };
    this.pets.push(newPet);
    return newPet;
  }

  async update(id: string, input: Partial<CreatePetInput>): Promise<Pet> {
    const index = this.pets.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error('Không tìm thấy thú cưng');
    }
    this.pets[index] = { ...this.pets[index], ...input };
    return this.pets[index];
  }

  async delete(id: string): Promise<void> {
    this.pets = this.pets.filter((p) => p.id !== id);
  }
}
