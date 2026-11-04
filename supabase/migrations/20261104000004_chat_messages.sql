-- ==============================================================================
-- Migration: 20261104000004_chat_messages.sql
-- Description: AI Veterinary Assistant chat history table with Row-Level Security
--              (RLS) and multi-device cloud synchronization.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL DEFAULT 'default',
    pet_id UUID REFERENCES public.pets(id) ON DELETE SET NULL,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
    text TEXT NOT NULL,
    pet_context JSONB,
    suggested_actions JSONB DEFAULT '[]'::jsonb,
    is_error BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- Comment on table
COMMENT ON TABLE public.chat_messages IS 'Persists PawCare AI Veterinary Assistant chat conversations and question history';

-- Indices for rapid querying and history retrieval
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created 
    ON public.chat_messages(user_id, created_at DESC) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_pet 
    ON public.chat_messages(pet_id) 
    WHERE pet_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_session 
    ON public.chat_messages(user_id, session_id);

-- Auto-update updated_at timestamp trigger
DROP TRIGGER IF EXISTS set_chat_messages_updated_at ON public.chat_messages;
CREATE TRIGGER set_chat_messages_updated_at
    BEFORE UPDATE ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row-Level Security (RLS)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Users can view only their own chat messages
DROP POLICY IF EXISTS "chat_messages_select_own" ON public.chat_messages;
CREATE POLICY "chat_messages_select_own" ON public.chat_messages
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NULL);

-- 2. INSERT: Users can insert messages only for themselves
DROP POLICY IF EXISTS "chat_messages_insert_own" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_own" ON public.chat_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- 3. UPDATE: Users can update or soft-delete only their own messages
DROP POLICY IF EXISTS "chat_messages_update_own" ON public.chat_messages;
CREATE POLICY "chat_messages_update_own" ON public.chat_messages
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 4. DELETE: Users can delete only their own messages
DROP POLICY IF EXISTS "chat_messages_delete_own" ON public.chat_messages;
CREATE POLICY "chat_messages_delete_own" ON public.chat_messages
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());
