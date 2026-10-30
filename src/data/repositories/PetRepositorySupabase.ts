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
    try {
      const { error } = await supabase
        .from('pets')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        throw new Error(mapSupabaseError(error));
      }
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }
}
