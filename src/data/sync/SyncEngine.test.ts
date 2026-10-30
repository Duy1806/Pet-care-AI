/**
 * PawCare AI — Sync Engine Unit Tests
 *
 * Verifies the 3 core synchronization guarantees:
 * 1. Offline Create ➔ Reconnect ➔ Pushed to Remote
 * 2. Edit on Two Devices ➔ Conflict Resolution (Last-Write-Wins / Conflict mark)
 * 3. Soft Delete Propagation
 */
import { SyncEngine, type RemoteSyncClient } from './SyncEngine';
import { PetDao, type LocalPet } from '../local/PetDao';
import type { OutboxEntry } from '../local/OutboxDao';

/**
 * In-memory mock of SQLiteDatabase for deterministic unit testing
 */
class InMemoryDatabaseMock {
  public outbox: OutboxEntry[] = [];
  public pets = new Map<string, LocalPet>();
  public syncState = new Map<string, string>();

  async runAsync(sql: string, ...params: any[]): Promise<any> {
    const s = sql.trim().toUpperCase();

    if (s.startsWith('INSERT INTO SYNC_OUTBOX')) {
      const [id, entity_table, entity_id, operation, payload, attempt_count, last_error, created_at] = params;
      this.outbox.push({
        id,
        entity_table,
        entity_id,
        operation,
        payload,
        attempt_count,
        last_error,
        created_at,
      });
      return { changes: 1 };
    }

    if (s.startsWith('DELETE FROM SYNC_OUTBOX WHERE ID =')) {
      const id = params[0];
      this.outbox = this.outbox.filter((e) => e.id !== id);
      return { changes: 1 };
    }

    if (s.startsWith('INSERT INTO PETS')) {
      const [
        id, owner_id, name, species, breed_id, breed_name_custom,
        sex, is_neutered, birth_date, current_weight_kg, activity_level,
        photo_url, notes, created_at, updated_at, deleted_at,
        sync_status, last_synced_at, local_updated_at,
      ] = params;

      this.pets.set(id, {
        id, owner_id, name, species, breed_id, breed_name_custom,
        sex, is_neutered, birth_date, current_weight_kg, activity_level,
        photo_url, notes, created_at, updated_at, deleted_at,
        sync_status, last_synced_at, local_updated_at,
      });
      return { changes: 1 };
    }

    if (s.startsWith('UPDATE PETS SET SYNC_STATUS = \'SYNCED\'')) {
      const [last_synced_at, id] = params;
      const p = this.pets.get(id);
      if (p) {
        p.sync_status = 'synced';
        p.last_synced_at = last_synced_at;
      }
      return { changes: 1 };
    }

    if (s.startsWith('UPDATE PETS SET DELETED_AT =')) {
      const [deleted_at, updated_at, local_updated_at, id] = params;
      const p = this.pets.get(id);
      if (p) {
        p.deleted_at = deleted_at;
        p.updated_at = updated_at;
        p.local_updated_at = local_updated_at;
        p.sync_status = 'pending_delete';
      }
      return { changes: 1 };
    }

    if (s.startsWith('UPDATE PETS SET') && s.includes('SYNC_STATUS = \'CONFLICT\'')) {
      const [name, current_weight_kg, activity_level, photo_url, notes, updated_at, deleted_at, last_synced_at, local_updated_at, id] = params;
      const p = this.pets.get(id);
      if (p) {
        Object.assign(p, {
          name, current_weight_kg, activity_level, photo_url, notes,
          updated_at, deleted_at, sync_status: 'conflict', last_synced_at, local_updated_at,
        });
      }
      return { changes: 1 };
    }

    if (s.startsWith('INSERT INTO SYNC_STATE')) {
      const [table, time] = params;
      this.syncState.set(table, time);
      return { changes: 1 };
    }

    return { changes: 0 };
  }

  async getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null> {
    const s = sql.trim().toUpperCase();

    if (s.startsWith('SELECT COUNT(*) AS COUNT FROM SYNC_OUTBOX')) {
      return { count: this.outbox.length } as unknown as T;
    }

    if (s.startsWith('SELECT * FROM PETS WHERE ID =')) {
      const id = params[0];
      return (this.pets.get(id) || null) as unknown as T;
    }

    if (s.startsWith('SELECT LAST_PULLED_AT FROM SYNC_STATE')) {
      const table = params[0];
      const time = this.syncState.get(table) || null;
      return { last_pulled_at: time } as unknown as T;
    }

    return null;
  }

  async getAllAsync<T>(sql: string): Promise<T[]> {
    const s = sql.trim().toUpperCase();

    if (s.startsWith('SELECT * FROM SYNC_OUTBOX')) {
      return [...this.outbox] as unknown as T[];
    }

    if (s.startsWith('SELECT * FROM PETS')) {
      return Array.from(this.pets.values()) as unknown as T[];
    }

    return [];
  }

  async withTransactionAsync<T>(task: () => Promise<T>): Promise<T> {
    return task();
  }
}

describe('SyncEngine', () => {
  let dbMock: InMemoryDatabaseMock;
  let remoteUpsertMock: jest.Mock;
  let remoteSoftDeleteMock: jest.Mock;
  let remotePullMock: jest.Mock;
  let mockRemoteClient: RemoteSyncClient;
  let petDao: PetDao;
  let syncEngine: SyncEngine;

  beforeEach(() => {
    dbMock = new InMemoryDatabaseMock();
    remoteUpsertMock = jest.fn().mockResolvedValue(undefined);
    remoteSoftDeleteMock = jest.fn().mockResolvedValue(undefined);
    remotePullMock = jest.fn().mockResolvedValue([]);

    mockRemoteClient = {
      upsert: remoteUpsertMock,
      softDelete: remoteSoftDeleteMock,
      pullChanges: remotePullMock,
    };

    petDao = new PetDao(dbMock as any);
    syncEngine = new SyncEngine(dbMock as any, mockRemoteClient);
  });

  // --------------------------------------------------------------------------
  // TEST 1: OFFLINE CREATE -> RECONNECT -> PUSHED
  // --------------------------------------------------------------------------
  it('1. Offline Create: Lưu offline vào SQLite + outbox, sau đó reconnect và push thành công', async () => {
    // Bước 1: Thiết bị offline tạo pet
    const pet = await petDao.create('owner-123', {
      name: 'Milo Vàng',
      species: 'dog',
      current_weight_kg: 10.5,
      activity_level: 'high',
    });

    expect(pet.sync_status).toBe('pending_create');
    expect(dbMock.outbox.length).toBe(1);
    expect(await syncEngine.getPendingCount()).toBe(1);

    // Bước 2: Thiết bị có mạng trở lại, SyncEngine kích hoạt pushOutbox
    const pushResult = await syncEngine.pushOutbox();

    expect(pushResult.pushedCount).toBe(1);
    expect(pushResult.errors.length).toBe(0);

    // Đã gọi remote client với đúng payload
    expect(remoteUpsertMock).toHaveBeenCalledWith('pets', expect.objectContaining({
      id: pet.id,
      name: 'Milo Vàng',
      species: 'dog',
    }));

    // Outbox phải trống và trạng thái pet phải là 'synced'
    expect(dbMock.outbox.length).toBe(0);
    const updatedLocal = await petDao.getById(pet.id);
    expect(updatedLocal?.sync_status).toBe('synced');
  });

  // --------------------------------------------------------------------------
  // TEST 2: CONFLICT RESOLUTION (Last-write-wins by updated_at)
  // --------------------------------------------------------------------------
  it('2. Conflict Rule: Khi cả 2 thiết bị cùng sửa, phiên bản remote mới hơn sẽ thắng và đánh dấu conflict', async () => {
    const petId = 'pet-conflict-001';
    const oldTime = '2026-10-30T09:00:00.000Z';
    const localEditTime = '2026-10-30T09:10:00.000Z';
    const remoteEditTime = '2026-10-30T09:20:00.000Z'; // Remote mới hơn!

    // Giả lập pet tại local đang có chỉnh sửa pending_update
    dbMock.pets.set(petId, {
      id: petId,
      owner_id: 'owner-123',
      name: 'Milo Local Edit',
      species: 'dog',
      breed_id: null,
      breed_name_custom: null,
      sex: 'male',
      is_neutered: 1,
      birth_date: null,
      current_weight_kg: 11.0,
      activity_level: 'moderate',
      photo_url: null,
      notes: null,
      created_at: oldTime,
      updated_at: oldTime,
      deleted_at: null,
      sync_status: 'pending_update',
      last_synced_at: oldTime,
      local_updated_at: localEditTime,
    });

    // Remote pull trả về bản ghi được sửa từ thiết bị B với timestamp mới hơn
    const remotePet = {
      id: petId,
      owner_id: 'owner-123',
      name: 'Milo Remote Edit B',
      species: 'dog',
      current_weight_kg: 12.0,
      activity_level: 'high',
      updated_at: remoteEditTime,
      deleted_at: null,
    };

    // Áp dụng remote pull
    const resolution = await petDao.upsertFromRemote(remotePet);

    expect(resolution).toBe('conflict');
    const resolvedLocal = await petDao.getById(petId);
    expect(resolvedLocal?.sync_status).toBe('conflict');
    expect(resolvedLocal?.name).toBe('Milo Remote Edit B');
    expect(resolvedLocal?.current_weight_kg).toBe(12.0);
  });

  // --------------------------------------------------------------------------
  // TEST 3: SOFT DELETE PROPAGATION
  // --------------------------------------------------------------------------
  it('3. Soft Delete Propagation: Khi xóa trên thiết bị A, deleted_at được đồng bộ và lan truyền', async () => {
    const pet = await petDao.create('owner-123', {
      name: 'Luna',
      species: 'cat',
    });

    // Xóa mềm tại local
    await petDao.softDelete(pet.id);

    const softDeleted = await petDao.getById(pet.id);
    expect(softDeleted?.sync_status).toBe('pending_delete');
    expect(softDeleted?.deleted_at).not.toBeNull();

    // Push outbox đồng bộ lệnh xóa lên remote
    await syncEngine.pushOutbox();

    expect(remoteSoftDeleteMock).toHaveBeenCalledWith('pets', pet.id, expect.any(String));
    expect(dbMock.outbox.length).toBe(0);
  });
});
