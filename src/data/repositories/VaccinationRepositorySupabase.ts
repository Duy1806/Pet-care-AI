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
import { getDatabase } from '../local/database';
import { VaccinationDao } from '../local/VaccinationDao';

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

      // Asynchronously mirror into local SQLite
      try {
        const db = await getDatabase();
        const dao = new VaccinationDao(db);
        for (const row of data || []) {
          await dao.upsertFromRemote(row);
        }
      } catch {}

      return (data || []).map((row) => this.mapRow(row));
    } catch {
      // Offline fallback: load from local SQLite
      try {
        const db = await getDatabase();
        const dao = new VaccinationDao(db);
        const locals = await dao.getByPetId(petId);
        return locals.map((l) => this.mapRow(l));
      } catch {
        return [];
      }
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
    } catch {
      // Offline fallback: load from local SQLite
      try {
        const db = await getDatabase();
        const dao = new VaccinationDao(db);
        const locals = await dao.getUpcomingAlerts(petIds);
        return locals.map((l) => this.mapRow(l));
      } catch {
        return [];
      }
    }
  }

  async create(params: CreateVaccinationParams): Promise<VaccinationRecord> {
    const adminDate = params.administeredAt
      ? new Date(params.administeredAt).toISOString()
      : (params.nextDueAt ? new Date(params.nextDueAt).toISOString() : new Date().toISOString());

    const notePayload = this.encodeMetadataNote(params.status, params.doseNumber, params.note);
    const nextDueDate = params.nextDueAt ? new Date(params.nextDueAt).toISOString() : null;

    try {
      const insertPayload: Record<string, any> = {
        pet_id: params.petId,
        type: params.type,
        name: params.name.trim(),
        administered_at: adminDate,
        next_due_at: nextDueDate,
        vet_clinic: params.vetClinic?.trim() || null,
        note: notePayload,
      };

      const { data, error } = await supabase
        .from('vaccinations')
        .insert(insertPayload)
        .select()
        .single();

      if (error || !data) {
        throw new Error(mapSupabaseError(error));
      }

      // Cache locally in SQLite
      try {
        const db = await getDatabase();
        const dao = new VaccinationDao(db);
        await dao.upsertFromRemote(data);
      } catch {}

      return this.mapRow(data);
    } catch {
      // Offline fallback: save to local SQLite with outbox queue
      try {
        const db = await getDatabase();
        const dao = new VaccinationDao(db);
        const localRecord = await dao.create({
          petId: params.petId,
          type: params.type,
          name: params.name.trim(),
          administeredAt: adminDate,
          nextDueAt: nextDueDate,
          vetClinic: params.vetClinic?.trim() || null,
          note: notePayload,
        });
        return this.mapRow(localRecord);
      } catch (err: any) {
        throw new Error(err.message || 'Không thể lưu bản ghi tiêm phòng ngoại tuyến');
      }
    }
  }

  async update(params: UpdateVaccinationParams): Promise<VaccinationRecord> {
    const notePayload = this.encodeMetadataNote(params.status, params.doseNumber, params.note);
    const adminDate = params.administeredAt ? new Date(params.administeredAt).toISOString() : undefined;
    const nextDueDate = params.nextDueAt !== undefined ? (params.nextDueAt ? new Date(params.nextDueAt).toISOString() : null) : undefined;

    try {
      const updatePayload: Record<string, any> = {};

      if (params.type) updatePayload.type = params.type;
      if (params.name) updatePayload.name = params.name.trim();
      if (adminDate) updatePayload.administered_at = adminDate;
      if (nextDueDate !== undefined) updatePayload.next_due_at = nextDueDate;
      if (params.vetClinic !== undefined) updatePayload.vet_clinic = params.vetClinic?.trim() || null;
      if (params.status !== undefined || params.doseNumber !== undefined || params.note !== undefined) {
        updatePayload.note = notePayload;
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

      try {
        const db = await getDatabase();
        const dao = new VaccinationDao(db);
        await dao.upsertFromRemote(data);
      } catch {}

      return this.mapRow(data);
    } catch {
      // Offline fallback: update local SQLite with outbox queue
      try {
        const db = await getDatabase();
        const dao = new VaccinationDao(db);
        await dao.update(params.id, {
          type: params.type,
          name: params.name,
          administeredAt: adminDate,
          nextDueAt: nextDueDate,
          vetClinic: params.vetClinic,
          note: notePayload,
        });

        return {
          id: params.id,
          petId: '',
          type: params.type || 'vaccine',
          name: params.name || '',
          status: params.status || 'completed',
          doseNumber: params.doseNumber || null,
          administeredAt: params.administeredAt || '',
          nextDueAt: params.nextDueAt || null,
          vetClinic: params.vetClinic || null,
          note: params.note || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      } catch (err: any) {
        throw new Error(err.message || 'Không thể cập nhật tiêm phòng ngoại tuyến');
      }
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

      try {
        const db = await getDatabase();
        const dao = new VaccinationDao(db);
        await dao.softDelete(id);
      } catch {}
    } catch {
      // Offline fallback: soft-delete locally in SQLite and queue outbox
      try {
        const db = await getDatabase();
        const dao = new VaccinationDao(db);
        await dao.softDelete(id);
      } catch {}
    }
  }
}
