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
import { supabase } from '../remote/supabaseClient';

export interface RemoteSyncClient {
  upsert(table: string, payload: Record<string, any>): Promise<void>;
  softDelete(table: string, id: string, deletedAt: string): Promise<void>;
  pullChanges(table: string, since: string | null): Promise<Record<string, any>[]>;
}

/** Default Remote Client using real Supabase */
export const defaultSupabaseRemoteClient: RemoteSyncClient = {
  async upsert(table: string, payload: Record<string, any>): Promise<void> {
    // Strip local-only sync columns before pushing to Supabase
    const { sync_status, last_synced_at, local_updated_at, ...serverPayload } = payload;
    void sync_status;
    void last_synced_at;
    void local_updated_at;

    const { error } = await supabase.from(table).upsert(serverPayload);
    if (error) throw new Error(error.message);
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
  private isSyncing = false;

  constructor(
    private readonly db: SQLiteDatabase,
    private readonly remoteClient: RemoteSyncClient = defaultSupabaseRemoteClient,
  ) {
    this.outboxDao = new OutboxDao(db);
    this.petDao = new PetDao(db);
    this.weightLogDao = new WeightLogDao(db);
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

        if (entry.operation === 'INSERT' || entry.operation === 'UPDATE') {
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
        }
        pushedCount++;
      } catch (err: any) {
        const msg = err?.message || 'Sync failed';
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

      const pulledCount = petsPull.updatedCount + weightsPull.updatedCount;

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
