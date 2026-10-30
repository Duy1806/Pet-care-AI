/**
 * PawCare AI — Pet DAO (Local SQLite Access)
 *
 * Implements offline-first writes:
 * 1. Writes to SQLite first (instant UI feedback).
 * 2. Queues outbox entry in the same transaction.
 * 3. Primary key is generated via expo-crypto so it's identical on server.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { OutboxDao } from './OutboxDao';
import { generateUUID } from './uuid';

export interface LocalPet {
  id: string;
  owner_id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed_id: string | null;
  breed_name_custom: string | null;
  sex: string | null;
  is_neutered: number; // 0 or 1
  birth_date: string | null;
  current_weight_kg: number | null;
  activity_level: string;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  sync_status: 'synced' | 'pending_create' | 'pending_update' | 'pending_delete' | 'conflict';
  last_synced_at: string | null;
  local_updated_at: string;
}

export interface CreatePetParams {
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed_id?: string | null;
  breed_name_custom?: string | null;
  sex?: 'male' | 'female' | 'unknown';
  is_neutered?: boolean;
  birth_date?: string | null;
  current_weight_kg?: number | null;
  activity_level?: 'low' | 'moderate' | 'high';
  photo_url?: string | null;
  notes?: string | null;
}

export class PetDao {
  private readonly outboxDao: OutboxDao;

  constructor(private readonly db: SQLiteDatabase) {
    this.outboxDao = new OutboxDao(db);
  }

  /**
   * Get all active (not soft-deleted) pets for the owner
   */
  async getAll(ownerId: string): Promise<LocalPet[]> {
    return this.db.getAllAsync<LocalPet>(
      'SELECT * FROM pets WHERE owner_id = ? AND deleted_at IS NULL ORDER BY created_at DESC;',
      ownerId,
    );
  }

  /**
   * Get a pet by ID
   */
  async getById(id: string): Promise<LocalPet | null> {
    return this.db.getFirstAsync<LocalPet>(
      'SELECT * FROM pets WHERE id = ?;',
      id,
    );
  }

  /**
   * Offline-First Create: Write to SQLite + Outbox in one step
   */
  async create(ownerId: string, params: CreatePetParams): Promise<LocalPet> {
    const now = new Date().toISOString();
    const petId = generateUUID();

    const pet: LocalPet = {
      id: petId,
      owner_id: ownerId,
      name: params.name,
      species: params.species,
      breed_id: params.breed_id ?? null,
      breed_name_custom: params.breed_name_custom ?? null,
      sex: params.sex ?? 'unknown',
      is_neutered: params.is_neutered ? 1 : 0,
      birth_date: params.birth_date ?? null,
      current_weight_kg: params.current_weight_kg ?? null,
      activity_level: params.activity_level ?? 'moderate',
      photo_url: params.photo_url ?? null,
      notes: params.notes ?? null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      sync_status: 'pending_create',
      last_synced_at: null,
      local_updated_at: now,
    };

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO pets (
          id, owner_id, name, species, breed_id, breed_name_custom,
          sex, is_neutered, birth_date, current_weight_kg, activity_level,
          photo_url, notes, created_at, updated_at, deleted_at,
          sync_status, last_synced_at, local_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        pet.id,
        pet.owner_id,
        pet.name,
        pet.species,
        pet.breed_id,
        pet.breed_name_custom,
        pet.sex,
        pet.is_neutered,
        pet.birth_date,
        pet.current_weight_kg,
        pet.activity_level,
        pet.photo_url,
        pet.notes,
        pet.created_at,
        pet.updated_at,
        pet.deleted_at,
        pet.sync_status,
        pet.last_synced_at,
        pet.local_updated_at,
      );

      // Add to outbox queue
      await this.outboxDao.add('pets', pet.id, 'INSERT', pet as unknown as Record<string, unknown>);
    });

    return pet;
  }

  /**
   * Offline-First Update
   */
  async update(id: string, updates: Partial<CreatePetParams>): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Không tìm thấy thú cưng');

    const now = new Date().toISOString();
    const newStatus = existing.sync_status === 'pending_create' ? 'pending_create' : 'pending_update';

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE pets SET
          name = COALESCE(?, name),
          current_weight_kg = COALESCE(?, current_weight_kg),
          activity_level = COALESCE(?, activity_level),
          notes = COALESCE(?, notes),
          updated_at = ?,
          local_updated_at = ?,
          sync_status = ?
        WHERE id = ?;`,
        updates.name ?? null,
        updates.current_weight_kg ?? null,
        updates.activity_level ?? null,
        updates.notes ?? null,
        now,
        now,
        newStatus,
        id,
      );

      const updatedRow = await this.getById(id);
      if (updatedRow) {
        await this.outboxDao.add('pets', id, 'UPDATE', updatedRow as unknown as Record<string, unknown>);
      }
    });
  }

  /**
   * Offline-First Soft Delete
   */
  async softDelete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) return;

    const now = new Date().toISOString();

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE pets SET deleted_at = ?, updated_at = ?, local_updated_at = ?, sync_status = 'pending_delete'
         WHERE id = ?;`,
        now,
        now,
        now,
        id,
      );

      await this.outboxDao.add('pets', id, 'DELETE', { id, deleted_at: now });
    });
  }

  /**
   * Upsert from Remote Pull (Sync Engine)
   * Resolves conflicts via last-write-wins by updated_at.
   */
  async upsertFromRemote(remotePet: Record<string, any>): Promise<'updated' | 'inserted' | 'conflict'> {
    const existing = await this.getById(remotePet.id);
    const now = new Date().toISOString();

    if (!existing) {
      await this.db.runAsync(
        `INSERT INTO pets (
          id, owner_id, name, species, breed_id, breed_name_custom,
          sex, is_neutered, birth_date, current_weight_kg, activity_level,
          photo_url, notes, created_at, updated_at, deleted_at,
          sync_status, last_synced_at, local_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?);`,
        remotePet.id,
        remotePet.owner_id,
        remotePet.name,
        remotePet.species,
        remotePet.breed_id || null,
        remotePet.breed_name_custom || null,
        remotePet.sex || 'unknown',
        remotePet.is_neutered ? 1 : 0,
        remotePet.birth_date || null,
        remotePet.current_weight_kg || null,
        remotePet.activity_level || 'moderate',
        remotePet.photo_url || null,
        remotePet.notes || null,
        remotePet.created_at,
        remotePet.updated_at,
        remotePet.deleted_at || null,
        now,
        now,
      );
      return 'inserted';
    }

    // Conflict Check: If local has unsynced changes
    if (existing.sync_status === 'pending_update' || existing.sync_status === 'pending_delete') {
      const localTime = new Date(existing.local_updated_at).getTime();
      const remoteTime = new Date(remotePet.updated_at).getTime();

      if (remoteTime > localTime) {
        // Remote wins (last-write-wins), mark as conflict resolution
        await this.db.runAsync(
          `UPDATE pets SET
            name = ?, current_weight_kg = ?, activity_level = ?,
            photo_url = ?, notes = ?, updated_at = ?, deleted_at = ?,
            sync_status = 'conflict', last_synced_at = ?, local_updated_at = ?
          WHERE id = ?;`,
          remotePet.name,
          remotePet.current_weight_kg,
          remotePet.activity_level,
          remotePet.photo_url,
          remotePet.notes,
          remotePet.updated_at,
          remotePet.deleted_at,
          now,
          now,
          remotePet.id,
        );
        return 'conflict';
      }
      // Local changes are newer, keep local pending
      return 'updated';
    }

    // Clean update
    await this.db.runAsync(
      `UPDATE pets SET
        name = ?, current_weight_kg = ?, activity_level = ?,
        photo_url = ?, notes = ?, updated_at = ?, deleted_at = ?,
        sync_status = 'synced', last_synced_at = ?, local_updated_at = ?
      WHERE id = ?;`,
      remotePet.name,
      remotePet.current_weight_kg,
      remotePet.activity_level,
      remotePet.photo_url,
      remotePet.notes,
      remotePet.updated_at,
      remotePet.deleted_at,
      now,
      now,
      remotePet.id,
    );
    return 'updated';
  }

  /**
   * Mark row as successfully synced after push
   */
  async markSynced(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      "UPDATE pets SET sync_status = 'synced', last_synced_at = ? WHERE id = ?;",
      now,
      id,
    );
  }
}
