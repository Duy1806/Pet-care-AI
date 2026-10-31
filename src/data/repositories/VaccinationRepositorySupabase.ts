/**
 * PawCare AI — Supabase Vaccination Repository Implementation
 *
 * Persists vaccination and preventive health records to Supabase 'vaccinations' table.
 */
import type { CreateVaccinationParams, VaccinationRecord } from '../../domain/entities/Vaccination';
import type { VaccinationRepository } from '../../domain/repositories/VaccinationRepository';
import { supabase } from '../remote/supabaseClient';
import { mapSupabaseError } from '../remote/supabaseErrors';

export class VaccinationRepositorySupabase implements VaccinationRepository {
  private mapRow(row: any): VaccinationRecord {
    return {
      id: row.id,
      petId: row.pet_id,
      type: row.type,
      name: row.name,
      administeredAt: row.administered_at ? row.administered_at.split('T')[0] : '',
      nextDueAt: row.next_due_at ? row.next_due_at.split('T')[0] : null,
      vetClinic: row.vet_clinic ?? null,
      note: row.note ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getByPetId(petId: string): Promise<VaccinationRecord[]> {
    try {
      const { data, error } = await supabase
        .from('vaccinations')
        .select('*')
        .eq('pet_id', petId)
        .is('deleted_at', null)
        .order('administered_at', { ascending: false });

      if (error) {
        throw new Error(mapSupabaseError(error));
      }

      return (data || []).map((row) => this.mapRow(row));
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }

  async getUpcomingAlerts(petIds: string[]): Promise<VaccinationRecord[]> {
    if (!petIds || petIds.length === 0) return [];

    try {
      const { data, error } = await supabase
        .from('vaccinations')
        .select('*')
        .in('pet_id', petIds)
        .is('deleted_at', null)
        .not('next_due_at', 'is', null)
        .order('next_due_at', { ascending: true });

      if (error) {
        throw new Error(mapSupabaseError(error));
      }

      return (data || []).map((row) => this.mapRow(row));
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }

  async create(params: CreateVaccinationParams): Promise<VaccinationRecord> {
    try {
      const insertPayload: Record<string, any> = {
        pet_id: params.petId,
        type: params.type,
        name: params.name.trim(),
        administered_at: new Date(params.administeredAt).toISOString(),
        vet_clinic: params.vetClinic?.trim() || null,
        note: params.note?.trim() || null,
      };

      if (params.nextDueAt) {
        insertPayload.next_due_at = new Date(params.nextDueAt).toISOString();
      }

      const { data, error } = await supabase
        .from('vaccinations')
        .insert(insertPayload)
        .select()
        .single();

      if (error || !data) {
        throw new Error(mapSupabaseError(error));
      }

      return this.mapRow(data);
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('vaccinations')
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
