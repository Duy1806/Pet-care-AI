-- ==============================================================================
-- Migration: 20261030000001_initial_schema.sql
-- Description: Core schema for PawCare AI with soft-delete & sync index support.
-- ==============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- Auto-update updated_at timestamp function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE (Mirrors auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin')),
    preferred_theme TEXT NOT NULL DEFAULT 'system' CHECK (preferred_theme IN ('light', 'dark', 'system')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile trigger on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, role, preferred_theme)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Chủ nuôi'),
        NEW.raw_user_meta_data->>'phone',
        'owner',
        'system'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Prevent non-admins from changing their own role
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.role <> OLD.role AND (auth.jwt()->>'role' IS NULL OR auth.jwt()->>'role' <> 'service_role') THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
        ) THEN
            RAISE EXCEPTION 'Bạn không có quyền thay đổi vai trò tài khoản.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_role_escalation
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION prevent_role_escalation();

-- ------------------------------------------------------------------------------
-- 2. BREEDS TABLE (Reference catalog)
-- ------------------------------------------------------------------------------
CREATE TABLE breeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    species TEXT NOT NULL CHECK (species IN ('dog', 'cat', 'other')),
    name_en TEXT NOT NULL,
    name_vi TEXT NOT NULL,
    size_category TEXT CHECK (size_category IN ('toy', 'small', 'medium', 'large', 'giant')),
    typical_weight_min_kg NUMERIC(5,2),
    typical_weight_max_kg NUMERIC(5,2),
    description TEXT,
    common_health_issues JSONB DEFAULT '[]'::jsonb,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER set_breeds_updated_at
    BEFORE UPDATE ON breeds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 3. PETS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    species TEXT NOT NULL CHECK (species IN ('dog', 'cat', 'other')),
    breed_id UUID REFERENCES breeds(id) ON DELETE SET NULL,
    breed_name_custom TEXT,
    sex TEXT CHECK (sex IN ('male', 'female', 'unknown')),
    is_neutered BOOLEAN NOT NULL DEFAULT false,
    birth_date DATE,
    current_weight_kg NUMERIC(5,2),
    activity_level TEXT NOT NULL DEFAULT 'moderate' CHECK (activity_level IN ('low', 'moderate', 'high')),
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER set_pets_updated_at
    BEFORE UPDATE ON pets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 4. BREED_PREDICTIONS TABLE (AI scan history)
-- ------------------------------------------------------------------------------
CREATE TABLE breed_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID REFERENCES pets(id) ON DELETE SET NULL,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    top_breed_id UUID REFERENCES breeds(id) ON DELETE SET NULL,
    top_confidence NUMERIC(5,4) NOT NULL,
    alternatives JSONB NOT NULL DEFAULT '[]'::jsonb,
    model_version TEXT NOT NULL DEFAULT 'v1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 5. WEIGHT_LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE weight_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    weight_kg NUMERIC(5,2) NOT NULL,
    measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER set_weight_logs_updated_at
    BEFORE UPDATE ON weight_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 6. HEALTH_LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE health_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('symptom', 'checkup', 'medication', 'note', 'meal')),
    title TEXT NOT NULL,
    description TEXT,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER set_health_logs_updated_at
    BEFORE UPDATE ON health_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 7. VACCINATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE vaccinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('vaccine', 'deworming', 'flea_tick')),
    name TEXT NOT NULL,
    administered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    next_due_at TIMESTAMPTZ,
    vet_clinic TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER set_vaccinations_updated_at
    BEFORE UPDATE ON vaccinations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 8. REMINDERS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('vaccination', 'deworming', 'recheck', 'custom')),
    title TEXT NOT NULL,
    remind_at TIMESTAMPTZ NOT NULL,
    repeat_rule TEXT NOT NULL DEFAULT 'none' CHECK (repeat_rule IN ('none', 'monthly', 'quarterly', 'yearly')),
    is_done BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER set_reminders_updated_at
    BEFORE UPDATE ON reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 9. NUTRITION_PLANS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE nutrition_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    weight_kg_at_calc NUMERIC(5,2) NOT NULL,
    rer_kcal NUMERIC(7,2) NOT NULL,
    activity_factor NUMERIC(4,2) NOT NULL,
    mer_kcal NUMERIC(7,2) NOT NULL,
    meals_per_day INTEGER NOT NULL DEFAULT 2,
    recommendation_text TEXT,
    llm_model TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 10. ADMIN_AUDIT_LOGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES profiles(id),
    action TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- SYNC & QUERY INDEXES (Foreign Keys & (owner_id/pet_id, updated_at))
-- ------------------------------------------------------------------------------
CREATE INDEX idx_profiles_updated_at ON profiles(updated_at);
CREATE INDEX idx_breeds_species ON breeds(species);
CREATE INDEX idx_breeds_updated_at ON breeds(updated_at);

CREATE INDEX idx_pets_owner_updated_at ON pets(owner_id, updated_at);
CREATE INDEX idx_pets_breed_id ON pets(breed_id);

CREATE INDEX idx_breed_predictions_owner_created ON breed_predictions(owner_id, created_at);
CREATE INDEX idx_breed_predictions_pet ON breed_predictions(pet_id);

CREATE INDEX idx_weight_logs_pet_updated ON weight_logs(pet_id, updated_at);
CREATE INDEX idx_weight_logs_measured ON weight_logs(pet_id, measured_at);

CREATE INDEX idx_health_logs_pet_updated ON health_logs(pet_id, updated_at);
CREATE INDEX idx_health_logs_type ON health_logs(pet_id, type);

CREATE INDEX idx_vaccinations_pet_updated ON vaccinations(pet_id, updated_at);
CREATE INDEX idx_vaccinations_next_due ON vaccinations(pet_id, next_due_at);

CREATE INDEX idx_reminders_owner_updated ON reminders(owner_id, updated_at);
CREATE INDEX idx_reminders_pet_remind_at ON reminders(pet_id, remind_at);

CREATE INDEX idx_nutrition_plans_pet_created ON nutrition_plans(pet_id, created_at);
CREATE INDEX idx_admin_audit_logs_created ON admin_audit_logs(created_at);

