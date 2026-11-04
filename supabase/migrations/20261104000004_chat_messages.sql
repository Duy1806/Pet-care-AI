-- ==============================================================================
-- Migration: 20261104000004_chat_messages.sql
-- Description: ChatGPT/Gemini-style AI conversation history schema with
--              chat_conversations and chat_messages tables.
-- ==============================================================================

-- 1. CHAT_CONVERSATIONS TABLE (Từng chủ đề / phiên hội thoại)
CREATE TABLE IF NOT EXISTS public.chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    pet_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.chat_conversations IS 'Lưu trữ các phiên / cuộc hội thoại với Bác sĩ Thú y AI (tương tự ChatGPT/Gemini)';

-- 2. CHAT_MESSAGES TABLE (Chi tiết từng tin nhắn hỏi-đáp trong phiên hội thoại)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE public.chat_messages IS 'Chi tiết các tin nhắn của người dùng và AI theo từng cuộc hội thoại';

-- 3. INDICES CHO HIỆU NĂNG CAO
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user 
    ON public.chat_conversations(user_id, updated_at DESC) 
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv 
    ON public.chat_messages(conversation_id, created_at ASC) 
    WHERE deleted_at IS NULL;

-- 4. TRIGGER CẬP NHẬT UPDATED_AT CHO CUỘC HỘI THOẠI
DROP TRIGGER IF EXISTS set_chat_conversations_updated_at ON public.chat_conversations;
CREATE TRIGGER set_chat_conversations_updated_at
    BEFORE UPDATE ON public.chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. BẬT ROW-LEVEL SECURITY (RLS)
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- POLICIES CHO CHAT_CONVERSATIONS
DROP POLICY IF EXISTS "conversations_select_own" ON public.chat_conversations;
CREATE POLICY "conversations_select_own" ON public.chat_conversations
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "conversations_insert_own" ON public.chat_conversations;
CREATE POLICY "conversations_insert_own" ON public.chat_conversations
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "conversations_update_own" ON public.chat_conversations;
CREATE POLICY "conversations_update_own" ON public.chat_conversations
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "conversations_delete_own" ON public.chat_conversations;
CREATE POLICY "conversations_delete_own" ON public.chat_conversations
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- POLICIES CHO CHAT_MESSAGES
DROP POLICY IF EXISTS "messages_select_own" ON public.chat_messages;
CREATE POLICY "messages_select_own" ON public.chat_messages
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS "messages_insert_own" ON public.chat_messages;
CREATE POLICY "messages_insert_own" ON public.chat_messages
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "messages_update_own" ON public.chat_messages;
CREATE POLICY "messages_update_own" ON public.chat_messages
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "messages_delete_own" ON public.chat_messages;
CREATE POLICY "messages_delete_own" ON public.chat_messages
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());
