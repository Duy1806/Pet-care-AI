/**
 * useChatStore — Zustand store for AI Veterinary Assistant
 *
 * Persists chat history & questions locally via SQLite (ChatHistoryDao)
 * with strict per-user account isolation.
 */
import { create } from 'zustand';
import type { ChatMessage } from '@/domain/entities/ChatMessage';
import { GeminiAssistantService, type PetContext } from '@/domain/services/GeminiAssistantService';
import { ChatHistoryDao, type QuestionHistoryItem } from '@/data/local/ChatHistoryDao';
import { ChatRepositorySupabase } from '@/data/repositories/ChatRepositorySupabase';

const chatRepo = new ChatRepositorySupabase();

interface ChatStoreState {
  currentUserId: string | null;
  messages: ChatMessage[];
  questionHistory: QuestionHistoryItem[];
  isLoading: boolean;
  apiKey: string;
  activePetContext: PetContext | null;
  isChatModalOpen: boolean;
  isHistoryModalOpen: boolean;

  // Actions
  setUser: (userId: string | null) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  setApiKey: (key: string) => void;
  setActivePetContext: (pet: PetContext | null) => void;
  openChatModal: () => void;
  closeChatModal: () => void;
  toggleChatModal: () => void;
  openHistoryModal: () => void;
  closeHistoryModal: () => void;
  loadPersistedHistory: () => Promise<void>;
  loadQuestionHistory: () => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;
}

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'msg_welcome',
  sender: 'assistant',
  text: 'Xin chào! Tôi là **PawCare AI Doctor** - Bác sĩ Thú y AI của bạn. 🩺🐾\n\nTôi có thể giải đáp các thắc mắc về sức khỏe, biểu hiện bất thường, khẩu phần dinh dưỡng hoặc lịch tiêm chủng cho thú cưng của bạn. Hãy gửi câu hỏi cho tôi nhé!',
  timestamp: Date.now(),
  suggestedActions: [
    'Bé nhà mình bỏ ăn 1 ngày có sao không?',
    'Lịch tiêm phòng mũi đầu cho thú cưng?',
    'Chó bị nôn ra bọt trắng cần xử lý thế nào?',
    'Thực phẩm nào gây độc nguy hiểm cho chó mèo?',
  ],
};

export const useChatStore = create<ChatStoreState>((set, get) => ({
  currentUserId: null,
  messages: [INITIAL_WELCOME_MESSAGE],
  questionHistory: [],
  isLoading: false,
  apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
  activePetContext: null,
  isChatModalOpen: false,
  isHistoryModalOpen: false,

  setUser: async (userId: string | null) => {
    if (!userId) {
      set({
        currentUserId: null,
        messages: [INITIAL_WELCOME_MESSAGE],
        questionHistory: [],
        activePetContext: null,
      });
      return;
    }

    set({ currentUserId: userId });
    await get().loadPersistedHistory();
    await get().loadQuestionHistory();
  },

  setApiKey: (key: string) => set({ apiKey: key.trim() }),

  setActivePetContext: (pet: PetContext | null) => set({ activePetContext: pet }),

  openChatModal: () => {
    set({ isChatModalOpen: true });
    void get().loadPersistedHistory();
    void get().loadQuestionHistory();
  },

  closeChatModal: () => set({ isChatModalOpen: false }),

  toggleChatModal: () => {
    const nextState = !get().isChatModalOpen;
    set({ isChatModalOpen: nextState });
    if (nextState) {
      void get().loadPersistedHistory();
      void get().loadQuestionHistory();
    }
  },

  openHistoryModal: () => {
    set({ isHistoryModalOpen: true });
    void get().loadQuestionHistory();
  },

  closeHistoryModal: () => set({ isHistoryModalOpen: false }),

  loadPersistedHistory: async () => {
    try {
      const uid = get().currentUserId || 'anonymous';
      const savedMessages = await ChatHistoryDao.getAllMessages(uid);
      if (savedMessages && savedMessages.length > 0) {
        set({ messages: [INITIAL_WELCOME_MESSAGE, ...savedMessages] });
      } else {
        // If local SQLite is empty and user is authenticated, sync from Supabase cloud
        if (uid !== 'anonymous') {
          const remoteMessages = await chatRepo.getMessages(uid);
          if (remoteMessages && remoteMessages.length > 0) {
            for (const rm of remoteMessages) {
              void ChatHistoryDao.saveMessage(rm, uid);
            }
            set({ messages: [INITIAL_WELCOME_MESSAGE, ...remoteMessages] });
            return;
          }
        }
        set({ messages: [INITIAL_WELCOME_MESSAGE] });
      }
    } catch (e) {
      console.warn('[useChatStore] loadPersistedHistory error:', e);
    }
  },

  loadQuestionHistory: async () => {
    try {
      const uid = get().currentUserId || 'anonymous';
      const items = await ChatHistoryDao.getQuestionHistory(uid);
      set({ questionHistory: items });
    } catch (e) {
      console.warn('[useChatStore] loadQuestionHistory error:', e);
    }
  },

  deleteQuestion: async (id: string) => {
    try {
      const uid = get().currentUserId || 'anonymous';
      await ChatHistoryDao.deleteQuestion(id);
      if (uid !== 'anonymous') {
        void chatRepo.deleteMessage(id, uid);
      }
      await get().loadQuestionHistory();
    } catch (e) {
      console.warn('[useChatStore] deleteQuestion error:', e);
    }
  },

  clearHistory: async () => {
    try {
      const uid = get().currentUserId || 'anonymous';
      await ChatHistoryDao.clearMessages(uid);
      if (uid !== 'anonymous') {
        void chatRepo.clearMessages(uid);
      }
    } catch (e) {
      console.warn('[useChatStore] clearHistory error:', e);
    }
    set({ messages: [INITIAL_WELCOME_MESSAGE], questionHistory: [] });
  },

  sendMessage: async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || get().isLoading) return;

    const uid = get().currentUserId || 'anonymous';

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: Date.now(),
      petContext: get().activePetContext
        ? {
            petId: get().activePetContext?.id,
            petName: get().activePetContext?.name,
            species: get().activePetContext?.species,
            breed: get().activePetContext?.breed,
            weightKg: get().activePetContext?.weightKg,
          }
        : undefined,
    };

    // Save user message to SQLite with user_id & Supabase cloud
    void ChatHistoryDao.saveMessage(userMsg, uid);
    if (uid !== 'anonymous') {
      void chatRepo.saveMessage(userMsg, uid);
    }

    set((state) => ({
      messages: [...state.messages, userMsg],
      isLoading: true,
    }));

    try {
      const response = await GeminiAssistantService.consult({
        userQuery: trimmed,
        petContext: get().activePetContext,
        history: get().messages,
        apiKey: get().apiKey,
      });

      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: 'assistant',
        text: response.text,
        timestamp: Date.now(),
        suggestedActions: response.suggestedActions,
      };

      // Save AI response to SQLite with user_id & Supabase cloud
      void ChatHistoryDao.saveMessage(aiMsg, uid);
      if (uid !== 'anonymous') {
        void chatRepo.saveMessage(aiMsg, uid);
      }

      set((state) => ({
        messages: [...state.messages, aiMsg],
        isLoading: false,
      }));

      // Refresh question history
      void get().loadQuestionHistory();
    } catch (e) {
      const errMsg: ChatMessage = {
        id: `msg_err_${Date.now()}`,
        sender: 'assistant',
        text: `Đã xảy ra lỗi: ${e instanceof Error ? e.message : 'Không thể kết nối tới AI'}. Vui lòng thử lại.`,
        timestamp: Date.now(),
        isError: true,
      };

      set((state) => ({
        messages: [...state.messages, errMsg],
        isLoading: false,
      }));
    }
  },
}));
