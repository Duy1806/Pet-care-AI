/**
 * PawCare AI — Pet Management Store (Zustand)
 *
 * Manages user's real pet list, active pet selection, and CRUD operations.
 */
import { create } from 'zustand';
import type { Pet } from '@/domain/entities/Pet';
import type { CreatePetInput } from '@/domain/repositories/PetRepository';
import { petRepository } from '@/di/container';

interface PetState {
  pets: Pet[];
  selectedPet: Pet | null;
  isLoading: boolean;
  error: string | null;

  loadPets: () => Promise<void>;
  selectPet: (pet: Pet) => void;
  addPet: (input: CreatePetInput) => Promise<Pet>;
  updatePet: (id: string, input: Partial<CreatePetInput>) => Promise<Pet>;
  deletePet: (id: string) => Promise<void>;
  clearError: () => void;
}

export const usePetStore = create<PetState>((set, get) => ({
  pets: [],
  selectedPet: null,
  isLoading: false,
  error: null,

  loadPets: async () => {
    try {
      set({ isLoading: true, error: null });
      const fetchedPets = await petRepository.getAll();
      set({
        pets: fetchedPets,
        selectedPet: get().selectedPet || (fetchedPets.length > 0 ? fetchedPets[0] : null),
        isLoading: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể tải danh sách thú cưng';
      set({ isLoading: false, error: msg });
    }
  },

  selectPet: (pet: Pet) => {
    set({ selectedPet: pet });
  },

  addPet: async (input: CreatePetInput) => {
    try {
      set({ isLoading: true, error: null });
      const created = await petRepository.create(input);
      const updatedList = [created, ...get().pets];
      set({
        pets: updatedList,
        selectedPet: created,
        isLoading: false,
      });
      return created;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể thêm thú cưng';
      set({ isLoading: false, error: msg });
      throw e;
    }
  },

  updatePet: async (id: string, input: Partial<CreatePetInput>) => {
    try {
      set({ isLoading: true, error: null });
      const updated = await petRepository.update(id, input);
      const updatedList = get().pets.map((p) => (p.id === id ? updated : p));
      set({
        pets: updatedList,
        selectedPet: get().selectedPet?.id === id ? updated : get().selectedPet,
        isLoading: false,
      });
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể cập nhật thú cưng';
      set({ isLoading: false, error: msg });
      throw e;
    }
  },

  deletePet: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      await petRepository.delete(id);
      const remaining = get().pets.filter((p) => p.id !== id);
      set({
        pets: remaining,
        selectedPet: get().selectedPet?.id === id ? (remaining[0] || null) : get().selectedPet,
        isLoading: false,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể xóa thú cưng';
      set({ isLoading: false, error: msg });
      throw e;
    }
  },

  clearError: () => set({ error: null }),
}));

