/**
 * ChatMessage entity for Generative AI Veterinary Assistant
 */
export interface ChatMessage {
  id: string;
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
