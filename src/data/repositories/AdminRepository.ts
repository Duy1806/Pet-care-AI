/**
 * PawCare AI — Admin Repository
 *
 * Provides data aggregation and management capabilities for the Admin Portal:
 * - System KPIs (Total users, pets, vaccination alerts)
 * - User list management & role switching
 * - Master Pet Registry (All pets, health stats, owner details)
 * - Vaccination & Preventive Care Hub (Overdue & upcoming immunizations)
 */
import { supabase } from '../remote/supabaseClient';
import type { UserRole } from '@/domain/entities/User';
import { useAuthStore } from '@/presentation/stores/useAuthStore';

export interface AdminStats {
  totalUsers: number;
  totalPets: number;
  dogCount: number;
  catCount: number;
  totalVaccinations: number;
  overdueVaccinations: number;
  upcomingVaccinations: number;
}

export interface AdminUserItem {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: string;
  petCount: number;
}

export interface AdminPetItem {
  id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breedName: string;
  sex: 'male' | 'female' | 'unknown';
  isNeutered: boolean;
  birthDate: string | null;
  weightKg: number | null;
  activityLevel: string;
  photoUrl: string | null;
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  createdAt: string;
}

export interface AdminVaccinationItem {
  id: string;
  petId: string;
  petName: string;
  petSpecies: 'dog' | 'cat' | 'other';
  ownerName: string;
  type: 'vaccine' | 'deworming' | 'flea_tick';
  name: string;
  administeredAt: string;
  nextDueAt: string | null;
  vetClinic: string | null;
  note: string | null;
  status: 'completed' | 'upcoming' | 'overdue';
}

export class AdminRepository {
  /**
   * Aggregate high-level platform statistics
   */
  async getStats(): Promise<AdminStats> {
    try {
      // 1. Total users from profiles
      const { count: usersCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null);

      // 2. Total pets & species breakdown
      const { data: petsData } = await supabase
        .from('pets')
        .select('species')
        .is('deleted_at', null);

      const totalPets = petsData?.length || 0;
      const dogCount = petsData?.filter((p) => p.species === 'dog').length || 0;
      const catCount = petsData?.filter((p) => p.species === 'cat').length || 0;

      // 3. Vaccinations statistics & due alerts
      const { data: vaccData } = await supabase
        .from('vaccinations')
        .select('next_due_at')
        .is('deleted_at', null);

      const now = new Date();
      const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      let overdueCount = 0;
      let upcomingCount = 0;

      vaccData?.forEach((v) => {
        if (v.next_due_at) {
          const dueDate = new Date(v.next_due_at);
          if (dueDate < now) {
            overdueCount++;
          } else if (dueDate <= in14Days) {
            upcomingCount++;
          }
        }
      });

      return {
        totalUsers: Math.max(usersCount || 0, 1),
        totalPets,
        dogCount,
        catCount,
        totalVaccinations: vaccData?.length || 0,
        overdueVaccinations: overdueCount,
        upcomingVaccinations: upcomingCount,
      };
    } catch (err) {
      console.warn('[AdminRepository] getStats fallback:', err);
      return {
        totalUsers: 1,
        totalPets: 0,
        dogCount: 0,
        catCount: 0,
        totalVaccinations: 0,
        overdueVaccinations: 0,
        upcomingVaccinations: 0,
      };
    }
  }

  /**
   * Fetch all registered users
   */
  async getAllUsers(): Promise<AdminUserItem[]> {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, role, avatar_url, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error || !profiles) {
        return [];
      }

      // Query pet counts per owner
      const { data: pets } = await supabase
        .from('pets')
        .select('owner_id')
        .is('deleted_at', null);

      const petCountMap: Record<string, number> = {};
      pets?.forEach((p) => {
        petCountMap[p.owner_id] = (petCountMap[p.owner_id] || 0) + 1;
      });

      return profiles.map((p) => ({
        id: p.id,
        fullName: p.full_name || 'Chủ nuôi',
        email: p.phone ? `${p.phone}@pawcare.vn` : 'user@pawcare.vn',
        phone: p.phone || '',
        role: (p.role as UserRole) || 'owner',
        avatarUrl: p.avatar_url,
        createdAt: p.created_at,
        petCount: petCountMap[p.id] || 0,
      }));
    } catch (err) {
      console.warn('[AdminRepository] getAllUsers error:', err);
      return [];
    }
  }

  /**
   * Update a user's role (admin / owner)
   * Strictly forbidden for standard owners; only verified admins can invoke.
   */
  async updateUserRole(userId: string, newRole: UserRole): Promise<boolean> {
    try {
      // Security Enforcement: Strictly reject any role update attempted by non-admin owners
      const currentUser = useAuthStore.getState().user;
      if (!currentUser || currentUser.role !== 'admin') {
        console.warn('[Security] Từ chối: Chủ nuôi (Owner) không được phép thay đổi vai trò tài khoản.');
        return false;
      }

      // Prevent admin from accidentally demoting themselves and losing portal access
      if (currentUser.id === userId && newRole !== 'admin') {
        console.warn('[Security] Không thể tự hạ quyền chính mình');
        return false;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      return !error;
    } catch (err) {
      console.warn('[AdminRepository] updateUserRole error:', err);
      return false;
    }
  }

  /**
   * Fetch all registered pets across the entire system (Master Pet Registry)
   */
  async getAllPets(): Promise<AdminPetItem[]> {
    try {
      // 1. Fetch pets
      const { data: pets, error } = await supabase
        .from('pets')
        .select('id, name, species, breed_name_custom, sex, is_neutered, birth_date, current_weight_kg, activity_level, photo_url, owner_id, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error || !pets) return [];

      // 2. Fetch owners mapping
      const { data: owners } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .is('deleted_at', null);

      const ownerMap = new Map<string, { name: string; phone: string }>();
      owners?.forEach((o) => {
        ownerMap.set(o.id, { name: o.full_name || 'Chủ nuôi', phone: o.phone || '' });
      });

      return pets.map((p) => {
        const owner = ownerMap.get(p.owner_id);
        return {
          id: p.id,
          name: p.name,
          species: p.species as 'dog' | 'cat' | 'other',
          breedName: p.breed_name_custom || (p.species === 'dog' ? 'Chó cảnh' : 'Mèo nhà'),
          sex: (p.sex as 'male' | 'female' | 'unknown') || 'unknown',
          isNeutered: Boolean(p.is_neutered),
          birthDate: p.birth_date,
          weightKg: p.current_weight_kg ? Number(p.current_weight_kg) : null,
          activityLevel: p.activity_level || 'moderate',
          photoUrl: p.photo_url,
          ownerId: p.owner_id,
          ownerName: owner?.name || 'Chủ nuôi',
          ownerPhone: owner?.phone || '',
          createdAt: p.created_at,
        };
      });
    } catch (err) {
      console.warn('[AdminRepository] getAllPets error:', err);
      return [];
    }
  }

  /**
   * Fetch all vaccination and preventive care records across the system
   */
  async getAllVaccinations(): Promise<AdminVaccinationItem[]> {
    try {
      // 1. Fetch vaccinations
      const { data: records, error } = await supabase
        .from('vaccinations')
        .select('id, pet_id, type, name, administered_at, next_due_at, vet_clinic, note, created_at')
        .is('deleted_at', null)
        .order('administered_at', { ascending: false });

      if (error || !records) return [];

      // 2. Fetch pets and owners mapping
      const { data: pets } = await supabase
        .from('pets')
        .select('id, name, species, owner_id')
        .is('deleted_at', null);

      const { data: owners } = await supabase
        .from('profiles')
        .select('id, full_name')
        .is('deleted_at', null);

      const ownerMap = new Map<string, string>();
      owners?.forEach((o) => ownerMap.set(o.id, o.full_name || 'Chủ nuôi'));

      const petMap = new Map<string, { name: string; species: 'dog' | 'cat' | 'other'; ownerName: string }>();
      pets?.forEach((p) => {
        petMap.set(p.id, {
          name: p.name,
          species: (p.species as 'dog' | 'cat' | 'other') || 'dog',
          ownerName: ownerMap.get(p.owner_id) || 'Chủ nuôi',
        });
      });

      const now = new Date();
      const in14Days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      return records.map((r) => {
        const petInfo = petMap.get(r.pet_id);
        let status: 'completed' | 'upcoming' | 'overdue' = 'completed';

        if (r.next_due_at) {
          const due = new Date(r.next_due_at);
          if (due < now) {
            status = 'overdue';
          } else if (due <= in14Days) {
            status = 'upcoming';
          }
        }

        return {
          id: r.id,
          petId: r.pet_id,
          petName: petInfo?.name || 'Thú cưng',
          petSpecies: petInfo?.species || 'dog',
          ownerName: petInfo?.ownerName || 'Chủ nuôi',
          type: (r.type as 'vaccine' | 'deworming' | 'flea_tick') || 'vaccine',
          name: r.name,
          administeredAt: r.administered_at,
          nextDueAt: r.next_due_at,
          vetClinic: r.vet_clinic,
          note: r.note,
          status,
        };
      });
    } catch (err) {
      console.warn('[AdminRepository] getAllVaccinations error:', err);
      return [];
    }
  }
}

export const adminRepo = new AdminRepository();
