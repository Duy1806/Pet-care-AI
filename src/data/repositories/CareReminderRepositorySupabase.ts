/**
 * PawCare AI — Care Reminder Supabase Repository
 *
 * Implements real-time persistence of care schedule items with soft-delete
 * and offline/mock resilience.
 */
import { supabase } from '../remote/supabaseClient';
import { mapSupabaseError } from '../remote/supabaseErrors';
import type { CareCategory, CareReminder } from '@/domain/entities/CareReminder';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// In-memory local cache for instant UI and non-UUID demo pets
const localMemoryStore: Map<string, CareReminder[]> = new Map();

function getCategoryIcon(kind: string, rawTitle: string): string {
  const t = rawTitle.toLowerCase();
  if (t.includes('nước')) return 'water-pump';
  if (t.includes('thuốc') || t.includes('vitamin') || t.includes('men') || t.includes('gel')) return 'pill';
  if (t.includes('ăn') || t.includes('bữa') || t.includes('hạt') || t.includes('pate')) return 'food-drumstick';
  if (t.includes('dạo') || t.includes('vận động') || t.includes('chạy') || t.includes('chơi')) return 'run-fast';
  if (t.includes('chải') || t.includes('tắm') || t.includes('lông')) return 'brush';
  if (t.includes('răng') || t.includes('nướu')) return 'tooth-outline';
  if (t.includes('cát') || t.includes('vệ sinh')) return 'tray-full';

  switch (kind) {
    case 'feeding':
      return 'food-drumstick';
    case 'medication':
      return 'pill';
    case 'exercise':
      return 'run-fast';
    case 'grooming':
      return 'brush';
    case 'hygiene':
      return 'sparkles';
    case 'water':
      return 'water-pump';
    default:
      return 'clock-check-outline';
  }
}

export class CareReminderRepositorySupabase {
  async getByPetIdAndDate(petId: string, date: string): Promise<CareReminder[]> {
    // If not a UUID (e.g. demo pet), return from memory
    if (!UUID_REGEX.test(petId)) {
      const list = localMemoryStore.get(petId) || [];
      return list.filter((r) => r.date === date);
    }

    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('pet_id', petId)
        .is('deleted_at', null)
        .order('remind_at', { ascending: true });

      if (error) {
        throw new Error(mapSupabaseError(error));
      }

      const results: CareReminder[] = (data || []).map((row: any) => {
        const timePart = row.remind_at ? new Date(row.remind_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '08:00';
        const datePart = row.remind_at ? row.remind_at.split('T')[0] : date;
        const kind = (row.kind as CareCategory) || 'other';

        return {
          id: row.id,
          petId: row.pet_id,
          ownerId: row.owner_id,
          title: row.title,
          time: timePart,
          category: kind,
          icon: getCategoryIcon(kind, row.title),
          isDone: Boolean(row.is_done),
          date: datePart,
          createdAt: row.created_at,
        };
      });

      // Filter by the requested day (e.g. today)
      return results.filter((r) => r.date === date);
    } catch {
      // Fallback to local cache on error
      const list = localMemoryStore.get(petId) || [];
      return list.filter((r) => r.date === date);
    }
  }

  async create(reminder: Omit<CareReminder, 'id' | 'createdAt'>): Promise<CareReminder> {
    const id = UUID_REGEX.test(reminder.petId)
      ? 'tmp_' + Date.now() + Math.random().toString(36).substring(2, 6)
      : 'local_' + Date.now();

    const createdItem: CareReminder = {
      ...reminder,
      id,
      createdAt: new Date().toISOString(),
    };

    // If not a valid UUID, store locally in memory
    if (!UUID_REGEX.test(reminder.petId)) {
      const current = localMemoryStore.get(reminder.petId) || [];
      localMemoryStore.set(reminder.petId, [createdItem, ...current]);
      return createdItem;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id;

      if (!currentUserId) {
        const current = localMemoryStore.get(reminder.petId) || [];
        localMemoryStore.set(reminder.petId, [createdItem, ...current]);
        return createdItem;
      }

      // Build remind_at ISO timestamp
      const [hStr, mStr] = reminder.time.split(':');
      const [yStr, monStr, dStr] = reminder.date.split('-');
      const remindDate = new Date(
        parseInt(yStr, 10),
        parseInt(monStr, 10) - 1,
        parseInt(dStr, 10),
        parseInt(hStr || '8', 10),
        parseInt(mStr || '0', 10),
        0
      );

      const rowToInsert = {
        pet_id: reminder.petId,
        owner_id: currentUserId,
        kind: 'custom',
        title: reminder.title,
        remind_at: remindDate.toISOString(),
        repeat_rule: 'none',
        is_done: reminder.isDone,
      };

      const { data, error } = await supabase
        .from('reminders')
        .insert(rowToInsert)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(mapSupabaseError(error));
      }

      const realItem: CareReminder = {
        id: data.id,
        petId: data.pet_id,
        ownerId: data.owner_id,
        title: data.title,
        time: reminder.time,
        category: reminder.category,
        icon: reminder.icon,
        isDone: Boolean(data.is_done),
        date: reminder.date,
        createdAt: data.created_at,
      };

      const current = localMemoryStore.get(reminder.petId) || [];
      localMemoryStore.set(reminder.petId, [realItem, ...current]);
      return realItem;
    } catch {
      // Return optimistic item if network fails
      const current = localMemoryStore.get(reminder.petId) || [];
      localMemoryStore.set(reminder.petId, [createdItem, ...current]);
      return createdItem;
    }
  }

  async updateDone(id: string, isDone: boolean): Promise<void> {
    // Update in local memory
    for (const [petId, list] of localMemoryStore.entries()) {
      localMemoryStore.set(
        petId,
        list.map((item) => (item.id === id ? { ...item, isDone } : item))
      );
    }

    if (!UUID_REGEX.test(id)) return;

    try {
      await supabase
        .from('reminders')
        .update({ is_done: isDone })
        .eq('id', id);
    } catch {
      // Ignored
    }
  }

  async delete(id: string): Promise<void> {
    // Remove from local memory
    for (const [petId, list] of localMemoryStore.entries()) {
      localMemoryStore.set(
        petId,
        list.filter((item) => item.id !== id)
      );
    }

    if (!UUID_REGEX.test(id)) return;

    try {
      await supabase
        .from('reminders')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
    } catch {
      // Ignored
    }
  }
}

export const careReminderRepository = new CareReminderRepositorySupabase();

