/**
 * PawCare AI — Weight Log DAO (Local SQLite Access)
 *
 * Append-only data access for pet weight tracking.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { OutboxDao } from './OutboxDao';
import { generateUUID } from './uuid';

export interface LocalWeightLog {
  id: string;
  pet_id: string;
  weight_kg: number;
  measured_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete' | 'conflict';
  last_synced_at: string | null;
  local_updated_at: string;
}

export class WeightLogDao {
  private readonly outboxDao: OutboxDao;

  constructor(private readonly db: SQLiteDatabase) {
    this.outboxDao = new OutboxDao(db);
  }

  /**
   * Get weight logs for a specific pet sorted by measurement date
   */
  async getByPetId(petId: string): Promise<LocalWeightLog[]> {
    return this.db.getAllAsync<LocalWeightLog>(
      'SELECT * FROM weight_logs WHERE pet_id = ? AND deleted_at IS NULL ORDER BY measured_at ASC;',
      petId,
    );
  }

  /**
   * Add a new weight log offline-first
   */
  async add(petId: string, weightKg: number, note?: string): Promise<LocalWeightLog> {
    const now = new Date().toISOString();
    const id = generateUUID();

    const log: LocalWeightLog = {
      id,
      pet_id: petId,
      weight_kg: weightKg,
      measured_at: now,
      note: note ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      sync_status: 'pending_create',
      last_synced_at: null,
      local_updated_at: now,
    };

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO weight_logs (
          id, pet_id, weight_kg, measured_at, note,
          created_at, updated_at, deleted_at,
          sync_status, last_synced_at, local_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        log.id,
        log.pet_id,
        log.weight_kg,
        log.measured_at,
        log.note,
        log.created_at,
        log.updated_at,
        log.deleted_at,
        log.sync_status,
        log.last_synced_at,
        log.local_updated_at,
      );

      // Also update pet's current_weight_kg locally
      await this.db.runAsync(
        'UPDATE pets SET current_weight_kg = ?, local_updated_at = ? WHERE id = ?;',
        weightKg,
        now,
        petId,
      );

      // Add to outbox queue
      await this.outboxDao.add('weight_logs', log.id, 'INSERT', log as unknown as Record<string, unknown>);
    });

    return log;
  }

  /**
   * Upsert from remote pull
   */
  async upsertFromRemote(remoteLog: Record<string, any>): Promise<void> {
    const existing = await this.db.getFirstAsync<LocalWeightLog>(
      'SELECT * FROM weight_logs WHERE id = ?;',
      remoteLog.id,
    );

    const now = new Date().toISOString();

    if (!existing) {
      await this.db.runAsync(
        `INSERT INTO weight_logs (
          id, pet_id, weight_kg, measured_at, note,
          created_at, updated_at, deleted_at,
          sync_status, last_synced_at, local_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?);`,
        remoteLog.id,
        remoteLog.pet_id,
        remoteLog.weight_kg,
        remoteLog.measured_at,
        remoteLog.note || null,
        remoteLog.created_at,
        remoteLog.updated_at,
        remoteLog.deleted_at || null,
        now,
        now,
      );
    } else {
      await this.db.runAsync(
        `UPDATE weight_logs SET
          weight_kg = ?, measured_at = ?, note = ?,
          updated_at = ?, deleted_at = ?, sync_status = 'synced',
          last_synced_at = ?, local_updated_at = ?
        WHERE id = ?;`,
        remoteLog.weight_kg,
        remoteLog.measured_at,
        remoteLog.note || null,
        remoteLog.updated_at,
        remoteLog.deleted_at || null,
        now,
        now,
        remoteLog.id,
      );
    }
  }

  /**
   * Mark row as synced
   */
  async markSynced(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      "UPDATE weight_logs SET sync_status = 'synced', last_synced_at = ? WHERE id = ?;",
      now,
      id,
    );
  }
}
