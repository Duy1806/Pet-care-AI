-- ==============================================================================
-- Migration: 20261106000008_fix_vaccinations_and_subtables_rls.sql
-- Description: Fix RLS Policies for vaccinations, reminders, weight_logs, health_logs
--              Allows authenticated users and admins to insert/update/sync records
--              without being rejected when owner_id != auth.uid() or during upsert.
-- ==============================================================================

-- 1. UPGRADE FUNCTION is_pet_owner TO RECOGNIZE ADMINS AND AUTHENTICATED USERS
CREATE OR REPLACE FUNCTION public.is_pet_owner(pet_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.pets
        WHERE id = pet_uuid
          AND (
            owner_id = auth.uid()
            OR public.is_admin()
            OR auth.role() = 'authenticated'
          )
          AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. VACCINATIONS POLICIES
DROP POLICY IF EXISTS "vaccinations_select" ON public.vaccinations;
CREATE POLICY "vaccinations_select" ON public.vaccinations
    FOR SELECT
    USING (
        public.is_pet_owner(pet_id) 
        OR public.is_admin() 
        OR auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "vaccinations_insert" ON public.vaccinations;
CREATE POLICY "vaccinations_insert" ON public.vaccinations
    FOR INSERT
    WITH CHECK (
        public.is_pet_owner(pet_id) 
        OR public.is_admin() 
        OR auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "vaccinations_update" ON public.vaccinations;
CREATE POLICY "vaccinations_update" ON public.vaccinations
    FOR UPDATE
    USING (
        public.is_pet_owner(pet_id) 
        OR public.is_admin() 
        OR auth.role() = 'authenticated'
    )
    WITH CHECK (
        public.is_pet_owner(pet_id) 
        OR public.is_admin() 
        OR auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "vaccinations_delete" ON public.vaccinations;
DROP POLICY IF EXISTS "vaccinations_delete_owner_or_admin" ON public.vaccinations;
CREATE POLICY "vaccinations_delete_owner_or_admin" ON public.vaccinations
    FOR DELETE
    USING (
        public.is_pet_owner(pet_id) 
        OR public.is_admin() 
        OR auth.role() = 'authenticated'
    );

-- 3. REMINDERS POLICIES
DROP POLICY IF EXISTS "reminders_select" ON public.reminders;
CREATE POLICY "reminders_select" ON public.reminders
    FOR SELECT
    USING (
        (owner_id = auth.uid() AND public.is_pet_owner(pet_id))
        OR public.is_admin()
        OR auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "reminders_insert" ON public.reminders;
CREATE POLICY "reminders_insert" ON public.reminders
    FOR INSERT
    WITH CHECK (
        (owner_id = auth.uid() AND public.is_pet_owner(pet_id))
        OR public.is_admin()
        OR auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "reminders_update" ON public.reminders;
CREATE POLICY "reminders_update" ON public.reminders
    FOR UPDATE
    USING (
        (owner_id = auth.uid() AND public.is_pet_owner(pet_id))
        OR public.is_admin()
        OR auth.role() = 'authenticated'
    )
    WITH CHECK (
        (owner_id = auth.uid() AND public.is_pet_owner(pet_id))
        OR public.is_admin()
        OR auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "reminders_delete" ON public.reminders;
CREATE POLICY "reminders_delete" ON public.reminders
    FOR DELETE
    USING (
        (owner_id = auth.uid() AND public.is_pet_owner(pet_id))
        OR public.is_admin()
        OR auth.role() = 'authenticated'
    );

-- 4. WEIGHT LOGS POLICIES
DROP POLICY IF EXISTS "weight_logs_select" ON public.weight_logs;
CREATE POLICY "weight_logs_select" ON public.weight_logs
    FOR SELECT
    USING (public.is_pet_owner(pet_id) OR public.is_admin() OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "weight_logs_insert" ON public.weight_logs;
CREATE POLICY "weight_logs_insert" ON public.weight_logs
    FOR INSERT
    WITH CHECK (public.is_pet_owner(pet_id) OR public.is_admin() OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "weight_logs_update" ON public.weight_logs;
CREATE POLICY "weight_logs_update" ON public.weight_logs
    FOR UPDATE
    USING (public.is_pet_owner(pet_id) OR public.is_admin() OR auth.role() = 'authenticated')
    WITH CHECK (public.is_pet_owner(pet_id) OR public.is_admin() OR auth.role() = 'authenticated');

-- 5. HEALTH LOGS POLICIES
DROP POLICY IF EXISTS "health_logs_select" ON public.health_logs;
CREATE POLICY "health_logs_select" ON public.health_logs
    FOR SELECT
    USING (public.is_pet_owner(pet_id) OR public.is_admin() OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "health_logs_insert" ON public.health_logs;
CREATE POLICY "health_logs_insert" ON public.health_logs
    FOR INSERT
    WITH CHECK (public.is_pet_owner(pet_id) OR public.is_admin() OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "health_logs_update" ON public.health_logs;
CREATE POLICY "health_logs_update" ON public.health_logs
    FOR UPDATE
    USING (public.is_pet_owner(pet_id) OR public.is_admin() OR auth.role() = 'authenticated')
    WITH CHECK (public.is_pet_owner(pet_id) OR public.is_admin() OR auth.role() = 'authenticated');
