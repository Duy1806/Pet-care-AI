/**
 * PawCare AI — Care Reminder Supabase Repository
 *
 * Implements real-time persistence of care schedule items with soft-delete
 * and offline/mock resilience using local SQLite table 'reminders' and SyncEngine.
 */
import { supabase, ExpoSecureStoreAdapter } from '../remote/supabaseClient';
import { mapSupabaseError } from '../remote/supabaseErrors';
import { getDatabase } from '../local/database';
import { CareReminderDao } from '../local/CareReminderDao';
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

      // Mirror to local SQLite
      try {
        const db = await getDatabase();
        const dao = new CareReminderDao(db);
        for (const row of data || []) {
          await dao.upsertFromRemote(row);
        }
      } catch {}

      const results: CareReminder[] = (data || []).map((row: any) => {
        const timePart = row.remind_at
          ? new Date(row.remind_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
          : '08:00';
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

      return results.filter((r) => r.date === date);
    } catch {
      // Offline fallback: load from local SQLite table 'reminders'
      try {
        const db = await getDatabase();
        const dao = new CareReminderDao(db);
        const locals = await dao.getByPetIdAndDate(petId, date);
        return locals.map((row) => {
          const timePart = row.remind_at
            ? new Date(row.remind_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
            : '08:00';
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
            date,
            createdAt: row.created_at,
          };
        });
      } catch {
        return [];
      }
    }
  }

  async getAllByPetId(petId: string): Promise<CareReminder[]> {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('pet_id', petId)
        .is('deleted_at', null)
        .order('remind_at', { ascending: false });

      if (error) {
        throw new Error(mapSupabaseError(error));
      }

      return (data || []).map((row: any) => {
        const timePart = row.remind_at
          ? new Date(row.remind_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
          : '08:00';
        const datePart = row.remind_at ? row.remind_at.split('T')[0] : '';
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
    } catch {
      try {
        const db = await getDatabase();
        const dao = new CareReminderDao(db);
        const locals = await dao.getByPetId(petId);
        return locals.map((row) => {
          const timePart = row.remind_at
            ? new Date(row.remind_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
            : '08:00';
          const datePart = row.remind_at ? row.remind_at.split('T')[0] : '';
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
      } catch {
        return [];
      }
    }
  }

  async create(reminder: Omit<CareReminder, 'id' | 'createdAt'>): Promise<CareReminder> {
    // Resolve current user ID
    let currentUserId: string | null = null;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      currentUserId = sessionData?.session?.user?.id || null;
    } catch {}
    if (!currentUserId) {
      try {
        const cached = await ExpoSecureStoreAdapter.getItem('petcare_last_user_session');
        if (cached) currentUserId = JSON.parse(cached)?.user?.id || null;
      } catch {}
    }
    const resolvedOwnerId = currentUserId || reminder.ownerId || 'guest_local_user';

    // Build remind_at ISO timestamp
    const [hStr, mStr] = reminder.time.split(':');
    const [yStr, monStr, dStr] = reminder.date.split('-');
    const remindDate = new Date(
      parseInt(yStr, 10),
      parseInt(monStr, 10) - 1,
      parseInt(dStr, 10),
      parseInt(hStr || '8', 10),
      parseInt(mStr || '0', 10),
      0,
    );
    const remindAtIso = remindDate.toISOString();

    const VALID_SUPABASE_KINDS = ['vaccination', 'deworming', 'recheck', 'custom'];
    const supabaseKind = VALID_SUPABASE_KINDS.includes(reminder.category) ? reminder.category : 'custom';

    try {
      const rowToInsert = {
        pet_id: reminder.petId,
        owner_id: resolvedOwnerId,
        kind: supabaseKind,
        title: reminder.title,
        remind_at: remindAtIso,
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

      // Cache into local SQLite
      try {
        const db = await getDatabase();
        const dao = new CareReminderDao(db);
        await dao.upsertFromRemote(data);
      } catch {}

      return {
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
    } catch {
      // Offline fallback: save to local SQLite with outbox queue
      try {
        const db = await getDatabase();
        const dao = new CareReminderDao(db);
        const local = await dao.create({
          petId: reminder.petId,
          ownerId: resolvedOwnerId,
          kind: reminder.category || 'custom',
          title: reminder.title,
          remindAt: remindAtIso,
          repeatRule: 'none',
          isDone: reminder.isDone,
        });

        return {
          id: local.id,
          petId: local.pet_id,
          ownerId: local.owner_id,
          title: local.title,
          time: reminder.time,
          category: reminder.category,
          icon: reminder.icon,
          isDone: Boolean(local.is_done),
          date: reminder.date,
          createdAt: local.created_at,
        };
      } catch (err: any) {
        throw new Error(err.message || 'Không thể lưu lịch chăm sóc ngoại tuyến');
      }
    }
  }

  async updateDone(id: string, isDone: boolean): Promise<void> {
    // 1. Update in local SQLite with outbox queue
    try {
      const db = await getDatabase();
      const dao = new CareReminderDao(db);
      await dao.updateDone(id, isDone);
    } catch {}

    // 2. If online, also update Supabase directly
    if (UUID_REGEX.test(id)) {
      try {
        await supabase
          .from('reminders')
          .update({ is_done: isDone })
          .eq('id', id);
      } catch {
        // Ignored; SyncEngine will sync when network is restored
      }
    }
  }

  async delete(id: string): Promise<void> {
    // 1. Soft-delete in local SQLite with outbox queue
    try {
      const db = await getDatabase();
      const dao = new CareReminderDao(db);
      await dao.softDelete(id);
    } catch {}

    // 2. If online, also soft-delete in Supabase
    if (UUID_REGEX.test(id)) {
      try {
        await supabase
          .from('reminders')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', id);
      } catch {
        // Ignored; SyncEngine will sync when network is restored
      }
    }
  }
}

export const careReminderRepository = new CareReminderRepositorySupabase();

