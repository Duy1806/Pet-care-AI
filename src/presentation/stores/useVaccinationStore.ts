/**
 * PawCare AI — Vaccination Store
 *
 * Manages vaccination records, user-provided health history, and automatic reminders.
 */
import { create } from 'zustand';
import type {
  CreateVaccinationParams,
  VaccinationAlert,
  VaccinationRecord,
} from '../../domain/entities/Vaccination';
import type { Pet } from '../../domain/entities/Pet';
import { vaccinationRepository } from '../../di/container';

interface VaccinationState {
  records: VaccinationRecord[];
  alerts: VaccinationAlert[];
  isLoading: boolean;
  error: string | null;

  loadVaccinations: (petId: string) => Promise<void>;
  loadAlerts: (pets: Pet[]) => Promise<void>;
  addVaccination: (params: CreateVaccinationParams) => Promise<boolean>;
  deleteVaccination: (id: string, petId: string) => Promise<boolean>;
  clearError: () => void;
}

export const useVaccinationStore = create<VaccinationState>((set) => ({
  records: [],
  alerts: [],
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  loadVaccinations: async (petId: string) => {
    if (!petId) return;
    try {
      set({ isLoading: true, error: null });
      const records = await vaccinationRepository.getByPetId(petId);
      set({ records, isLoading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể tải sổ tiêm chủng.';
      set({ error: msg, isLoading: false });
    }
  },

  loadAlerts: async (pets: Pet[]) => {
    if (!pets || pets.length === 0) {
      set({ alerts: [] });
      return;
    }

    try {
      const petIds = pets.map((p) => p.id);
      const petMap = new Map(pets.map((p) => [p.id, p]));
      const rawRecords = await vaccinationRepository.getUpcomingAlerts(petIds);

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const alerts: VaccinationAlert[] = [];

      for (const rec of rawRecords) {
        if (!rec.nextDueAt) continue;

        const dueDate = new Date(rec.nextDueAt);
        dueDate.setHours(0, 0, 0, 0);

        const diffTime = dueDate.getTime() - now.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        // Alert if overdue (diffDays < 0) or due within the next 30 days
        if (diffDays <= 30) {
          const pet = petMap.get(rec.petId);
          alerts.push({
            record: rec,
            petName: pet?.name || 'Thú cưng',
            petSpecies: pet?.species || 'other',
            status: diffDays < 0 ? 'overdue' : diffDays === 0 ? 'today' : 'upcoming',
            daysDiff: diffDays,
          });
        }
      }

      // Sort by urgency: overdue first, then today, then upcoming
      alerts.sort((a, b) => a.daysDiff - b.daysDiff);

      set({ alerts });
    } catch {
      // Background alert calculation should not block the UI
    }
  },

  addVaccination: async (params: CreateVaccinationParams) => {
    try {
      set({ isLoading: true, error: null });
      const newRecord = await vaccinationRepository.create(params);
      set((state) => ({
        records: [newRecord, ...state.records],
        isLoading: false,
      }));
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể lưu mũi tiêm.';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  deleteVaccination: async (id: string, petId: string) => {
    try {
      set({ isLoading: true, error: null });
      await vaccinationRepository.delete(id);
      set((state) => ({
        records: state.records.filter((r) => r.id !== id),
        alerts: state.alerts.filter((a) => a.record.id !== id),
        isLoading: false,
      }));
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể xóa mũi tiêm.';
      set({ error: msg, isLoading: false });
      return false;
    }
  },
}));
