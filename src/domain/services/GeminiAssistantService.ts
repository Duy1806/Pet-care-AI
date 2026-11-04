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

const BUILTIN_KEY_B64 = 'QVEuQWI4Uk42SmNGTE52eVZ1WE1Zb2hFMkNhV3dkM3pIUUdWajVXWmxpanI4Sk80X1ZYZGc=';

function getBuiltinKey(): string {
  try {
    return atob(BUILTIN_KEY_B64);
  } catch {
    return '';
  }
}

const CANDIDATE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
];

export class GeminiAssistantService {
  /**
   * Get effective API key from parameter, environment, or built-in fallback
   */
  static getEffectiveApiKey(customKey?: string): string {
    return customKey?.trim() || process.env.EXPO_PUBLIC_GEMINI_API_KEY || getBuiltinKey();
  }

  /**
   * Send consultation query to Google Gemini API
   */
  static async consult(request: GeminiConsultationRequest): Promise<{ text: string; suggestedActions?: string[] }> {
    const apiKey = this.getEffectiveApiKey(request.apiKey);

    if (!apiKey) {
      return this.generateSmartFallback(request.userQuery, request.petContext);
    }

    try {
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

      // Build conversation contents with strictly alternating turns (user -> model -> user)
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      // Clean history: exclude initial greeting, errors, and current user question
      const validHistory = (request.history || []).filter(
        (m) => m.id !== 'msg_welcome' && !m.isError && m.text.trim() !== request.userQuery.trim()
      );

      // Take recent messages (up to last 6)
      const recent = validHistory.slice(-6);

      let nextRole: 'user' | 'model' = 'user';
      for (const msg of recent) {
        const role = msg.sender === 'user' ? 'user' : 'model';
        if (role === nextRole) {
          contents.push({
            role,
            parts: [{ text: msg.text }],
          });
          nextRole = nextRole === 'user' ? 'model' : 'user';
        }
      }

      // Ensure that current prompt will alternate properly
      if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents.pop();
      }

      // Add current user query with pet context as the final user turn
      const promptText = petContextStr
        ? `${petContextStr}\nCâu hỏi của người nuôi: ${request.userQuery}`
        : request.userQuery;

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

      // Multi-tier model execution: try models in order until success
      let lastErrMsg = '';
      for (const model of CANDIDATE_MODELS) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
          });

          if (response.ok) {
            const resData = await response.json();
            const candidate = resData?.candidates?.[0];
            const textOutput = candidate?.content?.parts?.[0]?.text;

            if (textOutput) {
              return {
                text: textOutput.trim(),
                suggestedActions: this.extractSuggestions(request.userQuery),
              };
            }
          } else {
            const errJson = await response.json().catch(() => ({}));
            lastErrMsg = errJson?.error?.message || `HTTP ${response.status}`;
            // If high demand (503) or not found (404), continue to next model
            if (response.status === 503 || response.status === 404) {
              continue;
            }
          }
        } catch (e) {
          lastErrMsg = e instanceof Error ? e.message : 'Lỗi mạng';
        }
      }

      throw new Error(lastErrMsg || 'Tất cả các mô hình Gemini đang bận.');
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Lỗi kết nối AI';
      const fallback = this.generateSmartFallback(request.userQuery, request.petContext);
      return {
        text: `⚠️ [Thông báo: ${err}]\n\n💡 Dưới đây là tư vấn sơ bộ từ hệ thống y khoa PawCare:\n\n${fallback.text}`,
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
      text: `💡 **Tư vấn nhanh về vấn đề bạn đang quan tâm:**\n\n` +
        `• Đối với ${petName}${petBreed}, khi gặp biểu hiện bất thường hoặc thắc mắc về chăm sóc, bạn nên theo dõi sát tinh thần, thói quen ăn uống và nhiệt độ cơ thể của bé.\n` +
        `• Nếu bé có biểu hiện mệt mỏi, bỏ ăn hoặc nôn ói/tiêu chảy, hãy đưa bé tới phòng khám thú y để được bác sĩ kiểm tra trực tiếp.\n` +
        `• Bạn cũng có thể hỏi cụ thể hơn về các chủ đề: triệu chứng, dinh dưỡng hạt/pate hoặc lịch tiêm chủng để tôi phân tích chi tiết nhé!`,
      suggestedActions: ['Bé bỏ ăn phải làm sao?', 'Lịch tiêm phòng mũi đầu?', 'Thực phẩm gây độc cho chó mèo'],
    };
  }
}

