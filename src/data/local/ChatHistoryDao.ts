/**
 * PawCare AI — Chat History DAO (SQLite)
 *
 * Persists AI Veterinary Assistant messages and user question history
 * to the local SQLite database (pawcare.db).
 */
import { getDatabase } from './database';
import type { ChatMessage } from '@/domain/entities/ChatMessage';

export interface QuestionHistoryItem {
  id: string;
  question: string;
  timestamp: number;
  petName?: string;
}

export class ChatHistoryDao {
  private static isInitialized = false;

  private static async ensureTable(): Promise<void> {
    if (this.isInitialized) return;
    try {
      const db = await getDatabase();
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL DEFAULT 'default',
          sender TEXT NOT NULL,
          text TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          pet_id TEXT,
          pet_name TEXT,
          species TEXT,
          breed TEXT,
          weight_kg REAL,
          suggested_actions TEXT,
          is_error INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_messages(timestamp);
        CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id);
      `);
      this.isInitialized = true;
    } catch (err) {
      console.warn('[ChatHistoryDao] Failed to ensure table:', err);
    }
  }

  /**
   * Retrieve all messages for a given session in chronological order
   */
  static async getAllMessages(sessionId = 'default'): Promise<ChatMessage[]> {
    await this.ensureTable();
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<any>(
        `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC`,
        [sessionId]
      );

      return rows.map((r) => ({
        id: r.id,
        sender: r.sender as 'user' | 'assistant',
        text: r.text,
        timestamp: r.timestamp,
        petContext:
          r.pet_id || r.pet_name
            ? {
                petId: r.pet_id,
                petName: r.pet_name,
                species: r.species,
                breed: r.breed,
                weightKg: r.weight_kg,
              }
            : undefined,
        suggestedActions: r.suggested_actions ? JSON.parse(r.suggested_actions) : undefined,
        isError: Boolean(r.is_error),
      }));
    } catch (err) {
      console.warn('[ChatHistoryDao] getAllMessages error:', err);
      return [];
    }
  }

  /**
   * Persist a single chat message
   */
  static async saveMessage(msg: ChatMessage, sessionId = 'default'): Promise<void> {
    await this.ensureTable();
    try {
      const db = await getDatabase();
      await db.runAsync(
        `INSERT OR REPLACE INTO chat_messages 
         (id, session_id, sender, text, timestamp, pet_id, pet_name, species, breed, weight_kg, suggested_actions, is_error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          msg.id,
          sessionId,
          msg.sender,
          msg.text,
          msg.timestamp,
          msg.petContext?.petId ?? null,
          msg.petContext?.petName ?? null,
          msg.petContext?.species ?? null,
          msg.petContext?.breed ?? null,
          msg.petContext?.weightKg ?? null,
          msg.suggestedActions ? JSON.stringify(msg.suggestedActions) : null,
          msg.isError ? 1 : 0,
        ]
      );
    } catch (err) {
      console.warn('[ChatHistoryDao] saveMessage error:', err);
    }
  }

  /**
   * Delete all messages for a session (Reset chat)
   */
  static async clearMessages(sessionId = 'default'): Promise<void> {
    await this.ensureTable();
    try {
      const db = await getDatabase();
      await db.runAsync(`DELETE FROM chat_messages WHERE session_id = ?`, [sessionId]);
    } catch (err) {
      console.warn('[ChatHistoryDao] clearMessages error:', err);
    }
  }

  /**
   * Query distinct past user questions
   */
  static async getQuestionHistory(): Promise<QuestionHistoryItem[]> {
    await this.ensureTable();
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<any>(
        `SELECT id, text, timestamp, pet_name 
         FROM chat_messages 
         WHERE sender = 'user' 
         ORDER BY timestamp DESC 
         LIMIT 50`
      );

      return rows.map((r) => ({
        id: r.id,
        question: r.text,
        timestamp: r.timestamp,
        petName: r.pet_name ?? undefined,
      }));
    } catch (err) {
      console.warn('[ChatHistoryDao] getQuestionHistory error:', err);
      return [];
    }
  }

  /**
   * Delete a single question by id
   */
  static async deleteQuestion(id: string): Promise<void> {
    await this.ensureTable();
    try {
      const db = await getDatabase();
      await db.runAsync(`DELETE FROM chat_messages WHERE id = ?`, [id]);
    } catch (err) {
      console.warn('[ChatHistoryDao] deleteQuestion error:', err);
    }
  }
}

