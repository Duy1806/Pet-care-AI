/**
 * PawCare AI — Chat History DAO (SQLite)
 *
 * Implements ChatGPT/Gemini conversation architecture with local SQLite persistence:
 * - chat_conversations: stores thread titles, timestamps, and pet context
 * - chat_messages: stores chronological user and AI messages linked by conversation_id
 * - Backward compatibility migration for older chat records
 */
import { getDatabase } from './database';
import type { ChatConversation, ChatMessage } from '@/domain/entities/ChatMessage';

export class ChatHistoryDao {
  private static isInitialized = false;

  private static async ensureTable(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const db = await getDatabase();

      // 1. Ensure tables exist (without dependent composite index on chat_messages first)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS chat_conversations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          pet_name TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT,
          user_id TEXT NOT NULL DEFAULT 'anonymous',
          sender TEXT NOT NULL,
          content TEXT,
          created_at INTEGER NOT NULL
        );
      `);

      // 2. Inspect columns of chat_messages to migrate legacy schema safely
      const msgCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(chat_messages);`);
      const colSet = new Set(msgCols.map((c) => c.name));

      if (!colSet.has('conversation_id')) {
        await db.execAsync(`ALTER TABLE chat_messages ADD COLUMN conversation_id TEXT;`);
      }
      if (!colSet.has('content')) {
        await db.execAsync(`ALTER TABLE chat_messages ADD COLUMN content TEXT;`);
      }
      if (!colSet.has('created_at')) {
        await db.execAsync(`ALTER TABLE chat_messages ADD COLUMN created_at INTEGER;`);
      }
      if (!colSet.has('user_id')) {
        await db.execAsync(`ALTER TABLE chat_messages ADD COLUMN user_id TEXT NOT NULL DEFAULT 'anonymous';`);
      }
      if (!colSet.has('sender')) {
        await db.execAsync(`ALTER TABLE chat_messages ADD COLUMN sender TEXT NOT NULL DEFAULT 'user';`);
      }

      // 3. Now that conversation_id and created_at definitely exist, safely create indexes
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_conversations_user 
          ON chat_conversations(user_id, updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_messages_conv 
          ON chat_messages(conversation_id, created_at ASC);
      `);

      // 4. If legacy messages exist with `text` but `content` is null, copy `text` into `content`
      if (colSet.has('text')) {
        try {
          await db.execAsync(`
            UPDATE chat_messages 
            SET content = text 
            WHERE content IS NULL AND text IS NOT NULL;
          `);
        } catch {
          // ignore
        }
      }

      // If legacy messages exist with `timestamp` but `created_at` is null, copy `timestamp`
      if (colSet.has('timestamp')) {
        try {
          await db.execAsync(`
            UPDATE chat_messages 
            SET created_at = timestamp 
            WHERE created_at IS NULL AND timestamp IS NOT NULL;
          `);
        } catch {
          // ignore
        }
      }

      // 5. Migrate any orphaned messages into a default conversation
      try {
        const orphaned = await db.getAllAsync<any>(
          `SELECT id, user_id, content, created_at 
           FROM chat_messages 
           WHERE conversation_id IS NULL OR conversation_id = '' 
           ORDER BY created_at ASC`
        );

        if (orphaned.length > 0) {
          const defaultConvId = 'conv_legacy_default';
          const firstMsg = orphaned[0];
          const titleText = (firstMsg.content || 'Tư vấn sức khỏe thú cưng')
            .slice(0, 36)
            .trim();
          const convTime = firstMsg.created_at || Date.now();
          const convUserId = firstMsg.user_id || 'anonymous';

          await db.runAsync(
            `INSERT OR IGNORE INTO chat_conversations (id, user_id, title, pet_name, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [defaultConvId, convUserId, titleText, null, convTime, convTime]
          );

          await db.runAsync(
            `UPDATE chat_messages 
             SET conversation_id = ? 
             WHERE conversation_id IS NULL OR conversation_id = ''`,
            [defaultConvId]
          );
        }
      } catch {
        // ignore legacy orphaned migration errors
      }

      this.isInitialized = true;
    } catch (err) {
      console.warn('[ChatHistoryDao] Failed to ensure tables:', err);
    }
  }

  /**
   * Create or update a conversation header
   */
  static async upsertConversation(conv: ChatConversation): Promise<void> {
    await this.ensureTable();
    try {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT OR REPLACE INTO chat_conversations (id, user_id, title, pet_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [conv.id, conv.userId, conv.title, conv.petName ?? null, conv.createdAt, conv.updatedAt]
      );
    } catch (err) {
      console.warn('[ChatHistoryDao] upsertConversation error:', err);
    }
  }

  /**
   * Get all conversations for a user, sorted newest first
   */
  static async getConversations(userId = 'anonymous'): Promise<ChatConversation[]> {
    await this.ensureTable();
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<any>(
        `SELECT c.*, 
           (SELECT content FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
         FROM chat_conversations c
         WHERE (c.user_id = ? OR c.user_id = 'anonymous' OR c.user_id IS NULL)
         ORDER BY c.updated_at DESC`,
        [userId]
      );

      return rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        title: r.title,
        petName: r.pet_name ?? undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        lastMessage: r.last_message ?? undefined,
      }));
    } catch (err) {
      console.warn('[ChatHistoryDao] getConversations error:', err);
      return [];
    }
  }

  /**
   * Get all messages for a specific conversation
   */
  static async getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
    await this.ensureTable();
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<any>(
        `SELECT * FROM chat_messages 
         WHERE conversation_id = ? 
         ORDER BY created_at ASC`,
        [conversationId]
      );

      return rows.map((r) => ({
        id: r.id,
        conversationId: r.conversation_id,
        sender: r.sender as 'user' | 'assistant',
        text: r.content || r.text || '',
        timestamp: r.created_at || r.timestamp || Date.now(),
      }));
    } catch (err) {
      console.warn('[ChatHistoryDao] getConversationMessages error:', err);
      return [];
    }
  }

  /**
   * Save a single chat message
   */
  static async saveMessage(msg: ChatMessage, conversationId: string, userId = 'anonymous'): Promise<void> {
    await this.ensureTable();
    try {
      const db = await getDatabase();
      const ts = msg.timestamp || Date.now();

      await db.runAsync(
        `INSERT OR REPLACE INTO chat_messages (id, conversation_id, user_id, sender, content, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [msg.id, conversationId, userId, msg.sender, msg.text, ts]
      );

      // Touch updated_at on the conversation
      await db.runAsync(
        `UPDATE chat_conversations SET updated_at = ? WHERE id = ?`,
        [ts, conversationId]
      );
    } catch (err) {
      console.warn('[ChatHistoryDao] saveMessage error:', err);
    }
  }

  /**
   * Delete an entire conversation and all its messages
   */
  static async deleteConversation(conversationId: string): Promise<void> {
    await this.ensureTable();
    try {
      const db = await getDatabase();
      await db.runAsync(`DELETE FROM chat_messages WHERE conversation_id = ?`, [conversationId]);
      await db.runAsync(`DELETE FROM chat_conversations WHERE id = ?`, [conversationId]);
    } catch (err) {
      console.warn('[ChatHistoryDao] deleteConversation error:', err);
    }
  }
}
