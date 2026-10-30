/**
 * PawCare AI — Pure Nutrition Calculator Service
 *
 * Clean Architecture: Domain Layer (Pure TypeScript, Zero Framework Dependencies).
 * Implements standard veterinary formulas:
 *   - RER (Resting Energy Requirement): RER = 70 * (bodyWeightKg ^ 0.75)
 *   - MER (Maintenance Energy Requirement): MER = RER * factor
 *
 * Activity & Life-Stage Factors follow WSAVA (World Small Animal Veterinary Association)
 * and AAHA nutritional guidelines.
 */

export type PetLifeStage =
  | 'puppy_kitten_young' // < 4 months
  | 'puppy_kitten_older' // 4 to 12 months
  | 'adult'
  | 'senior';

export type NutritionActivityLevel = 'low' | 'moderate' | 'high' | 'working';

export interface NutritionCalculationInput {
  species: 'dog' | 'cat';
  weightKg: number;
  lifeStage: PetLifeStage;
  isNeutered: boolean;
  activityLevel: NutritionActivityLevel;
  isObeseProne?: boolean;
  isWeightLoss?: boolean;
}

export interface NutritionCalculationResult {
  weightKg: number;
  rerKcal: number;
  activityFactor: number;
  merKcal: number;
  recommendedMealsPerDay: number;
  recommendedWaterMlPerDay: number;
  summaryVi: string;
  formulaExplanationVi: string;
}

/**
 * Standard Veterinary MER Multipliers
 * Documented configurable constants.
 */
export const NUTRITION_FACTORS = {
  dog: {
    puppyYoung: 3.0, // < 4 months
    puppyOlder: 2.0, // 4-12 months
    adultNeutered: 1.6,
    adultIntact: 1.8,
    senior: 1.4,
    inactiveObeseProne: 1.2,
    weightLoss: 1.0,
    activeModerate: 1.8,
    activeHigh: 2.2,
    working: 3.0,
  },
  cat: {
    kittenYoung: 2.5,
    kittenOlder: 2.0,
    adultNeutered: 1.2,
    adultIntact: 1.4,
    senior: 1.1,
    inactiveObeseProne: 1.0,
    weightLoss: 0.8,
    activeHigh: 1.6,
  },
} as const;

/**
 * Calculate Resting Energy Requirement (RER)
 * RER = 70 * (weightKg ^ 0.75)
 */
export function calculateRER(weightKg: number): number {
  if (weightKg <= 0) {
    throw new Error('Cân nặng phải lớn hơn 0 kg');
  }
  const rer = 70 * Math.pow(weightKg, 0.75);
  return Math.round(rer * 10) / 10;
}

/**
 * Determine the MER factor based on species, life stage, neuter status, and activity.
 */
export function determineActivityFactor(input: NutritionCalculationInput): number {
  const { species, lifeStage, isNeutered, activityLevel, isObeseProne, isWeightLoss } = input;

  if (species === 'dog') {
    if (isWeightLoss) return NUTRITION_FACTORS.dog.weightLoss;
    if (isObeseProne || activityLevel === 'low') return NUTRITION_FACTORS.dog.inactiveObeseProne;
    if (lifeStage === 'puppy_kitten_young') return NUTRITION_FACTORS.dog.puppyYoung;
    if (lifeStage === 'puppy_kitten_older') return NUTRITION_FACTORS.dog.puppyOlder;
    if (lifeStage === 'senior') return NUTRITION_FACTORS.dog.senior;

    // Adult dog
    if (activityLevel === 'working') return NUTRITION_FACTORS.dog.working;
    if (activityLevel === 'high') return NUTRITION_FACTORS.dog.activeHigh;
    if (isNeutered) return NUTRITION_FACTORS.dog.adultNeutered;
    return NUTRITION_FACTORS.dog.adultIntact;
  }

  // Cat
  if (isWeightLoss) return NUTRITION_FACTORS.cat.weightLoss;
  if (isObeseProne || activityLevel === 'low') return NUTRITION_FACTORS.cat.inactiveObeseProne;
  if (lifeStage === 'puppy_kitten_young') return NUTRITION_FACTORS.cat.kittenYoung;
  if (lifeStage === 'puppy_kitten_older') return NUTRITION_FACTORS.cat.kittenOlder;
  if (lifeStage === 'senior') return NUTRITION_FACTORS.cat.senior;

  // Adult cat
  if (activityLevel === 'high') return NUTRITION_FACTORS.cat.activeHigh;
  if (isNeutered) return NUTRITION_FACTORS.cat.adultNeutered;
  return NUTRITION_FACTORS.cat.adultIntact;
}

/**
 * Pure function: Calculate full nutritional recommendation
 */
export function calculateNutrition(input: NutritionCalculationInput): NutritionCalculationResult {
  const rer = calculateRER(input.weightKg);
  const factor = determineActivityFactor(input);
  const mer = Math.round(rer * factor);

  // Recommended meals per day
  let mealsPerDay = 2;
  if (input.lifeStage === 'puppy_kitten_young') {
    mealsPerDay = 4;
  } else if (input.lifeStage === 'puppy_kitten_older') {
    mealsPerDay = 3;
  }

  // Water requirement (~50-60ml per kg or ~1ml per kcal MER)
  const waterMl = Math.round(Math.max(input.weightKg * 55, mer * 0.9));

  const speciesName = input.species === 'dog' ? 'chó' : 'mèo';
  const summaryVi = `Khẩu phần khuyến nghị cho ${speciesName} (${input.weightKg} kg): ${mer} kcal/ngày, chia làm ${mealsPerDay} bữa.`;
  const formulaExplanationVi = `RER = 70 × (${input.weightKg})^0.75 = ${rer} kcal. Hệ số nhu cầu duy trì (MER) là ${factor}x. Tổng năng lượng cần nạp = ${mer} kcal/ngày.`;

  return {
    weightKg: input.weightKg,
    rerKcal: rer,
    activityFactor: factor,
    merKcal: mer,
    recommendedMealsPerDay: mealsPerDay,
    recommendedWaterMlPerDay: waterMl,
    summaryVi,
    formulaExplanationVi,
  };
}

