/**
 * useChatStore — Zustand store for AI Veterinary Assistant
 *
 * Implements ChatGPT/Gemini conversation architecture:
 * - Active thread management with continuous dialogue context
 * - Multi-conversation list (ChatGPT-style history)
 * - Real-time persistence to local SQLite & Supabase Cloud
 * - Strict multi-user isolation
 */
import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import type { ChatConversation, ChatMessage } from '@/domain/entities/ChatMessage';
import { GeminiAssistantService, cleanAssistantText, type PetContext } from '@/domain/services/GeminiAssistantService';
import { ChatHistoryDao } from '@/data/local/ChatHistoryDao';
import { ChatRepositorySupabase } from '@/data/repositories/ChatRepositorySupabase';

const chatRepo = new ChatRepositorySupabase();

export const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'msg_welcome',
  sender: 'assistant',
  text: 'Xin chào! Tôi là PawCare AI Doctor - Bác sĩ Thú y AI của bạn. 🩺🐾\n\nTôi có thể giải đáp các thắc mắc về sức khỏe, biểu hiện bất thường, khẩu phần dinh dưỡng hoặc lịch tiêm chủng cho thú cưng của bạn. Hãy gửi câu hỏi cho tôi nhé!',
  timestamp: Date.now(),
  suggestedActions: [
    'Bé nhà mình bỏ ăn 1 ngày có sao không?',
    'Lịch tiêm phòng mũi đầu cho thú cưng?',
    'Chó bị nôn ra bọt trắng cần xử lý thế nào?',
    'Thực phẩm nào gây độc nguy hiểm cho chó mèo?',
  ],
};

interface ChatStoreState {
  currentUserId: string | null;
  activeConversationId: string | null;
  activeConversationTitle: string | null;
  conversations: ChatConversation[];
  messages: ChatMessage[];
  isLoading: boolean;
  apiKey: string;
  activePetContext: PetContext | null;
  isChatModalOpen: boolean;
  isHistoryModalOpen: boolean;

  // Actions
  setUser: (userId: string | null) => Promise<void>;
  startNewChat: () => void;
  selectConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  clearCurrentConversation: () => Promise<void>;
  clearHistory: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  setApiKey: (key: string) => void;
  setActivePetContext: (pet: PetContext | null) => void;
  openChatModal: () => void;
  closeChatModal: () => void;
  toggleChatModal: () => void;
  openHistoryModal: () => void;
  closeHistoryModal: () => void;
  loadConversations: () => Promise<void>;
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  currentUserId: null,
  activeConversationId: null,
  activeConversationTitle: null,
  conversations: [],
  messages: [INITIAL_WELCOME_MESSAGE],
  isLoading: false,
  apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
  activePetContext: null,
  isChatModalOpen: false,
  isHistoryModalOpen: false,

  setUser: async (userId: string | null) => {
    if (!userId) {
      set({
        currentUserId: null,
        activeConversationId: null,
        activeConversationTitle: null,
        conversations: [],
        messages: [INITIAL_WELCOME_MESSAGE],
        activePetContext: null,
      });
      return;
    }

    set({ currentUserId: userId });
    await get().loadConversations();
  },

  startNewChat: () => {
    set({
      activeConversationId: null,
      activeConversationTitle: null,
      messages: [INITIAL_WELCOME_MESSAGE],
    });
  },

  selectConversation: async (conversationId: string) => {
    try {
      const convs = get().conversations;
      const targetConv = convs.find((c) => c.id === conversationId);

      let loadedMessages = await ChatHistoryDao.getConversationMessages(conversationId);

      // If local cache is empty and user is authenticated, query Supabase Cloud
      if ((!loadedMessages || loadedMessages.length === 0) && get().currentUserId) {
        loadedMessages = await chatRepo.getConversationMessages(conversationId);
        // Cache to local SQLite
        for (const m of loadedMessages) {
          void ChatHistoryDao.saveMessage(m, conversationId, get().currentUserId || 'anonymous');
        }
      }

      set({
        activeConversationId: conversationId,
        activeConversationTitle: targetConv?.title || null,
        messages: loadedMessages.length > 0 ? loadedMessages : [INITIAL_WELCOME_MESSAGE],
        isHistoryModalOpen: false,
        isChatModalOpen: true,
      });
    } catch (e) {
      console.warn('[useChatStore] selectConversation error:', e);
    }
  },

  deleteConversation: async (conversationId: string) => {
    try {
      const uid = get().currentUserId || 'anonymous';
      await ChatHistoryDao.deleteConversation(conversationId);
      if (uid !== 'anonymous') {
        void chatRepo.deleteConversation(conversationId, uid);
      }
      if (get().activeConversationId === conversationId) {
        get().startNewChat();
      }
      await get().loadConversations();
    } catch (e) {
      console.warn('[useChatStore] deleteConversation error:', e);
    }
  },

  clearCurrentConversation: async () => {
    const activeId = get().activeConversationId;
    if (activeId) {
      await get().deleteConversation(activeId);
    } else {
      get().startNewChat();
    }
  },

  clearHistory: async () => {
    await get().clearCurrentConversation();
  },

  loadConversations: async () => {
    try {
      const uid = get().currentUserId || 'anonymous';
      let list = await ChatHistoryDao.getConversations(uid);

      // If SQLite has no conversations and user is signed into Supabase, sync from Cloud
      if ((!list || list.length === 0) && uid !== 'anonymous') {
        const cloudList = await chatRepo.getConversations(uid);
        if (cloudList && cloudList.length > 0) {
          for (const c of cloudList) {
            void ChatHistoryDao.upsertConversation(c);
          }
          list = cloudList;
        }
      }

      set({ conversations: list });
    } catch (e) {
      console.warn('[useChatStore] loadConversations error:', e);
    }
  },

  setApiKey: (key: string) => set({ apiKey: key.trim() }),

  setActivePetContext: (pet: PetContext | null) => set({ activePetContext: pet }),

  openChatModal: () => {
    set({ isChatModalOpen: true });
    void get().loadConversations();
  },

  closeChatModal: () => set({ isChatModalOpen: false }),

  toggleChatModal: () => {
    const nextState = !get().isChatModalOpen;
    set({ isChatModalOpen: nextState });
    if (nextState) {
      void get().loadConversations();
    }
  },

  openHistoryModal: () => {
    set({ isHistoryModalOpen: true });
    void get().loadConversations();
  },

  closeHistoryModal: () => set({ isHistoryModalOpen: false }),

  sendMessage: async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || get().isLoading) return;

    const uid = get().currentUserId || 'anonymous';
    let convId = get().activeConversationId;
    let convTitle = get().activeConversationTitle;

    // If starting a fresh chat, create a new conversation thread
    if (!convId) {
      convId = Crypto.randomUUID();
      convTitle = trimmed.length > 38 ? trimmed.slice(0, 35) + '...' : trimmed;
      const newConv: ChatConversation = {
        id: convId,
        userId: uid,
        title: convTitle,
        petName: get().activePetContext?.name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      set({ activeConversationId: convId, activeConversationTitle: convTitle });

      void ChatHistoryDao.upsertConversation(newConv);
      if (uid !== 'anonymous') {
        void chatRepo.upsertConversation(newConv);
      }
    }

    const userMsgId = Crypto.randomUUID();
    const userMsg: ChatMessage = {
      id: userMsgId,
      conversationId: convId,
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

    // Save user message to SQLite & Supabase
    void ChatHistoryDao.saveMessage(userMsg, convId, uid);
    if (uid !== 'anonymous') {
      void chatRepo.saveMessage(userMsg, convId, uid);
    }

    // Filter out welcome message when adding user prompt to active thread
    const currentList = get().messages.filter((m) => m.id !== 'msg_welcome');
    set({
      messages: [...currentList, userMsg],
      isLoading: true,
    });

    try {
      const response = await GeminiAssistantService.consult({
        userQuery: trimmed,
        petContext: get().activePetContext,
        history: get().messages, // Continuous dialogue context like ChatGPT
        apiKey: get().apiKey,
      });

      const aiMsgId = Crypto.randomUUID();
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        conversationId: convId,
        sender: 'assistant',
        text: cleanAssistantText(response.text),
        timestamp: Date.now(),
        suggestedActions: response.suggestedActions,
      };

      // Save AI response to SQLite & Supabase
      void ChatHistoryDao.saveMessage(aiMsg, convId, uid);
      if (uid !== 'anonymous') {
        void chatRepo.saveMessage(aiMsg, convId, uid);
      }

      set((state) => ({
        messages: [...state.messages, aiMsg],
        isLoading: false,
      }));

      // Refresh conversations list to update latest timestamp and previews
      void get().loadConversations();
    } catch (e) {
      const errMsg: ChatMessage = {
        id: Crypto.randomUUID(),
        conversationId: convId,
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
