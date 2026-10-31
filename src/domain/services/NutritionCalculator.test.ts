/**
 * PawCare AI — Nutrition Calculator Unit Tests
 */
import {
  calculateNutrition,
  calculateRER,
  determineActivityFactor,
  NUTRITION_FACTORS,
} from './NutritionCalculator';

describe('NutritionCalculator Service', () => {
  describe('calculateRER', () => {
    it('tính RER chính xác cho chó 10kg', () => {
      // 70 * (10 ^ 0.75) = 70 * 5.623413... = 393.638... -> 393.6
      const rer = calculateRER(10);
      expect(rer).toBeCloseTo(393.6, 1);
    });

    it('tính RER chính xác cho mèo 4kg', () => {
      // 70 * (4 ^ 0.75) = 70 * 2.8284... = 197.99... -> 198.0
      const rer = calculateRER(4);
      expect(rer).toBeCloseTo(198.0, 1);
    });

    it('báo lỗi khi cân nặng <= 0', () => {
      expect(() => calculateRER(0)).toThrow('Cân nặng phải lớn hơn 0 kg');
      expect(() => calculateRER(-5)).toThrow('Cân nặng phải lớn hơn 0 kg');
    });
  });

  describe('determineActivityFactor', () => {
    it('trả về hệ số chó con dưới 4 tháng tuổi (puppyYoung = 3.0)', () => {
      const factor = determineActivityFactor({
        species: 'dog',
        weightKg: 3,
        lifeStage: 'puppy_kitten_young',
        isNeutered: false,
        activityLevel: 'moderate',
      });
      expect(factor).toBe(NUTRITION_FACTORS.dog.puppyYoung);
    });

    it('trả về hệ số chó trưởng thành đã triệt sản (adultNeutered = 1.6)', () => {
      const factor = determineActivityFactor({
        species: 'dog',
        weightKg: 15,
        lifeStage: 'adult',
        isNeutered: true,
        activityLevel: 'moderate',
      });
      expect(factor).toBe(NUTRITION_FACTORS.dog.adultNeutered);
    });

    it('trả về hệ số chó trưởng thành chưa triệt sản (adultIntact = 1.8)', () => {
      const factor = determineActivityFactor({
        species: 'dog',
        weightKg: 15,
        lifeStage: 'adult',
        isNeutered: false,
        activityLevel: 'moderate',
      });
      expect(factor).toBe(NUTRITION_FACTORS.dog.adultIntact);
    });

    it('trả về hệ số giảm cân cho chó (weightLoss = 1.0)', () => {
      const factor = determineActivityFactor({
        species: 'dog',
        weightKg: 20,
        lifeStage: 'adult',
        isNeutered: true,
        activityLevel: 'low',
        isWeightLoss: true,
      });
      expect(factor).toBe(NUTRITION_FACTORS.dog.weightLoss);
    });

    it('trả về hệ số mèo trưởng thành đã triệt sản (adultNeutered = 1.2)', () => {
      const factor = determineActivityFactor({
        species: 'cat',
        weightKg: 4.5,
        lifeStage: 'adult',
        isNeutered: true,
        activityLevel: 'moderate',
      });
      expect(factor).toBe(NUTRITION_FACTORS.cat.adultNeutered);
    });
  });

  describe('calculateNutrition', () => {
    it('tính toán đầy đủ khẩu phần và số bữa ăn cho mèo con', () => {
      const result = calculateNutrition({
        species: 'cat',
        weightKg: 1.5,
        lifeStage: 'puppy_kitten_young',
        isNeutered: false,
        activityLevel: 'moderate',
      });

      expect(result.weightKg).toBe(1.5);
      expect(result.rerKcal).toBeGreaterThan(0);
      expect(result.activityFactor).toBe(NUTRITION_FACTORS.cat.kittenYoung);
      expect(result.merKcal).toBe(Math.round(result.rerKcal * NUTRITION_FACTORS.cat.kittenYoung));
      expect(result.recommendedMealsPerDay).toBe(4);
      expect(result.summaryVi).toContain('kcal/ngày');
      expect(result.formulaExplanationVi).toContain('RER = 70 ×');
    });

    it('tính toán lượng nước và số bữa ăn cho chó trưởng thành', () => {
      const result = calculateNutrition({
        species: 'dog',
        weightKg: 12,
        lifeStage: 'adult',
        isNeutered: true,
        activityLevel: 'moderate',
      });

      expect(result.recommendedMealsPerDay).toBe(2);
      expect(result.recommendedWaterMlPerDay).toBeGreaterThan(500);
      expect(result.activityFactor).toBe(1.6);
    });

    it('áp dụng hệ số giảm calo và khuyến nghị chuyên sâu cho chó Beagle (dễ béo phì)', () => {
      const result = calculateNutrition({
        species: 'dog',
        weightKg: 10,
        lifeStage: 'adult',
        isNeutered: true,
        activityLevel: 'moderate',
        breedKey: 'beagle',
      });

      // Base dog adult neutered = 1.6, Beagle modifier = 0.88 -> 1.6 * 0.88 = 1.41
      expect(result.breedProfile).toBeDefined();
      expect(result.breedProfile?.nameVi).toContain('Beagle');
      expect(result.breedModifier).toBe(0.88);
      expect(result.activityFactor).toBeCloseTo(1.41, 2);
      expect(result.breedProfile?.healthRisks).toContain('Béo phì mất kiểm soát');
      expect(result.optimalDiet.wetPercentage).toBe(30);
    });

    it('áp dụng hệ số tăng calo cho mèo Sphynx không lông để bù thân nhiệt', () => {
      const result = calculateNutrition({
        species: 'cat',
        weightKg: 4,
        lifeStage: 'adult',
        isNeutered: true,
        activityLevel: 'moderate',
        breedKey: 'sphynx',
      });

      // Base cat adult neutered = 1.2, Sphynx modifier = 1.25 -> 1.2 * 1.25 = 1.50
      expect(result.breedProfile).toBeDefined();
      expect(result.breedModifier).toBe(1.25);
      expect(result.activityFactor).toBe(1.5);
      expect(result.merKcal).toBeGreaterThan(Math.round(result.rerKcal * 1.2));
    });

    it('khuyến nghị 3 bữa/ngày cho giống chó Toy (Chihuahua) để ngừa hạ đường huyết', () => {
      const result = calculateNutrition({
        species: 'dog',
        weightKg: 2.5,
        lifeStage: 'adult',
        isNeutered: true,
        activityLevel: 'moderate',
        breedKey: 'chihuahua',
      });

      expect(result.recommendedMealsPerDay).toBe(3);
      expect(result.breedProfile?.kibbleSize).toBe('extra_small');
    });
  });
});

