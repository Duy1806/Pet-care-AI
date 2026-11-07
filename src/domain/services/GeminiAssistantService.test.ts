/**
 * GeminiAssistantService Unit Tests
 */
import { GeminiAssistantService, cleanAssistantText } from './GeminiAssistantService';

describe('GeminiAssistantService', () => {
  it('should clean markdown asterisks properly', () => {
    const raw = '**Lời khuyên:**\n* Ý 1: *uống nước*\n* Ý 2: ăn hạt';
    const cleaned = cleanAssistantText(raw);
    expect(cleaned).not.toContain('*');
    expect(cleaned).toContain('Lời khuyên:');
    expect(cleaned).toContain('Ý 1: uống nước');
  });

  it('should return fallback veterinary response without asterisks when no API key is provided', async () => {
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
    expect(result.text).not.toContain('*');
    expect(result.suggestedActions).toBeDefined();
    expect(result.suggestedActions?.length).toBeGreaterThan(0);
  });

  it('should provide vomiting advice when asked about nôn mửa without asterisks', async () => {
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
    expect(result.text).not.toContain('*');
  });

  it('should provide vaccination schedule advice when asked about tiêm phòng without asterisks', async () => {
    const result = await GeminiAssistantService.consult({
      userQuery: 'Lịch tiêm phòng mũi đầu cho cún con như thế nào?',
    });

    expect(result.text).toContain('tiêm chủng');
    expect(result.text).not.toContain('*');
    expect(result.suggestedActions).toBeDefined();
  });
});

