-- ==============================================================================
-- Migration: 20261030000002_rls_and_storage.sql
-- Description: Complete Row-Level Security (RLS) policies, security-definer
--              helper functions, storage bucket policies, and realtime.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SECURITY DEFINER HELPER FUNCTIONS
-- ------------------------------------------------------------------------------

-- Check if current authenticated user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
          AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current authenticated user owns the given pet
CREATE OR REPLACE FUNCTION public.is_pet_owner(pet_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.pets
        WHERE id = pet_uuid
          AND owner_id = auth.uid()
          AND deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ------------------------------------------------------------------------------
-- 2. ENABLE RLS ON ALL TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.breed_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nutrition_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. PROFILES POLICIES
-- ------------------------------------------------------------------------------
-- Users can view their own profile; Admins can view all profiles
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
    FOR SELECT
    USING (
        id = auth.uid() OR public.is_admin()
    );

-- Users can update only their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Insertion handled by trigger on auth.users insert, but allow auth.uid() insert if needed
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT
    WITH CHECK (id = auth.uid() OR public.is_admin());

-- No client hard DELETE (only soft-delete via update)

-- ------------------------------------------------------------------------------
-- 4. BREEDS POLICIES (Catalog)
-- ------------------------------------------------------------------------------
-- Any authenticated user can read breeds catalog
CREATE POLICY "breeds_select_authenticated" ON public.breeds
    FOR SELECT
    TO authenticated
    USING (deleted_at IS NULL OR public.is_admin());

-- Only admins can insert, update breeds
CREATE POLICY "breeds_insert_admin" ON public.breeds
    FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "breeds_update_admin" ON public.breeds
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 5. PETS POLICIES
-- ------------------------------------------------------------------------------
-- Owners can read their own pets; Admins can view all pets
CREATE POLICY "pets_select_owner_or_admin" ON public.pets
    FOR SELECT
    USING (
        (owner_id = auth.uid() AND deleted_at IS NULL)
        OR public.is_admin()
    );

-- Owners can insert pets for themselves
CREATE POLICY "pets_insert_owner" ON public.pets
    FOR INSERT
    WITH CHECK (
        owner_id = auth.uid()
    );

-- Owners can update their own pets (including setting deleted_at for soft delete)
CREATE POLICY "pets_update_owner" ON public.pets
    FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- No hard DELETE for clients!

-- ------------------------------------------------------------------------------
-- 6. BREED_PREDICTIONS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "predictions_select_owner_or_admin" ON public.breed_predictions
    FOR SELECT
    USING (
        owner_id = auth.uid() OR public.is_admin()
    );

CREATE POLICY "predictions_insert_owner" ON public.breed_predictions
    FOR INSERT
    WITH CHECK (
        owner_id = auth.uid()
    );

-- ------------------------------------------------------------------------------
-- 7. WEIGHT_LOGS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "weight_logs_select" ON public.weight_logs
    FOR SELECT
    USING (
        public.is_pet_owner(pet_id) OR public.is_admin()
    );

CREATE POLICY "weight_logs_insert" ON public.weight_logs
    FOR INSERT
    WITH CHECK (
        public.is_pet_owner(pet_id)
    );

CREATE POLICY "weight_logs_update" ON public.weight_logs
    FOR UPDATE
    USING (public.is_pet_owner(pet_id))
    WITH CHECK (public.is_pet_owner(pet_id));

-- ------------------------------------------------------------------------------
-- 8. HEALTH_LOGS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "health_logs_select" ON public.health_logs
    FOR SELECT
    USING (
        public.is_pet_owner(pet_id) OR public.is_admin()
    );

CREATE POLICY "health_logs_insert" ON public.health_logs
    FOR INSERT
    WITH CHECK (
        public.is_pet_owner(pet_id)
    );

CREATE POLICY "health_logs_update" ON public.health_logs
    FOR UPDATE
    USING (public.is_pet_owner(pet_id))
    WITH CHECK (public.is_pet_owner(pet_id));

-- ------------------------------------------------------------------------------
-- 9. VACCINATIONS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "vaccinations_select" ON public.vaccinations
    FOR SELECT
    USING (
        public.is_pet_owner(pet_id) OR public.is_admin()
    );

CREATE POLICY "vaccinations_insert" ON public.vaccinations
    FOR INSERT
    WITH CHECK (
        public.is_pet_owner(pet_id)
    );

CREATE POLICY "vaccinations_update" ON public.vaccinations
    FOR UPDATE
    USING (public.is_pet_owner(pet_id))
    WITH CHECK (public.is_pet_owner(pet_id));

-- ------------------------------------------------------------------------------
-- 10. REMINDERS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "reminders_select" ON public.reminders
    FOR SELECT
    USING (
        (owner_id = auth.uid() AND public.is_pet_owner(pet_id))
        OR public.is_admin()
    );

CREATE POLICY "reminders_insert" ON public.reminders
    FOR INSERT
    WITH CHECK (
        owner_id = auth.uid() AND public.is_pet_owner(pet_id)
    );

CREATE POLICY "reminders_update" ON public.reminders
    FOR UPDATE
    USING (owner_id = auth.uid() AND public.is_pet_owner(pet_id))
    WITH CHECK (owner_id = auth.uid() AND public.is_pet_owner(pet_id));

-- ------------------------------------------------------------------------------
-- 11. NUTRITION_PLANS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "nutrition_plans_select" ON public.nutrition_plans
    FOR SELECT
    USING (
        public.is_pet_owner(pet_id) OR public.is_admin()
    );

CREATE POLICY "nutrition_plans_insert" ON public.nutrition_plans
    FOR INSERT
    WITH CHECK (
        public.is_pet_owner(pet_id)
    );

CREATE POLICY "nutrition_plans_update" ON public.nutrition_plans
    FOR UPDATE
    USING (public.is_pet_owner(pet_id))
    WITH CHECK (public.is_pet_owner(pet_id));

-- ------------------------------------------------------------------------------
-- 12. ADMIN_AUDIT_LOGS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "admin_audit_logs_select" ON public.admin_audit_logs
    FOR SELECT
    USING (public.is_admin());

CREATE POLICY "admin_audit_logs_insert" ON public.admin_audit_logs
    FOR INSERT
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 13. STORAGE BUCKETS CONFIGURATION
-- ------------------------------------------------------------------------------
-- Create buckets if they don't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('pet-photos', 'pet-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('breed-scan-images', 'breed-scan-images', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: AVATARS (Public read, authenticated upload to {auth.uid()}/*)
CREATE POLICY "avatars_public_select" ON storage.objects
    FOR SELECT
    USING (bucket_id = 'avatars');

CREATE POLICY "avatars_user_insert" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'avatars'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "avatars_user_update" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'avatars'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Storage RLS: PET-PHOTOS (Private, only owner can select and insert)
CREATE POLICY "pet_photos_owner_select" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'pet-photos'
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR public.is_admin()
        )
    );

CREATE POLICY "pet_photos_owner_insert" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'pet-photos'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Storage RLS: BREED-SCAN-IMAGES (Private, only owner can select and insert)
CREATE POLICY "breed_scan_owner_select" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'breed-scan-images'
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR public.is_admin()
        )
    );

CREATE POLICY "breed_scan_owner_insert" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'breed-scan-images'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- ------------------------------------------------------------------------------
-- 14. REALTIME CONFIGURATION
-- ------------------------------------------------------------------------------
-- Enable supabase_realtime replication for pets and reminders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'pets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.pets;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'reminders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.reminders;
    END IF;
END $$;

