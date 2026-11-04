/**
 * GeminiAssistantService Unit Tests
 */
import { GeminiAssistantService } from './GeminiAssistantService';

describe('GeminiAssistantService', () => {
  it('should return fallback veterinary response when no API key is provided', async () => {
    const result = await GeminiAssistantService.consult({
      userQuery: 'Bé mèo bỏ ăn 1 ngày có sao không?',
      petContext: {
        name: 'Miu',
        species: 'cat',
        breed: 'British Shorthair',
        weightKg: 4.2,
      },
    });

    expect(result.text).toBeDefined();
    expect(result.text).toContain('Miu');
    expect(result.text).toContain('bỏ ăn');
    expect(result.suggestedActions).toBeDefined();
    expect(result.suggestedActions?.length).toBeGreaterThan(0);
  });

  it('should provide vomiting advice when asked about nôn mửa', async () => {
    const result = await GeminiAssistantService.consult({
      userQuery: 'Chó bị nôn ra bọt trắng thì làm sao?',
      petContext: {
        name: 'Milo',
        species: 'dog',
        breed: 'Poodle',
        weightKg: 5.0,
      },
    });

    expect(result.text).toContain('Milo');
    expect(result.text).toContain('nôn');
  });

  it('should provide vaccination schedule advice when asked about tiêm phòng', async () => {
    const result = await GeminiAssistantService.consult({
      userQuery: 'Lịch tiêm phòng mũi đầu cho cún con như thế nào?',
    });

    expect(result.text).toContain('tiêm chủng');
    expect(result.suggestedActions).toBeDefined();
  });
});
