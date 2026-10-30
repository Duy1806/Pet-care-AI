/**
 * PawCare AI — Nutrition Advisor Screen (Gợi ý Dinh dưỡng AI)
 *
 * Implements veterinary standard WSAVA nutrition calculations:
 * - Species, weight, age, neutered status, and activity selection
 * - Real-time RER (Resting Energy) & MER (Maintenance Energy) calculation
 * - Exact daily food portions (Dry food grams, Wet food grams, Mixed diet)
 * - Safe foods vs Toxic foods checklist
 */
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '@/presentation/theme';
import { usePetStore } from '@/presentation/stores/usePetStore';
import type { Pet } from '@/domain/entities/Pet';
import {
  calculateNutrition,
  type PetLifeStage,
  type NutritionActivityLevel,
} from '@/domain/services/NutritionCalculator';

function calculateDryFoodGrams(merKcal: number): number {
  return Math.round((merKcal / 370) * 100);
}

function calculateWetFoodGrams(merKcal: number): number {
  return Math.round((merKcal / 100) * 100);
}

function calculateMixedDiet(merKcal: number, dryPct = 0.5) {
  const dryKcal = merKcal * dryPct;
  const wetKcal = merKcal * (1 - dryPct);
  return {
    dryGrams: calculateDryFoodGrams(dryKcal),
    wetGrams: calculateWetFoodGrams(wetKcal),
  };
}

export default function NutritionScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { pets, selectedPet, selectPet } = usePetStore();

  // Input states initialized with active pet or default
  const [species, setSpecies] = useState<'dog' | 'cat'>(() => (selectedPet?.species === 'cat' ? 'cat' : 'dog'));
  const [weightKg, setWeightKg] = useState<number>(() => (selectedPet?.weightKg && selectedPet.weightKg > 0 ? selectedPet.weightKg : 6.0));
  const [lifeStage, setLifeStage] = useState<PetLifeStage>('adult');
  const [isNeutered, setIsNeutered] = useState<boolean>(() => Boolean(selectedPet?.isNeutered ?? true));
  const [activityLevel, setActivityLevel] = useState<NutritionActivityLevel>(() => selectedPet?.activityLevel || 'moderate');

  const handleSelectPet = (p: Pet) => {
    void Haptics.selectionAsync();
    selectPet(p);
    if (p.species === 'cat' || p.species === 'dog') {
      setSpecies(p.species);
    }
    if (p.weightKg > 0) {
      setWeightKg(p.weightKg);
    }
    setIsNeutered(Boolean(p.isNeutered));
    if (
      p.activityLevel === 'low' ||
      p.activityLevel === 'moderate' ||
      p.activityLevel === 'high'
    ) {
      setActivityLevel(p.activityLevel);
    }
  };

  // Compute nutrition via Domain Service
  const calculationResult = useMemo(() => {
    return calculateNutrition({
      species,
      weightKg,
      lifeStage,
      isNeutered,
      activityLevel,
    });
  }, [species, weightKg, lifeStage, isNeutered, activityLevel]);

  const dryGrams = useMemo(() => {
    return calculateDryFoodGrams(calculationResult.merKcal);
  }, [calculationResult.merKcal]);

  const wetGrams = useMemo(() => {
    return calculateWetFoodGrams(calculationResult.merKcal);
  }, [calculationResult.merKcal]);

  const mixedDiet = useMemo(() => {
    return calculateMixedDiet(calculationResult.merKcal, 0.5);
  }, [calculationResult.merKcal]);

  const adjustWeight = (delta: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWeightKg((prev) => Math.max(0.5, Math.min(60, Number((prev + delta).toFixed(1)))));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
          },
        ]}
      >
        <Text style={[typo.headlineMedium, { color: colors.text }]}>
          Gợi ý Dinh dưỡng AI
        </Text>
        <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
          Tính toán khẩu phần ăn chuẩn khoa học thú y (RER & MER)
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing.xxl,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
        }}
      >
        {/* Real Pet Quick Picker */}
        {pets.length > 0 && (
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[typo.labelMedium, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              Chọn thông số từ thú cưng của bạn:
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {pets.map((p) => {
                const isSelected = selectedPet?.id === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => handleSelectPet(p)}
                    style={[
                      styles.toggleChip,
                      {
                        backgroundColor: isSelected ? colors.primaryContainer : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: radius.full,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={p.species === 'dog' ? 'dog' : 'cat'}
                      size={16}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        typo.labelSmall,
                        {
                          color: isSelected ? colors.primary : colors.text,
                          marginLeft: 4,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {p.name} ({p.weightKg} kg)
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Controls Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.xl,
              padding: spacing.md,
            },
          ]}
        >
          {/* Species Selector */}
          <View style={styles.inputGroup}>
            <Text style={[typo.labelMedium, { color: colors.text, marginBottom: spacing.xs }]}>
              Loài thú cưng:
            </Text>
            <View style={styles.segmentRow}>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSpecies('dog');
                }}
                style={[
                  styles.segmentBtn,
                  {
                    backgroundColor: species === 'dog' ? colors.primary : colors.surfaceElevated,
                    borderColor: species === 'dog' ? colors.primary : colors.border,
                    borderRadius: radius.lg,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="dog"
                  size={20}
                  color={species === 'dog' ? colors.onPrimary : colors.text}
                />
                <Text
                  style={[
                    typo.labelMedium,
                    {
                      color: species === 'dog' ? colors.onPrimary : colors.text,
                      marginLeft: 6,
                    },
                  ]}
                >
                  Chó (Dog)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSpecies('cat');
                }}
                style={[
                  styles.segmentBtn,
                  {
                    backgroundColor: species === 'cat' ? colors.primary : colors.surfaceElevated,
                    borderColor: species === 'cat' ? colors.primary : colors.border,
                    borderRadius: radius.lg,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="cat"
                  size={20}
                  color={species === 'cat' ? colors.onPrimary : colors.text}
                />
                <Text
                  style={[
                    typo.labelMedium,
                    {
                      color: species === 'cat' ? colors.onPrimary : colors.text,
                      marginLeft: 6,
                    },
                  ]}
                >
                  Mèo (Cat)
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Weight Stepper */}
          <View style={[styles.inputGroup, { marginTop: spacing.md }]}>
            <Text style={[typo.labelMedium, { color: colors.text, marginBottom: spacing.xs }]}>
              Cân nặng hiện tại:
            </Text>
            <View
              style={[
                styles.weightStepper,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.lg },
              ]}
            >
              <Pressable
                onPress={() => adjustWeight(-0.5)}
                hitSlop={8}
                style={[styles.stepperBtn, { backgroundColor: colors.surface }]}
              >
                <MaterialCommunityIcons name="minus" size={20} color={colors.text} />
              </Pressable>

              <View style={styles.weightDisplay}>
                <Text style={[typo.displayMedium, { color: colors.primary, fontWeight: '700' }]}>
                  {weightKg}
                </Text>
                <Text style={[typo.labelMedium, { color: colors.textSecondary, marginLeft: 4 }]}>
                  kg
                </Text>
              </View>

              <Pressable
                onPress={() => adjustWeight(0.5)}
                hitSlop={8}
                style={[styles.stepperBtn, { backgroundColor: colors.surface }]}
              >
                <MaterialCommunityIcons name="plus" size={20} color={colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Life Stage Selector */}
          <View style={[styles.inputGroup, { marginTop: spacing.md }]}>
            <Text style={[typo.labelMedium, { color: colors.text, marginBottom: spacing.xs }]}>
              Giai đoạn phát triển:
            </Text>
            <View style={styles.segmentRow}>
              {(
                [
                  { label: 'Con (< 1 tuổi)', val: 'puppy_kitten_older' as PetLifeStage },
                  { label: 'Trưởng thành', val: 'adult' as PetLifeStage },
                  { label: 'Lớn tuổi', val: 'senior' as PetLifeStage },
                ] as const
              ).map((stage) => {
                const isSelected = lifeStage === stage.val;
                return (
                  <Pressable
                    key={stage.val}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setLifeStage(stage.val);
                    }}
                    style={[
                      styles.smallSegmentBtn,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: radius.md,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typo.labelSmall,
                        { color: isSelected ? colors.onPrimary : colors.text, fontWeight: isSelected ? '700' : '500' },
                      ]}
                    >
                      {stage.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Activity Level Selector */}
          <View style={[styles.inputGroup, { marginTop: spacing.md }]}>
            <Text style={[typo.labelMedium, { color: colors.text, marginBottom: spacing.xs }]}>
              Mức độ vận động:
            </Text>
            <View style={styles.segmentRow}>
              {(
                [
                  { label: 'Thấp (Nằm nhiều)', val: 'low' as NutritionActivityLevel },
                  { label: 'Vừa phải (Đi dạo)', val: 'moderate' as NutritionActivityLevel },
                  { label: 'Năng động cao', val: 'high' as NutritionActivityLevel },
                ] as const
              ).map((act) => {
                const isSelected = activityLevel === act.val;
                return (
                  <Pressable
                    key={act.val}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setActivityLevel(act.val);
                    }}
                    style={[
                      styles.smallSegmentBtn,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: radius.md,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typo.labelSmall,
                        { color: isSelected ? colors.onPrimary : colors.text, fontWeight: isSelected ? '700' : '500' },
                      ]}
                    >
                      {act.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Life Stage & Neutered Row */}
          <View style={[styles.inputGroup, { marginTop: spacing.md }]}>
            <View style={styles.neuteredRow}>
              <Text style={[typo.labelMedium, { color: colors.text }]}>
                Đã triệt sản:
              </Text>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setIsNeutered(!isNeutered);
                }}
                style={[
                  styles.toggleChip,
                  {
                    backgroundColor: isNeutered ? colors.primaryContainer : colors.surfaceElevated,
                    borderColor: isNeutered ? colors.primary : colors.border,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={isNeutered ? 'check-circle' : 'circle-outline'}
                  size={16}
                  color={isNeutered ? colors.primary : colors.textTertiary}
                />
                <Text
                  style={[
                    typo.labelSmall,
                    {
                      color: isNeutered ? colors.primary : colors.textSecondary,
                      marginLeft: 4,
                      fontWeight: isNeutered ? '700' : '500',
                    },
                  ]}
                >
                  {isNeutered ? 'Đã triệt sản' : 'Chưa triệt sản'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Calorie Results Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.primaryContainer,
              borderColor: colors.primary,
              borderRadius: radius.xl,
              padding: spacing.md,
              marginTop: spacing.md,
            },
          ]}
        >
          <View style={styles.resultTitleRow}>
            <MaterialCommunityIcons name="fire" size={24} color={colors.primary} />
            <Text
              style={[
                typo.titleLarge,
                { color: colors.primary, marginLeft: spacing.xs, fontWeight: '700' },
              ]}
            >
              Nhu cầu Năng lượng mỗi ngày
            </Text>
          </View>

          <View style={[styles.calorieGrid, { marginTop: spacing.sm }]}>
            <View style={[styles.calorieCol, { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm }]}>
              <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                RER (Nghỉ ngơi)
              </Text>
              <Text style={[typo.headlineMedium, { color: colors.text, marginTop: 2 }]}>
                {calculationResult.rerKcal}
              </Text>
              <Text style={[typo.labelSmall, { color: colors.textTertiary }]}>kcal / ngày</Text>
            </View>

            <View style={[styles.calorieCol, { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm }]}>
              <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                MER (Mục tiêu)
              </Text>
              <Text style={[typo.headlineMedium, { color: colors.primary, marginTop: 2, fontWeight: '700' }]}>
                {calculationResult.merKcal}
              </Text>
              <Text style={[typo.labelSmall, { color: colors.primary }]}>kcal / ngày</Text>
            </View>
          </View>

          {/* Water & Meals info */}
          <View style={[styles.miniInfoRow, { marginTop: spacing.sm }]}>
            <View style={styles.miniInfoItem}>
              <MaterialCommunityIcons name="water" size={16} color="#0284C7" />
              <Text style={[typo.bodySmall, { color: colors.text, marginLeft: 4 }]}>
                Nước uống: <Text style={{ fontWeight: '700' }}>{calculationResult.recommendedWaterMlPerDay} ml/ngày</Text>
              </Text>
            </View>
            <View style={styles.miniInfoItem}>
              <MaterialCommunityIcons name="clock-outline" size={16} color="#16A34A" />
              <Text style={[typo.bodySmall, { color: colors.text, marginLeft: 4 }]}>
                Số bữa: <Text style={{ fontWeight: '700' }}>{calculationResult.recommendedMealsPerDay} bữa/ngày</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Exact Portions Breakdown Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.xl,
              padding: spacing.md,
              marginTop: spacing.md,
            },
          ]}
        >
          <Text style={[typo.titleMedium, { color: colors.text, marginBottom: spacing.xs }]}>
            Khẩu phần ăn gợi ý
          </Text>
          <Text style={[typo.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            Tùy chọn chế độ ăn uống phù hợp với gia đình bạn:
          </Text>

          {/* Option 1: Dry food */}
          <View style={[styles.portionRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <View style={styles.portionLeft}>
              <MaterialCommunityIcons name="seed-outline" size={22} color="#D97706" />
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={[typo.labelLarge, { color: colors.text }]}>Hạt khô (Dry Kibble)</Text>
                <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>~{Math.round(dryGrams / 2)}g mỗi bữa (2 bữa)</Text>
              </View>
            </View>
            <Text style={[typo.titleLarge, { color: colors.primary, fontWeight: '700' }]}>
              {dryGrams}g
            </Text>
          </View>

          {/* Option 2: Wet food */}
          <View style={[styles.portionRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <View style={styles.portionLeft}>
              <MaterialCommunityIcons name="food-variant" size={22} color="#DC2626" />
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={[typo.labelLarge, { color: colors.text }]}>Pate ướt (Wet Food)</Text>
                <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>~{Math.round(wetGrams / 2)}g mỗi bữa (2 bữa)</Text>
              </View>
            </View>
            <Text style={[typo.titleLarge, { color: colors.primary, fontWeight: '700' }]}>
              {wetGrams}g
            </Text>
          </View>

          {/* Option 3: Mixed diet */}
          <View style={styles.portionRow}>
            <View style={styles.portionLeft}>
              <MaterialCommunityIcons name="silverware-fork-knife" size={22} color="#16A34A" />
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={[typo.labelLarge, { color: colors.text }]}>Kết hợp 50/50</Text>
                <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>Nửa hạt khô + nửa pate</Text>
              </View>
            </View>
            <Text style={[typo.titleMedium, { color: colors.primary, fontWeight: '700' }]}>
              {mixedDiet.dryGrams}g hạt + {mixedDiet.wetGrams}g pate
            </Text>
          </View>
        </View>

        {/* Safe vs Toxic Foods Tips */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.xl,
              padding: spacing.md,
              marginTop: spacing.md,
            },
          ]}
        >
          <Text style={[typo.titleMedium, { color: colors.text, marginBottom: spacing.xs }]}>
            Lưu ý an toàn thực phẩm
          </Text>

          <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
            <View style={styles.safeRow}>
              <MaterialCommunityIcons name="check-circle" size={18} color="#16A34A" />
              <Text style={[typo.bodySmall, { color: colors.text, marginLeft: 6, flex: 1 }]}>
                <Text style={{ fontWeight: '700', color: '#16A34A' }}>Nên ăn: </Text>
                Ức gà luộc xé nhỏ, thịt bò nạc, cà rốt, bí đỏ hấp, cá hồi gỡ xương.
              </Text>
            </View>

            <View style={styles.safeRow}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#DC2626" />
              <Text style={[typo.bodySmall, { color: colors.text, marginLeft: 6, flex: 1 }]}>
                <Text style={{ fontWeight: '700', color: '#DC2626' }}>Cực độc: </Text>
                Socola, hành tỏi, nho & nho khô, bơ, cafein, hạt macca, xương gà sắc nhọn.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {},
  card: {
    borderWidth: 1,
  },
  inputGroup: {},
  segmentRow: {
    flexDirection: 'row',
    gap: 12,
  },
  segmentBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallSegmentBtn: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  weightStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderWidth: 1,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weightDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  neuteredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  resultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calorieGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  calorieCol: {
    flex: 1,
    alignItems: 'center',
  },
  miniInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  miniInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  portionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  portionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  safeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
