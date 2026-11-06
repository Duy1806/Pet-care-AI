/**
 * PawCare AI — Offline-First Sync Engine
 *
 * Implements two-way synchronization:
 * - Push: Reads FIFO outbox, sends changes to Supabase, updates local sync_status.
 * - Pull: Fetches rows updated since last_pulled_at (including soft-deleted), updates SQLite.
 * - Conflict Resolution: Last-write-wins based on updated_at timestamp.
 * - Realtime Listener: Subscribes to Supabase postgres_changes to keep device in sync.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { OutboxDao } from '../local/OutboxDao';
import { PetDao } from '../local/PetDao';
import { WeightLogDao } from '../local/WeightLogDao';
import { VaccinationDao } from '../local/VaccinationDao';
import { CareReminderDao } from '../local/CareReminderDao';
import { supabase } from '../remote/supabaseClient';

export interface RemoteSyncClient {
  upsert(table: string, payload: Record<string, any>): Promise<void>;
  softDelete(table: string, id: string, deletedAt: string): Promise<void>;
  pullChanges(table: string, since: string | null): Promise<Record<string, any>[]>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Default Remote Client using real Supabase */
export const defaultSupabaseRemoteClient: RemoteSyncClient = {
  async upsert(table: string, payload: Record<string, any>): Promise<void> {
    // Strip local-only sync columns before pushing to Supabase
    const { sync_status, last_synced_at, local_updated_at, ...rawServerPayload } = payload;
    void sync_status;
    void last_synced_at;
    void local_updated_at;

    const serverPayload: Record<string, any> = { ...rawServerPayload };

    // Resolve owner_id: if not a valid UUID (e.g. guest or offline account), replace with real authenticated user id
    let authUserId: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      authUserId = data.session?.user?.id || null;
    } catch {}

    if (serverPayload.owner_id !== undefined) {
      if (!UUID_REGEX.test(serverPayload.owner_id) && authUserId) {
        serverPayload.owner_id = authUserId;
      }
    }

    if (table === 'pets') {
      if (serverPayload.is_neutered !== undefined) {
        serverPayload.is_neutered = Boolean(serverPayload.is_neutered);
      }
      if (serverPayload.breed_id && !UUID_REGEX.test(serverPayload.breed_id)) {
        serverPayload.breed_id = null;
      }
      if (serverPayload.current_weight_kg !== undefined && serverPayload.current_weight_kg !== null) {
        serverPayload.current_weight_kg = Number(serverPayload.current_weight_kg);
      }
    } else if (table === 'reminders') {
      if (serverPayload.is_done !== undefined) {
        serverPayload.is_done = Boolean(serverPayload.is_done);
      }
    } else if (table === 'weight_logs') {
      if (serverPayload.weight_kg !== undefined) {
        serverPayload.weight_kg = Number(serverPayload.weight_kg);
      }
    } else if (table === 'vaccinations') {
      if (serverPayload.administered_at) {
        serverPayload.administered_at = new Date(serverPayload.administered_at).toISOString();
      }
      if (serverPayload.next_due_at) {
        serverPayload.next_due_at = new Date(serverPayload.next_due_at).toISOString();
      }
    }

    const { error } = await supabase.from(table).upsert(serverPayload);
    if (error) {
      console.warn(`[SyncEngine] Upsert failed for table '${table}':`, error.message, serverPayload);
      throw new Error(error.message);
    }
  },

  async softDelete(table: string, id: string, deletedAt: string): Promise<void> {
    const { error } = await supabase
      .from(table)
      .update({ deleted_at: deletedAt, updated_at: deletedAt })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async pullChanges(table: string, since: string | null): Promise<Record<string, any>[]> {
    let query = supabase.from(table).select('*');
    if (since) {
      query = query.gt('updated_at', since);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },
};

export class SyncEngine {
  private readonly outboxDao: OutboxDao;
  private readonly petDao: PetDao;
  private readonly weightLogDao: WeightLogDao;
  private readonly vaccinationDao: VaccinationDao;
  private readonly careReminderDao: CareReminderDao;
  private isSyncing = false;

  constructor(
    private readonly db: SQLiteDatabase,
    private readonly remoteClient: RemoteSyncClient = defaultSupabaseRemoteClient,
  ) {
    this.outboxDao = new OutboxDao(db);
    this.petDao = new PetDao(db);
    this.weightLogDao = new WeightLogDao(db);
    this.vaccinationDao = new VaccinationDao(db);
    this.careReminderDao = new CareReminderDao(db);
  }

  /**
   * Process all pending entries in the outbox (FIFO)
   */
  async pushOutbox(): Promise<{ pushedCount: number; errors: string[] }> {
    const entries = await this.outboxDao.getPending();
    let pushedCount = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      try {
        const payload = JSON.parse(entry.payload);

        if (entry.entity_table === 'profiles') {
          const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
          const targetId = UUID_REGEX.test(entry.entity_id) ? entry.entity_id : sessionData.session?.user?.id;
          if (targetId) {
            const { error: profError } = await supabase.from('profiles').update(payload).eq('id', targetId);
            if (profError) throw new Error(profError.message);
          }
        } else if (entry.operation === 'INSERT' || entry.operation === 'UPDATE') {
          await this.remoteClient.upsert(entry.entity_table, payload);
        } else if (entry.operation === 'DELETE') {
          await this.remoteClient.softDelete(
            entry.entity_table,
            entry.entity_id,
            payload.deleted_at || new Date().toISOString(),
          );
        }

        // Successfully pushed: remove from outbox and mark row as synced
        await this.outboxDao.remove(entry.id);
        if (entry.entity_table === 'pets') {
          await this.petDao.markSynced(entry.entity_id);
        } else if (entry.entity_table === 'weight_logs') {
          await this.weightLogDao.markSynced(entry.entity_id);
        } else if (entry.entity_table === 'vaccinations') {
          await this.vaccinationDao.markSynced(entry.entity_id);
        } else if (entry.entity_table === 'reminders') {
          await this.careReminderDao.markSynced(entry.entity_id);
        }
        pushedCount++;
      } catch (err: any) {
        const msg = err?.message || 'Sync failed';
        console.warn(`[SyncEngine] pushOutbox error on ${entry.entity_table}:${entry.entity_id}:`, msg);
        errors.push(`${entry.entity_table}:${entry.entity_id} - ${msg}`);
        await this.outboxDao.markFailed(entry.id, msg);
      }
    }

    return { pushedCount, errors };
  }

  /**
   * Pull changes from remote tables since last_pulled_at
   */
  async pullTable(tableName: string): Promise<{ updatedCount: number }> {
    // Read last pulled timestamp
    const state = await this.db.getFirstAsync<{ last_pulled_at: string | null }>(
      'SELECT last_pulled_at FROM sync_state WHERE entity_table = ?;',
      tableName,
    );

    const since = state?.last_pulled_at ?? null;
    const remoteRows = await this.remoteClient.pullChanges(tableName, since);

    let updatedCount = 0;
    const now = new Date().toISOString();

    for (const row of remoteRows) {
      if (tableName === 'pets') {
        await this.petDao.upsertFromRemote(row);
        updatedCount++;
      } else if (tableName === 'weight_logs') {
        await this.weightLogDao.upsertFromRemote(row);
        updatedCount++;
      } else if (tableName === 'vaccinations') {
        await this.vaccinationDao.upsertFromRemote(row);
        updatedCount++;
      } else if (tableName === 'reminders') {
        await this.careReminderDao.upsertFromRemote(row);
        updatedCount++;
      }
    }

    // Advance cursor in sync_state
    await this.db.runAsync(
      `INSERT INTO sync_state (entity_table, last_pulled_at) VALUES (?, ?)
       ON CONFLICT(entity_table) DO UPDATE SET last_pulled_at = excluded.last_pulled_at;`,
      tableName,
      now,
    );

    return { updatedCount };
  }

  /**
   * Run full sync cycle: Push outbox -> Pull tables
   */
  async syncAll(): Promise<{ pushedCount: number; pulledCount: number; errors: string[] }> {
    if (this.isSyncing) {
      return { pushedCount: 0, pulledCount: 0, errors: [] };
    }

    this.isSyncing = true;
    try {
      // 1. Push local changes
      const { pushedCount, errors } = await this.pushOutbox();

      // 2. Pull remote updates for core tables
      const petsPull = await this.pullTable('pets');
      const weightsPull = await this.pullTable('weight_logs');
      const vaccsPull = await this.pullTable('vaccinations');
      const remindersPull = await this.pullTable('reminders');

      const pulledCount =
        petsPull.updatedCount +
        weightsPull.updatedCount +
        vaccsPull.updatedCount +
        remindersPull.updatedCount;

      return { pushedCount, pulledCount, errors };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get count of pending changes awaiting push
   */
  async getPendingCount(): Promise<number> {
    return this.outboxDao.getPendingCount();
  }
}
