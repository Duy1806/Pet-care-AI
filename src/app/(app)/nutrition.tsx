/**
 * PawCare AI — Nutrition Advisor Screen (Gợi ý Dinh dưỡng AI)
 *
 * Implements veterinary standard WSAVA nutrition calculations:
 * - Species, breed, weight, age, neutered status, and activity selection
 * - Specialized 37-breed dataset nutritional knowledge integration
 * - Real-time RER & MER calculation with breed-specific metabolic adjustments
 * - Exact daily food portions (Dry food grams, Wet food grams, Breed-optimal diet)
 * - Macronutrient distribution (Protein / Fat / Carbs)
 * - Safe foods vs Toxic foods checklist & Scientific source citations
 */
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';

import { useAppTheme } from '@/presentation/theme';
import { usePetStore } from '@/presentation/stores/usePetStore';
import type { Pet } from '@/domain/entities/Pet';
import {
  calculateNutrition,
  type PetLifeStage,
  type NutritionActivityLevel,
} from '@/domain/services/NutritionCalculator';
import {
  BREED_NUTRITION_PROFILES,
  type BreedNutritionProfile,
  findBreedNutritionProfile,
} from '@/domain/services/breedNutritionProfiles';

export default function NutritionScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ breed?: string; species?: string }>();
  const { pets, selectedPet, selectPet } = usePetStore();

  // Search / Selection Modal State
  const [showBreedModal, setShowBreedModal] = useState(false);
  const [breedSearchText, setBreedSearchText] = useState('');

  // Selected pet ID: null when consulting via AI Scan / manual input, or specific pet ID when user selects their pet
  const [selectedPetId, setSelectedPetId] = useState<string | null>(() => {
    if (params.breed) return null;
    return selectedPet?.id || (pets[0]?.id ?? null);
  });

  // Initial values from params or active pet
  const initialProfile = findBreedNutritionProfile(params.breed || selectedPet?.breedName || selectedPet?.breed);
  const initialSpecies = params.species === 'cat' || selectedPet?.species === 'cat' ? 'cat' : 'dog';

  // Input states
  const [species, setSpecies] = useState<'dog' | 'cat'>(() => initialProfile?.species || initialSpecies);
  const [selectedBreedKey, setSelectedBreedKey] = useState<string>(() => initialProfile?.id || '');
  const [weightKg, setWeightKg] = useState<number>(() => {
    if (params.breed && initialProfile) {
      return (initialProfile.typicalWeightKg.min + initialProfile.typicalWeightKg.max) / 2;
    }
    if (selectedPet?.weightKg && selectedPet.weightKg > 0) return selectedPet.weightKg;
    if (initialProfile) return (initialProfile.typicalWeightKg.min + initialProfile.typicalWeightKg.max) / 2;
    return initialSpecies === 'cat' ? 4.0 : 8.0;
  });
  const [lifeStage, setLifeStage] = useState<PetLifeStage>('adult');
  const [isNeutered, setIsNeutered] = useState<boolean>(() => Boolean(selectedPet?.isNeutered ?? true));
  const [activityLevel, setActivityLevel] = useState<NutritionActivityLevel>(() => selectedPet?.activityLevel || 'moderate');

  // Adjust state during render when route params change (Official React pattern)
  const [prevParamBreed, setPrevParamBreed] = useState(params.breed);
  if (params.breed !== prevParamBreed) {
    setPrevParamBreed(params.breed);
    if (params.breed) {
      setSelectedPetId(null);
    }
    const matched = findBreedNutritionProfile(params.breed);
    if (matched) {
      setSelectedBreedKey(matched.id);
      setSpecies(matched.species);
      setWeightKg(Number(((matched.typicalWeightKg.min + matched.typicalWeightKg.max) / 2).toFixed(1)));
    }
  }

  // Sync with pet selection from store
  const handleSelectPet = (p: Pet) => {
    void Haptics.selectionAsync();
    setSelectedPetId(p.id);
    selectPet(p);
    const sp = p.species === 'cat' ? 'cat' : 'dog';
    setSpecies(sp);
    if (p.weightKg > 0) {
      setWeightKg(p.weightKg);
    }
    setIsNeutered(Boolean(p.isNeutered));
    if (p.activityLevel === 'low' || p.activityLevel === 'moderate' || p.activityLevel === 'high') {
      setActivityLevel(p.activityLevel);
    }
    const matched = findBreedNutritionProfile(p.breedName || p.breed);
    if (matched) {
      setSelectedBreedKey(matched.id);
    } else {
      setSelectedBreedKey('');
    }
  };

  const handleSelectScanOrCustomMode = () => {
    void Haptics.selectionAsync();
    setSelectedPetId(null);
  };

  // Filter breed list by current species
  const availableBreeds = useMemo(() => {
    return Object.values(BREED_NUTRITION_PROFILES).filter((b) => b.species === species);
  }, [species]);

  // Popular quick-selection breeds for current species
  const popularBreeds = useMemo(() => {
    if (species === 'dog') {
      return ['poodle', 'beagle', 'pug', 'pomeranian', 'chihuahua', 'shiba_inu', 'samoyed', 'boxer', 'corgi'];
    }
    return ['british_shorthair', 'persian', 'ragdoll', 'bengal', 'sphynx', 'siamese', 'maine_coon'];
  }, [species]);

  // Filtered modal breeds
  const modalFilteredBreeds = useMemo(() => {
    const q = breedSearchText.trim().toLowerCase();
    if (!q) return availableBreeds;
    return availableBreeds.filter(
      (b) =>
        b.nameVi.toLowerCase().includes(q) ||
        b.nameEn.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
    );
  }, [availableBreeds, breedSearchText]);

  // Handle species switch
  const handleSwitchSpecies = (newSpecies: 'dog' | 'cat') => {
    void Haptics.selectionAsync();
    setSpecies(newSpecies);
    // If current breed does not match new species, reset or switch
    const currentProfile = BREED_NUTRITION_PROFILES[selectedBreedKey];
    if (currentProfile && currentProfile.species !== newSpecies) {
      setSelectedBreedKey('');
      setWeightKg(newSpecies === 'cat' ? 4.0 : 8.0);
    }
  };

  const handleSelectBreed = (b: BreedNutritionProfile | null) => {
    void Haptics.selectionAsync();
    if (!b) {
      setSelectedBreedKey('');
    } else {
      setSelectedBreedKey(b.id);
      setSpecies(b.species);
      // Auto-adjust weight towards breed standard if too divergent
      if (weightKg < b.typicalWeightKg.min || weightKg > b.typicalWeightKg.max * 1.5) {
        setWeightKg(Number(((b.typicalWeightKg.min + b.typicalWeightKg.max) / 2).toFixed(1)));
      }
    }
    setShowBreedModal(false);
  };

  // Compute nutrition via Domain Service (pure veterinary formulas)
  const calculationResult = useMemo(() => {
    return calculateNutrition({
      species,
      weightKg,
      lifeStage,
      isNeutered,
      activityLevel,
      breedKey: selectedBreedKey || undefined,
    });
  }, [species, weightKg, lifeStage, isNeutered, activityLevel, selectedBreedKey]);

  const activeBreedProfile = calculationResult.breedProfile;

  const adjustWeight = (delta: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWeightKg((prev) => Math.max(0.5, Math.min(80, Number((prev + delta).toFixed(1)))));
  };

  const getSizeLabel = (size?: string) => {
    switch (size) {
      case 'toy':
        return 'Mini / Toy';
      case 'small':
        return 'Nhỏ (Small)';
      case 'medium':
        return 'Trung bình (Medium)';
      case 'large':
        return 'Lớn (Large)';
      case 'giant':
        return 'Khổng lồ (Giant)';
      default:
        return 'Tiêu chuẩn';
    }
  };

  const getKibbleSizeLabel = (kibble?: string) => {
    switch (kibble) {
      case 'extra_small':
        return 'Siêu nhỏ (0.5cm - chống nghẹn)';
      case 'small':
        return 'Hạt nhỏ (0.8 - 1cm)';
      case 'medium':
        return 'Hạt vừa (1.2cm)';
      case 'large':
        return 'Hạt lớn (1.6cm - chống nuốt vội)';
      default:
        return 'Cỡ tiêu chuẩn';
    }
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
          Tính toán khẩu phần & vi chất chuẩn thú y theo 37 giống loài
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
        {/* Real Pet Quick Picker & Calculation Target */}
        <View style={{ marginBottom: spacing.md }}>
          <Text style={[typo.labelMedium, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
            Đối tượng áp dụng:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {/* Free Mode / Scanned AI Result Chip */}
            <Pressable
              onPress={handleSelectScanOrCustomMode}
              style={[
                styles.toggleChip,
                {
                  backgroundColor: selectedPetId === null ? colors.primaryContainer : colors.surface,
                  borderColor: selectedPetId === null ? colors.primary : colors.border,
                  borderRadius: radius.full,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={params.breed ? 'line-scan' : 'tune-vertical'}
                size={16}
                color={selectedPetId === null ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  typo.labelSmall,
                  {
                    color: selectedPetId === null ? colors.primary : colors.text,
                    marginLeft: 4,
                    fontWeight: selectedPetId === null ? '700' : '500',
                  },
                ]}
              >
                {params.breed ? `Quét AI: ${activeBreedProfile?.nameVi || params.breed}` : 'Tư vấn tự do'}
              </Text>
            </Pressable>

            {pets.map((p) => {
              const isSelected = selectedPetId === p.id;
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

        {/* AI Scan Banner Notice when in scanned mode */}
        {selectedPetId === null && (params.breed || activeBreedProfile) ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primaryContainer,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: radius.lg,
              marginBottom: spacing.md,
              borderLeftWidth: 4,
              borderLeftColor: colors.primary,
            }}
          >
            <MaterialCommunityIcons name="line-scan" size={22} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[typo.titleSmall, { color: colors.primary, fontWeight: '700' }]}>
                {params.breed ? 'Gợi ý theo kết quả nhận diện AI' : 'Chế độ tính toán tự do'}
              </Text>
              <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                {activeBreedProfile
                  ? `Đang hiển thị chuẩn dinh dưỡng cho giống ${activeBreedProfile.nameVi}. Bạn có thể bấm chọn bé thú cưng ở trên nếu muốn áp dụng trực tiếp.`
                  : 'Tùy chỉnh thông số theo nhu cầu của bạn.'}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Input Parameters Card */}
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
                onPress={() => handleSwitchSpecies('dog')}
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
                onPress={() => handleSwitchSpecies('cat')}
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

          {/* Breed Selector */}
          <View style={[styles.inputGroup, { marginTop: spacing.md }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={[typo.labelMedium, { color: colors.text }]}>
                Giống loài chuyên biệt ({species === 'dog' ? '25 giống chó' : '12 giống mèo'}):
              </Text>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setShowBreedModal(true);
                }}
              >
                <Text style={[typo.labelSmall, { color: colors.primary, fontWeight: '700' }]}>
                  Xem tất cả ➔
                </Text>
              </Pressable>
            </View>

            {/* Quick popular chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
            >
              <Pressable
                onPress={() => handleSelectBreed(null)}
                style={[
                  styles.breedChip,
                  {
                    backgroundColor: !selectedBreedKey ? colors.primaryContainer : colors.surfaceElevated,
                    borderColor: !selectedBreedKey ? colors.primary : colors.border,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <Text
                  style={[
                    typo.labelSmall,
                    { color: !selectedBreedKey ? colors.primary : colors.textSecondary, fontWeight: !selectedBreedKey ? '700' : '400' },
                  ]}
                >
                  Chung theo loài
                </Text>
              </Pressable>

              {popularBreeds.map((key) => {
                const profile = BREED_NUTRITION_PROFILES[key];
                if (!profile) return null;
                const isSelected = selectedBreedKey === profile.id;
                return (
                  <Pressable
                    key={profile.id}
                    onPress={() => handleSelectBreed(profile)}
                    style={[
                      styles.breedChip,
                      {
                        backgroundColor: isSelected ? colors.primaryContainer : colors.surfaceElevated,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: radius.full,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typo.labelSmall,
                        { color: isSelected ? colors.primary : colors.text, fontWeight: isSelected ? '700' : '500' },
                      ]}
                    >
                      {profile.nameVi}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Weight Stepper */}
          <View style={[styles.inputGroup, { marginTop: spacing.md }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={[typo.labelMedium, { color: colors.text }]}>
                Cân nặng hiện tại:
              </Text>
              {activeBreedProfile && (
                <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>
                  Chuẩn giống: {activeBreedProfile.typicalWeightKg.min} - {activeBreedProfile.typicalWeightKg.max} kg
                </Text>
              )}
            </View>
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
              Độ tuổi / Giai đoạn:
            </Text>
            <View style={styles.segmentRow}>
              {[
                { label: '< 4 tháng', val: 'puppy_kitten_young' as PetLifeStage },
                { label: '4 - 12 tháng', val: 'puppy_kitten_older' as PetLifeStage },
                { label: 'Trưởng thành', val: 'adult' as PetLifeStage },
                { label: 'Lớn tuổi', val: 'senior' as PetLifeStage },
              ].map((stage) => {
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
                        {
                          color: isSelected ? colors.onPrimary : colors.text,
                          fontWeight: isSelected ? '700' : '400',
                        },
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
              Mức độ vận động hàng ngày:
            </Text>
            <View style={styles.segmentRow}>
              {[
                { label: 'Nằm nhiều', val: 'low' as NutritionActivityLevel },
                { label: 'Vừa phải', val: 'moderate' as NutritionActivityLevel },
                { label: 'Năng động', val: 'high' as NutritionActivityLevel },
              ].map((act) => {
                const isSelected = activityLevel === act.val;
                return (
                  <Pressable
                    key={act.val}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setActivityLevel(act.val);
                    }}
                    style={[
                      styles.segmentBtn,
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

          {/* Neutered Toggle */}
          <View style={[styles.inputGroup, { marginTop: spacing.md }]}>
            <View style={styles.neuteredRow}>
              <Text style={[typo.labelMedium, { color: colors.text }]}>
                Tình trạng triệt sản:
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

        {/* Specialized Breed Clinical Profile Card */}
        {activeBreedProfile && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.primary,
                borderRadius: radius.xl,
                padding: spacing.md,
                marginTop: spacing.md,
                borderLeftWidth: 4,
              },
            ]}
          >
            {/* Breed Title & Badges */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '700' }]}>
                    {activeBreedProfile.nameVi}
                  </Text>
                  <View style={[styles.badgePill, { backgroundColor: colors.primaryContainer }]}>
                    <Text style={[typo.labelSmall, { color: colors.primary, fontWeight: '700' }]}>
                      {getSizeLabel(activeBreedProfile.sizeCategory)}
                    </Text>
                  </View>
                </View>
                <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  {activeBreedProfile.nameEn} • Cân nặng tiêu chuẩn: {activeBreedProfile.typicalWeightKg.min} - {activeBreedProfile.typicalWeightKg.max} kg
                </Text>
              </View>
            </View>

            {/* Breed Metabolic Modifier Badge */}
            <View style={[styles.modifierBox, { backgroundColor: colors.surfaceElevated, borderRadius: radius.md, marginTop: spacing.sm }]}>
              <MaterialCommunityIcons
                name={activeBreedProfile.metabolicModifier < 1.0 ? 'scale-balance' : 'lightning-bolt'}
                size={20}
                color={activeBreedProfile.metabolicModifier < 1.0 ? '#D97706' : colors.primary}
              />
              <Text style={[typo.bodySmall, { color: colors.text, flex: 1, marginLeft: 8 }]}>
                <Text style={{ fontWeight: '700' }}>Hệ số chuyển hóa ({activeBreedProfile.metabolicModifier}x): </Text>
                {activeBreedProfile.metabolicModifier < 1.0
                  ? `Được điều chỉnh giảm ${Math.round((1 - activeBreedProfile.metabolicModifier) * 100)}% năng lượng do cơ địa giống dễ tích mỡ, béo phì.`
                  : activeBreedProfile.metabolicModifier > 1.0
                  ? `Được điều chỉnh tăng ${Math.round((activeBreedProfile.metabolicModifier - 1) * 100)}% năng lượng do tốc độ trao đổi chất và tiêu hao thể nhiệt cao.`
                  : 'Mức trao đổi chất cơ bản đạt chuẩn trung bình loài.'}
              </Text>
            </View>

            {/* Macronutrient Distribution Bar */}
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 6 }]}>
                Tỷ lệ Calo đa lượng khuyến nghị (Macronutrients):
              </Text>
              <View style={styles.macroBarTrack}>
                <View style={[styles.macroSegment, { flex: calculationResult.macroRatio.proteinPercent, backgroundColor: '#16A34A' }]} />
                <View style={[styles.macroSegment, { flex: calculationResult.macroRatio.fatPercent, backgroundColor: '#EA580C' }]} />
                <View style={[styles.macroSegment, { flex: calculationResult.macroRatio.carbsPercent, backgroundColor: '#0284C7' }]} />
              </View>
              <View style={styles.macroLegendRow}>
                <Text style={[typo.labelSmall, { color: '#16A34A' }]}>
                  ● Đạm: {calculationResult.macroRatio.proteinPercent}%
                </Text>
                <Text style={[typo.labelSmall, { color: '#EA580C' }]}>
                  ● Chất béo: {calculationResult.macroRatio.fatPercent}%
                </Text>
                <Text style={[typo.labelSmall, { color: '#0284C7' }]}>
                  ● Tinh bột/Xơ: {calculationResult.macroRatio.carbsPercent}%
                </Text>
              </View>
            </View>

            {/* Kibble Size & Optimal Wet/Dry */}
            <View style={[styles.infoRowGrid, { marginTop: spacing.md }]}>
              <View style={[styles.infoGridCol, { backgroundColor: colors.surfaceElevated, borderRadius: radius.md }]}>
                <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>Cỡ hạt an toàn</Text>
                <Text style={[typo.labelMedium, { color: colors.text, fontWeight: '700', marginTop: 2 }]}>
                  {getKibbleSizeLabel(activeBreedProfile.kibbleSize)}
                </Text>
              </View>
              <View style={[styles.infoGridCol, { backgroundColor: colors.surfaceElevated, borderRadius: radius.md }]}>
                <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>Tỷ lệ hạt / pate tối ưu</Text>
                <Text style={[typo.labelMedium, { color: colors.primary, fontWeight: '700', marginTop: 2 }]}>
                  {100 - calculationResult.optimalDiet.wetPercentage}% Hạt + {calculationResult.optimalDiet.wetPercentage}% Pate
                </Text>
              </View>
            </View>

            {/* Key Nutrients Chips */}
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 6 }]}>
                ✨ Vi chất vàng cho giống này:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {activeBreedProfile.keyNutrients.map((nut, idx) => (
                  <View key={idx} style={[styles.chipPill, { backgroundColor: colors.primaryContainer }]}>
                    <Text style={[typo.labelSmall, { color: colors.primary, fontWeight: '600' }]}>
                      {nut}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Health Risks Alert */}
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 6 }]}>
                ⚠️ Cảnh báo bệnh lý di truyền cần kiểm soát chế độ ăn:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {activeBreedProfile.healthRisks.map((risk, idx) => (
                  <View key={idx} style={[styles.chipPill, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1 }]}>
                    <Text style={[typo.labelSmall, { color: '#DC2626', fontWeight: '600' }]}>
                      {risk}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Veterinary Doctor Advice */}
            <View style={[styles.adviceBox, { backgroundColor: colors.surfaceElevated, borderRadius: radius.md, marginTop: spacing.md }]}>
              <MaterialCommunityIcons name="doctor" size={22} color={colors.primary} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[typo.labelMedium, { color: colors.primary, fontWeight: '700' }]}>
                  Lời khuyên Bác sĩ thú y:
                </Text>
                <Text style={[typo.bodySmall, { color: colors.text, marginTop: 4, lineHeight: 20 }]}>
                  {activeBreedProfile.dietaryAdviceVi}
                </Text>
              </View>
            </View>

            {/* Scientific Source Reference */}
            <View style={{ marginTop: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={[typo.labelSmall, { color: colors.textTertiary, fontStyle: 'italic' }]}>
                Nguồn y khoa: {activeBreedProfile.scientificSource}
              </Text>
            </View>
          </View>
        )}

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
                MER (Mục tiêu {activeBreedProfile ? 'theo giống' : ''})
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
                Nước uống: <Text style={{ fontWeight: '700' }}>~{calculationResult.recommendedWaterMlPerDay} ml/ngày</Text>
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
            Khẩu phần ăn cụ thể (Gram/ngày)
          </Text>
          <Text style={[typo.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
            Lựa chọn hình thức cho ăn phù hợp với thói quen gia đình bạn:
          </Text>

          {/* Option 1: Breed Optimal Diet (Highlighted) */}
          <View style={[styles.portionHighlightBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.primary, borderRadius: radius.lg }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <MaterialCommunityIcons name="star-circle" size={20} color={colors.primary} />
              <Text style={[typo.labelMedium, { color: colors.primary, fontWeight: '700', marginLeft: 4, flex: 1 }]}>
                Chế độ vàng khuyến nghị cho {activeBreedProfile ? activeBreedProfile.nameVi : 'thú cưng'}
              </Text>
            </View>
            <View style={{ gap: 6 }}>
              <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                Tỷ lệ chuẩn: {100 - calculationResult.optimalDiet.wetPercentage}% Hạt khô + {calculationResult.optimalDiet.wetPercentage}% Pate ướt
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <View style={[styles.dietBadge, { backgroundColor: colors.primaryContainer }]}>
                  <Text style={[typo.labelMedium, { color: colors.primary, fontWeight: '700' }]}>
                    🥣 Hạt: {calculationResult.optimalDiet.dryGrams}g/ngày
                  </Text>
                </View>
                <View style={[styles.dietBadge, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[typo.labelMedium, { color: '#DC2626', fontWeight: '700' }]}>
                    🥫 Pate: {calculationResult.optimalDiet.wetGrams}g/ngày
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Option 2: Dry food only */}
          <View style={[styles.portionRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
            <View style={styles.portionLeft}>
              <MaterialCommunityIcons name="seed-outline" size={22} color="#D97706" />
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={[typo.labelLarge, { color: colors.text }]}>Hạt khô hoàn toàn (Dry Kibble)</Text>
                <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                  ~{Math.round(calculationResult.dryFoodGrams / calculationResult.recommendedMealsPerDay)}g mỗi bữa ({calculationResult.recommendedMealsPerDay} bữa)
                </Text>
              </View>
            </View>
            <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '700' }]}>
              {calculationResult.dryFoodGrams}g
            </Text>
          </View>

          {/* Option 3: Wet food only */}
          <View style={styles.portionRow}>
            <View style={styles.portionLeft}>
              <MaterialCommunityIcons name="food-variant" size={22} color="#DC2626" />
              <View style={{ marginLeft: spacing.sm }}>
                <Text style={[typo.labelLarge, { color: colors.text }]}>Pate ướt hoàn toàn (Wet Food)</Text>
                <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                  ~{Math.round(calculationResult.wetFoodGrams / calculationResult.recommendedMealsPerDay)}g mỗi bữa ({calculationResult.recommendedMealsPerDay} bữa)
                </Text>
              </View>
            </View>
            <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '700' }]}>
              {calculationResult.wetFoodGrams}g
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
            Cẩm nang an toàn thực phẩm
          </Text>

          <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
            <View style={styles.safeRow}>
              <MaterialCommunityIcons name="check-circle" size={18} color="#16A34A" />
              <Text style={[typo.bodySmall, { color: colors.text, marginLeft: 6, flex: 1 }]}>
                <Text style={{ fontWeight: '700', color: '#16A34A' }}>Nên ăn: </Text>
                Ức gà luộc xé nhỏ, thịt bò nạc, cá hồi gỡ sạch xương, cà rốt, bí ngô hấp chín.
              </Text>
            </View>

            <View style={styles.safeRow}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#DC2626" />
              <Text style={[typo.bodySmall, { color: colors.text, marginLeft: 6, flex: 1 }]}>
                <Text style={{ fontWeight: '700', color: '#DC2626' }}>Cực độc (Nguy hiểm tính mạng): </Text>
                Socola, hành tây, tỏi, nho & nho khô, bơ, cafein, hạt macca, xương gà sắc nhọn.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Full 37-Breed Selection Modal */}
      <Modal visible={showBreedModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '700' }]}>
                Chọn Giống ({species === 'dog' ? 'Chó' : 'Mèo'})
              </Text>
              <Pressable
                onPress={() => setShowBreedModal(false)}
                hitSlop={8}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceElevated }]}
              >
                <MaterialCommunityIcons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={[styles.searchBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.lg }]}>
              <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
              <TextInput
                placeholder="Tìm kiếm giống (vd: Poodle, Beagle, Ba Tư...)"
                placeholderTextColor={colors.textTertiary}
                value={breedSearchText}
                onChangeText={setBreedSearchText}
                style={[styles.searchInput, { color: colors.text }]}
              />
              {breedSearchText ? (
                <Pressable onPress={() => setBreedSearchText('')}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            {/* Breed List */}
            <FlatList
              data={modalFilteredBreeds}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: spacing.sm }}
              renderItem={({ item }) => {
                const isSelected = selectedBreedKey === item.id;
                return (
                  <Pressable
                    onPress={() => handleSelectBreed(item)}
                    style={[
                      styles.breedListItem,
                      {
                        backgroundColor: isSelected ? colors.primaryContainer : colors.surface,
                        borderBottomColor: colors.border,
                        borderBottomWidth: 1,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[typo.labelLarge, { color: isSelected ? colors.primary : colors.text, fontWeight: '600' }]}>
                        {item.nameVi}
                      </Text>
                      <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                        {item.nameEn} • {getSizeLabel(item.sizeCategory)} • {item.typicalWeightKg.min}-{item.typicalWeightKg.max} kg
                      </Text>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
                    )}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
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
    gap: 8,
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
  breedChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
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
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  modifierBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  macroBarTrack: {
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  macroSegment: {
    height: '100%',
  },
  macroLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  infoRowGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  infoGridCol: {
    flex: 1,
    padding: 10,
  },
  chipPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  adviceBox: {
    flexDirection: 'row',
    padding: 12,
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
  portionHighlightBox: {
    padding: 12,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  dietBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
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
    flex: 1,
    marginRight: 8,
  },
  safeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
  },
  breedListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
});
