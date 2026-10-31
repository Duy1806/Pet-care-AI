/**
 * PawCare AI — Dedicated Add / Schedule Vaccination Screen (Trang thêm mũi tiêm & Lên lịch hẹn)
 *
 * Full-page navigation screen with:
 * - Administered record (Đã tiêm) with next booster due date
 * - Planned record (Chưa tiêm / Kế hoạch) with scheduled date
 * - Species-specific vaccine suggestions (Chó vs Mèo)
 * - Automatic 2-step push notifications (1 day before + on due date)
 * - Complete keyboard handling & smooth submission
 */
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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

import { useAppTheme } from '@/presentation/theme';
import { PrimaryButton } from '@/presentation/components/PrimaryButton';
import { usePetStore } from '@/presentation/stores/usePetStore';
import { useVaccinationStore } from '@/presentation/stores/useVaccinationStore';
import type { VaccinationStatus, VaccinationType } from '@/domain/entities/Vaccination';

const TYPE_OPTIONS: { type: VaccinationType; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { type: 'vaccine', label: 'Vắc-xin', icon: 'needle' },
  { type: 'deworming', label: 'Tẩy giun', icon: 'pill' },
  { type: 'flea_tick', label: 'Ve rận & Giun tim', icon: 'shield-bug-outline' },
];

const SUGGESTIONS_BY_SPECIES: Record<'dog' | 'cat', Record<VaccinationType, string[]>> = {
  dog: {
    vaccine: [
      'Vắc-xin 7 bệnh Vanguard Plus (Care, Parvo, Viêm gan...)',
      'Phòng bệnh Dại (Rabies) định kỳ',
      'Vắc-xin 5 bệnh chó con',
      'Phòng ho cũi chó (Bordetella)',
    ],
    deworming: [
      'Tẩy giun định kỳ Drontal Plus',
      'Thuốc tẩy giun Sanpet',
      'Viên nhai Heartgard Plus (phòng giun tim)',
    ],
    flea_tick: [
      'Viên nhai NexGard Spectra (Ve rận & Giun tim)',
      'Viên nhai Bravecto (bảo vệ 3 tháng)',
      'Nhỏ gáy Frontline Plus',
      'Viên nhai Simparica Trio',
    ],
  },
  cat: {
    vaccine: [
      'Vắc-xin 4 bệnh Purevax FVRCP (Giảm bạch cầu, Viêm mũi, Calici, Chlamydia)',
      'Phòng bệnh Dại (Rabies) định kỳ',
      'Vắc-xin 3 bệnh Felocell cho mèo',
    ],
    deworming: [
      'Tẩy giun Drontal Cat',
      'Viên tẩy giun Milbemax cho mèo',
      'Broadline trị giun sán tổng hợp',
    ],
    flea_tick: [
      'Nhỏ gáy Revolution Plus (Ve rận, Ghẻ tai, Giun tim)',
      'Nhỏ gáy Bravecto Plus cho mèo',
      'Nhỏ gáy Frontline Plus Cat',
    ],
  },
};

function getTodayString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function getDefaultNextDue(type: VaccinationType): string {
  const d = new Date();
  if (type === 'vaccine') {
    d.setFullYear(d.getFullYear() + 1); // 1 năm tiêm nhắc lại
  } else if (type === 'deworming') {
    d.setMonth(d.getMonth() + 3); // 3 tháng tẩy giun
  } else {
    d.setMonth(d.getMonth() + 1); // 1 tháng nhỏ gáy
  }
  return d.toISOString().split('T')[0];
}

function getNextWeekString(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

export default function AddVaccinationScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const searchParams = useLocalSearchParams<{ petId?: string; defaultStatus?: string }>();

  const { pets, selectedPet, selectPet, addPet } = usePetStore();
  const { addVaccination, loadAlerts, loadVaccinations, isLoading, error, clearError } = useVaccinationStore();

  const initialStatus: VaccinationStatus = searchParams.defaultStatus === 'planned' ? 'planned' : 'completed';
  const initialPetId = searchParams.petId || selectedPet?.id || pets[0]?.id || '';

  const [status, setStatus] = useState<VaccinationStatus>(initialStatus);
  const [activePetId, setActivePetId] = useState<string>(initialPetId);
  const [newPetName, setNewPetName] = useState<string>('Bé cưng');
  const [newPetSpecies, setNewPetSpecies] = useState<'dog' | 'cat'>('dog');
  const [type, setType] = useState<VaccinationType>('vaccine');
  const [name, setName] = useState<string>('');
  const [doseNumber, setDoseNumber] = useState<number | null>(1);
  const [administeredAt, setAdministeredAt] = useState<string>(getTodayString());
  const [nextDueAt, setNextDueAt] = useState<string>(getDefaultNextDue('vaccine'));
  const [scheduledDate, setScheduledDate] = useState<string>(getNextWeekString());
  const [vetClinic, setVetClinic] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const currentPet = pets.find((p) => p.id === activePetId) || selectedPet || pets[0];
  const petSpeciesKey = currentPet?.species === 'cat' ? 'cat' : (pets.length === 0 ? newPetSpecies : 'dog');
  const suggestions = SUGGESTIONS_BY_SPECIES[petSpeciesKey]?.[type] || SUGGESTIONS_BY_SPECIES.dog[type];

  const handleStatusChange = (newStatus: VaccinationStatus) => {
    void Haptics.selectionAsync();
    setStatus(newStatus);
  };

  const handleTypeChange = (newType: VaccinationType) => {
    void Haptics.selectionAsync();
    setType(newType);
    setNextDueAt(getDefaultNextDue(newType));
  };

  const handleSelectSuggestion = (sug: string) => {
    void Haptics.selectionAsync();
    setName(sug);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert(
        'Thiếu thông tin',
        'Vui lòng nhập hoặc chọn tên loại vắc-xin / thuốc cần tiêm.'
      );
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let targetPetId = activePetId;
    let targetPetName = currentPet?.name || newPetName;

    if (!targetPetId) {
      if (pets.length > 0) {
        targetPetId = pets[0].id;
        targetPetName = pets[0].name;
      } else {
        try {
          const createdPet = await addPet({
            name: newPetName.trim() || 'Bé cưng',
            species: newPetSpecies,
            sex: 'unknown',
            weightKg: 4.0,
          });
          targetPetId = createdPet.id;
          targetPetName = createdPet.name;
          setActivePetId(createdPet.id);
        } catch {
          Alert.alert('Chưa có thú cưng', 'Vui lòng nhập tên bé cưng để tạo sổ tiêm chủng.');
          return;
        }
      }
    }

    const isCompleted = status === 'completed';

    const success = await addVaccination(
      {
        petId: targetPetId,
        type,
        name: name.trim(),
        status,
        doseNumber: doseNumber || null,
        administeredAt: isCompleted ? administeredAt.trim() || getTodayString() : scheduledDate.trim(),
        nextDueAt: isCompleted ? (nextDueAt.trim() || null) : scheduledDate.trim(),
        vetClinic: vetClinic.trim() || null,
        note: note.trim() || null,
      },
      targetPetName
    );

    if (success) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void loadAlerts(pets);
      if (targetPetId) {
        void loadVaccinations(targetPetId);
      }
      Alert.alert(
        'Thành công',
        isCompleted
          ? `Đã lưu mũi tiêm "${name.trim()}" vào sổ sức khỏe của bé ${targetPetName}!`
          : `Đã lên lịch hẹn tiêm "${name.trim()}" vào ngày ${scheduledDate.trim()} cho bé ${targetPetName}. Hệ thống sẽ gửi thông báo nhắc lịch trước 1 ngày và trong ngày tiêm!`,
        [
          {
            text: 'Xem sổ tiêm',
            onPress: () => router.push('/(app)/vaccinations' as any),
          },
          {
            text: 'Đóng',
            style: 'cancel',
            onPress: () => router.back(),
          },
        ]
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Bar with Back Button */}
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
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => {
              clearError();
              router.back();
            }}
            hitSlop={8}
            style={[styles.backBtn, { borderColor: colors.border }]}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          </Pressable>

          <View style={{ flex: 1, marginLeft: spacing.sm, marginRight: spacing.xs }}>
            <Text style={[typo.headlineMedium, { color: colors.text }]}>
              {status === 'completed' ? 'Ghi nhận mũi đã tiêm' : 'Lên lịch hẹn tiêm phòng'}
            </Text>
            <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
              {status === 'completed'
                ? 'Lưu lịch sử & tự động nhắc tái chủng tiếp theo'
                : 'Tự động gửi thông báo nhắc trước 1 ngày & trong ngày'}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(app)/vaccinations' as any);
            }}
            style={[
              styles.listTopBtn,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                borderRadius: radius.full,
              },
            ]}
          >
            <MaterialCommunityIcons name="clipboard-list-outline" size={16} color={colors.primary} />
            <Text style={[typo.labelSmall, { color: colors.primary, marginLeft: 3, fontWeight: '700' }]}>
              Xem sổ
            </Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: spacing.lg,
            paddingBottom: insets.bottom + spacing.xxl,
          }}
        >
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.errorContainer, borderRadius: radius.md }]}>
              <Text style={[typo.bodySmall, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          {/* STATUS SWITCHER: ĐÃ TIÊM vs CHƯA TIÊM / LÊN LỊCH */}
          <View style={[styles.statusSwitcher, { backgroundColor: colors.surfaceElevated, borderRadius: radius.lg }]}>
            <Pressable
              onPress={() => handleStatusChange('completed')}
              style={[
                styles.statusTab,
                status === 'completed' && {
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  shadowColor: colors.primary,
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color={status === 'completed' ? colors.onPrimary : colors.textSecondary}
              />
              <Text
                style={[
                  typo.labelLarge,
                  {
                    color: status === 'completed' ? colors.onPrimary : colors.textSecondary,
                    fontWeight: '700',
                    marginLeft: 6,
                  },
                ]}
              >
                Đã tiêm phòng
              </Text>
            </Pressable>

            <Pressable
              onPress={() => handleStatusChange('planned')}
              style={[
                styles.statusTab,
                status === 'planned' && {
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  shadowColor: colors.primary,
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="calendar-clock"
                size={20}
                color={status === 'planned' ? colors.onPrimary : colors.textSecondary}
              />
              <Text
                style={[
                  typo.labelLarge,
                  {
                    color: status === 'planned' ? colors.onPrimary : colors.textSecondary,
                    fontWeight: '700',
                    marginLeft: 6,
                  },
                ]}
              >
                Chưa tiêm / Hẹn lịch
              </Text>
            </Pressable>
          </View>

          {/* SELECT PET */}
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[typo.labelLarge, { color: colors.text, marginBottom: spacing.xs }]}>
              Thú cưng áp dụng <Text style={{ color: colors.primary }}>*</Text>
            </Text>
            {pets.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {pets.map((p) => {
                  const isSelected = p.id === activePetId;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setActivePetId(p.id);
                        selectPet(p);
                      }}
                      style={[
                        styles.petChip,
                        {
                          backgroundColor: isSelected ? colors.primaryContainer : colors.surfaceElevated,
                          borderColor: isSelected ? colors.primary : colors.border,
                          borderRadius: radius.full,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={p.species === 'dog' ? 'dog' : 'cat'}
                        size={18}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          typo.labelMedium,
                          {
                            color: isSelected ? colors.primary : colors.text,
                            fontWeight: isSelected ? '700' : '500',
                            marginLeft: 6,
                          },
                        ]}
                      >
                        {p.name} ({p.species === 'cat' ? 'Mèo' : 'Chó'})
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={{ gap: 8 }}>
                <TextInput
                  value={newPetName}
                  onChangeText={setNewPetName}
                  placeholder="Nhập tên bé cưng của bạn..."
                  placeholderTextColor={colors.textTertiary}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      color: colors.text,
                      borderRadius: radius.md,
                    },
                  ]}
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={() => setNewPetSpecies('dog')}
                    style={[
                      styles.sugChip,
                      {
                        backgroundColor: newPetSpecies === 'dog' ? colors.primaryContainer : colors.surfaceElevated,
                        borderColor: newPetSpecies === 'dog' ? colors.primary : colors.border,
                        borderRadius: radius.full,
                      },
                    ]}
                  >
                    <Text style={[typo.labelSmall, { color: newPetSpecies === 'dog' ? colors.primary : colors.text, fontWeight: '700' }]}>
                      🐕 Thú cưng là Chó
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setNewPetSpecies('cat')}
                    style={[
                      styles.sugChip,
                      {
                        backgroundColor: newPetSpecies === 'cat' ? colors.primaryContainer : colors.surfaceElevated,
                        borderColor: newPetSpecies === 'cat' ? colors.primary : colors.border,
                        borderRadius: radius.full,
                      },
                    ]}
                  >
                    <Text style={[typo.labelSmall, { color: newPetSpecies === 'cat' ? colors.primary : colors.text, fontWeight: '700' }]}>
                      🐈 Thú cưng là Mèo
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* SELECT CATEGORY */}
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[typo.labelLarge, { color: colors.text, marginBottom: spacing.xs }]}>
              Phân loại phòng bệnh
            </Text>
            <View style={styles.typeRow}>
              {TYPE_OPTIONS.map((opt) => {
                const isSelected = type === opt.type;
                return (
                  <Pressable
                    key={opt.type}
                    onPress={() => handleTypeChange(opt.type)}
                    style={[
                      styles.typeButton,
                      {
                        backgroundColor: isSelected ? colors.primaryContainer : colors.surfaceElevated,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: radius.lg,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={opt.icon}
                      size={22}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        typo.labelMedium,
                        {
                          color: isSelected ? colors.primary : colors.text,
                          fontWeight: isSelected ? '700' : '500',
                          marginTop: 4,
                          textAlign: 'center',
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* VACCINE NAME & QUICK SUGGESTIONS */}
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[typo.labelLarge, { color: colors.text, marginBottom: spacing.xs }]}>
              Tên loại thuốc / vắc-xin <Text style={{ color: colors.primary }}>*</Text>
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={
                type === 'vaccine'
                  ? 'Ví dụ: Vắc-xin 7 bệnh Vanguard Plus...'
                  : type === 'deworming'
                  ? 'Ví dụ: Thuốc tẩy giun Drontal...'
                  : 'Ví dụ: Viên nhai NexGard Spectra...'
              }
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  color: colors.text,
                  borderRadius: radius.md,
                },
              ]}
            />

            {/* Suggestions Chips according to dog/cat */}
            <Text style={[typo.labelSmall, { color: colors.textSecondary, marginTop: 8, marginBottom: 4 }]}>
              Gợi ý cho {petSpeciesKey === 'cat' ? 'mèo' : 'chó'} ({currentPet?.name || 'thú cưng'}):
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {suggestions.map((sug, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => handleSelectSuggestion(sug)}
                  style={[
                    styles.sugChip,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: name === sug ? colors.primary : colors.border,
                      borderRadius: radius.full,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typo.labelSmall,
                      { color: name === sug ? colors.primary : colors.textSecondary, fontWeight: name === sug ? '700' : '400' },
                    ]}
                  >
                    + {sug}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* DOSE NUMBER SELECTOR */}
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[typo.labelLarge, { color: colors.text, marginBottom: spacing.xs }]}>
              Mũi tiêm / Lần dùng
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { dose: 1, label: 'Mũi 1' },
                { dose: 2, label: 'Mũi 2' },
                { dose: 3, label: 'Mũi 3' },
                { dose: 4, label: 'Nhắc lại hàng năm' },
              ].map((item) => {
                const isSel = doseNumber === item.dose;
                return (
                  <Pressable
                    key={item.dose}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setDoseNumber(item.dose);
                    }}
                    style={[
                      styles.doseChip,
                      {
                        backgroundColor: isSel ? colors.primaryContainer : colors.surfaceElevated,
                        borderColor: isSel ? colors.primary : colors.border,
                        borderRadius: radius.md,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typo.labelSmall,
                        { color: isSel ? colors.primary : colors.textSecondary, fontWeight: isSel ? '700' : '500' },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* DATES SECTION BASED ON STATUS */}
          {status === 'completed' ? (
            <View style={styles.dateRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 4 }]}>
                  Ngày đã tiêm
                </Text>
                <TextInput
                  value={administeredAt}
                  onChangeText={setAdministeredAt}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      color: colors.text,
                      borderRadius: radius.md,
                    },
                  ]}
                />
              </View>

              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 4 }]}>
                  Hẹn tiêm tiếp (Nhắc lịch)
                </Text>
                <TextInput
                  value={nextDueAt}
                  onChangeText={setNextDueAt}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textTertiary}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      color: colors.text,
                      borderRadius: radius.md,
                    },
                  ]}
                />
              </View>
            </View>
          ) : (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 4 }]}>
                Ngày dự kiến đưa bé đi tiêm (Hẹn lịch) <Text style={{ color: colors.primary }}>*</Text>
              </Text>
              <TextInput
                value={scheduledDate}
                onChangeText={setScheduledDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    color: colors.text,
                    borderRadius: radius.md,
                  },
                ]}
              />
            </View>
          )}

          {/* SMART NOTIFICATION INFO BOX */}
          <View
            style={[
              styles.reminderNoticeBox,
              {
                backgroundColor: colors.primaryContainer,
                borderColor: colors.primary,
                borderRadius: radius.lg,
                marginBottom: spacing.md,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="bell-ring-outline" size={22} color={colors.primary} />
              <Text style={[typo.titleSmall, { color: colors.primary, fontWeight: '700', marginLeft: 6 }]}>
                Tự động gửi thông báo nhắc nhở 2 lần
              </Text>
            </View>
            <Text style={[typo.bodySmall, { color: colors.text, marginTop: 4, lineHeight: 18 }]}>
              Khi đến ngày hẹn ({status === 'completed' ? nextDueAt || 'chưa đặt' : scheduledDate}), hệ thống tự động đẩy thông báo trên điện thoại:
            </Text>
            <View style={{ marginTop: 6, gap: 4 }}>
              <Text style={[typo.bodySmall, { color: colors.text }]}>
                🔔 <Text style={{ fontWeight: '700' }}>Lần 1 — Trước 1 ngày (lúc 09:00 sáng):</Text> Nhắc bạn chuẩn bị sổ sức khỏe và sắp xếp lịch.
              </Text>
              <Text style={[typo.bodySmall, { color: colors.text }]}>
                🚨 <Text style={{ fontWeight: '700' }}>Lần 2 — Đúng ngày tiêm (lúc 08:00 sáng):</Text> Nhắc bạn đưa bé cưng đến phòng khám thú y.
              </Text>
            </View>
          </View>

          {/* CLINIC / HOSPITAL */}
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[typo.labelLarge, { color: colors.text, marginBottom: spacing.xs }]}>
              Phòng khám / Cơ sở thú y (Tùy chọn)
            </Text>
            <TextInput
              value={vetClinic}
              onChangeText={setVetClinic}
              placeholder="Ví dụ: Bệnh viện Thú y Samyang, PetCare Clinic..."
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  color: colors.text,
                  borderRadius: radius.md,
                },
              ]}
            />
          </View>

          {/* NOTE */}
          <View style={{ marginBottom: spacing.xl }}>
            <Text style={[typo.labelLarge, { color: colors.text, marginBottom: spacing.xs }]}>
              Ghi chú thêm (Tùy chọn)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Số lô vắc-xin, phản ứng sau tiêm, dặn dò kiêng khem của bác sĩ..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                  color: colors.text,
                  borderRadius: radius.md,
                },
              ]}
            />
          </View>

          {/* SUBMIT BUTTON */}
          <PrimaryButton
            title={isLoading ? 'Đang lưu vào hệ thống...' : status === 'completed' ? 'Lưu vào sổ tiêm chủng' : 'Xác nhận tạo lịch hẹn tiêm'}
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading || !name.trim()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusSwitcher: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 16,
  },
  statusTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  errorBox: {
    padding: 10,
    marginBottom: 12,
  },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderWidth: 1,
  },
  input: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  sugChip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  doseChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  reminderNoticeBox: {
    padding: 14,
    borderWidth: 1,
  },
  listTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
});

