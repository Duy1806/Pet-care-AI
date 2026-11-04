/**
 * useChatStore — Zustand store for AI Veterinary Assistant
 */
import { create } from 'zustand';
import type { ChatMessage } from '@/domain/entities/ChatMessage';
import { GeminiAssistantService, type PetContext } from '@/domain/services/GeminiAssistantService';

interface ChatStoreState {
  messages: ChatMessage[];
  isLoading: boolean;
  apiKey: string;
  activePetContext: PetContext | null;

  // Actions
  sendMessage: (text: string) => Promise<void>;
  clearHistory: () => void;
  setApiKey: (key: string) => void;
  setActivePetContext: (pet: PetContext | null) => void;
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
  messages: [INITIAL_WELCOME_MESSAGE],
  isLoading: false,
  apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY || '',
  activePetContext: null,

  setApiKey: (key: string) => set({ apiKey: key.trim() }),

  setActivePetContext: (pet: PetContext | null) => set({ activePetContext: pet }),

  clearHistory: () => set({ messages: [INITIAL_WELCOME_MESSAGE] }),

  sendMessage: async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || get().isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: Date.now(),
      petContext: get().activePetContext ? {
        petId: get().activePetContext?.id,
        petName: get().activePetContext?.name,
        species: get().activePetContext?.species,
        breed: get().activePetContext?.breed,
        weightKg: get().activePetContext?.weightKg,
      } : undefined,
    };

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

      set((state) => ({
        messages: [...state.messages, aiMsg],
        isLoading: false,
      }));
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
