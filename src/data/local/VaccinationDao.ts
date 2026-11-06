/**
 * PawCare AI — Vaccination DAO (Local SQLite Access)
 *
 * Implements offline-first writes with outbox queuing for vaccination records.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { OutboxDao } from './OutboxDao';
import { generateUUID } from './uuid';

export interface LocalVaccination {
  id: string;
  pet_id: string;
  type: string;
  name: string;
  administered_at: string;
  next_due_at: string | null;
  vet_clinic: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete' | 'conflict';
  last_synced_at: string | null;
  local_updated_at: string;
}

export interface CreateVaccinationInput {
  petId: string;
  type: string;
  name: string;
  administeredAt: string;
  nextDueAt?: string | null;
  vetClinic?: string | null;
  note?: string | null;
}

export class VaccinationDao {
  private readonly outboxDao: OutboxDao;

  constructor(private readonly db: SQLiteDatabase) {
    this.outboxDao = new OutboxDao(db);
  }

  async getByPetId(petId: string): Promise<LocalVaccination[]> {
    return this.db.getAllAsync<LocalVaccination>(
      'SELECT * FROM vaccinations WHERE pet_id = ? AND deleted_at IS NULL ORDER BY administered_at DESC;',
      petId,
    );
  }

  async getUpcomingAlerts(petIds: string[]): Promise<LocalVaccination[]> {
    if (petIds.length === 0) return [];
    const placeholders = petIds.map(() => '?').join(',');
    return this.db.getAllAsync<LocalVaccination>(
      `SELECT * FROM vaccinations WHERE pet_id IN (${placeholders}) AND deleted_at IS NULL AND next_due_at IS NOT NULL ORDER BY next_due_at ASC;`,
      ...petIds,
    );
  }

  async create(input: CreateVaccinationInput): Promise<LocalVaccination> {
    const now = new Date().toISOString();
    const id = generateUUID();

    const record: LocalVaccination = {
      id,
      pet_id: input.petId,
      type: input.type,
      name: input.name,
      administered_at: input.administeredAt,
      next_due_at: input.nextDueAt ?? null,
      vet_clinic: input.vetClinic ?? null,
      note: input.note ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      sync_status: 'pending_create',
      last_synced_at: null,
      local_updated_at: now,
    };

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO vaccinations (
          id, pet_id, type, name, administered_at, next_due_at, vet_clinic, note,
          created_at, updated_at, deleted_at, sync_status, last_synced_at, local_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        record.id,
        record.pet_id,
        record.type,
        record.name,
        record.administered_at,
        record.next_due_at,
        record.vet_clinic,
        record.note,
        record.created_at,
        record.updated_at,
        record.deleted_at,
        record.sync_status,
        record.last_synced_at,
        record.local_updated_at,
      );

      await this.outboxDao.add('vaccinations', record.id, 'INSERT', {
        id: record.id,
        pet_id: record.pet_id,
        type: record.type,
        name: record.name,
        administered_at: record.administered_at,
        next_due_at: record.next_due_at,
        vet_clinic: record.vet_clinic,
        note: record.note,
        created_at: record.created_at,
        updated_at: record.updated_at,
      });
    });

    return record;
  }

  async update(id: string, updates: Partial<CreateVaccinationInput>): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.db.getFirstAsync<LocalVaccination>(
      'SELECT * FROM vaccinations WHERE id = ?;',
      id,
    );
    if (!existing) return;

    const updated: LocalVaccination = {
      ...existing,
      type: updates.type ?? existing.type,
      name: updates.name ?? existing.name,
      administered_at: updates.administeredAt ?? existing.administered_at,
      next_due_at: updates.nextDueAt !== undefined ? updates.nextDueAt : existing.next_due_at,
      vet_clinic: updates.vetClinic !== undefined ? updates.vetClinic : existing.vet_clinic,
      note: updates.note !== undefined ? updates.note : existing.note,
      updated_at: now,
      sync_status: 'pending_update',
      local_updated_at: now,
    };

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE vaccinations SET
          type = ?, name = ?, administered_at = ?, next_due_at = ?,
          vet_clinic = ?, note = ?, updated_at = ?, sync_status = 'pending_update',
          local_updated_at = ?
        WHERE id = ?;`,
        updated.type,
        updated.name,
        updated.administered_at,
        updated.next_due_at,
        updated.vet_clinic,
        updated.note,
        updated.updated_at,
        updated.local_updated_at,
        id,
      );

      await this.outboxDao.add('vaccinations', id, 'UPDATE', {
        id,
        pet_id: updated.pet_id,
        type: updated.type,
        name: updated.name,
        administered_at: updated.administered_at,
        next_due_at: updated.next_due_at,
        vet_clinic: updated.vet_clinic,
        note: updated.note,
        updated_at: updated.updated_at,
      });
    });
  }

  async softDelete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE vaccinations SET
          deleted_at = ?, updated_at = ?, sync_status = 'pending_delete',
          local_updated_at = ?
        WHERE id = ?;`,
        now,
        now,
        now,
        id,
      );

      await this.outboxDao.add('vaccinations', id, 'DELETE', {
        id,
        deleted_at: now,
        updated_at: now,
      });
    });
  }

  async upsertFromRemote(remote: Record<string, any>): Promise<void> {
    const now = new Date().toISOString();
    const existing = await this.db.getFirstAsync<LocalVaccination>(
      'SELECT * FROM vaccinations WHERE id = ?;',
      remote.id,
    );

    if (!existing) {
      await this.db.runAsync(
        `INSERT INTO vaccinations (
          id, pet_id, type, name, administered_at, next_due_at, vet_clinic, note,
          created_at, updated_at, deleted_at, sync_status, last_synced_at, local_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?);`,
        remote.id,
        remote.pet_id,
        remote.type,
        remote.name,
        remote.administered_at,
        remote.next_due_at || null,
        remote.vet_clinic || null,
        remote.note || null,
        remote.created_at,
        remote.updated_at,
        remote.deleted_at || null,
        now,
        now,
      );
    } else {
      await this.db.runAsync(
        `UPDATE vaccinations SET
          type = ?, name = ?, administered_at = ?, next_due_at = ?,
          vet_clinic = ?, note = ?, updated_at = ?, deleted_at = ?,
          sync_status = 'synced', last_synced_at = ?, local_updated_at = ?
        WHERE id = ?;`,
        remote.type,
        remote.name,
        remote.administered_at,
        remote.next_due_at || null,
        remote.vet_clinic || null,
        remote.note || null,
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
      "UPDATE vaccinations SET sync_status = 'synced', last_synced_at = ? WHERE id = ?;",
      now,
      id,
    );
  }
}

