/**
 * PawCare AI — Supabase Breed Repository Implementation
 *
 * Fetches standardized pet breed catalog from Supabase.
 */
import type { Breed } from '../../domain/entities/Breed';
import type { BreedRepository } from '../../domain/repositories/BreedRepository';
import { supabase } from '../remote/supabaseClient';
import { mapSupabaseError } from '../remote/supabaseErrors';

interface DbBreedRow {
  id: string;
  species: 'dog' | 'cat' | 'other';
  name_en: string;
  name_vi: string;
  size_category: 'toy' | 'small' | 'medium' | 'large' | 'giant' | null;
  typical_weight_min_kg: number | null;
  typical_weight_max_kg: number | null;
  description: string | null;
  common_health_issues: string[] | null;
  image_url: string | null;
}

function mapRowToBreed(row: DbBreedRow): Breed {
  return {
    id: row.id,
    species: row.species,
    nameEn: row.name_en,
    nameVi: row.name_vi,
    sizeCategory: row.size_category,
    typicalWeightMinKg: row.typical_weight_min_kg,
    typicalWeightMaxKg: row.typical_weight_max_kg,
    description: row.description,
    commonHealthIssues: row.common_health_issues || [],
    imageUrl: row.image_url,
  };
}

export class BreedRepositorySupabase implements BreedRepository {
  async getAll(species?: string): Promise<Breed[]> {
    try {
      let query = supabase
        .from('breeds')
        .select('*')
        .is('deleted_at', null)
        .order('name_vi', { ascending: true });

      if (species) {
        query = query.eq('species', species);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(mapSupabaseError(error));
      }

      return (data || []).map((row: any) => mapRowToBreed(row));
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }

  async getById(id: string): Promise<Breed | null> {
    try {
      const { data, error } = await supabase
        .from('breeds')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error || !data) {
        return null;
      }

      return mapRowToBreed(data as any);
    } catch {
      return null;
    }
  }
}

