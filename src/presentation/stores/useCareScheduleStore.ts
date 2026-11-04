/**
 * PawCare AI — Care Schedule Store (Zustand)
 *
 * Manages daily care tasks per pet, custom scheduling by owner,
 * and comprehensive care history tracking (food, activities, meds by date).
 */
import { create } from 'zustand';
import type { CareCategory, CareReminder, CareSuggestion } from '@/domain/entities/CareReminder';
import { careReminderRepository } from '@/data/repositories/CareReminderRepositorySupabase';

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

interface CareScheduleState {
  reminders: CareReminder[];
  isLoading: boolean;
  activePetId: string | null;

  // Care History state
  isCareHistoryModalOpen: boolean;
  selectedHistoryDate: string;
  historyReminders: CareReminder[];
  allHistoryRecords: CareReminder[];
  isHistoryLoading: boolean;

  // Actions
  loadReminders: (petId: string, date?: string) => Promise<void>;
  addReminder: (params: {
    petId: string;
    title: string;
    time: string;
    category: CareCategory;
    icon: string;
    date?: string;
  }) => Promise<CareReminder>;
  addQuickSuggestion: (petId: string, suggestion: CareSuggestion, date?: string) => Promise<void>;
  toggleReminder: (id: string) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;

  // History Actions
  openCareHistoryModal: () => void;
  closeCareHistoryModal: () => void;
  setSelectedHistoryDate: (date: string) => Promise<void>;
  loadHistoryForDate: (petId: string, date: string) => Promise<void>;
  loadAllHistory: (petId: string) => Promise<void>;
}

export const useCareScheduleStore = create<CareScheduleState>((set, get) => ({
  reminders: [],
  isLoading: false,
  activePetId: null,

  isCareHistoryModalOpen: false,
  selectedHistoryDate: getTodayString(),
  historyReminders: [],
  allHistoryRecords: [],
  isHistoryLoading: false,

  openCareHistoryModal: () => {
    set({ isCareHistoryModalOpen: true });
    const petId = get().activePetId;
    if (petId) {
      void get().loadAllHistory(petId);
      void get().loadHistoryForDate(petId, get().selectedHistoryDate);
    }
  },

  closeCareHistoryModal: () => set({ isCareHistoryModalOpen: false }),

  setSelectedHistoryDate: async (date: string) => {
    set({ selectedHistoryDate: date });
    const petId = get().activePetId;
    if (petId) {
      await get().loadHistoryForDate(petId, date);
    }
  },

  loadHistoryForDate: async (petId: string, date: string) => {
    if (!petId) return;
    set({ isHistoryLoading: true });
    try {
      const list = await careReminderRepository.getByPetIdAndDate(petId, date);
      set({ historyReminders: list, isHistoryLoading: false });
    } catch {
      set({ isHistoryLoading: false });
    }
  },

  loadAllHistory: async (petId: string) => {
    if (!petId) return;
    try {
      const all = await careReminderRepository.getAllByPetId(petId);
      set({ allHistoryRecords: all });
    } catch (e) {
      console.warn('[useCareScheduleStore] loadAllHistory error:', e);
    }
  },

  loadReminders: async (petId: string, date?: string) => {
    if (!petId) {
      set({ reminders: [], activePetId: null });
      return;
    }

    const targetDate = date || getTodayString();
    set({ isLoading: true, activePetId: petId });

    try {
      const list = await careReminderRepository.getByPetIdAndDate(petId, targetDate);
      set({ reminders: list, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addReminder: async (params) => {
    const targetDate = params.date || getTodayString();
    const created = await careReminderRepository.create({
      petId: params.petId,
      title: params.title,
      time: params.time,
      category: params.category,
      icon: params.icon,
      isDone: false,
      date: targetDate,
    });

    const isCurrentDate = targetDate === getTodayString();

    set((state) => ({
      reminders: isCurrentDate
        ? [...state.reminders, created].sort((a, b) => a.time.localeCompare(b.time))
        : state.reminders,
      historyReminders:
        targetDate === state.selectedHistoryDate
          ? [...state.historyReminders, created].sort((a, b) => a.time.localeCompare(b.time))
          : state.historyReminders,
      allHistoryRecords: [created, ...state.allHistoryRecords],
    }));

    return created;
  },

  addQuickSuggestion: async (petId: string, suggestion: CareSuggestion, date?: string) => {
    const targetDate = date || getTodayString();

    // Prevent duplicate suggestions with identical title & time
    const exists = get().reminders.some(
      (r) => r.title === suggestion.title && r.time === suggestion.time
    );
    if (exists) return;

    const created = await careReminderRepository.create({
      petId,
      title: suggestion.title,
      time: suggestion.time,
      category: suggestion.category,
      icon: suggestion.icon,
      isDone: false,
      date: targetDate,
    });

    const isCurrentDate = targetDate === getTodayString();

    set((state) => ({
      reminders: isCurrentDate
        ? [...state.reminders, created].sort((a, b) => a.time.localeCompare(b.time))
        : state.reminders,
      historyReminders:
        targetDate === state.selectedHistoryDate
          ? [...state.historyReminders, created].sort((a, b) => a.time.localeCompare(b.time))
          : state.historyReminders,
      allHistoryRecords: [created, ...state.allHistoryRecords],
    }));
  },

  toggleReminder: async (id: string) => {
    const currentList = get().reminders;
    const historyList = get().historyReminders;

    const target = currentList.find((r) => r.id === id) || historyList.find((r) => r.id === id);
    if (!target) return;

    const newDone = !target.isDone;

    // Optimistic UI update on both today's list and history view
    set({
      reminders: currentList.map((r) => (r.id === id ? { ...r, isDone: newDone } : r)),
      historyReminders: historyList.map((r) => (r.id === id ? { ...r, isDone: newDone } : r)),
      allHistoryRecords: get().allHistoryRecords.map((r) =>
        r.id === id ? { ...r, isDone: newDone } : r
      ),
    });

    await careReminderRepository.updateDone(id, newDone);
  },

  deleteReminder: async (id: string) => {
    set((state) => ({
      reminders: state.reminders.filter((r) => r.id !== id),
      historyReminders: state.historyReminders.filter((r) => r.id !== id),
      allHistoryRecords: state.allHistoryRecords.filter((r) => r.id !== id),
    }));

    await careReminderRepository.delete(id);
  },
}));
