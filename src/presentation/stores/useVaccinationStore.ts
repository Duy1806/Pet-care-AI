/**
 * PawCare AI — Vaccination Store
 *
 * Manages vaccination records, user-provided health history, and automatic reminders.
 * Schedules local notifications:
 * - 1 day before due date (09:00 AM)
 * - On the due date (08:00 AM)
 */
import { create } from 'zustand';
import type {
  CreateVaccinationParams,
  UpdateVaccinationParams,
  VaccinationAlert,
  VaccinationRecord,
} from '../../domain/entities/Vaccination';
import type { Pet } from '../../domain/entities/Pet';
import { vaccinationRepository } from '../../di/container';
import { NotificationService } from '../../data/services/NotificationService';

interface VaccinationState {
  records: VaccinationRecord[];
  alerts: VaccinationAlert[];
  isLoading: boolean;
  error: string | null;

  loadVaccinations: (petId: string) => Promise<void>;
  loadAlerts: (pets: Pet[]) => Promise<void>;
  addVaccination: (
    params: CreateVaccinationParams,
    petName?: string
  ) => Promise<boolean>;
  markAsCompleted: (
    record: VaccinationRecord,
    administeredAt: string,
    nextDueAt?: string | null,
    vetClinic?: string | null,
    petName?: string
  ) => Promise<boolean>;
  deleteVaccination: (id: string, petId: string) => Promise<boolean>;
  clearError: () => void;
}

export const useVaccinationStore = create<VaccinationState>((set, get) => ({
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

        const pet = petMap.get(rec.petId);

        // Schedule or refresh notifications if due date is in the future
        if (diffDays >= 0 && pet) {
          void NotificationService.scheduleVaccinationAlerts({
            recordId: rec.id,
            petId: rec.petId,
            petName: pet.name,
            vaccinationName: rec.name,
            type: rec.type,
            dueDate: rec.nextDueAt,
          });
        }

        // Alert if overdue (diffDays < 0) or due within the next 30 days
        if (diffDays <= 30) {
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

  addVaccination: async (params: CreateVaccinationParams, petName?: string) => {
    try {
      set({ isLoading: true, error: null });
      const newRecord = await vaccinationRepository.create(params);

      // Schedule reminders if due date is set
      const reminderTargetDate = params.nextDueAt || (params.status === 'planned' ? params.administeredAt : null);
      if (reminderTargetDate) {
        void NotificationService.scheduleVaccinationAlerts({
          recordId: newRecord.id,
          petId: newRecord.petId,
          petName: petName || 'Thú cưng',
          vaccinationName: newRecord.name,
          type: newRecord.type,
          dueDate: reminderTargetDate,
        });
      }

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

  markAsCompleted: async (
    record: VaccinationRecord,
    administeredAt: string,
    nextDueAt?: string | null,
    vetClinic?: string | null,
    petName?: string
  ) => {
    try {
      set({ isLoading: true, error: null });

      const updatePayload: UpdateVaccinationParams = {
        id: record.id,
        status: 'completed',
        administeredAt,
        nextDueAt: nextDueAt || null,
        vetClinic: vetClinic ?? record.vetClinic,
        note: record.note,
      };

      const updated = await vaccinationRepository.update(updatePayload);

      // Cancel previous planned reminders
      await NotificationService.cancelVaccinationAlerts(record.id);

      // If next booster date is set, schedule new reminders
      if (nextDueAt) {
        void NotificationService.scheduleVaccinationAlerts({
          recordId: updated.id,
          petId: updated.petId,
          petName: petName || 'Thú cưng',
          vaccinationName: updated.name,
          type: updated.type,
          dueDate: nextDueAt,
        });
      }

      set((state) => ({
        records: state.records.map((r) => (r.id === updated.id ? updated : r)),
        isLoading: false,
      }));
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể cập nhật trạng thái.';
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  deleteVaccination: async (id: string, _petId: string) => {
    try {
      set({ isLoading: true, error: null });

      // Cancel scheduled notifications
      void NotificationService.cancelVaccinationAlerts(id);

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
