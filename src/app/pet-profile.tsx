/**
 * PawCare AI — Dedicated Pet Profile Screen (Hồ sơ thú cưng chuyên biệt)
 *
 * Professional healthcare & care profile screen:
 * - Direct navigation from Home & Owner Profile (never redirects to Owner Account)
 * - Multi-pet horizontal quick switcher
 * - Detailed pet identity (photo, breed, sex, sterilization status, exact age)
 * - Vital health metrics (weight, activity, body condition)
 * - Real-time daily nutrition & calories calculation (RER/MER) via NutritionCalculator
 * - Integrated vaccination & preventive status with quick action buttons
 * - Health history, medical notes & allergy tracking
 * - Edit Pet modal with instant Supabase database persistence
 * - Delete pet with safe confirmation dialog
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { useAppTheme } from '@/presentation/theme';
import { usePetStore } from '@/presentation/stores/usePetStore';
import { useVaccinationStore } from '@/presentation/stores/useVaccinationStore';
import { PrimaryButton } from '@/presentation/components/PrimaryButton';
import { AddPetModal } from '@/presentation/components/AddPetModal';
import { calculateNutrition } from '@/domain/services/NutritionCalculator';
import type { Pet, Species } from '@/domain/entities/Pet';

function getAgeString(birthDateStr?: string | null): string {
  if (!birthDateStr) return 'Chưa cập nhật ngày sinh';
  const birth = new Date(birthDateStr);
  if (isNaN(birth.getTime())) return 'Chưa cập nhật ngày sinh';
  const now = new Date();
  const diffMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (diffMonths < 0) return 'Chưa cập nhật ngày sinh';
  if (diffMonths < 1) return 'Dưới 1 tháng tuổi';
  if (diffMonths < 12) return `${diffMonths} tháng tuổi`;
  const years = Math.floor(diffMonths / 12);
  const remMonths = diffMonths % 12;
  return remMonths > 0 ? `${years} tuổi ${remMonths} tháng` : `${years} tuổi`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'Chưa rõ';
  try {
    const [y, m, d] = dateStr.split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
    return dateStr;
  } catch {
    return dateStr;
  }
}

export default function PetProfileScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const searchParams = useLocalSearchParams<{ petId?: string }>();

  const { pets, selectedPet, selectPet, updatePet, deletePet, isLoading: isPetStoreLoading } = usePetStore();
  const { records, loadVaccinations } = useVaccinationStore();

  // Active pet state - user selection takes priority over initial param
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activePetId = selectedId ?? searchParams.petId ?? selectedPet?.id ?? pets[0]?.id ?? '';

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editSpecies, setEditSpecies] = useState<Species>('dog');
  const [editBreed, setEditBreed] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editSex, setEditSex] = useState<'male' | 'female' | 'unknown'>('male');
  const [editNeutered, setEditNeutered] = useState(true);
  const [editActivity, setEditActivity] = useState<'low' | 'moderate' | 'high'>('moderate');
  const [editNotes, setEditNotes] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const currentPet: Pet | null = useMemo(() => {
    return pets.find((p) => p.id === activePetId) || selectedPet || (pets.length > 0 ? pets[0] : null);
  }, [pets, activePetId, selectedPet]);

  // Load vaccination records for this pet
  useEffect(() => {
    if (currentPet?.id) {
      void loadVaccinations(currentPet.id);
    }
  }, [currentPet?.id, loadVaccinations]);

  // Vaccination stats for current pet
  const petVaccinations = useMemo(() => {
    if (!currentPet) return { completed: 0, planned: 0, total: 0 };
    const list = records.filter((r) => r.petId === currentPet.id);
    const completed = list.filter((r) => r.status === 'completed').length;
    const planned = list.filter((r) => r.status === 'planned').length;
    return { completed, planned, total: list.length };
  }, [records, currentPet]);

  // Daily Nutrition calculation for current pet
  const nutritionResult = useMemo(() => {
    if (!currentPet || currentPet.species === 'other') return null;
    try {
      return calculateNutrition({
        species: currentPet.species as 'dog' | 'cat',
        weightKg: currentPet.weightKg > 0 ? currentPet.weightKg : 4.0,
        lifeStage: 'adult',
        isNeutered: Boolean(currentPet.isNeutered),
        activityLevel: (currentPet.activityLevel as any) || 'moderate',
        breedKey: currentPet.breedId,
        breedName: currentPet.breedName || currentPet.breed,
      });
    } catch {
      return null;
    }
  }, [currentPet]);

  // Handle pick and upload avatar
  const handlePickAvatar = () => {
    if (!currentPet) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Cập nhật ảnh thú cưng',
      `Thay đổi ảnh đại diện cho bé "${currentPet.name}":`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: '📸 Chụp ảnh mới',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Cần quyền truy cập', 'Vui lòng cho phép ứng dụng truy cập máy ảnh trong cài đặt thiết bị.');
                return;
              }
              const res = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.6,
                base64: true,
              });
              if (!res.canceled && res.assets && res.assets[0]) {
                await applyAvatar(res.assets[0]);
              }
            } catch (err: any) {
              Alert.alert('Lỗi chụp ảnh', err?.message || 'Không thể chụp ảnh lúc này.');
            }
          },
        },
        {
          text: '🖼️ Chọn từ thư viện',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Cần quyền truy cập', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh trong cài đặt.');
                return;
              }
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.6,
                base64: true,
              });
              if (!res.canceled && res.assets && res.assets[0]) {
                await applyAvatar(res.assets[0]);
              }
            } catch (err: any) {
              Alert.alert('Lỗi chọn ảnh', err?.message || 'Không thể chọn ảnh từ thư viện.');
            }
          },
        },
      ]
    );
  };

  const applyAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!currentPet) return;
    setIsUploadingAvatar(true);
    try {
      let finalPhotoUrl = asset.uri;
      if (asset.base64) {
        finalPhotoUrl = `data:image/jpeg;base64,${asset.base64}`;
      }
      await updatePet(currentPet.id, { photoUrl: finalPhotoUrl });
      setEditPhotoUrl(finalPhotoUrl);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thành công', 'Đã cập nhật ảnh đại diện mới cho bé!');
    } catch (e: any) {
      Alert.alert('Không thể lưu ảnh', e?.message || 'Có lỗi xảy ra khi lưu ảnh.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Handle opening edit modal
  const handleOpenEdit = () => {
    if (!currentPet) return;
    setEditName(currentPet.name);
    setEditSpecies(currentPet.species);
    setEditBreed(currentPet.breedName || currentPet.breed || '');
    setEditWeight(currentPet.weightKg ? String(currentPet.weightKg) : '4.5');
    setEditBirthDate(currentPet.birthDate || '');
    setEditSex(currentPet.sex || 'male');
    setEditNeutered(Boolean(currentPet.isNeutered));
    setEditActivity(currentPet.activityLevel || 'moderate');
    setEditNotes(currentPet.notes || '');
    setEditPhotoUrl(currentPet.photoUrl || null);
    setEditError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsEditModalOpen(true);
  };

  // Submit edit
  const handleSaveEdit = async () => {
    if (!currentPet) return;
    if (!editName.trim()) {
      setEditError('Tên thú cưng không được để trống.');
      return;
    }
    const weightNum = parseFloat(editWeight);
    if (isNaN(weightNum) || weightNum <= 0) {
      setEditError('Cân nặng phải là số dương hợp lệ (ví dụ: 4.5).');
      return;
    }

    setEditError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await updatePet(currentPet.id, {
        name: editName.trim(),
        species: editSpecies,
        breedName: editBreed.trim() || (editSpecies === 'dog' ? 'Chó nhà' : 'Mèo nhà'),
        weightKg: weightNum,
        birthDate: editBirthDate.trim() || null,
        sex: editSex,
        isNeutered: editNeutered,
        activityLevel: editActivity,
        notes: editNotes.trim() || null,
        photoUrl: editPhotoUrl,
      });
      setIsEditModalOpen(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Thành công', `Đã cập nhật thông tin hồ sơ bé ${editName.trim()}!`);
    } catch (e: any) {
      setEditError(e?.message || 'Không thể lưu thay đổi. Vui lòng thử lại.');
    }
  };

  // Handle delete pet
  const handleDeleteCurrentPet = () => {
    if (!currentPet) return;
    Alert.alert(
      'Xóa hồ sơ thú cưng',
      `Bạn có chắc chắn muốn xóa hồ sơ của bé "${currentPet.name}"?\nMọi lịch tiêm chủng và ghi chú của bé cũng sẽ bị hủy.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận xóa',
          style: 'destructive',
          onPress: async () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await deletePet(currentPet.id);
              if (pets.length > 1) {
                const remaining = pets.filter((p) => p.id !== currentPet.id);
                setSelectedId(remaining[0].id);
              } else {
                router.back();
              }
            } catch (err: any) {
              Alert.alert('Không thể xóa', err?.message || 'Có lỗi xảy ra khi xóa hồ sơ thú cưng.');
            }
          },
        },
      ]
    );
  };

  // Empty state if no pets exist
  if (!currentPet && !isPetStoreLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg }]}>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { borderColor: colors.border }]}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={[typo.titleLarge, { color: colors.text, marginLeft: spacing.sm }]}>Hồ sơ thú cưng</Text>
        </View>

        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconBox, { backgroundColor: colors.primaryContainer }]}>
            <MaterialCommunityIcons name="paw" size={48} color={colors.primary} />
          </View>
          <Text style={[typo.headlineMedium, { color: colors.text, marginTop: spacing.md }]}>
            Chưa có hồ sơ thú cưng nào
          </Text>
          <Text style={[typo.bodyMedium, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }]}>
            Thêm thú cưng của bạn ngay để theo dõi cân nặng, lịch tiêm phòng và chế độ dinh dưỡng tối ưu.
          </Text>
          <View style={{ width: '100%', marginTop: spacing.xl }}>
            <PrimaryButton
              title="+ Thêm thú cưng ngay"
              onPress={() => setIsAddModalOpen(true)}
            />
          </View>
        </View>

        <AddPetModal
          visible={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
          }}
        />
      </View>
    );
  }

  const speciesColor = currentPet?.species === 'dog' ? '#EA580C' : '#9333EA';
  const speciesBg = currentPet?.species === 'dog' ? '#FFEDD5' : '#F3E8FF';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top App Bar with Sticky Pet Selector */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={[styles.backBtn, { borderColor: colors.border }]}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          </Pressable>

          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '700' }]}>
              Hồ sơ thú cưng
            </Text>
            <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
              {currentPet ? `Bé ${currentPet.name} (${currentPet.species === 'dog' ? 'Chó' : 'Mèo'})` : 'Sức khỏe & chăm sóc'}
            </Text>
          </View>

          <Pressable
            onPress={handleOpenEdit}
            style={[
              styles.editHeaderBtn,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
          >
            <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} />
            <Text style={[typo.labelMedium, { color: colors.primary, marginLeft: 4, fontWeight: '700' }]}>
              Sửa
            </Text>
          </Pressable>
        </View>

        {/* Top Horizontal Pet Switcher (Sticky at top left/bar) */}
        {pets.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginTop: spacing.sm, paddingBottom: 2 }}
          >
            {pets.map((pet) => {
              const isActive = pet.id === currentPet?.id;
              return (
                <Pressable
                  key={pet.id}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setSelectedId(pet.id);
                    selectPet(pet);
                  }}
                  style={[
                    styles.petTab,
                    {
                      backgroundColor: isActive ? colors.primary : colors.surfaceElevated,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={pet.species === 'dog' ? 'dog' : 'cat'}
                    size={18}
                    color={isActive ? colors.onPrimary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      typo.labelMedium,
                      {
                        color: isActive ? colors.onPrimary : colors.text,
                        fontWeight: isActive ? '700' : '500',
                        marginLeft: 4,
                      },
                    ]}
                  >
                    {pet.name}
                  </Text>
                </Pressable>
              );
            })}

            <Pressable
              onPress={() => setIsAddModalOpen(true)}
              style={[
                styles.petTab,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <MaterialCommunityIcons name="plus" size={16} color={colors.primary} />
              <Text style={[typo.labelMedium, { color: colors.primary, marginLeft: 2, fontWeight: '600' }]}>
                Thêm bé
              </Text>
            </Pressable>
          </ScrollView>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing.xxl,
          paddingTop: spacing.sm,
        }}
      >

        {/* HERO PET IDENTITY CARD */}
        {currentPet && (
          <View style={{ paddingHorizontal: spacing.lg }}>
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                },
              ]}
            >
              <View style={styles.heroRow}>
                {/* Big Avatar with Upload Support */}
                <Pressable
                  onPress={handlePickAvatar}
                  disabled={isUploadingAvatar}
                  style={[
                    styles.heroAvatar,
                    {
                      backgroundColor: speciesBg,
                      borderColor: speciesColor + '40',
                    },
                  ]}
                >
                  {currentPet.photoUrl ? (
                    <Image
                      source={{ uri: currentPet.photoUrl }}
                      style={styles.heroAvatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name={currentPet.species === 'dog' ? 'dog' : 'cat'}
                      size={46}
                      color={speciesColor}
                    />
                  )}

                  {isUploadingAvatar ? (
                    <View style={styles.avatarLoadingOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  ) : (
                    <View style={styles.cameraIconBadge}>
                      <MaterialCommunityIcons name="camera-plus" size={13} color="#FFFFFF" />
                    </View>
                  )}

                  <View style={[styles.avatarSpeciesBadge, { backgroundColor: speciesColor }]}>
                    <Text style={styles.avatarSpeciesText}>
                      {currentPet.species === 'dog' ? 'CHÓ' : 'MÈO'}
                    </Text>
                  </View>
                </Pressable>

                {/* Name & Quick Badges */}
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[typo.headlineMedium, { color: colors.text, fontWeight: '800' }]}>
                      {currentPet.name}
                    </Text>
                    <View
                      style={[
                        styles.genderPill,
                        {
                          backgroundColor:
                            currentPet.sex === 'female' ? '#FCE7F3' : '#E0F2FE',
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          currentPet.sex === 'female'
                            ? 'gender-female'
                            : currentPet.sex === 'male'
                            ? 'gender-male'
                            : 'gender-male-female'
                        }
                        size={14}
                        color={currentPet.sex === 'female' ? '#DB2777' : '#0284C7'}
                      />
                      <Text
                        style={[
                          typo.labelSmall,
                          {
                            color: currentPet.sex === 'female' ? '#DB2777' : '#0284C7',
                            fontWeight: '700',
                            marginLeft: 2,
                          },
                        ]}
                      >
                        {currentPet.sex === 'female' ? 'Cái' : currentPet.sex === 'male' ? 'Đực' : 'Chưa rõ'}
                      </Text>
                    </View>
                  </View>

                  <Text style={[typo.titleSmall, { color: colors.primary, marginTop: 2 }]}>
                    {currentPet.breedName || currentPet.breed || (currentPet.species === 'dog' ? 'Chó cảnh' : 'Mèo cảnh')}
                  </Text>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.xs }}>
                    <View style={[styles.statusTag, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                      <MaterialCommunityIcons name="cake-variant-outline" size={13} color={colors.textSecondary} />
                      <Text style={[typo.labelSmall, { color: colors.textSecondary, marginLeft: 3 }]}>
                        {getAgeString(currentPet.birthDate)}
                      </Text>
                    </View>

                    <View style={[styles.statusTag, { backgroundColor: currentPet.isNeutered ? '#DCFCE7' : '#FEF3C7' }]}>
                      <MaterialCommunityIcons
                        name={currentPet.isNeutered ? 'shield-check-outline' : 'shield-alert-outline'}
                        size={13}
                        color={currentPet.isNeutered ? '#16A34A' : '#D97706'}
                      />
                      <Text
                        style={[
                          typo.labelSmall,
                          {
                            color: currentPet.isNeutered ? '#16A34A' : '#D97706',
                            fontWeight: '700',
                            marginLeft: 3,
                          },
                        ]}
                      >
                        {currentPet.isNeutered ? 'Đã triệt sản' : 'Chưa triệt sản'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* 4-BOX VITAL METRICS GRID */}
            <View style={[styles.metricsGrid, { marginTop: spacing.md }]}>
              {/* Metric 1: Weight */}
              <View style={[styles.metricBox, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
                <View style={styles.metricHeader}>
                  <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>CÂN NẶNG</Text>
                  <MaterialCommunityIcons name="scale-bathroom" size={16} color="#0284C7" />
                </View>
                <Text style={[typo.headlineSmall, { color: colors.text, marginTop: 4, fontWeight: '800' }]}>
                  {currentPet.weightKg} <Text style={[typo.titleSmall, { color: colors.textSecondary }]}>kg</Text>
                </Text>
                <Text style={[typo.bodySmall, { color: '#0284C7', marginTop: 2 }]}>
                  {currentPet.weightKg < 3 ? 'Nhỏ bé' : currentPet.weightKg <= 10 ? 'Trung bình' : 'Lớn khỏe'}
                </Text>
              </View>

              {/* Metric 2: Activity */}
              <View style={[styles.metricBox, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
                <View style={styles.metricHeader}>
                  <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>VẬN ĐỘNG</Text>
                  <MaterialCommunityIcons name="run-fast" size={16} color="#16A34A" />
                </View>
                <Text style={[typo.headlineSmall, { color: colors.text, marginTop: 4, fontWeight: '800' }]}>
                  {currentPet.activityLevel === 'high' ? 'Năng động' : currentPet.activityLevel === 'low' ? 'Ít vận động' : 'Vừa phải'}
                </Text>
                <Text style={[typo.bodySmall, { color: '#16A34A', marginTop: 2 }]}>
                  {currentPet.activityLevel === 'high' ? 'Cần nhiều calo' : 'Tiêu chuẩn'}
                </Text>
              </View>

              {/* Metric 3: Birthday */}
              <View style={[styles.metricBox, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
                <View style={styles.metricHeader}>
                  <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>NGÀY SINH</Text>
                  <MaterialCommunityIcons name="calendar-heart" size={16} color="#E11D48" />
                </View>
                <Text style={[typo.titleMedium, { color: colors.text, marginTop: 4, fontWeight: '700' }]}>
                  {formatDate(currentPet.birthDate)}
                </Text>
                <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  Sinh nhật bé
                </Text>
              </View>

              {/* Metric 4: Vaccination count */}
              <View style={[styles.metricBox, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
                <View style={styles.metricHeader}>
                  <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>ĐÃ TIÊM CHỦNG</Text>
                  <MaterialCommunityIcons name="needle" size={16} color="#9333EA" />
                </View>
                <Text style={[typo.headlineSmall, { color: colors.text, marginTop: 4, fontWeight: '800' }]}>
                  {petVaccinations.completed} <Text style={[typo.titleSmall, { color: colors.textSecondary }]}>mũi</Text>
                </Text>
                <Text style={[typo.bodySmall, { color: petVaccinations.planned > 0 ? '#D97706' : '#16A34A', marginTop: 2 }]}>
                  {petVaccinations.planned > 0 ? `${petVaccinations.planned} mũi chờ tiêm` : 'Đã phòng ngừa tốt'}
                </Text>
              </View>
            </View>

            {/* SECTION 1: SỔ TIÊM CHỦNG & PHÒNG BỆNH CỦA BÉ */}
            <View
              style={[
                styles.featureCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                  marginTop: spacing.md,
                  padding: spacing.md,
                },
              ]}
            >
              <View style={styles.featureHeaderRow}>
                <View style={[styles.featureIconBadge, { backgroundColor: '#DCFCE7' }]}>
                  <MaterialCommunityIcons name="needle" size={20} color="#16A34A" />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[typo.titleMedium, { color: colors.text, fontWeight: '700' }]}>
                    Sổ tiêm chủng & Phòng ngừa
                  </Text>
                  <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                    {petVaccinations.total === 0
                      ? 'Chưa ghi nhận mũi tiêm nào cho bé'
                      : `Tổng cộng ${petVaccinations.total} ghi nhận (${petVaccinations.completed} đã tiêm, ${petVaccinations.planned} hẹn lịch)`}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    selectPet(currentPet);
                    router.push({
                      pathname: '/vaccinations',
                      params: { petId: currentPet.id },
                    } as any);
                  }}
                  style={[
                    styles.featureBtn,
                    { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md },
                  ]}
                >
                  <MaterialCommunityIcons name="book-open-outline" size={16} color={colors.primary} />
                  <Text style={[typo.labelMedium, { color: colors.primary, marginLeft: 6, fontWeight: '700' }]}>
                    Mở sổ tiêm bé {currentPet.name}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    selectPet(currentPet);
                    router.push({
                      pathname: '/add-vaccination',
                      params: { petId: currentPet.id, defaultStatus: 'planned' },
                    } as any);
                  }}
                  style={[styles.featureBtn, { backgroundColor: colors.primary, borderRadius: radius.md }]}
                >
                  <MaterialCommunityIcons name="calendar-plus" size={16} color={colors.onPrimary} />
                  <Text style={[typo.labelMedium, { color: colors.onPrimary, marginLeft: 6, fontWeight: '700' }]}>
                    + Hẹn lịch tiêm
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* SECTION 2: DINH DƯỠNG & NĂNG LƯỢNG RER/MER */}
            {nutritionResult && (
              <View
                style={[
                  styles.featureCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.xl,
                    marginTop: spacing.md,
                    padding: spacing.md,
                  },
                ]}
              >
                <View style={styles.featureHeaderRow}>
                  <View style={[styles.featureIconBadge, { backgroundColor: '#FFEDD5' }]}>
                    <MaterialCommunityIcons name="food-drumstick" size={20} color="#EA580C" />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.sm }}>
                    <Text style={[typo.titleMedium, { color: colors.text, fontWeight: '700' }]}>
                      Nhu cầu năng lượng hàng ngày
                    </Text>
                    <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                      Khuyến nghị chuẩn Thú y Quốc tế (WSAVA & AAHA)
                    </Text>
                  </View>
                </View>

                {/* Nutrition numbers row */}
                <View style={[styles.nutritionBoxRow, { backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, marginTop: spacing.md }]}>
                  <View style={styles.nutritionBoxItem}>
                    <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>NĂNG LƯỢNG (MER)</Text>
                    <Text style={[typo.titleLarge, { color: '#EA580C', fontWeight: '800', marginTop: 2 }]}>
                      {nutritionResult.merKcal} <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>kcal/ngày</Text>
                    </Text>
                  </View>

                  <View style={[styles.dividerV, { backgroundColor: colors.border }]} />

                  <View style={styles.nutritionBoxItem}>
                    <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>NƯỚC UỐNG</Text>
                    <Text style={[typo.titleLarge, { color: '#0284C7', fontWeight: '800', marginTop: 2 }]}>
                      ~{nutritionResult.recommendedWaterMlPerDay} <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>ml/ngày</Text>
                    </Text>
                  </View>

                  <View style={[styles.dividerV, { backgroundColor: colors.border }]} />

                  <View style={styles.nutritionBoxItem}>
                    <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>BỮA ĂN</Text>
                    <Text style={[typo.titleLarge, { color: '#16A34A', fontWeight: '800', marginTop: 2 }]}>
                      {nutritionResult.recommendedMealsPerDay} <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>bữa/ngày</Text>
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push({
                      pathname: '/(app)/nutrition',
                      params: {
                        breed: currentPet.breedName || currentPet.breed,
                        species: currentPet.species === 'cat' ? 'cat' : 'dog',
                      },
                    } as any);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md }}
                >
                  <Text style={[typo.labelMedium, { color: colors.primary, fontWeight: '700' }]}>
                    Xem thực đơn & chi tiết dinh dưỡng →
                  </Text>
                </Pressable>
              </View>
            )}

            {/* SECTION 3: GHI CHÚ SỨC KHỎE, DỊ ỨNG & LƯU Ý BÁC SĨ */}
            <View
              style={[
                styles.featureCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                  marginTop: spacing.md,
                  padding: spacing.md,
                },
              ]}
            >
              <View style={styles.featureHeaderRow}>
                <View style={[styles.featureIconBadge, { backgroundColor: '#E0E7FF' }]}>
                  <MaterialCommunityIcons name="clipboard-text-outline" size={20} color="#4F46E5" />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={[typo.titleMedium, { color: colors.text, fontWeight: '700' }]}>
                    Ghi chú sức khỏe & Dị ứng
                  </Text>
                  <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                    Lưu ý về thức ăn, thuốc dị ứng hoặc tính cách
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.notesBox,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    marginTop: spacing.sm,
                  },
                ]}
              >
                <Text style={[typo.bodyMedium, { color: currentPet.notes ? colors.text : colors.textTertiary, lineHeight: 20 }]}>
                  {currentPet.notes || 'Chưa có ghi chú đặc biệt nào. Bấm nút "Sửa" ở trên để thêm ghi chú dị ứng hoặc bệnh lý cho bé.'}
                </Text>
              </View>
            </View>

            {/* QUICK AI BREED SCANNER BUTTON */}
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(app)/breed-scanner' as any);
              }}
              style={[
                styles.scannerCard,
                {
                  backgroundColor: '#0F172A',
                  borderRadius: radius.xl,
                  marginTop: spacing.md,
                  padding: spacing.md,
                },
              ]}
            >
              <View style={[styles.scannerIconBox, { backgroundColor: '#1E293B' }]}>
                <MaterialCommunityIcons name="camera-iris" size={24} color="#38BDF8" />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[typo.titleMedium, { color: '#F8FAFC', fontWeight: '700' }]}>
                  Quét nhận diện giống AI
                </Text>
                <Text style={[typo.bodySmall, { color: '#94A3B8' }]}>
                  Chụp ảnh bé để AI nhận diện giống & gợi ý chăm sóc
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#94A3B8" />
            </Pressable>

            {/* DELETE PET ACTION */}
            <Pressable
              onPress={handleDeleteCurrentPet}
              style={[
                styles.deleteBtn,
                {
                  borderColor: '#FCA5A5',
                  backgroundColor: '#FEF2F2',
                  borderRadius: radius.lg,
                  marginTop: spacing.xl,
                },
              ]}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={18} color="#DC2626" />
              <Text style={[typo.labelMedium, { color: '#DC2626', fontWeight: '700', marginLeft: 6 }]}>
                Xóa hồ sơ bé {currentPet.name}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* ================= EDIT PET MODAL ================= */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
        >
          {/* Modal Header */}
          <View
            style={[
              styles.modalHeader,
              {
                paddingTop: spacing.lg,
                paddingHorizontal: spacing.lg,
                paddingBottom: spacing.md,
                borderBottomColor: colors.border,
                borderBottomWidth: 1,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <View>
              <Text style={[typo.headlineSmall, { color: colors.text, fontWeight: '800' }]}>
                Chỉnh sửa hồ sơ bé {currentPet?.name}
              </Text>
              <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                Cập nhật thông tin thực tế cho thú cưng
              </Text>
            </View>
            <Pressable
              onPress={() => setIsEditModalOpen(false)}
              hitSlop={8}
              style={[styles.closeModalBtn, { borderColor: colors.border }]}
            >
              <MaterialCommunityIcons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}
          >
            {editError && (
              <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderRadius: radius.md }]}>
                <MaterialCommunityIcons name="alert-circle" size={18} color="#DC2626" />
                <Text style={[typo.bodySmall, { color: '#DC2626', marginLeft: 6, flex: 1 }]}>
                  {editError}
                </Text>
              </View>
            )}

            {/* Avatar Picker in Edit Modal */}
            <View style={{ alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.xs }}>
              <Pressable
                onPress={handlePickAvatar}
                style={[
                  styles.heroAvatar,
                  {
                    width: 76,
                    height: 76,
                    borderRadius: 38,
                    backgroundColor: editSpecies === 'dog' ? '#FFEDD5' : '#F3E8FF',
                    borderColor: colors.primary,
                  },
                ]}
              >
                {editPhotoUrl ? (
                  <Image source={{ uri: editPhotoUrl }} style={styles.heroAvatarImage} resizeMode="cover" />
                ) : (
                  <MaterialCommunityIcons
                    name={editSpecies === 'dog' ? 'dog' : 'cat'}
                    size={38}
                    color={editSpecies === 'dog' ? '#EA580C' : '#9333EA'}
                  />
                )}
                <View style={styles.cameraIconBadge}>
                  <MaterialCommunityIcons name="camera" size={12} color="#FFFFFF" />
                </View>
              </Pressable>
              <Pressable onPress={handlePickAvatar} style={{ marginTop: 6 }}>
                <Text style={[typo.labelMedium, { color: colors.primary, fontWeight: '700' }]}>
                  {editPhotoUrl ? 'Đổi ảnh đại diện' : '+ Thêm ảnh đại diện'}
                </Text>
              </Pressable>
            </View>

            {/* Species Selector */}
            <Text style={[typo.labelLarge, { color: colors.text, marginTop: spacing.xs, marginBottom: spacing.xs }]}>
              Loài thú cưng
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: spacing.md }}>
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setEditSpecies('dog');
                }}
                style={[
                  styles.speciesChoiceBtn,
                  {
                    flex: 1,
                    backgroundColor: editSpecies === 'dog' ? '#FFEDD5' : colors.surface,
                    borderColor: editSpecies === 'dog' ? '#EA580C' : colors.border,
                    borderRadius: radius.lg,
                  },
                ]}
              >
                <MaterialCommunityIcons name="dog" size={24} color={editSpecies === 'dog' ? '#EA580C' : colors.textSecondary} />
                <Text style={[typo.labelLarge, { color: editSpecies === 'dog' ? '#EA580C' : colors.text, marginLeft: 8, fontWeight: '700' }]}>
                  Chó
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setEditSpecies('cat');
                }}
                style={[
                  styles.speciesChoiceBtn,
                  {
                    flex: 1,
                    backgroundColor: editSpecies === 'cat' ? '#F3E8FF' : colors.surface,
                    borderColor: editSpecies === 'cat' ? '#9333EA' : colors.border,
                    borderRadius: radius.lg,
                  },
                ]}
              >
                <MaterialCommunityIcons name="cat" size={24} color={editSpecies === 'cat' ? '#9333EA' : colors.textSecondary} />
                <Text style={[typo.labelLarge, { color: editSpecies === 'cat' ? '#9333EA' : colors.text, marginLeft: 8, fontWeight: '700' }]}>
                  Mèo
                </Text>
              </Pressable>
            </View>

            {/* Name Input */}
            <Text style={[typo.labelLarge, { color: colors.text, marginBottom: spacing.xs }]}>
              Tên thú cưng *
            </Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Ví dụ: Milo, Lu, Bông..."
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                  borderRadius: radius.md,
                },
              ]}
            />

            {/* Breed Input */}
            <Text style={[typo.labelLarge, { color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs }]}>
              Giống loài
            </Text>
            <TextInput
              value={editBreed}
              onChangeText={setEditBreed}
              placeholder="Ví dụ: Golden Retriever, Mèo Anh Lông Ngắn..."
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                  borderRadius: radius.md,
                },
              ]}
            />

            {/* Weight Input */}
            <Text style={[typo.labelLarge, { color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs }]}>
              Cân nặng (kg) *
            </Text>
            <TextInput
              value={editWeight}
              onChangeText={setEditWeight}
              keyboardType="decimal-pad"
              placeholder="Ví dụ: 4.5"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                  borderRadius: radius.md,
                },
              ]}
            />

            {/* Birth Date Input */}
            <Text style={[typo.labelLarge, { color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs }]}>
              Ngày sinh (Năm-Tháng-Ngày: YYYY-MM-DD)
            </Text>
            <TextInput
              value={editBirthDate}
              onChangeText={setEditBirthDate}
              placeholder="Ví dụ: 2023-05-15"
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                  borderRadius: radius.md,
                },
              ]}
            />

            {/* Gender Row */}
            <Text style={[typo.labelLarge, { color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs }]}>
              Giới tính
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setEditSex('male')}
                style={[
                  styles.optionPill,
                  {
                    flex: 1,
                    backgroundColor: editSex === 'male' ? '#E0F2FE' : colors.surface,
                    borderColor: editSex === 'male' ? '#0284C7' : colors.border,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <MaterialCommunityIcons name="gender-male" size={18} color={editSex === 'male' ? '#0284C7' : colors.textSecondary} />
                <Text style={[typo.labelMedium, { color: editSex === 'male' ? '#0284C7' : colors.text, marginLeft: 4 }]}>Đực</Text>
              </Pressable>

              <Pressable
                onPress={() => setEditSex('female')}
                style={[
                  styles.optionPill,
                  {
                    flex: 1,
                    backgroundColor: editSex === 'female' ? '#FCE7F3' : colors.surface,
                    borderColor: editSex === 'female' ? '#DB2777' : colors.border,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <MaterialCommunityIcons name="gender-female" size={18} color={editSex === 'female' ? '#DB2777' : colors.textSecondary} />
                <Text style={[typo.labelMedium, { color: editSex === 'female' ? '#DB2777' : colors.text, marginLeft: 4 }]}>Cái</Text>
              </Pressable>
            </View>

            {/* Neutered Status */}
            <Text style={[typo.labelLarge, { color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs }]}>
              Tình trạng triệt sản
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setEditNeutered(true)}
                style={[
                  styles.optionPill,
                  {
                    flex: 1,
                    backgroundColor: editNeutered ? '#DCFCE7' : colors.surface,
                    borderColor: editNeutered ? '#16A34A' : colors.border,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <MaterialCommunityIcons name="check-circle-outline" size={18} color={editNeutered ? '#16A34A' : colors.textSecondary} />
                <Text style={[typo.labelMedium, { color: editNeutered ? '#16A34A' : colors.text, marginLeft: 4 }]}>Đã triệt sản</Text>
              </Pressable>

              <Pressable
                onPress={() => setEditNeutered(false)}
                style={[
                  styles.optionPill,
                  {
                    flex: 1,
                    backgroundColor: !editNeutered ? '#FEF3C7' : colors.surface,
                    borderColor: !editNeutered ? '#D97706' : colors.border,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <MaterialCommunityIcons name="close-circle-outline" size={18} color={!editNeutered ? '#D97706' : colors.textSecondary} />
                <Text style={[typo.labelMedium, { color: !editNeutered ? '#D97706' : colors.text, marginLeft: 4 }]}>Chưa triệt sản</Text>
              </Pressable>
            </View>

            {/* Activity Level */}
            <Text style={[typo.labelLarge, { color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs }]}>
              Mức độ vận động
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['low', 'moderate', 'high'] as const).map((lvl) => (
                <Pressable
                  key={lvl}
                  onPress={() => setEditActivity(lvl)}
                  style={[
                    styles.optionPill,
                    {
                      flex: 1,
                      backgroundColor: editActivity === lvl ? colors.primary + '18' : colors.surface,
                      borderColor: editActivity === lvl ? colors.primary : colors.border,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typo.labelSmall,
                      {
                        color: editActivity === lvl ? colors.primary : colors.text,
                        fontWeight: editActivity === lvl ? '700' : '500',
                      },
                    ]}
                  >
                    {lvl === 'low' ? 'Thấp' : lvl === 'moderate' ? 'Trung bình' : 'Năng động'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Notes Input */}
            <Text style={[typo.labelLarge, { color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs }]}>
              Ghi chú sức khỏe & Dị ứng
            </Text>
            <TextInput
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              numberOfLines={3}
              placeholder="Dị ứng thức ăn, bệnh mãn tính hoặc thói quen của bé..."
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                  borderRadius: radius.md,
                },
              ]}
            />

            <View style={{ marginTop: spacing.xl }}>
              <PrimaryButton
                title="Lưu thay đổi hồ sơ"
                onPress={handleSaveEdit}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Pet Modal */}
      <AddPetModal
        visible={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          setIsAddModalOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  petTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  heroCard: {
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroAvatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  heroAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 41,
  },
  cameraIconBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 41,
  },
  avatarSpeciesBadge: {
    position: 'absolute',
    bottom: -4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  avatarSpeciesText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  genderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 0.5,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricBox: {
    width: '48.5%',
    padding: 12,
    borderWidth: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featureCard: {
    borderWidth: 1,
  },
  featureHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  nutritionBoxRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
  },
  nutritionBoxItem: {
    flex: 1,
    alignItems: 'center',
  },
  dividerV: {
    width: 1,
    height: 28,
  },
  notesBox: {
    padding: 12,
    borderWidth: 1,
  },
  scannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scannerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeModalBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  speciesChoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1.5,
  },
  input: {
    height: 46,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
  },
});
