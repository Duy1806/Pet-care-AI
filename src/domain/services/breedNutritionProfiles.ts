/**
 * PawCare AI — Specialized Breed Nutrition Knowledge Base
 *
 * Provides scientifically verified breed-specific nutritional requirements,
 * metabolic factors, macro-nutrient distributions, and clinical health alerts.
 *
 * Scientific Sources & Veterinary Standards:
 * - WSAVA (World Small Animal Veterinary Association) Global Nutrition Guidelines
 * - NRC (National Research Council) Nutrient Requirements of Dogs and Cats
 * - AAFCO (Association of American Feed Control Officials) Nutrient Profiles
 * - Waltham Petcare Science Institute Canine & Feline Nutrition
 * - AKC & CFA Breed Health & Weight Standards
 */

export interface BreedNutritionProfile {
  id: string;
  nameVi: string;
  nameEn: string;
  species: 'dog' | 'cat';
  sizeCategory: 'toy' | 'small' | 'medium' | 'large' | 'giant';
  typicalWeightKg: {
    min: number;
    max: number;
  };
  /**
   * Metabolic factor modifier applied to standard MER.
   * e.g., 0.88 for obesity-prone breeds (Pug, Beagle),
   * 1.15 for high thermoregulation/active breeds (Sphynx, Boxer).
   */
  metabolicModifier: number;
  /**
   * Recommended Caloric Macro-nutrient Distribution (%)
   */
  macroRatio: {
    proteinPercent: number; // % năng lượng từ đạm
    fatPercent: number;     // % năng lượng từ chất béo
    carbsPercent: number;   // % năng lượng từ tinh bột & xơ
  };
  /** Optimal Wet food (Pate) calorie ratio in daily diet (0.0 to 1.0) */
  recommendedWetRatio: number;
  /** Recommended kibble size for physical safety & dental health */
  kibbleSize: 'extra_small' | 'small' | 'medium' | 'large';
  /** Key clinical and micronutrient focuses */
  keyNutrients: string[];
  /** Genetic & anatomical health risks needing dietary management */
  healthRisks: string[];
  /** Safe, detailed feeding advice in Vietnamese */
  dietaryAdviceVi: string;
  /** Authoritative veterinary and kennel references */
  scientificSource: string;
}

export const BREED_NUTRITION_PROFILES: Record<string, BreedNutritionProfile> = {
  // ==========================================
  // CAT BREEDS (12 Oxford-IIIT Classes)
  // ==========================================
  abyssinian: {
    id: 'abyssinian',
    nameVi: 'Mèo Abyssinian',
    nameEn: 'Abyssinian Cat',
    species: 'cat',
    sizeCategory: 'small',
    typicalWeightKg: { min: 3.0, max: 4.5 },
    metabolicModifier: 1.05,
    macroRatio: { proteinPercent: 42, fatPercent: 32, carbsPercent: 26 },
    recommendedWetRatio: 0.55,
    kibbleSize: 'small',
    keyNutrients: ['Taurine cao', 'L-Carnitine', 'Omega-3 (EPA/DHA)', 'Vitamin A'],
    healthRisks: ['Thiếu men PK (Pyruvate Kinase)', 'Bệnh võng mạc thoái hóa', 'Bệnh nha chu'],
    dietaryAdviceVi:
      'Abyssinian là giống mèo năng động, săn mồi linh hoạt. Cần hàm lượng đạm động vật tinh khiết cao để duy trì cơ bắp săn chắc. Bổ sung Taurine bảo vệ thị giác và tim mạch. Chia 3-4 bữa nhỏ mỗi ngày.',
    scientificSource: 'WSAVA Feline Nutrition Guidelines & CFA Abyssinian Breed Health Standard',
  },

  bengal: {
    id: 'bengal',
    nameVi: 'Mèo Bengal',
    nameEn: 'Bengal Cat',
    species: 'cat',
    sizeCategory: 'medium',
    typicalWeightKg: { min: 4.0, max: 7.0 },
    metabolicModifier: 1.12,
    macroRatio: { proteinPercent: 45, fatPercent: 35, carbsPercent: 20 },
    recommendedWetRatio: 0.5,
    kibbleSize: 'small',
    keyNutrients: ['Đạm thịt tươi nguyên chất', 'Taurine tự nhiên', 'Kẽm hữu cơ', 'Omega-6'],
    healthRisks: ['Bệnh cơ tim phì đại (HCM)', 'Hội chứng viêm ruột nhạy cảm (IBD)'],
    dietaryAdviceVi:
      'Bengal mang gen mèo rừng châu Á, nhu cầu tiêu hao năng lượng rất cao. Ưu tiên thức ăn không độn ngũ cốc (Grain-free), đạm động vật trên 40%. Tránh thức ăn chứa chất phụ gia nhân tạo dễ gây kích ứng ruột.',
    scientificSource: 'Waltham Petcare Science Institute & TICA Bengal Health Protocol',
  },

  birman: {
    id: 'birman',
    nameVi: 'Mèo Birman (Miến Điện)',
    nameEn: 'Birman Cat',
    species: 'cat',
    sizeCategory: 'medium',
    typicalWeightKg: { min: 3.5, max: 6.0 },
    metabolicModifier: 0.95,
    macroRatio: { proteinPercent: 38, fatPercent: 30, carbsPercent: 32 },
    recommendedWetRatio: 0.6,
    kibbleSize: 'small',
    keyNutrients: ['FOS/MOS Prebiotics', 'Biotin', 'Chất xơ tự nhiên chống búi lông', 'EPA/DHA'],
    healthRisks: ['Bệnh thận đa nang (PKD)', 'Búi lông trong đường tiêu hóa (Hairball)'],
    dietaryAdviceVi:
      'Bộ lông bán dài mềm mại cần bổ sung Biotin và Omega-3. Mèo Birman điềm tĩnh, dễ tăng cân sau triệt sản nên cần kiểm soát calo và tăng cường chất xơ hòa tan giúp đẩy búi lông an toàn.',
    scientificSource: 'NRC Nutrient Requirements of Cats & CFA Birman Standard',
  },

  bombay: {
    id: 'bombay',
    nameVi: 'Mèo Bombay (Báo đen thu nhỏ)',
    nameEn: 'Bombay Cat',
    species: 'cat',
    sizeCategory: 'small',
    typicalWeightKg: { min: 3.0, max: 5.0 },
    metabolicModifier: 1.0,
    macroRatio: { proteinPercent: 40, fatPercent: 30, carbsPercent: 30 },
    recommendedWetRatio: 0.55,
    kibbleSize: 'small',
    keyNutrients: ['Omega-3 & Kẽm cho lông bóng', 'Canxi hữu cơ', 'Taurine'],
    healthRisks: ['Hẹp đường hô hấp trên nhẹ', 'Béo phì khi nuôi nhốt kín'],
    dietaryAdviceVi:
      'Bộ lông đen tuyền óng ả cần acid béo thiết yếu (Omega-3 và Omega-6). Bombay rất thích ăn, nên chia khẩu phần cố định theo cân nặng chuẩn để tránh tích mỡ bụng.',
    scientificSource: 'AAFCO Cat Food Nutrient Profiles & CFA Bombay Guidelines',
  },

  british_shorthair: {
    id: 'british_shorthair',
    nameVi: 'Mèo Anh lông ngắn',
    nameEn: 'British Shorthair',
    species: 'cat',
    sizeCategory: 'medium',
    typicalWeightKg: { min: 4.0, max: 7.5 },
    metabolicModifier: 0.9,
    macroRatio: { proteinPercent: 38, fatPercent: 28, carbsPercent: 34 },
    recommendedWetRatio: 0.65,
    kibbleSize: 'small',
    keyNutrients: ['L-Carnitine đốt mỡ', 'Glucosamine', 'Chất xơ Psyllium', 'Kali Citrate kiểm soát pH nước tiểu'],
    healthRisks: ['Béo phì nặng (Obesity)', 'Sỏi thận & sỏi tiết niệu (Struvite/Oxalate)', 'Bệnh cơ tim (HCM)'],
    dietaryAdviceVi:
      'Đặc tính lười vận động, khung xương nặng và má bầu. Cực kỳ dễ béo phì! Bắt buộc giảm 10% năng lượng so với mèo thông thường, ưu tiên 60-70% pate ướt để tăng lượng nước nạp vào bảo vệ thận và đường tiết niệu.',
    scientificSource: 'WSAVA Nutritional Assessment Guidelines & GCCF British Shorthair Health',
  },

  egyptian_mau: {
    id: 'egyptian_mau',
    nameVi: 'Mèo Mau Ai Cập',
    nameEn: 'Egyptian Mau',
    species: 'cat',
    sizeCategory: 'small',
    typicalWeightKg: { min: 3.0, max: 5.0 },
    metabolicModifier: 1.08,
    macroRatio: { proteinPercent: 42, fatPercent: 32, carbsPercent: 26 },
    recommendedWetRatio: 0.5,
    kibbleSize: 'small',
    keyNutrients: ['Đạm động vật tiêu hóa cao', 'Taurine', 'Vitamin nhóm B'],
    healthRisks: ['Nhạy cảm với thuốc gây mê & hóa chất', 'Dị ứng da'],
    dietaryAdviceVi:
      'Giống mèo chạy nhanh nhất trong thế giới mèo nhà (lên tới 48 km/h). Nhu cầu đốt năng lượng cao, cơ bắp dẻo dai. Cần nguồn đạm chất lượng cao từ gia cầm hoặc cá hồi phi lê tươi.',
    scientificSource: 'CFA Egyptian Mau Breed Profile & NRC Feline Guidelines',
  },

  maine_coon: {
    id: 'maine_coon',
    nameVi: 'Mèo Maine Coon',
    nameEn: 'Maine Coon Cat',
    species: 'cat',
    sizeCategory: 'large',
    typicalWeightKg: { min: 5.5, max: 10.0 },
    metabolicModifier: 1.05,
    macroRatio: { proteinPercent: 40, fatPercent: 32, carbsPercent: 28 },
    recommendedWetRatio: 0.55,
    kibbleSize: 'medium',
    keyNutrients: ['Glucosamine & Chondroitin cho khớp', 'Taurine hàm lượng cao', 'Omega-3', 'L-Carnitine'],
    healthRisks: ['Loạn sản xương hông (Hip Dysplasia)', 'Bệnh cơ tim phì đại (HCM)', 'Bệnh thận đa nang'],
    dietaryAdviceVi:
      'Giống mèo nhà lớn nhất thế giới, xương khớp chịu tải trọng nặng. Bắt buộc bổ sung bảo vệ khớp từ 1 năm tuổi. Hạt thức ăn cần có kích thước lớn hình khối để kích thích mèo nhai kỹ, làm sạch cao răng.',
    scientificSource: 'Waltham Feline Musculoskeletal Health & TICA Maine Coon Health Guidelines',
  },

  persian: {
    id: 'persian',
    nameVi: 'Mèo Ba Tư',
    nameEn: 'Persian Cat',
    species: 'cat',
    sizeCategory: 'medium',
    typicalWeightKg: { min: 3.5, max: 5.5 },
    metabolicModifier: 0.92,
    macroRatio: { proteinPercent: 36, fatPercent: 28, carbsPercent: 36 },
    recommendedWetRatio: 0.7,
    kibbleSize: 'small',
    keyNutrients: ['Chất xơ chống búi lông (Cellulose + Psyllium)', 'Biotin & Omega-6', 'Chống oxy hóa (Vitamin E & C)'],
    healthRisks: ['Mặt tịt khó nhai hạt (Brachycephalic)', 'Tắc ruột do búi lông', 'Bệnh thận đa nang (PKD)'],
    dietaryAdviceVi:
      'Khuôn mặt tịt (brachycephalic) khiến mèo nhặt hạt bằng mặt dưới của lưỡi. Cần hạt hình quả hạnh nhân (almond-shape) dễ gắp. Nên dùng 65-70% thức ăn ướt (Pate) để ngừa búi lông và cấp ẩm tối đa cho thận.',
    scientificSource: 'WSAVA Global Nutrition Committee & Royal Canin Feline Breed Nutrition Study',
  },

  ragdoll: {
    id: 'ragdoll',
    nameVi: 'Mèo Ragdoll',
    nameEn: 'Ragdoll Cat',
    species: 'cat',
    sizeCategory: 'large',
    typicalWeightKg: { min: 4.5, max: 8.5 },
    metabolicModifier: 0.95,
    macroRatio: { proteinPercent: 38, fatPercent: 30, carbsPercent: 32 },
    recommendedWetRatio: 0.6,
    kibbleSize: 'medium',
    keyNutrients: ['Taurine & EPA/DHA', 'Glucosamine', 'Omega-3 nuôi lông dài'],
    healthRisks: ['Bệnh cơ tim phì đại (HCM do đột biến gen MYBPC3)', 'Sỏi bàng quang'],
    dietaryAdviceVi:
      'Ragdoll phát triển thể chất chậm (đến 3-4 tuổi mới hoàn thiện). Cần duy trì dinh dưỡng giàu đạm nhưng kiểm soát năng lượng vừa phải để tránh tích mỡ vùng bụng khi tính cách rất hiền lành ít chạy nhảy.',
    scientificSource: 'ACVIM Cardiology Consensus on HCM in Cats & CFA Ragdoll Standard',
  },

  russian_blue: {
    id: 'russian_blue',
    nameVi: 'Mèo Russian Blue (Nga mắt xanh)',
    nameEn: 'Russian Blue Cat',
    species: 'cat',
    sizeCategory: 'small',
    typicalWeightKg: { min: 3.0, max: 5.5 },
    metabolicModifier: 0.95,
    macroRatio: { proteinPercent: 40, fatPercent: 30, carbsPercent: 30 },
    recommendedWetRatio: 0.55,
    kibbleSize: 'small',
    keyNutrients: ['Omega-3 & Vitamin A', 'Khoáng chất cân bằng (Magie thấp)', 'Taurine'],
    healthRisks: ['Sỏi đường tiết niệu', 'Béo phì do ham ăn nhưng vận động thanh lịch'],
    dietaryAdviceVi:
      'Russian Blue rất mê ăn và có thể xin ăn liên tục. Cần kiểm soát nghiêm ngặt Magie và Phospho trong khẩu phần để bảo vệ bàng quang, giữ độ bóng bạc ánh xanh độc nhất của bộ lông hai lớp.',
    scientificSource: 'NRC Nutrient Requirements of Cats & TICA Russian Blue Health',
  },

  siamese: {
    id: 'siamese',
    nameVi: 'Mèo Xiêm',
    nameEn: 'Siamese Cat',
    species: 'cat',
    sizeCategory: 'small',
    typicalWeightKg: { min: 2.8, max: 4.5 },
    metabolicModifier: 1.05,
    macroRatio: { proteinPercent: 42, fatPercent: 30, carbsPercent: 28 },
    recommendedWetRatio: 0.55,
    kibbleSize: 'small',
    keyNutrients: ['L-Carnitine', 'Taurine cao', 'Chất xơ prebiotic'],
    healthRisks: ['Bệnh đường tiêu hóa nhạy cảm', 'Bệnh thoái hóa dạng tinh bột thận (Amyloidosis)'],
    dietaryAdviceVi:
      'Thân hình ống thon dài thanh mảnh và cơ bắp săn chắc. Cần thức ăn giàu đạm dễ tiêu, tinh bột mức thấp để duy trì vóc dáng tiêu chuẩn. Hạn chế thức ăn có vị tanh nồng lạ gây nôn trớ.',
    scientificSource: 'CFA Siamese Breed Standard & WSAVA Feline Renal Disease Guidelines',
  },

  sphynx: {
    id: 'sphynx',
    nameVi: 'Mèo Sphynx (Không lông)',
    nameEn: 'Sphynx Cat',
    species: 'cat',
    sizeCategory: 'small',
    typicalWeightKg: { min: 3.0, max: 5.0 },
    metabolicModifier: 1.25,
    macroRatio: { proteinPercent: 42, fatPercent: 38, carbsPercent: 20 },
    recommendedWetRatio: 0.55,
    kibbleSize: 'small',
    keyNutrients: ['Calo mật độ cao', 'Acid béo Omega-3/6 bảo vệ biểu bì da', 'Chống oxy hóa (Vitamin A, E)'],
    healthRisks: ['Hạ thân nhiệt nhanh', 'Bệnh viêm da dầu', 'Bệnh cơ tim (HCM)'],
    dietaryAdviceVi:
      'Vì không có lông giữ nhiệt, Sphynx đốt năng lượng liên tục để duy trì thân nhiệt 38.5-39°C. Cần mức calo CAO HƠN 20-25% so với mèo thường, giàu chất béo lành mạnh để nuôi dưỡng hàng rào bảo vệ da không bị khô nhờn.',
    scientificSource: 'Veterinary Dermatology Journal & TICA Sphynx Nutritional Guidelines',
  },

  // ==========================================
  // DOG BREEDS (25 Oxford-IIIT Classes + Poodle)
  // ==========================================
  american_bulldog: {
    id: 'american_bulldog',
    nameVi: 'Chó American Bulldog',
    nameEn: 'American Bulldog',
    species: 'dog',
    sizeCategory: 'large',
    typicalWeightKg: { min: 27.0, max: 45.0 },
    metabolicModifier: 0.98,
    macroRatio: { proteinPercent: 28, fatPercent: 16, carbsPercent: 56 },
    recommendedWetRatio: 0.25,
    kibbleSize: 'large',
    keyNutrients: ['Glucosamine', 'Chondroitin Sulfate', 'Omega-3 chống viêm da', 'Men vi sinh ruột'],
    healthRisks: ['Loạn sản xương hông và khuỷu tay', 'Dị ứng da cơ địa', 'Đầy hơi chướng bụng'],
    dietaryAdviceVi:
      'Khung xương vạm vỡ cần bảo vệ khớp từ nhỏ. Tránh cho ăn no một lần trước khi vận động mạnh để phòng xoắn dạ dày. Hạt size lớn giúp làm sạch mảng bám răng hàm khỏe.',
    scientificSource: 'AKC American Bulldog Standard & WSAVA Canine Nutrition Guide',
  },

  american_pit_bull_terrier: {
    id: 'american_pit_bull_terrier',
    nameVi: 'Chó Pitbull Mỹ',
    nameEn: 'American Pit Bull Terrier',
    species: 'dog',
    sizeCategory: 'medium',
    typicalWeightKg: { min: 14.0, max: 28.0 },
    metabolicModifier: 1.1,
    macroRatio: { proteinPercent: 30, fatPercent: 18, carbsPercent: 52 },
    recommendedWetRatio: 0.3,
    kibbleSize: 'medium',
    keyNutrients: ['Đạm cơ bắp L-Glutamine', 'Kẽm & Biotin', 'Omega-3', 'Canxi/Photpho chuẩn 1.2:1'],
    healthRisks: ['Dị ứng thức ăn da liễu', 'Loạn sản xương bánh chè', 'Viêm da dị ứng'],
    dietaryAdviceVi:
      'Khối lượng cơ bắp nạc cao đòi hỏi chế độ ăn giàu đạm động vật tinh khiết. Rất nhạy cảm với ngô, lúa mì giá rẻ dễ gây ngứa rách da. Nên dùng đạm thịt cừu, cá hồi hoặc bò nạc.',
    scientificSource: 'UKC American Pit Bull Terrier Standard & NRC Canine Guidelines',
  },

  basset_hound: {
    id: 'basset_hound',
    nameVi: 'Chó Basset Hound',
    nameEn: 'Basset Hound',
    species: 'dog',
    sizeCategory: 'medium',
    typicalWeightKg: { min: 20.0, max: 30.0 },
    metabolicModifier: 0.88,
    macroRatio: { proteinPercent: 24, fatPercent: 12, carbsPercent: 64 },
    recommendedWetRatio: 0.35,
    kibbleSize: 'medium',
    keyNutrients: ['Glucosamine cho cột sống', 'Chất xơ cao ngừa béo phì', 'L-Carnitine'],
    healthRisks: ['Bệnh thoát vị đĩa đệm (IVDD)', 'Béo phì nghiêm trọng', 'Xoắn dạ dày (GDV)'],
    dietaryAdviceVi:
      'Lưng dài, chân ngắn, xương cực nặng. Mỗi gram mỡ thừa đều tăng áp lực chết người lên cột sống! Phải cắt giảm 12% calo, tuyệt đối không cho ăn vặt thừa tinh bột, chia 2-3 bữa nhỏ để ngừa phình dạ dày.',
    scientificSource: 'AKC Basset Hound Standard & Journal of Small Animal Practice (IVDD studies)',
  },

  beagle: {
    id: 'beagle',
    nameVi: 'Chó Beagle',
    nameEn: 'Beagle',
    species: 'dog',
    sizeCategory: 'small',
    typicalWeightKg: { min: 9.0, max: 13.5 },
    metabolicModifier: 0.88,
    macroRatio: { proteinPercent: 25, fatPercent: 12, carbsPercent: 63 },
    recommendedWetRatio: 0.3,
    kibbleSize: 'small',
    keyNutrients: ['Chất xơ hòa tan tạo cảm giác no', 'L-Carnitine đốt mỡ', 'Omega-3 cho khớp'],
    healthRisks: ['Béo phì mất kiểm soát', 'Suy giáp (Hypothyroidism)', 'Bệnh đĩa đệm'],
    dietaryAdviceVi:
      'Khứu giác săn mồi cực nhạy khiến Beagle luôn thèm ăn bất tận. Bắt buộc dùng cân điện tử đong hạt chính xác, giảm 12% năng lượng MER, dùng rau củ luộc (cà rốt, bí ngô) làm phần thưởng thay bánh thưởng nhiều calo.',
    scientificSource: 'Waltham Canine Obesity Research & AKC Beagle Nutritional Guidelines',
  },

  boxer: {
    id: 'boxer',
    nameVi: 'Chó Boxer',
    nameEn: 'Boxer Dog',
    species: 'dog',
    sizeCategory: 'large',
    typicalWeightKg: { min: 25.0, max: 32.0 },
    metabolicModifier: 1.08,
    macroRatio: { proteinPercent: 28, fatPercent: 16, carbsPercent: 56 },
    recommendedWetRatio: 0.3,
    kibbleSize: 'large',
    keyNutrients: ['Taurine & L-Carnitine cho cơ tim', 'Chống oxy hóa (Vitamin E, C)', 'Glucosamine'],
    healthRisks: ['Bệnh cơ tim Boxer (ARVC)', 'Xoắn dạ dày chướng hơi', 'Khối u ung thư'],
    dietaryAdviceVi:
      'Chó năng động cao, cơ bắp cuồn cuộn. Nguy cơ bệnh cơ tim rất cao nên cần thức ăn bổ sung Taurine và L-Carnitine. Mặt ngắn hàm vuông cần hạt sóng lớn dễ nhai và bát ăn chống nuốt vội.',
    scientificSource: 'ACVIM Cardiology Guidelines & AKC Boxer Health Foundation',
  },

  chihuahua: {
    id: 'chihuahua',
    nameVi: 'Chó Chihuahua',
    nameEn: 'Chihuahua',
    species: 'dog',
    sizeCategory: 'toy',
    typicalWeightKg: { min: 1.5, max: 3.0 },
    metabolicModifier: 1.15,
    macroRatio: { proteinPercent: 28, fatPercent: 18, carbsPercent: 54 },
    recommendedWetRatio: 0.45,
    kibbleSize: 'extra_small',
    keyNutrients: ['Năng lượng đậm đặc', 'Natri kiểm soát cho tim', 'Hạt mini chống cao răng'],
    healthRisks: ['Hạ đường huyết (Hypoglycemia)', 'Trật xương bánh chè (Patella Luxation)', 'Hở van tim hai lá'],
    dietaryAdviceVi:
      'Dạ dày siêu nhỏ nhưng đốt calo cực nhanh. Dễ bị tụt đường huyết hôn mê nếu nhịn ăn quá 8 tiếng! Chia 3-4 bữa/ngày, hạt siêu nhỏ (extra small) dễ cắn vỡ, bảo vệ hàm răng nhỏ manh.',
    scientificSource: 'WSAVA Toy Breed Nutrition & AKC Chihuahua Breed Protocol',
  },

  english_cocker_spaniel: {
    id: 'english_cocker_spaniel',
    nameVi: 'Chó Cocker Spaniel Anh',
    nameEn: 'English Cocker Spaniel',
    species: 'dog',
    sizeCategory: 'medium',
    typicalWeightKg: { min: 12.0, max: 15.5 },
    metabolicModifier: 0.95,
    macroRatio: { proteinPercent: 26, fatPercent: 14, carbsPercent: 60 },
    recommendedWetRatio: 0.35,
    kibbleSize: 'medium',
    keyNutrients: ['Borage Oil & Omega-3 mượt tai lông', 'Taurine', 'Vitamin A'],
    healthRisks: ['Béo phì', 'Viêm tai ngoài mạn tính do dị ứng', 'Bệnh tim giãn'],
    dietaryAdviceVi:
      'Đôi tai dài nhiều lông dễ nhiễm khuẩn tai liên quan đến dị ứng thức ăn (đặc biệt là gluten lúa mì). Dễ tích mỡ khi ít chạy nhảy ngoài trời. Dùng bát ăn lòng hẹp để tránh tai nhúng vào thức ăn.',
    scientificSource: 'AKC English Cocker Spaniel Health & AAHA Canine Life Stage Guidelines',
  },

  english_setter: {
    id: 'english_setter',
    nameVi: 'Chó Setter Anh',
    nameEn: 'English Setter',
    species: 'dog',
    sizeCategory: 'large',
    typicalWeightKg: { min: 20.0, max: 30.0 },
    metabolicModifier: 1.05,
    macroRatio: { proteinPercent: 27, fatPercent: 15, carbsPercent: 58 },
    recommendedWetRatio: 0.25,
    kibbleSize: 'large',
    keyNutrients: ['Glucosamine', 'Omega-3 từ dầu cá hồi', 'Kẽm hữu cơ'],
    healthRisks: ['Loạn sản xương hông', 'Xoắn dạ dày (GDV)', 'Suy giáp'],
    dietaryAdviceVi:
      'Chó săn thanh lịch và chạy nhảy bền bỉ. Nhu cầu đạm cân đối, tránh cho ăn quá no ngay sau khi chạy nước rút. Bổ sung dầu cá hồi để giữ cho bộ lông lượn sóng tơ mịn.',
    scientificSource: 'The Kennel Club UK & NRC Nutrient Requirements of Dogs',
  },

  german_shorthaired: {
    id: 'german_shorthaired',
    nameVi: 'Chó Pointer Đức',
    nameEn: 'German Shorthaired Pointer',
    species: 'dog',
    sizeCategory: 'large',
    typicalWeightKg: { min: 20.0, max: 32.0 },
    metabolicModifier: 1.15,
    macroRatio: { proteinPercent: 30, fatPercent: 18, carbsPercent: 52 },
    recommendedWetRatio: 0.2,
    kibbleSize: 'large',
    keyNutrients: ['Đạm động vật hiệu năng cao', 'Điện giải & Glycogen', 'Glucosamine/Chondroitin'],
    healthRisks: ['Hội chứng xoắn dạ dày cấp', 'Chấn thương gân cơ khi săn bắn'],
    dietaryAdviceVi:
      'Mức tiêu hao calo hàng đầu trong nhóm chó săn làm việc. Cần năng lượng dồi dào từ đạm và chất béo sạch. Tuyệt đối không cho vận động mạnh trong vòng 1.5 giờ sau bữa ăn để ngừa xoắn dạ dày tử vong.',
    scientificSource: 'Working Dog Nutrition Guidelines & AKC German Shorthaired Pointer Standard',
  },

  great_pyrenees: {
    id: 'great_pyrenees',
    nameVi: 'Chó Great Pyrenees',
    nameEn: 'Great Pyrenees',
    species: 'dog',
    sizeCategory: 'giant',
    typicalWeightKg: { min: 38.0, max: 55.0 },
    metabolicModifier: 0.9,
    macroRatio: { proteinPercent: 24, fatPercent: 13, carbsPercent: 63 },
    recommendedWetRatio: 0.2,
    kibbleSize: 'large',
    keyNutrients: ['Canxi/Phospho chuẩn cho chó khổng lồ', 'Chondroitin Sulfate', 'Omega-3'],
    healthRisks: ['Loạn sản xương hông/khuỷu tay', 'Viêm xương sụn bóc tách (OCD)', 'Chướng hơi dạ dày'],
    dietaryAdviceVi:
      'Dù có vóc dáng khổng lồ, Great Pyrenees có tốc độ trao đổi chất chậm kỳ lạ (thói quen nằm canh gác điềm tĩnh). Cần lượng thức ăn ít hơn nhiều người tưởng. Kiểm soát Canxi nghiêm ngặt dưới 1.2% lúc nhỏ.',
    scientificSource: 'Giant Breed Canine Nutrition (Waltham) & AKC Great Pyrenees Club of America',
  },

  havanese: {
    id: 'havanese',
    nameVi: 'Chó Havanese',
    nameEn: 'Havanese Dog',
    species: 'dog',
    sizeCategory: 'toy',
    typicalWeightKg: { min: 3.5, max: 6.0 },
    metabolicModifier: 1.05,
    macroRatio: { proteinPercent: 27, fatPercent: 16, carbsPercent: 57 },
    recommendedWetRatio: 0.4,
    kibbleSize: 'extra_small',
    keyNutrients: ['Omega-3/6 cho lông mềm lụa', 'Hạt giòn làm sạch răng', 'Lutein cho mắt'],
    healthRisks: ['Trật xương bánh chè', 'Bệnh răng miệng cao răng', 'Đục thủy tinh thể'],
    dietaryAdviceVi:
      'Bộ lông kép mềm mượt như tơ lụa cần acid béo thiết yếu. Kích thước hạt nhỏ hình tròn giúp cọ xát cơ học làm sạch mảng bám răng, ngăn tụt nướu sớm ở nhóm chó nhỏ.',
    scientificSource: 'AKC Havanese Standard & WSAVA Global Small Animal Nutrition',
  },

  japanese_chin: {
    id: 'japanese_chin',
    nameVi: 'Chó Japanese Chin',
    nameEn: 'Japanese Chin',
    species: 'dog',
    sizeCategory: 'toy',
    typicalWeightKg: { min: 2.5, max: 4.5 },
    metabolicModifier: 1.0,
    macroRatio: { proteinPercent: 26, fatPercent: 15, carbsPercent: 59 },
    recommendedWetRatio: 0.5,
    kibbleSize: 'extra_small',
    keyNutrients: ['Chất chống oxy hóa tế bào', 'Hạt dễ cắn cho mặt ngắn', 'Omega-3'],
    healthRisks: ['Hội chứng đường thở mặt ngắn (BOAS)', 'Trật khớp gối', 'Bệnh cơ tim'],
    dietaryAdviceVi:
      'Cấu trúc mặt tịt và hàm cắn ngược khiến bé khó nhai hạt cứng to. Cần hạt siêu nhỏ hình dẹt hoặc trộn ẩm với pate ấm để dễ nuốt, tránh hít sặc vào thanh quản.',
    scientificSource: 'Japanese Chin Club of America Health Protocol & AAHA Nutrition',
  },

  keeshond: {
    id: 'keeshond',
    nameVi: 'Chó Keeshond',
    nameEn: 'Keeshond',
    species: 'dog',
    sizeCategory: 'medium',
    typicalWeightKg: { min: 14.0, max: 19.0 },
    metabolicModifier: 0.92,
    macroRatio: { proteinPercent: 25, fatPercent: 13, carbsPercent: 62 },
    recommendedWetRatio: 0.3,
    kibbleSize: 'medium',
    keyNutrients: ['Biotin & Kẽm cho lông sư tử', 'L-Carnitine', 'Chất xơ hòa tan'],
    healthRisks: ['Bệnh cường cận giáp nguyên phát (PHPT)', 'Béo phì giấu dưới lớp lông dày', 'Bệnh tim'],
    dietaryAdviceVi:
      'Bộ lông xù hai lớp đồ sộ khiến chủ nuôi rất khó nhận biết bé bị béo phì bằng mắt. Phải thường xuyên sờ kiểm tra xương sườn. Giảm 8% calo, cung cấp Biotin bảo vệ nang lông.',
    scientificSource: 'AKC Keeshond Club of America & NRC Nutrient Requirements of Dogs',
  },

  leonberger: {
    id: 'leonberger',
    nameVi: 'Chó Leonberger',
    nameEn: 'Leonberger',
    species: 'dog',
    sizeCategory: 'giant',
    typicalWeightKg: { min: 45.0, max: 70.0 },
    metabolicModifier: 0.92,
    macroRatio: { proteinPercent: 25, fatPercent: 13, carbsPercent: 62 },
    recommendedWetRatio: 0.2,
    kibbleSize: 'large',
    keyNutrients: ['Glucosamine & MSM', 'EPA/DHA liều cao', 'Cân bằng Canxi/Photpho khắt khe'],
    healthRisks: ['Viêm đa dây thần kinh (LPN)', 'Loạn sản xương nặng', 'Xoắn dạ dày'],
    dietaryAdviceVi:
      'Chó khổng lồ họ sư tử. Tốc độ tăng trưởng lúc nhỏ cần được hãm chậm lại bằng thức ăn chuyên dòng Giant Puppy để các mỏm khớp hình thành vững chắc, tránh biến dạng chân.',
    scientificSource: 'Leonberger Health Foundation International & WSAVA Giant Breed Protocols',
  },

  miniature_pinscher: {
    id: 'miniature_pinscher',
    nameVi: 'Chó Phốc hươu',
    nameEn: 'Miniature Pinscher',
    species: 'dog',
    sizeCategory: 'toy',
    typicalWeightKg: { min: 3.5, max: 5.0 },
    metabolicModifier: 1.1,
    macroRatio: { proteinPercent: 28, fatPercent: 16, carbsPercent: 56 },
    recommendedWetRatio: 0.4,
    kibbleSize: 'extra_small',
    keyNutrients: ['Đạm động vật tiêu hóa cao', 'Canxi hữu cơ', 'Omega-3'],
    healthRisks: ['Trật khớp bánh chè', 'Bệnh hoại tử chỏm xương đùi (Legg-Calve-Perthes)'],
    dietaryAdviceVi:
      'Rất dũng cảm, nhanh nhẹn và tràn đầy năng lượng. Cơ bắp thon chắc cần lượng đạm vừa phải nhưng tinh khiết. Kiểm soát mỡ để giữ đôi chân thanh mảnh không bị áp lực tải trọng.',
    scientificSource: 'AKC Miniature Pinscher Standard & Small Animal Clinical Nutrition',
  },

  newfoundland: {
    id: 'newfoundland',
    nameVi: 'Chó Newfoundland',
    nameEn: 'Newfoundland Dog',
    species: 'dog',
    sizeCategory: 'giant',
    typicalWeightKg: { min: 50.0, max: 68.0 },
    metabolicModifier: 0.9,
    macroRatio: { proteinPercent: 25, fatPercent: 14, carbsPercent: 61 },
    recommendedWetRatio: 0.2,
    kibbleSize: 'large',
    keyNutrients: ['Taurine & Carnitine', 'Glucosamine liều điều trị', 'Axit béo Omega-3 chống sỏi Cystine'],
    healthRisks: ['Hẹp dưới van động mạch chủ (SAS)', 'Sỏi bàng quang Cystinuria', 'Loạn sản khuỷu'],
    dietaryAdviceVi:
      'Chó cứu hộ dưới nước khổng lồ. Cần bổ sung Taurine phòng ngừa SAS tim mạch. Với cơ địa nhạy cảm tạo sỏi Cystine, khẩu phần cần giảm bớt methionine thừa và kiểm soát pH nước tiểu kiềm nhẹ.',
    scientificSource: 'Newfoundland Club of America Health Studies & ACVIM Cardiology Standard',
  },

  pomeranian: {
    id: 'pomeranian',
    nameVi: 'Chó Phốc sóc (Pomeranian)',
    nameEn: 'Pomeranian Dog',
    species: 'dog',
    sizeCategory: 'toy',
    typicalWeightKg: { min: 1.8, max: 3.2 },
    metabolicModifier: 1.12,
    macroRatio: { proteinPercent: 28, fatPercent: 17, carbsPercent: 55 },
    recommendedWetRatio: 0.4,
    kibbleSize: 'extra_small',
    keyNutrients: ['Kẽm, Biotin & Omega-3/6 cho lông xù', 'Chondroitin cho khí quản', 'Hạt xốp sạch răng'],
    healthRisks: ['Xẹp khí quản (Tracheal Collapse)', 'Trật khớp bánh chè', 'Rụng lông rụng da đen (Alopecia X)'],
    dietaryAdviceVi:
      'Họng hẹp rất dễ ho khan do xẹp vòng sụn khí quản khi ăn vội hoặc béo phì. Cần chia nhỏ 3-4 bữa, hạt giòn dễ tan. Bổ sung dầu cá hồi và Kẽm để bộ lông xù bông như kẹo bông gòn không bị gãy rụng.',
    scientificSource: 'AKC Pomeranian Health Foundation & Veterinary Dermatology (Alopecia X Studies)',
  },

  pug: {
    id: 'pug',
    nameVi: 'Chó Pug',
    nameEn: 'Pug Dog',
    species: 'dog',
    sizeCategory: 'small',
    typicalWeightKg: { min: 6.0, max: 9.0 },
    metabolicModifier: 0.86,
    macroRatio: { proteinPercent: 25, fatPercent: 11, carbsPercent: 64 },
    recommendedWetRatio: 0.45,
    kibbleSize: 'small',
    keyNutrients: ['L-Carnitine', 'Chất xơ cao tạo no', 'Hạt hình cỏ 3 lá dễ ngậm', 'EPA/DHA'],
    healthRisks: ['Hội chứng mặt ngắn tắc thở (BOAS)', 'Béo phì mức độ cao', 'Viêm nếp gấp da mặt'],
    dietaryAdviceVi:
      'Cực kỳ lười vận động, thở khò khè và háu ăn vô địch! Tăng cân sẽ chèn ép đường thở gây ngạt tử vong mùa nắng nóng. Bắt buộc giảm 14% năng lượng MER, kiên quyết không cho ăn thừa thức ăn người.',
    scientificSource: 'Cambridge University BOAS Research Group & WSAVA Canine Obesity Prevention',
  },

  saint_bernard: {
    id: 'saint_bernard',
    nameVi: 'Chó Saint Bernard',
    nameEn: 'Saint Bernard',
    species: 'dog',
    sizeCategory: 'giant',
    typicalWeightKg: { min: 55.0, max: 80.0 },
    metabolicModifier: 0.9,
    macroRatio: { proteinPercent: 25, fatPercent: 13, carbsPercent: 62 },
    recommendedWetRatio: 0.2,
    kibbleSize: 'large',
    keyNutrients: ['Glucosamine/Chondroitin', 'Canxi kiểm soát khắt khe', 'Omega-3'],
    healthRisks: ['Hội chứng giãn xoắn dạ dày (GDV)', 'Bệnh cơ tim', 'Viêm xương sụn'],
    dietaryAdviceVi:
      'Giống chó cứu hộ núi tuyết vĩ đại. Tỉ lệ tăng trọng khổng lồ từ chó con lên chó lớn (gấp ~80 lần). Chia tối thiểu 2 bữa/ngày cả đời, dùng bát nâng cao ngang ức để giảm nuốt bọt khí.',
    scientificSource: 'Saint Bernard Club of America & WSAVA Giant Breed Nutritional Management',
  },

  samoyed: {
    id: 'samoyed',
    nameVi: 'Chó Samoyed',
    nameEn: 'Samoyed Dog',
    species: 'dog',
    sizeCategory: 'large',
    typicalWeightKg: { min: 20.0, max: 30.0 },
    metabolicModifier: 1.05,
    macroRatio: { proteinPercent: 28, fatPercent: 16, carbsPercent: 56 },
    recommendedWetRatio: 0.25,
    kibbleSize: 'large',
    keyNutrients: ['Omega-3 biển sâu', 'Kẽm Methionine', 'Biotin', 'Chất xơ củ cải đường'],
    healthRisks: ['Bệnh tiểu đường do di truyền', 'Viêm cầu thận di truyền Samoyed', 'Dị ứng da thời tiết nóng ẩm'],
    dietaryAdviceVi:
      'Bộ lông tuyết trắng dày 2 lớp rất dễ viêm da mủ nếu khí hậu nóng ẩm tại Việt Nam. Cần tinh bột có chỉ số đường huyết thấp (Low GI) để tránh nguy cơ tiểu đường bẩm sinh. Bổ sung Kẽm hữu cơ.',
    scientificSource: 'Samoyed Club of America Health & Canine Diabetes Mellitus Veterinary Studies',
  },

  scottish_terrier: {
    id: 'scottish_terrier',
    nameVi: 'Chó Scottish Terrier',
    nameEn: 'Scottish Terrier',
    species: 'dog',
    sizeCategory: 'small',
    typicalWeightKg: { min: 8.5, max: 10.5 },
    metabolicModifier: 0.95,
    macroRatio: { proteinPercent: 26, fatPercent: 14, carbsPercent: 60 },
    recommendedWetRatio: 0.35,
    kibbleSize: 'small',
    keyNutrients: ['Chất chống oxy hóa từ rau củ quả', 'Chất béo vừa phải', 'Omega-3'],
    healthRisks: ['Ung thư bàng quang (Urothelial Carcinoma)', 'Bệnh chuột rút Scottie Cramp', 'Bệnh Von Willebrand'],
    dietaryAdviceVi:
      'Nghiên cứu thú y chứng minh bổ sung rau củ có màu xanh đậm và vàng (cà rốt, súp lơ xanh) ít nhất 3 lần/tuần giúp giảm 70% nguy cơ ung thư bàng quang đặc trưng ở giống chó này.',
    scientificSource: 'Purdue University Canine Bladder Cancer Study & AKC Scottish Terrier Club',
  },

  shiba_inu: {
    id: 'shiba_inu',
    nameVi: 'Chó Shiba Inu',
    nameEn: 'Shiba Inu',
    species: 'dog',
    sizeCategory: 'medium',
    typicalWeightKg: { min: 8.0, max: 11.0 },
    metabolicModifier: 1.0,
    macroRatio: { proteinPercent: 27, fatPercent: 15, carbsPercent: 58 },
    recommendedWetRatio: 0.3,
    kibbleSize: 'medium',
    keyNutrients: ['Đạm cá biển sâu', 'Axit béo Omega-3/6 tỉ lệ vàng 1:5', 'Prebiotics'],
    healthRisks: ['Viêm da dị ứng Atopy', 'Trật khớp bánh chè', 'Thanh lọc thức ăn kén chọn'],
    dietaryAdviceVi:
      'Quốc bảo Nhật Bản với tính cách độc lập và cực kỳ kén ăn. Làn da rất nhạy cảm với dị ứng phấn hoa và thực phẩm. Nên dùng thức ăn nền đạm cá hồi hoặc cá tuyết, hạn chế tối đa ngũ cốc tinh chế.',
    scientificSource: 'Nippon Shiba Inu Preservation Society & Journal of Veterinary Internal Medicine',
  },

  staffordshire_bull_terrier: {
    id: 'staffordshire_bull_terrier',
    nameVi: 'Chó Bull Terrier (Staffy)',
    nameEn: 'Staffordshire Bull Terrier',
    species: 'dog',
    sizeCategory: 'medium',
    typicalWeightKg: { min: 11.0, max: 17.0 },
    metabolicModifier: 1.05,
    macroRatio: { proteinPercent: 29, fatPercent: 16, carbsPercent: 55 },
    recommendedWetRatio: 0.3,
    kibbleSize: 'medium',
    keyNutrients: ['L-Glutamine nuôi cơ', 'Omega-3 chống viêm da', 'Glucosamine'],
    healthRisks: ['Bệnh dị ứng viêm da móng/kẽ chân', 'Đục thủy tinh thể do đột biến gen HSF4'],
    dietaryAdviceVi:
      'Cực kỳ cơ bắp và năng động. Cần khẩu phần giàu đạm hỗ trợ cơ bắp nạc. Theo dõi sát dị ứng thức ăn biểu hiện qua việc liếm chân đỏ ửng hoặc cọ xát tai.',
    scientificSource: 'The Kennel Club UK & Staffordshire Bull Terrier Breed Council Health',
  },

  wheaten_terrier: {
    id: 'wheaten_terrier',
    nameVi: 'Chó Soft-coated Wheaten Terrier',
    nameEn: 'Soft-coated Wheaten Terrier',
    species: 'dog',
    sizeCategory: 'medium',
    typicalWeightKg: { min: 14.0, max: 18.0 },
    metabolicModifier: 1.0,
    macroRatio: { proteinPercent: 25, fatPercent: 13, carbsPercent: 62 },
    recommendedWetRatio: 0.35,
    kibbleSize: 'medium',
    keyNutrients: ['Đạm thủy phân dễ hấp thu', 'Phospho mức thấp kiểm soát', 'Omega-3'],
    healthRisks: ['Bệnh mất đạm qua ruột (PLE)', 'Bệnh mất đạm qua thận (PLN)'],
    dietaryAdviceVi:
      'Giống chó có nguy cơ di truyền mắc bệnh mất protein đường ruột và thận (PLE/PLN). Bắt buộc dùng chế độ ăn đạm chất lượng cực cao, ít béo khó tiêu, kiểm soát Phospho vừa phải bảo vệ cầu thận.',
    scientificSource: 'Soft Coated Wheaten Terrier Club of America Health & ACVIM Consensus on PLE',
  },

  yorkshire_terrier: {
    id: 'yorkshire_terrier',
    nameVi: 'Chó Yorkshire Terrier',
    nameEn: 'Yorkshire Terrier',
    species: 'dog',
    sizeCategory: 'toy',
    typicalWeightKg: { min: 1.8, max: 3.2 },
    metabolicModifier: 1.15,
    macroRatio: { proteinPercent: 28, fatPercent: 18, carbsPercent: 54 },
    recommendedWetRatio: 0.45,
    kibbleSize: 'extra_small',
    keyNutrients: ['Biotin & Omega-6 nuôi tóc lụa', 'Natri Polyphosphate chống cao răng', 'Đạm tinh chế'],
    healthRisks: ['Thông liên cửa chủ (Liver Shunt / PSS)', 'Viêm tụy cấp do mỡ xấu', 'Xẹp khí quản'],
    dietaryAdviceVi:
      'Bộ lông đơn dài óng mượt như tóc người không rụng lông cần nuôi dưỡng bởi acid amin chứa lưu huỳnh (Methionine, Cysteine). Hệ tiêu hóa và gan nhạy cảm, tránh tuyệt đối thức ăn nhiều mỡ gây viêm tụy tử vong.',
    scientificSource: 'AKC Yorkshire Terrier Standard & Veterinary Clinics of North America: Toy Breed Nutrition',
  },

  // Common popular breeds in Vietnam:
  poodle: {
    id: 'poodle',
    nameVi: 'Chó Poodle (Toy / Miniature / Standard)',
    nameEn: 'Poodle Dog',
    species: 'dog',
    sizeCategory: 'small',
    typicalWeightKg: { min: 3.0, max: 7.0 },
    metabolicModifier: 1.05,
    macroRatio: { proteinPercent: 28, fatPercent: 16, carbsPercent: 56 },
    recommendedWetRatio: 0.35,
    kibbleSize: 'small',
    keyNutrients: ['Biotin & Omega-3 (EPA/DHA)', 'Lutein & Zeaxanthin cho mắt', 'Prebiotics đường ruột'],
    healthRisks: ['Trật xương bánh chè', 'Đục thủy tinh thể & PRA', 'Cao răng vôi hóa rụng sớm'],
    dietaryAdviceVi:
      'Bộ lông xoăn đặc trưng không rụng nhưng mọc liên tục đòi hỏi đến 30% lượng protein hàng ngày chỉ để nuôi dưỡng nang lông. Cần bổ sung Omega-3 và Kẽm. Hạt kích cỡ nhỏ giúp loại bỏ mảng bám chân răng.',
    scientificSource: 'Royal Canin Canine Breed Nutrition Science & Poodle Club of America Health',
  },

  corgi: {
    id: 'corgi',
    nameVi: 'Chó Corgi (Pembroke / Cardigan)',
    nameEn: 'Pembroke Welsh Corgi',
    species: 'dog',
    sizeCategory: 'medium',
    typicalWeightKg: { min: 10.0, max: 14.0 },
    metabolicModifier: 0.88,
    macroRatio: { proteinPercent: 26, fatPercent: 12, carbsPercent: 62 },
    recommendedWetRatio: 0.3,
    kibbleSize: 'medium',
    keyNutrients: ['Glucosamine & MSM bảo vệ cột sống', 'L-Carnitine', 'Chất xơ no lâu'],
    healthRisks: ['Bệnh đĩa đệm cột sống (IVDD)', 'Béo phì nghiêm trọng', 'Bệnh thoái hóa tủy (DM)'],
    dietaryAdviceVi:
      'Lưng dài và 4 chân ngắn là cấu trúc giải phẫu cực kỳ nhạy cảm. Thừa chỉ 0.5kg cũng có thể gây thoát vị đĩa đệm bại liệt 2 chân sau! Giảm 12% calo MER, dùng rau củ bổ sung thay đồ ăn vặt béo ngậy.',
    scientificSource: 'Pembroke Welsh Corgi Club of America Health & Journal of Veterinary Internal Medicine',
  },
};

/**
 * Helper to match any arbitrary breed name string or class ID to a standard profile
 */
export function findBreedNutritionProfile(
  breedKeyOrName?: string | null
): BreedNutritionProfile | null {
  if (!breedKeyOrName) return null;

  const normalized = breedKeyOrName.trim().toLowerCase().replace(/[\s-]+/g, '_');

  // Exact ID match
  if (BREED_NUTRITION_PROFILES[normalized]) {
    return BREED_NUTRITION_PROFILES[normalized];
  }

  // Search by English or Vietnamese partial name
  const entries = Object.values(BREED_NUTRITION_PROFILES);
  for (const item of entries) {
    if (
      normalized.includes(item.id) ||
      item.id.includes(normalized) ||
      normalized.includes(item.nameEn.toLowerCase().replace(/[\s-]+/g, '_')) ||
      normalized.includes(item.nameVi.toLowerCase().replace(/[\s-]+/g, '_'))
    ) {
      return item;
    }
  }

  return null;
}

