/**
 * PawCare AI — Vaccination Repository Interface
 */
import type { CreateVaccinationParams, VaccinationRecord } from '../entities/Vaccination';

export interface VaccinationRepository {
  /**
   * Get all vaccination records for a specific pet
   */
  getByPetId(petId: string): Promise<VaccinationRecord[]>;

  /**
   * Get all upcoming or overdue vaccination records for all pets of the current owner
   */
  getUpcomingAlerts(petIds: string[]): Promise<VaccinationRecord[]>;

  /**
   * Add a new vaccination/deworming record (provided by pet owner)
   */
  create(params: CreateVaccinationParams): Promise<VaccinationRecord>;

  /**
   * Soft-delete a vaccination record
   */
  delete(id: string): Promise<void>;
}
