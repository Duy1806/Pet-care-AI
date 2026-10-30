/**
 * PawCare AI — Outbox DAO (Data Access Object)
 *
 * Manages the sync_outbox FIFO queue in SQLite.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { generateUUID } from './uuid';

export interface OutboxEntry {
  id: string;
  entity_table: string;
  entity_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: string; // JSON string
  attempt_count: number;
  last_error: string | null;
  created_at: string;
}

export class OutboxDao {
  constructor(private readonly db: SQLiteDatabase) {}

  /**
   * Add a new operation to the outbox queue
   */
  async add(
    entityTable: string,
    entityId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: Record<string, unknown>,
  ): Promise<OutboxEntry> {
    const entry: OutboxEntry = {
      id: generateUUID(),
      entity_table: entityTable,
      entity_id: entityId,
      operation,
      payload: JSON.stringify(payload),
      attempt_count: 0,
      last_error: null,
      created_at: new Date().toISOString(),
    };

    await this.db.runAsync(
      `INSERT INTO sync_outbox (id, entity_table, entity_id, operation, payload, attempt_count, last_error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      entry.id,
      entry.entity_table,
      entry.entity_id,
      entry.operation,
      entry.payload,
      entry.attempt_count,
      entry.last_error,
      entry.created_at,
    );

    return entry;
  }

  /**
   * Get all pending outbox entries in FIFO order
   */
  async getPending(): Promise<OutboxEntry[]> {
    return this.db.getAllAsync<OutboxEntry>(
      'SELECT * FROM sync_outbox ORDER BY created_at ASC;',
    );
  }

  /**
   * Get total number of pending operations
   */
  async getPendingCount(): Promise<number> {
    const res = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM sync_outbox;',
    );
    return res?.count ?? 0;
  }

  /**
   * Delete an outbox item upon successful push to remote
   */
  async remove(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM sync_outbox WHERE id = ?;', id);
  }

  /**
   * Record a failed push attempt with exponential backoff info
   */
  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE sync_outbox SET attempt_count = attempt_count + 1, last_error = ? WHERE id = ?;',
      errorMessage,
      id,
    );
  }

  /**
   * Clear entire outbox (used in dev tests/resets)
   */
  async clear(): Promise<void> {
    await this.db.runAsync('DELETE FROM sync_outbox;');
  }
}
