/**
 * PawCare AI — Supabase Vaccination Repository Implementation
 *
 * Persists vaccination and preventive health records to Supabase 'vaccinations' table.
 * Seamlessly stores status ('completed' | 'planned') and dose numbers via structured metadata.
 */
import type {
  CreateVaccinationParams,
  UpdateVaccinationParams,
  VaccinationRecord,
  VaccinationStatus,
} from '../../domain/entities/Vaccination';
import type { VaccinationRepository } from '../../domain/repositories/VaccinationRepository';
import { supabase } from '../remote/supabaseClient';
import { mapSupabaseError } from '../remote/supabaseErrors';

export class VaccinationRepositorySupabase implements VaccinationRepository {
  private mapRow(row: any): VaccinationRecord {
    let status: VaccinationStatus = 'completed';
    let doseNumber: number | null = null;
    let cleanNote: string | null = row.note ?? null;

    if (row.note && typeof row.note === 'string') {
      const match = row.note.match(/^\[STATUS:(planned|completed)?(?:;DOSE:(\d+))?\]\s*(.*)$/);
      if (match) {
        if (match[1] === 'planned') {
          status = 'planned';
        }
        if (match[2]) {
          doseNumber = parseInt(match[2], 10);
        }
        cleanNote = match[3] ? match[3].trim() : null;
      } else if (row.note.includes('[CHƯA TIÊM]')) {
        status = 'planned';
        cleanNote = row.note.replace('[CHƯA TIÊM]', '').trim() || null;
      }
    }

    return {
      id: row.id,
      petId: row.pet_id,
      type: row.type,
      name: row.name,
      status,
      doseNumber,
      administeredAt: row.administered_at ? row.administered_at.split('T')[0] : '',
      nextDueAt: row.next_due_at ? row.next_due_at.split('T')[0] : null,
      vetClinic: row.vet_clinic ?? null,
      note: cleanNote,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private encodeMetadataNote(status?: VaccinationStatus, doseNumber?: number | null, rawNote?: string | null): string | null {
    const s = status || 'completed';
    const hasDose = typeof doseNumber === 'number' && doseNumber > 0;

    if (s === 'planned' || hasDose) {
      const tag = `[STATUS:${s}${hasDose ? `;DOSE:${doseNumber}` : ''}]`;
      const text = rawNote ? rawNote.trim() : '';
      return text ? `${tag} ${text}` : tag;
    }

    return rawNote ? rawNote.trim() : null;
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
      const adminDate = params.administeredAt
        ? new Date(params.administeredAt).toISOString()
        : (params.nextDueAt ? new Date(params.nextDueAt).toISOString() : new Date().toISOString());

      const notePayload = this.encodeMetadataNote(params.status, params.doseNumber, params.note);

      const insertPayload: Record<string, any> = {
        pet_id: params.petId,
        type: params.type,
        name: params.name.trim(),
        administered_at: adminDate,
        vet_clinic: params.vetClinic?.trim() || null,
        note: notePayload,
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

  async update(params: UpdateVaccinationParams): Promise<VaccinationRecord> {
    try {
      const updatePayload: Record<string, any> = {};

      if (params.type) updatePayload.type = params.type;
      if (params.name) updatePayload.name = params.name.trim();
      if (params.administeredAt) {
        updatePayload.administered_at = new Date(params.administeredAt).toISOString();
      }
      if (params.nextDueAt !== undefined) {
        updatePayload.next_due_at = params.nextDueAt ? new Date(params.nextDueAt).toISOString() : null;
      }
      if (params.vetClinic !== undefined) {
        updatePayload.vet_clinic = params.vetClinic?.trim() || null;
      }
      if (params.status !== undefined || params.doseNumber !== undefined || params.note !== undefined) {
        updatePayload.note = this.encodeMetadataNote(params.status, params.doseNumber, params.note);
      }

      const { data, error } = await supabase
        .from('vaccinations')
        .update(updatePayload)
        .eq('id', params.id)
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
