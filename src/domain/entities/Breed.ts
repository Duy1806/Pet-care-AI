/**
 * PawCare AI — Breed Domain Entity
 */
export interface Breed {
  id: string;
  species: 'dog' | 'cat' | 'other';
  nameEn: string;
  nameVi: string;
  sizeCategory?: 'toy' | 'small' | 'medium' | 'large' | 'giant' | null;
  typicalWeightMinKg?: number | null;
  typicalWeightMaxKg?: number | null;
  description?: string | null;
  commonHealthIssues?: string[] | null;
  imageUrl?: string | null;
}

