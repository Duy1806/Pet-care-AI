/**
 * PawCare AI — Pet Domain Entity
 */
export type Species = 'dog' | 'cat' | 'other';

export interface Pet {
  id: string;
  ownerId?: string;
  name: string;
  species: Species;
  breed?: string;
  breedId?: string | null;
  breedName?: string | null;
  sex?: 'male' | 'female' | 'unknown';
  isNeutered?: boolean;
  birthDate?: string | null;
  weightKg: number;
  activityLevel?: 'low' | 'moderate' | 'high';
  photoUrl?: string | null;
  notes?: string | null;
  createdAt?: string;
}
