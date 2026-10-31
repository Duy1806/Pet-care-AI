/**
 * PawCare AI — Care Schedule Store (Zustand)
 *
 * Manages daily care tasks per pet, custom scheduling by owner,
 * and smart care suggestions.
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
}

export const useCareScheduleStore = create<CareScheduleState>((set, get) => ({
  reminders: [],
  isLoading: false,
  activePetId: null,

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

    set((state) => ({
      reminders: [...state.reminders, created].sort((a, b) => a.time.localeCompare(b.time)),
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

    set((state) => ({
      reminders: [...state.reminders, created].sort((a, b) => a.time.localeCompare(b.time)),
    }));
  },

  toggleReminder: async (id: string) => {
    const currentList = get().reminders;
    const target = currentList.find((r) => r.id === id);
    if (!target) return;

    const newDone = !target.isDone;

    // Optimistic UI update
    set({
      reminders: currentList.map((r) => (r.id === id ? { ...r, isDone: newDone } : r)),
    });

    await careReminderRepository.updateDone(id, newDone);
  },

  deleteReminder: async (id: string) => {
    set((state) => ({
      reminders: state.reminders.filter((r) => r.id !== id),
    }));

    await careReminderRepository.delete(id);
  },
}));

