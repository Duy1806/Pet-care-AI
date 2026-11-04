-- ==============================================================================
-- Migration: 20261104000005_fix_role_escalation_trigger.sql
-- Description: Allow Supabase Dashboard (postgres / service_role) to update
--              user roles without being blocked by prevent_role_escalation()
-- ==============================================================================

CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow database administrator, postgres superuser, Supabase Studio Table Editor and service_role
    IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
        RETURN NEW;
    END IF;

    IF (auth.jwt()->>'role' = 'service_role') THEN
        RETURN NEW;
    END IF;

    -- Allow if role is not actually changing
    IF NEW.role = OLD.role THEN
        RETURN NEW;
    END IF;

    -- Allow if the authenticated caller is already an admin
    IF auth.uid() IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin' AND deleted_at IS NULL
    ) THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Bạn không có quyền thay đổi vai trò tài khoản.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

