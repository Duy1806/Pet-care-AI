/**
 * PawCare AI — Chat Repository Supabase
 *
 * Persists AI chat conversations and question history to Supabase cloud database
 * with user isolation (RLS) and offline/mock resilience.
 */
import { supabase } from '../remote/supabaseClient';
import type { ChatMessage } from '@/domain/entities/ChatMessage';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ChatRepositorySupabase {
  /**
   * Save a single chat message to Supabase
   */
  async saveMessage(msg: ChatMessage, userId: string, sessionId = 'default'): Promise<void> {
    if (!UUID_REGEX.test(userId)) {
      // Non-UUID (anonymous/demo), skipped on cloud
      return;
    }

    try {
      const petId = msg.petContext?.petId && UUID_REGEX.test(msg.petContext.petId)
        ? msg.petContext.petId
        : null;

      const payload = {
        id: msg.id,
        user_id: userId,
        session_id: sessionId,
        pet_id: petId,
        sender: msg.sender,
        text: msg.text,
        pet_context: msg.petContext ?? null,
        suggested_actions: msg.suggestedActions ?? [],
        is_error: Boolean(msg.isError),
        created_at: new Date(msg.timestamp).toISOString(),
      };

      const { error } = await supabase
        .from('chat_messages')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn('[ChatRepositorySupabase] saveMessage error:', error.message);
      }
    } catch (err) {
      console.warn('[ChatRepositorySupabase] saveMessage failed:', err);
    }
  }

  /**
   * Fetch all messages for a specific user from Supabase
   */
  async getMessages(userId: string, sessionId = 'default'): Promise<ChatMessage[]> {
    if (!UUID_REGEX.test(userId)) {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[ChatRepositorySupabase] getMessages error:', error.message);
        return [];
      }

      if (!data) return [];

      return data.map((row: any) => ({
        id: row.id,
        sender: row.sender as 'user' | 'assistant',
        text: row.text,
        timestamp: new Date(row.created_at).getTime(),
        petContext: row.pet_context ?? undefined,
        suggestedActions: Array.isArray(row.suggested_actions) ? row.suggested_actions : undefined,
        isError: Boolean(row.is_error),
      }));
    } catch (err) {
      console.warn('[ChatRepositorySupabase] getMessages failed:', err);
      return [];
    }
  }

  /**
   * Delete a single message from Supabase
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    if (!UUID_REGEX.test(userId)) return;

    try {
      await supabase
        .from('chat_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('user_id', userId);
    } catch (err) {
      console.warn('[ChatRepositorySupabase] deleteMessage error:', err);
    }
  }

  /**
   * Soft-delete all chat messages for this user/session
   */
  async clearMessages(userId: string, sessionId = 'default'): Promise<void> {
    if (!UUID_REGEX.test(userId)) return;

    try {
      await supabase
        .from('chat_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('session_id', sessionId);
    } catch (err) {
      console.warn('[ChatRepositorySupabase] clearMessages error:', err);
    }
  }
}
