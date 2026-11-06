/**
 * PawCare AI — Supabase Pet Repository Implementation
 *
 * Implements real-time pet management via Supabase database with soft-delete support.
 */
import type { Pet } from '../../domain/entities/Pet';
import type { PetRepository, CreatePetInput } from '../../domain/repositories/PetRepository';
import { supabase, ExpoSecureStoreAdapter } from '../remote/supabaseClient';
import { mapSupabaseError } from '../remote/supabaseErrors';
import { getDatabase } from '../local/database';
import { PetDao, type LocalPet } from '../local/PetDao';

interface DbPetRow {
  id: string;
  owner_id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed_id: string | null;
  breed_name_custom: string | null;
  sex: 'male' | 'female' | 'unknown' | null;
  is_neutered: boolean;
  birth_date: string | null;
  current_weight_kg: number | null;
  activity_level: 'low' | 'moderate' | 'high';
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  breeds?: {
    name_vi: string;
    name_en: string;
  } | null;
}

function mapRowToPet(row: DbPetRow): Pet {
  const breedTitle = row.breeds?.name_vi || row.breeds?.name_en || row.breed_name_custom || 'Chưa rõ giống';
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    species: row.species,
    breed: breedTitle,
    breedId: row.breed_id,
    breedName: breedTitle,
    sex: row.sex || 'unknown',
    isNeutered: row.is_neutered,
    birthDate: row.birth_date,
    weightKg: Number(row.current_weight_kg) || 0,
    activityLevel: row.activity_level || 'moderate',
    photoUrl: row.photo_url,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function mapLocalPetToEntity(local: LocalPet): Pet {
  const breedTitle = local.breed_name_custom || 'Chưa rõ giống';
  return {
    id: local.id,
    ownerId: local.owner_id,
    name: local.name,
    species: local.species,
    breed: breedTitle,
    breedId: local.breed_id,
    breedName: breedTitle,
    sex: (local.sex as any) || 'unknown',
    isNeutered: Boolean(local.is_neutered),
    birthDate: local.birth_date,
    weightKg: Number(local.current_weight_kg) || 0,
    activityLevel: (local.activity_level as any) || 'moderate',
    photoUrl: local.photo_url,
    notes: local.notes,
    createdAt: local.created_at,
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveCurrentUserId(explicitId?: string): Promise<string> {
  if (explicitId && UUID_REGEX.test(explicitId)) return explicitId;
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user?.id) return data.session.user.id;
  } catch {}
  try {
    const cached = await ExpoSecureStoreAdapter.getItem('petcare_last_user_session');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.user?.id) return parsed.user.id;
    }
  } catch {}
  return explicitId || 'guest_local_user';
}

export class PetRepositorySupabase implements PetRepository {
  async getAll(): Promise<Pet[]> {
    const ownerId = await resolveCurrentUserId();
    try {
      const { data, error } = await supabase
        .from('pets')
        .select('*, breeds(name_vi, name_en)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(mapSupabaseError(error));
      }

      const pets = (data || []).map((row: any) => mapRowToPet(row));

      // Asynchronously mirror remote pets into local SQLite
      try {
        const db = await getDatabase();
        const petDao = new PetDao(db);
        for (const row of data || []) {
          await petDao.upsertFromRemote(row);
        }
      } catch {
        // Local SQLite mirror failure ignored
      }

      return pets;
    } catch {
      // Offline fallback: load cached pets from local SQLite
      try {
        const db = await getDatabase();
        const petDao = new PetDao(db);
        const localPets = await petDao.getAll(ownerId);
        return localPets.map(mapLocalPetToEntity);
      } catch {
        return [];
      }
    }
  }

  async getById(id: string): Promise<Pet | null> {
    if (!UUID_REGEX.test(id)) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('pets')
        .select('*, breeds(name_vi, name_en)')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error || !data) {
        return null;
      }

      return mapRowToPet(data as any);
    } catch {
      return null;
    }
  }

  async create(input: CreatePetInput): Promise<Pet> {
    const currentUserId = await resolveCurrentUserId(input.ownerId);

    try {
      const rowToInsert = {
        owner_id: currentUserId,
        name: input.name,
        species: input.species,
        breed_id: input.breedId || null,
        breed_name_custom: input.breedName || null,
        sex: input.sex || 'unknown',
        is_neutered: Boolean(input.isNeutered),
        birth_date: input.birthDate || null,
        current_weight_kg: input.weightKg,
        activity_level: input.activityLevel || 'moderate',
        photo_url: input.photoUrl || null,
        notes: input.notes || null,
      };

      const { data, error } = await supabase
        .from('pets')
        .insert(rowToInsert)
        .select('*, breeds(name_vi, name_en)')
        .single();

      if (error || !data) {
        throw new Error(mapSupabaseError(error));
      }

      const createdPet = mapRowToPet(data as any);
      // Asynchronously mirror to local SQLite
      try {
        const db = await getDatabase();
        const petDao = new PetDao(db);
        await petDao.upsertFromRemote(data);
      } catch {}

      return createdPet;
    } catch {
      // Offline fallback: write to local SQLite with outbox queue
      try {
        const db = await getDatabase();
        const petDao = new PetDao(db);
        const localPet = await petDao.create(currentUserId, {
          name: input.name,
          species: input.species,
          breed_id: input.breedId,
          breed_name_custom: input.breedName,
          sex: input.sex,
          is_neutered: input.isNeutered,
          birth_date: input.birthDate,
          current_weight_kg: input.weightKg,
          activity_level: input.activityLevel,
          photo_url: input.photoUrl,
          notes: input.notes,
        });
        return mapLocalPetToEntity(localPet);
      } catch (localErr: any) {
        throw new Error(localErr.message || 'Không thể lưu thú cưng vào bộ nhớ máy');
      }
    }
  }

  async update(id: string, input: Partial<CreatePetInput>): Promise<Pet> {
    const rowToUpdate: Record<string, any> = {};
    if (input.name !== undefined) rowToUpdate.name = input.name;
    if (input.species !== undefined) rowToUpdate.species = input.species;
    if (input.breedId !== undefined) rowToUpdate.breed_id = input.breedId;
    if (input.breedName !== undefined) rowToUpdate.breed_name_custom = input.breedName;
    if (input.sex !== undefined) rowToUpdate.sex = input.sex;
    if (input.isNeutered !== undefined) rowToUpdate.is_neutered = input.isNeutered;
    if (input.birthDate !== undefined) rowToUpdate.birth_date = input.birthDate;
    if (input.weightKg !== undefined) rowToUpdate.current_weight_kg = input.weightKg;
    if (input.activityLevel !== undefined) rowToUpdate.activity_level = input.activityLevel;
    if (input.photoUrl !== undefined) rowToUpdate.photo_url = input.photoUrl;
    if (input.notes !== undefined) rowToUpdate.notes = input.notes;

    // 1. Always update in local SQLite first (guarantees offline support & queue outbox)
    try {
      const db = await getDatabase();
      const petDao = new PetDao(db);
      await petDao.update(id, {
        name: input.name,
        species: input.species,
        breed_id: input.breedId,
        breed_name_custom: input.breedName,
        sex: input.sex,
        is_neutered: input.isNeutered,
        birth_date: input.birthDate,
        current_weight_kg: input.weightKg,
        activity_level: input.activityLevel,
        photo_url: input.photoUrl,
        notes: input.notes,
      });
    } catch (localErr) {
      console.warn('[PetRepository] Local SQLite update warning:', localErr);
    }

    // 2. If online and valid UUID, also update remote Supabase
    if (UUID_REGEX.test(id)) {
      try {
        const { data, error } = await supabase
          .from('pets')
          .update(rowToUpdate)
          .eq('id', id)
          .select('*, breeds(name_vi, name_en)')
          .single();

        if (data && !error) {
          try {
            const db = await getDatabase();
            const petDao = new PetDao(db);
            await petDao.upsertFromRemote(data);
          } catch {}
          return mapRowToPet(data as any);
        }
      } catch {
        // Offline: Ignored! Local SQLite has already saved the update and queued outbox
      }
    }

    // Return the updated pet entity from local SQLite
    try {
      const db = await getDatabase();
      const petDao = new PetDao(db);
      const localPet = await petDao.getById(id);
      if (localPet) {
        return mapLocalPetToEntity(localPet);
      }
    } catch {}

    return {
      id,
      name: input.name || 'Thú cưng',
      species: input.species || 'dog',
      breed: input.breedName || 'Chưa rõ',
      breedName: input.breedName || 'Chưa rõ',
      weightKg: input.weightKg || 4,
      sex: input.sex || 'unknown',
      isNeutered: input.isNeutered ?? true,
      birthDate: input.birthDate || null,
      activityLevel: input.activityLevel || 'moderate',
      notes: input.notes || null,
    };
  }

  async delete(id: string): Promise<void> {
    // 1. Always soft-delete in local SQLite (guarantees offline deletion and queues outbox)
    try {
      const db = await getDatabase();
      const petDao = new PetDao(db);
      await petDao.softDelete(id);
    } catch (localErr) {
      console.warn('[PetRepository] Local SQLite delete warning:', localErr);
    }

    // 2. If valid UUID, also try deleting on remote Supabase
    if (UUID_REGEX.test(id)) {
      try {
        const nowIso = new Date().toISOString();
        const { error: rpcError } = await supabase.rpc('delete_pet', { pet_uuid: id });
        if (!rpcError) return;

        const { error: softError } = await supabase
          .from('pets')
          .update({ deleted_at: nowIso })
          .eq('id', id);

        if (!softError) {
          await Promise.allSettled([
            supabase.from('vaccinations').update({ deleted_at: nowIso }).eq('pet_id', id),
            supabase.from('reminders').update({ deleted_at: nowIso }).eq('pet_id', id),
            supabase.from('weight_logs').update({ deleted_at: nowIso }).eq('pet_id', id),
            supabase.from('health_logs').update({ deleted_at: nowIso }).eq('pet_id', id),
          ]);
        }
      } catch {
        // Offline: Ignored! Local SQLite has already soft-deleted and queued outbox for sync
      }
    }
  }
}
