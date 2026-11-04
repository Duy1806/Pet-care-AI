/**
 * ChatMessage entity for Generative AI Veterinary Assistant
 */
export interface ChatMessage {
  id: string;
  conversationId?: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  petContext?: {
    petId?: string;
    petName?: string;
    species?: 'dog' | 'cat';
    breed?: string;
    weightKg?: number;
  };
  suggestedActions?: string[];
  isError?: boolean;
}

export interface ChatConversation {
  id: string;
  userId: string;
  title: string;
  petId?: string;
  petName?: string;
  createdAt: number;
  updatedAt: number;
  lastMessage?: string;
}


