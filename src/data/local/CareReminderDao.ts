/**
 * PawCare AI — Care Reminder DAO (Local SQLite Access)
 *
 * Implements offline-first writes with outbox queuing for daily care schedules and reminders.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { OutboxDao } from './OutboxDao';
import { generateUUID } from './uuid';

export interface LocalCareReminder {
  id: string;
  pet_id: string;
  owner_id: string;
  kind: string;
  title: string;
  remind_at: string;
  repeat_rule: string;
  is_done: number; // 0 or 1
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete' | 'conflict';
  last_synced_at: string | null;
  local_updated_at: string;
}

export interface CreateCareReminderInput {
  petId: string;
  ownerId: string;
  kind: string;
  title: string;
  remindAt: string;
  repeatRule?: string;
  isDone?: boolean;
}

export class CareReminderDao {
  private readonly outboxDao: OutboxDao;

  constructor(private readonly db: SQLiteDatabase) {
    this.outboxDao = new OutboxDao(db);
  }

  async getByPetId(petId: string): Promise<LocalCareReminder[]> {
    return this.db.getAllAsync<LocalCareReminder>(
      'SELECT * FROM reminders WHERE pet_id = ? AND deleted_at IS NULL ORDER BY remind_at ASC;',
      petId,
    );
  }

  async getByPetIdAndDate(petId: string, datePrefix: string): Promise<LocalCareReminder[]> {
    return this.db.getAllAsync<LocalCareReminder>(
      `SELECT * FROM reminders WHERE pet_id = ? AND remind_at LIKE ? AND deleted_at IS NULL ORDER BY remind_at ASC;`,
      petId,
      `${datePrefix}%`,
    );
  }

  async create(input: CreateCareReminderInput): Promise<LocalCareReminder> {
    const now = new Date().toISOString();
    const id = generateUUID();

    const record: LocalCareReminder = {
      id,
      pet_id: input.petId,
      owner_id: input.ownerId,
      kind: input.kind,
      title: input.title,
      remind_at: input.remindAt,
      repeat_rule: input.repeatRule ?? 'none',
      is_done: input.isDone ? 1 : 0,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      sync_status: 'pending_create',
      last_synced_at: null,
      local_updated_at: now,
    };

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO reminders (
          id, pet_id, owner_id, kind, title, remind_at, repeat_rule, is_done,
          created_at, updated_at, deleted_at, sync_status, last_synced_at, local_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        record.id,
        record.pet_id,
        record.owner_id,
        record.kind,
        record.title,
        record.remind_at,
        record.repeat_rule,
        record.is_done,
        record.created_at,
        record.updated_at,
        record.deleted_at,
        record.sync_status,
        record.last_synced_at,
        record.local_updated_at,
      );

      await this.outboxDao.add('reminders', record.id, 'INSERT', {
        id: record.id,
        pet_id: record.pet_id,
        owner_id: record.owner_id,
        kind: record.kind,
        title: record.title,
        remind_at: record.remind_at,
        repeat_rule: record.repeat_rule,
        is_done: Boolean(record.is_done),
        created_at: record.created_at,
        updated_at: record.updated_at,
      });
    });

    return record;
  }

  async updateDone(id: string, isDone: boolean): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.db.getFirstAsync<LocalCareReminder>(
      'SELECT * FROM reminders WHERE id = ?;',
      id,
    );
    if (!existing) return;

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE reminders SET
          is_done = ?, updated_at = ?, sync_status = 'pending_update', local_updated_at = ?
        WHERE id = ?;`,
        isDone ? 1 : 0,
        now,
        now,
        id,
      );

      await this.outboxDao.add('reminders', id, 'UPDATE', {
        id,
        is_done: isDone,
        updated_at: now,
      });
    });
  }

  async softDelete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE reminders SET
          deleted_at = ?, updated_at = ?, sync_status = 'pending_delete', local_updated_at = ?
        WHERE id = ?;`,
        now,
        now,
        now,
        id,
      );

      await this.outboxDao.add('reminders', id, 'DELETE', {
        id,
        deleted_at: now,
        updated_at: now,
      });
    });
  }

  async upsertFromRemote(remote: Record<string, any>): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.db.getFirstAsync<LocalCareReminder>(
      'SELECT * FROM reminders WHERE id = ?;',
      remote.id,
    );

    const isDoneVal = typeof remote.is_done === 'boolean' ? (remote.is_done ? 1 : 0) : Number(remote.is_done) || 0;

    if (!existing) {
      await this.db.runAsync(
        `INSERT INTO reminders (
          id, pet_id, owner_id, kind, title, remind_at, repeat_rule, is_done,
          created_at, updated_at, deleted_at, sync_status, last_synced_at, local_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?);`,
        remote.id,
        remote.pet_id,
        remote.owner_id,
        remote.kind || 'custom',
        remote.title,
        remote.remind_at,
        remote.repeat_rule || 'none',
        isDoneVal,
        remote.created_at,
        remote.updated_at,
        remote.deleted_at || null,
        now,
        now,
      );
    } else {
      await this.db.runAsync(
        `UPDATE reminders SET
          kind = ?, title = ?, remind_at = ?, repeat_rule = ?, is_done = ?,
          updated_at = ?, deleted_at = ?, sync_status = 'synced',
          last_synced_at = ?, local_updated_at = ?
        WHERE id = ?;`,
        remote.kind || 'custom',
        remote.title,
        remote.remind_at,
        remote.repeat_rule || 'none',
        isDoneVal,
        remote.updated_at,
        remote.deleted_at || null,
        now,
        now,
        remote.id,
      );
    }
  }

  async markSynced(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      "UPDATE reminders SET sync_status = 'synced', last_synced_at = ? WHERE id = ?;",
      now,
      id,
    );
  }
}

