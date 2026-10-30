/**
 * PawCare AI — Breeds Catalog Store (Zustand)
 *
 * Manages standardized breed catalog fetched from Supabase.
 */
import { create } from 'zustand';
import type { Breed } from '@/domain/entities/Breed';
import { breedRepository } from '@/di/container';

interface BreedState {
  breeds: Breed[];
  isLoading: boolean;
  error: string | null;

  loadBreeds: (species?: string) => Promise<void>;
  clearError: () => void;
}

export const useBreedStore = create<BreedState>((set) => ({
  breeds: [],
  isLoading: false,
  error: null,

  loadBreeds: async (species?: string) => {
    try {
      set({ isLoading: true, error: null });
      const list = await breedRepository.getAll(species);
      set({ breeds: list, isLoading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể tải danh mục giống loài';
      set({ isLoading: false, error: msg });
    }
  },

  clearError: () => set({ error: null }),
}));

