/**
 * GeminiAssistantService
 *
 * Domain service providing Generative AI veterinary consultations
 * via Google Gemini API (gemini-1.5-flash) with specialized veterinary context.
 */
import type { ChatMessage } from '../entities/ChatMessage';

export interface PetContext {
  id?: string;
  name: string;
  species: 'dog' | 'cat';
  breed?: string;
  weightKg?: number;
  ageYears?: number;
  isNeutered?: boolean;
}

export interface GeminiConsultationRequest {
  userQuery: string;
  petContext?: PetContext | null;
  history?: ChatMessage[];
  apiKey?: string;
}

const SYSTEM_PROMPT = `
Bạn là "PawCare AI Doctor" - Trợ lý Bác sĩ Thú y AI thông minh, tận tâm và chuyên nghiệp được phát triển riêng cho ứng dụng di động PawCare AI.

NGUYÊN TẮC HOẠT ĐỘNG:
1. Ngôn ngữ: Luôn trả lời bằng tiếng Việt thân thiện, rõ ràng, dễ hiểu cho người nuôi thú cưng.
2. Chuyên môn: Cung cấp thông tin chăm sóc sức khỏe, sơ cứu, dinh dưỡng, hành vi, và lịch tiêm chủng/tẩy giun chuẩn y khoa thú y.
3. Cá nhân hóa: Khi có thông tin thú cưng (tên, loài chó/mèo, giống loài, cân nặng), hãy xưng hô thân mật (ví dụ: "với bé [Tên bé] giống [Giống] nặng [Số kg]...") và đưa ra lời khuyên được may đo chính xác cho kích thước và cơ địa của bé.
4. Cảnh báo khẩn cấp: Nếu người dùng mô tả các triệu chứng nguy hiểm (khó thở, co giật, nôn ra máu, tiêu chảy cấp mất nước, ngộ độc sô-cô-la/hành tỏi, hôn mê), hãy CẢNH BÁO ĐỎ và khuyên đưa bé tới trạm thú y gần nhất NGAY LẬP TỨC.
5. Khuyến cáo y tế: Nhắc nhở người dùng rằng tư vấn của AI mang tính tham khảo chuyên môn và không thay thế hoàn toàn việc thăm khám trực tiếp tại phòng khám thú y.
6. Định dạng: Trình bày súc tích với gạch đầu dòng, emoji sinh động, dễ đọc trên màn hình điện thoại.
`;

export class GeminiAssistantService {
  private static defaultApiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

  /**
   * Get effective API key from parameter or environment
   */
  static getEffectiveApiKey(customKey?: string): string {
    return customKey?.trim() || this.defaultApiKey || '';
  }

  /**
   * Send consultation query to Google Gemini API
   */
  static async consult(request: GeminiConsultationRequest): Promise<{ text: string; suggestedActions?: string[] }> {
    const apiKey = this.getEffectiveApiKey(request.apiKey);

    if (!apiKey) {
      // Smart offline fallback if no API key is provided
      return this.generateSmartFallback(request.userQuery, request.petContext);
    }

    try {
      const primaryEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`;

      // Build context string from pet profile
      let petContextStr = '';
      if (request.petContext) {
        petContextStr = `\n[THÔNG TIN THÚ CƯNG HIỆN TẠI]:
- Tên: ${request.petContext.name}
- Loài: ${request.petContext.species === 'cat' ? 'Mèo' : 'Chó'}
- Giống: ${request.petContext.breed || 'Chưa rõ'}
- Cân nặng: ${request.petContext.weightKg ? `${request.petContext.weightKg} kg` : 'Chưa rõ'}
- Triệt sản: ${request.petContext.isNeutered ? 'Đã triệt sản' : 'Chưa triệt sản'}\n`;
      }

      // Build conversation contents
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      // Add recent history (up to last 6 messages)
      if (request.history && request.history.length > 0) {
        const recent = request.history.slice(-6);
        for (const msg of recent) {
          contents.push({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
          });
        }
      }

      // Add current user query with pet context
      const promptText = petContextStr ? `${petContextStr}\nCâu hỏi của người nuôi: ${request.userQuery}` : request.userQuery;
      contents.push({
        role: 'user',
        parts: [{ text: promptText }],
      });

      const requestBody = {
        contents,
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      };

      let response = await fetch(primaryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      // If primary model has temporary spike (503), gracefully switch to flash-lite
      if (!response.ok && (response.status === 503 || response.status === 404)) {
        const liteEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;
        response = await fetch(liteEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || `Lỗi Gemini API HTTP ${response.status}`;
        throw new Error(errMsg);
      }

      const resData = await response.json();
      const candidate = resData?.candidates?.[0];
      const textOutput = candidate?.content?.parts?.[0]?.text;

      if (!textOutput) {
        throw new Error('Gemini không trả về nội dung phù hợp.');
      }

      return {
        text: textOutput.trim(),
        suggestedActions: this.extractSuggestions(request.userQuery),
      };
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Lỗi kết nối AI';
      // If error (quota or network), provide informative fallback
      const fallback = this.generateSmartFallback(request.userQuery, request.petContext);
      return {
        text: `⚠️ [Lỗi kết nối Gemini: ${err}]\n\n💡 Dưới đây là phân tích sơ bộ từ cơ sở tri thức y khoa offline:\n\n${fallback.text}`,
        suggestedActions: fallback.suggestedActions,
      };
    }
  }

  /**
   * Extract dynamic action suggestions based on user intent
   */
  private static extractSuggestions(query: string): string[] {
    const q = query.toLowerCase();
    const suggestions: string[] = [];

    if (q.includes('ăn') || q.includes('dinh dưỡng') || q.includes('hạt') || q.includes('pate')) {
      suggestions.push('🥗 Xem gợi ý khẩu phần chuẩn');
      suggestions.push('🥩 Thức ăn nguy hiểm cần tránh');
    }
    if (q.includes('tiêm') || q.includes('vắc xin') || q.includes('chích') || q.includes('giun')) {
      suggestions.push('💉 Xem sổ tiêm chủng');
      suggestions.push('📅 Đặt lịch tiêm phòng mới');
    }
    if (q.includes('giống') || q.includes('chó') || q.includes('mèo') || q.includes('loài')) {
      suggestions.push('📸 Quét nhận diện giống AI');
    }
    if (suggestions.length === 0) {
      suggestions.push('🥗 Tư vấn dinh dưỡng');
      suggestions.push('💉 Lịch tiêm phòng chuẩn');
      suggestions.push('🚨 Dấu hiệu nguy cấp');
    }
    return suggestions.slice(0, 3);
  }

  /**
   * Smart rule-based veterinary knowledge engine for offline operation
   */
  private static generateSmartFallback(query: string, petContext?: PetContext | null): { text: string; suggestedActions: string[] } {
    const q = query.toLowerCase();
    const petName = petContext?.name ? `bé ${petContext.name}` : 'thú cưng';
    const petBreed = petContext?.breed ? ` (giống ${petContext.breed})` : '';

    if (q.includes('bỏ ăn') || q.includes('biếng ăn') || q.includes('không ăn')) {
      return {
        text: `🐾 **Lời khuyên bác sĩ về tình trạng ${petName}${petBreed} bỏ ăn:**\n\n` +
          `1. **Kiểm tra thời gian bỏ ăn:** Nếu bé mới bỏ 1 bữa nhưng vẫn uống nước và vui chơi, hãy theo dõi thêm. Tuy nhiên, với mèo bỏ ăn quá 24h có thể dẫn đến chứng thoái hóa gan nhiễm mỡ nguy hiểm.\n` +
          `2. **Quan sát triệu chứng đi kèm:** Kiểm tra xem bé có bị sốt, nôn ói, tiêu chảy, lừ đừ hoặc chảy nước dãi không.\n` +
          `3. **Cách khắc phục tạm thời:** Thử hâm ấm thức ăn (pate) để kích thích khứu giác, cung cấp nước sạch hoặc dung dịch bù điện giải cho thú cưng.\n` +
          `4. **Khi nào cần đi khám:** Nếu bỏ ăn kèm sốt, nôn ra dịch vàng/bọt trắng hoặc kéo dài trên 24 giờ, hãy đưa bé tới phòng khám thú y ngay.`,
        suggestedActions: ['🥗 Kiểm tra khẩu phần ăn', '🚨 Dấu hiệu nguy cấp'],
      };
    }

    if (q.includes('tiêm') || q.includes('vắc xin') || q.includes('vaccin') || q.includes('lịch tiêm')) {
      return {
        text: `💉 **Phác đồ tiêm chủng khuyến nghị cho ${petName}:**\n\n` +
          `• **Chó con (từ 6 - 8 tuần tuổi):**\n` +
          `  - Mũi 1 (6-8 tuần): Vắc-xin 5 bệnh (Care, Parvo, Viêm gan, Ho cũi, Phó cúm).\n` +
          `  - Mũi 2 (10-12 tuần): Vắc-xin 7 bệnh.\n` +
          `  - Mũi 3 (14-16 tuần): Vắc-xin 7 bệnh + Mũi Dại (Rabies).\n` +
          `  - Nhắc lại: Mỗi năm tiêm nhắc 1 mũi 7 bệnh và 1 mũi dại.\n\n` +
          `• **Mèo con (từ 8 tuần tuổi):**\n` +
          `  - Mũi 1 (8 tuần): Vắc-xin 4 bệnh (Giảm bạch cầu, Viêm mũi khí quản, Calicivirus, Chlamydia).\n` +
          `  - Mũi 2 (12 tuần): Vắc-xin 4 bệnh nhắc lại.\n` +
          `  - Mũi 3 (16 tuần): Nhắc lại 4 bệnh + Tiêm phòng dại.\n` +
          `  - Nhắc lại: Mỗi năm tiêm nhắc 1 mũi tổng hợp.`,
        suggestedActions: ['💉 Vào sổ tiêm chủng', '📅 Tạo lịch nhắc mới'],
      };
    }

    if (q.includes('nôn') || q.includes('ói') || q.includes('bọt trắng') || q.includes('bọt vàng')) {
      return {
        text: `⚠️ **Hướng dẫn xử lý khi ${petName} bị nôn mửa:**\n\n` +
          `• **Nôn bọt trắng/dịch vàng lúc đói:** Thường do tăng tiết axit dịch vị dạ dày khi để khoảng cách giữa các bữa quá xa. Chia nhỏ bữa ăn và cho ăn đúng giờ.\n` +
          `• **Nôn ra thức ăn chưa tiêu:** Thường do ăn quá nhanh hoặc ăn phải vật lạ, dị ứng hạt mới.\n` +
          `• **Sơ cứu tại nhà:** Tạm ngưng thức ăn trong 4 - 6 giờ, cho uống từng ngụm nước nhỏ. Không tự ý cho uống thuốc người.\n` +
          `• 🚨 **CẢNH BÁO NGUY HIỂM:** Nếu nôn liên tục, nôn ra máu, đi ngoài phân đen/máu tanh, hoặc bé nằm li bì, có thể do nhiễm Parvo/Care hoặc nuốt dị vật. Hãy đưa bé cấp cứu ngay!`,
        suggestedActions: ['🚨 Dấu hiệu nguy cấp', '🥗 Chế độ ăn nhẹ (Hạt/Pate)'],
      };
    }

    return {
      text: `Xin chào bạn! Tôi là **PawCare AI Doctor** - Trợ lý Thú y thông minh của bạn. 🐶🐱\n\n` +
        `Tôi có thể hỗ trợ bạn chăm sóc ${petName}:\n` +
        `• 🩺 **Tư vấn sức khỏe:** Nhận biết các biểu hiện bất thường, hướng dẫn chăm sóc sơ bộ.\n` +
        `• 🥗 **Chế độ dinh dưỡng:** Khẩu phần gram hạt/pate mỗi ngày, thực phẩm an toàn và độc hại.\n` +
        `• 💉 **Lịch phòng bệnh:** Tư vấn phác đồ tiêm vắc-xin, tẩy giun và ngừa ve rận định kỳ.\n` +
        `• 🐾 **Chăm sóc theo giống:** Tư vấn bệnh lý di truyền và tập tính theo giống loài.\n\n` +
        `Bạn có thể nhập câu hỏi cụ thể về sức khỏe hoặc biểu hiện của bé để tôi hỗ trợ nhé!`,
      suggestedActions: ['Bé bỏ ăn phải làm sao?', 'Lịch tiêm phòng mũi đầu?', 'Thực phẩm gây độc cho chó mèo'],
    };
  }
}

