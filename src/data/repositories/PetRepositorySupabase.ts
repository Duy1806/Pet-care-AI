/**
 * PawCare AI — Supabase Pet Repository Implementation
 *
 * Implements real-time pet management via Supabase database with soft-delete support.
 */
import type { Pet } from '../../domain/entities/Pet';
import type { PetRepository, CreatePetInput } from '../../domain/repositories/PetRepository';
import { supabase } from '../remote/supabaseClient';
import { mapSupabaseError } from '../remote/supabaseErrors';

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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class PetRepositorySupabase implements PetRepository {
  async getAll(): Promise<Pet[]> {
    try {
      const { data, error } = await supabase
        .from('pets')
        .select('*, breeds(name_vi, name_en)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(mapSupabaseError(error));
      }

      return (data || []).map((row: any) => mapRowToPet(row));
    } catch (e) {
      throw new Error(mapSupabaseError(e));
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
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id || input.ownerId;

      if (!currentUserId) {
        throw new Error('Vui lòng đăng nhập để thực hiện thêm thú cưng.');
      }

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

      return mapRowToPet(data as any);
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }

  async update(id: string, input: Partial<CreatePetInput>): Promise<Pet> {
    if (!UUID_REGEX.test(id)) {
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

    try {
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

      const { data, error } = await supabase
        .from('pets')
        .update(rowToUpdate)
        .eq('id', id)
        .select('*, breeds(name_vi, name_en)')
        .single();

      if (error || !data) {
        throw new Error(mapSupabaseError(error));
      }

      return mapRowToPet(data as any);
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }

  async delete(id: string): Promise<void> {
    // If id is not a valid UUID (e.g. mock or local id '1', '2'), it cannot exist on remote Supabase
    if (!UUID_REGEX.test(id)) {
      return;
    }

    try {
      // 1. Delete associated child records first to ensure foreign key integrity
      await Promise.allSettled([
        supabase.from('vaccinations').delete().eq('pet_id', id),
        supabase.from('reminders').delete().eq('pet_id', id),
        supabase.from('weight_logs').delete().eq('pet_id', id),
        supabase.from('health_logs').delete().eq('pet_id', id),
        supabase.from('nutrition_plans').delete().eq('pet_id', id),
      ]);

      // 2. Attempt direct hard delete on pets table
      // (If RLS DELETE policy is present, this completely removes the row from Supabase)
      const { error: hardError } = await supabase
        .from('pets')
        .delete()
        .eq('id', id);

      if (!hardError) {
        return;
      }

      // 3. Fallback: If hard delete was blocked (e.g. RLS restricts hard DELETE),
      // perform soft-delete by setting deleted_at so it is hidden in queries.
      // NOTE: Do NOT chain .select() here because the SELECT policy on pets
      // requires `deleted_at IS NULL`, which would cause .select() to fail on soft-deleted rows.
      const { error: softError } = await supabase
        .from('pets')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (!softError) {
        return;
      }

      // 4. If both hard delete and soft delete failed, throw the mapped error
      throw new Error(mapSupabaseError(softError || hardError));
    } catch (e: any) {
      if (e instanceof Error && e.message) {
        throw e;
      }
      throw new Error(mapSupabaseError(e));
    }
  }
}
