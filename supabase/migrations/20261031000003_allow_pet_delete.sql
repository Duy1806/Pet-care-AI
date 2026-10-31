-- ==============================================================================
-- Migration: 20261031000003_allow_pet_delete.sql
-- Description: Enable DELETE policies on pets and associated child records
--              for owners and admins.
-- ==============================================================================

-- 1. PETS DELETE POLICY
-- Drop if existing to avoid conflicts
DROP POLICY IF EXISTS "pets_delete_owner_or_admin" ON public.pets;

CREATE POLICY "pets_delete_owner_or_admin" ON public.pets
    FOR DELETE
    USING (
        owner_id = auth.uid() OR public.is_admin()
    );

-- 2. VACCINATIONS DELETE POLICY
DROP POLICY IF EXISTS "vaccinations_delete_owner_or_admin" ON public.vaccinations;

CREATE POLICY "vaccinations_delete_owner_or_admin" ON public.vaccinations
    FOR DELETE
    USING (
        public.is_pet_owner(pet_id) OR public.is_admin()
    );

-- 3. REMINDERS DELETE POLICY
DROP POLICY IF EXISTS "reminders_delete_owner_or_admin" ON public.reminders;

CREATE POLICY "reminders_delete_owner_or_admin" ON public.reminders
    FOR DELETE
    USING (
        owner_id = auth.uid() OR public.is_admin()
    );

-- 4. WEIGHT_LOGS DELETE POLICY
DROP POLICY IF EXISTS "weight_logs_delete_owner_or_admin" ON public.weight_logs;

CREATE POLICY "weight_logs_delete_owner_or_admin" ON public.weight_logs
    FOR DELETE
    USING (
        public.is_pet_owner(pet_id) OR public.is_admin()
    );

-- 5. HEALTH_LOGS DELETE POLICY
DROP POLICY IF EXISTS "health_logs_delete_owner_or_admin" ON public.health_logs;

CREATE POLICY "health_logs_delete_owner_or_admin" ON public.health_logs
    FOR DELETE
    USING (
        public.is_pet_owner(pet_id) OR public.is_admin()
    );

-- 6. NUTRITION_PLANS DELETE POLICY
DROP POLICY IF EXISTS "nutrition_plans_delete_owner_or_admin" ON public.nutrition_plans;

CREATE POLICY "nutrition_plans_delete_owner_or_admin" ON public.nutrition_plans
    FOR DELETE
    USING (
        public.is_pet_owner(pet_id) OR public.is_admin()
    );

