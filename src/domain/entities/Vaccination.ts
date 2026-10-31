/**
 * PawCare AI — Vaccination Entity (Hồ sơ tiêm chủng & phòng bệnh)
 */

export type VaccinationType = 'vaccine' | 'deworming' | 'flea_tick';

export interface VaccinationRecord {
  id: string;
  petId: string;
  type: VaccinationType;
  name: string;
  administeredAt: string; // ISO date string: YYYY-MM-DD
  nextDueAt: string | null; // ISO date string: YYYY-MM-DD
  vetClinic: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVaccinationParams {
  petId: string;
  type: VaccinationType;
  name: string;
  administeredAt: string;
  nextDueAt?: string | null;
  vetClinic?: string | null;
  note?: string | null;
}

export interface VaccinationAlert {
  record: VaccinationRecord;
  petName: string;
  petSpecies: string;
  status: 'upcoming' | 'overdue' | 'today';
  daysDiff: number; // positive = days until due, negative = days overdue
}
