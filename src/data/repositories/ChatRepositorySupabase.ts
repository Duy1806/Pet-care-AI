/**
 * PawCare AI — Chat Repository Supabase
 *
 * Implements ChatGPT/Gemini conversation storage on Supabase Cloud:
 * - chat_conversations: Thread headers (title, user_id, pet_name, updated_at)
 * - chat_messages: Itemized questions & answers linked to conversation_id
 */
import { supabase } from '../remote/supabaseClient';
import type { ChatConversation, ChatMessage } from '@/domain/entities/ChatMessage';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ChatRepositorySupabase {
  /**
   * Save or update a conversation header
   */
  async upsertConversation(conv: ChatConversation): Promise<void> {
    if (!UUID_REGEX.test(conv.userId) || !UUID_REGEX.test(conv.id)) return;

    try {
      const payload = {
        id: conv.id,
        user_id: conv.userId,
        title: conv.title,
        pet_name: conv.petName ?? null,
        created_at: new Date(conv.createdAt).toISOString(),
        updated_at: new Date(conv.updatedAt).toISOString(),
      };

      const { error } = await supabase
        .from('chat_conversations')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        console.warn('[ChatRepositorySupabase] upsertConversation error:', error.message);
      }
    } catch (err) {
      console.warn('[ChatRepositorySupabase] upsertConversation failed:', err);
    }
  }

  /**
   * Get all active conversations for a user
   */
  async getConversations(userId: string): Promise<ChatConversation[]> {
    if (!UUID_REGEX.test(userId)) return [];

    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('[ChatRepositorySupabase] getConversations error:', error.message);
        return [];
      }

      if (!data) return [];

      return data.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        title: r.title,
        petName: r.pet_name ?? undefined,
        createdAt: new Date(r.created_at).getTime(),
        updatedAt: new Date(r.updated_at).getTime(),
      }));
    } catch (err) {
      console.warn('[ChatRepositorySupabase] getConversations failed:', err);
      return [];
    }
  }

  /**
   * Get all messages in a conversation
   */
  async getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
    if (!UUID_REGEX.test(conversationId)) return [];

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[ChatRepositorySupabase] getConversationMessages error:', error.message);
        return [];
      }

      if (!data) return [];

      return data.map((r: any) => ({
        id: r.id,
        conversationId: r.conversation_id,
        sender: r.sender as 'user' | 'assistant',
        text: r.content,
        timestamp: new Date(r.created_at).getTime(),
      }));
    } catch (err) {
      console.warn('[ChatRepositorySupabase] getConversationMessages failed:', err);
      return [];
    }
  }

  /**
   * Save a single message in a conversation
   */
  async saveMessage(msg: ChatMessage, conversationId: string, userId: string): Promise<void> {
    if (!UUID_REGEX.test(userId) || !UUID_REGEX.test(conversationId) || !UUID_REGEX.test(msg.id)) {
      return;
    }

    try {
      const payload = {
        id: msg.id,
        conversation_id: conversationId,
        user_id: userId,
        sender: msg.sender,
        content: msg.text,
        created_at: new Date(msg.timestamp || Date.now()).toISOString(),
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
   * Delete an entire conversation
   */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    if (!UUID_REGEX.test(userId) || !UUID_REGEX.test(conversationId)) return;

    try {
      const now = new Date().toISOString();
      await supabase
        .from('chat_conversations')
        .update({ deleted_at: now })
        .eq('id', conversationId)
        .eq('user_id', userId);

      await supabase
        .from('chat_messages')
        .update({ deleted_at: now })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);
    } catch (err) {
      console.warn('[ChatRepositorySupabase] deleteConversation error:', err);
    }
  }
}
