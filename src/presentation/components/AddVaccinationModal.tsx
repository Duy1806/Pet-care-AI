/**
 * PawCare AI — Add Vaccination Modal (Thêm mũi tiêm & Lên lịch nhắc hẹn)
 *
 * Supports:
 * - Administered record (Đã tiêm) with next booster due date
 * - Planned record (Chưa tiêm / Kế hoạch) with scheduled date
 * - Species-specific vaccine suggestions (Chó vs Mèo)
 * - Automatic 2-step push notifications (1 day before + on due date)
 * - Proper KeyboardAvoidingView and state synchronization on open
 */
import React, { useState } from 'react';
import {
  Alert,
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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '@/presentation/theme';
import { PrimaryButton } from '@/presentation/components/PrimaryButton';
import { useVaccinationStore } from '@/presentation/stores/useVaccinationStore';
import type { Pet } from '@/domain/entities/Pet';
import type { VaccinationStatus, VaccinationType } from '@/domain/entities/Vaccination';

interface AddVaccinationModalProps {
  visible: boolean;
  onClose: () => void;
  pets: Pet[];
  selectedPetId?: string;
  defaultStatus?: VaccinationStatus;
}

const TYPE_OPTIONS: { type: VaccinationType; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { type: 'vaccine', label: 'Vắc-xin', icon: 'needle' },
  { type: 'deworming', label: 'Tẩy giun', icon: 'pill' },
  { type: 'flea_tick', label: 'Ve rận', icon: 'shield-bug-outline' },
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

export function AddVaccinationModal({
  visible,
  onClose,
  pets,
  selectedPetId,
  defaultStatus = 'completed',
}: AddVaccinationModalProps) {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const { addVaccination, loadAlerts, isLoading, error, clearError } = useVaccinationStore();

  const [status, setStatus] = useState<VaccinationStatus>(defaultStatus);
  const [activePetId, setActivePetId] = useState<string>(
    selectedPetId || (pets[0]?.id ?? '')
  );
  const [type, setType] = useState<VaccinationType>('vaccine');
  const [name, setName] = useState<string>('');
  const [doseNumber, setDoseNumber] = useState<number | null>(1);
  const [administeredAt, setAdministeredAt] = useState<string>(getTodayString());
  const [nextDueAt, setNextDueAt] = useState<string>(getDefaultNextDue('vaccine'));
  const [scheduledDate, setScheduledDate] = useState<string>(getNextWeekString());
  const [vetClinic, setVetClinic] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const currentPet = pets.find((p) => p.id === activePetId) || pets[0];
  const petSpeciesKey = currentPet?.species === 'cat' ? 'cat' : 'dog';
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

  const handleClose = () => {
    clearError();
    setName('');
    setVetClinic('');
    setNote('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!activePetId) {
      Alert.alert(
        'Chưa chọn thú cưng',
        'Vui lòng chọn hoặc thêm thú cưng trong ứng dụng trước khi ghi sổ tiêm chủng.'
      );
      return;
    }

    if (!name.trim()) {
      Alert.alert(
        'Thiếu tên thuốc / vắc-xin',
        'Vui lòng nhập hoặc chọn tên vắc-xin hoặc thuốc cần tiêm.'
      );
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const isCompleted = status === 'completed';

    const success = await addVaccination(
      {
        petId: activePetId,
        type,
        name: name.trim(),
        status,
        doseNumber: doseNumber || null,
        administeredAt: isCompleted ? administeredAt.trim() || getTodayString() : scheduledDate.trim(),
        nextDueAt: isCompleted ? (nextDueAt.trim() || null) : scheduledDate.trim(),
        vetClinic: vetClinic.trim() || null,
        note: note.trim() || null,
      },
      currentPet?.name
    );

    if (success) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void loadAlerts(pets);
      handleClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={[styles.content, { backgroundColor: colors.surface, borderRadius: radius.xxl }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={[typo.headlineMedium, { color: colors.text }]}>
                {status === 'completed' ? 'Ghi nhận mũi đã tiêm' : 'Lên lịch hẹn tiêm chủng'}
              </Text>
              <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                {status === 'completed'
                  ? 'Lưu lịch sử & tự động nhắc mũi tái chủng tiếp theo'
                  : 'Hệ thống tự động nhắc trước 1 ngày và đúng ngày hẹn'}
              </Text>
            </View>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: spacing.lg }}
          >
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.errorContainer, borderRadius: radius.md }]}>
                <Text style={[typo.bodySmall, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            {/* Segmented Switch: ĐÃ TIÊM vs CHƯA TIÊM / LÊN LỊCH */}
            <View style={[styles.statusSwitcher, { backgroundColor: colors.surfaceElevated, borderRadius: radius.lg }]}>
              <Pressable
                onPress={() => handleStatusChange('completed')}
                style={[
                  styles.statusTab,
                  status === 'completed' && {
                    backgroundColor: colors.primary,
                    borderRadius: radius.md,
                    shadowColor: colors.primary,
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="check-circle"
                  size={18}
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
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="calendar-clock"
                  size={18}
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

            {/* Select Pet */}
            {pets.length > 1 && (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={[typo.labelLarge, { color: colors.text, marginBottom: spacing.xs }]}>
                  Chọn thú cưng
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {pets.map((p) => {
                    const isSelected = p.id === activePetId;
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => {
                          void Haptics.selectionAsync();
                          setActivePetId(p.id);
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
                          size={16}
                          color={isSelected ? colors.primary : colors.textSecondary}
                        />
                        <Text
                          style={[
                            typo.labelMedium,
                            {
                              color: isSelected ? colors.primary : colors.text,
                              fontWeight: isSelected ? '700' : '500',
                              marginLeft: 4,
                            },
                          ]}
                        >
                          {p.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Select Type (Vaccine / Deworming / Flea & Tick) */}
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
                        size={20}
                        color={isSelected ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          typo.labelMedium,
                          {
                            color: isSelected ? colors.primary : colors.text,
                            fontWeight: isSelected ? '700' : '500',
                            marginTop: 4,
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

            {/* Name Input & Quick Suggestions */}
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
                Gợi ý cho {petSpeciesKey === 'cat' ? 'mèo' : 'chó'}:
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

            {/* Dose Number Selector */}
            <View style={{ marginBottom: spacing.md }}>
              <Text style={[typo.labelLarge, { color: colors.text, marginBottom: spacing.xs }]}>
                Mũi tiêm / Lần uống
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
                <MaterialCommunityIcons name="bell-ring-outline" size={20} color={colors.primary} />
                <Text style={[typo.titleSmall, { color: colors.primary, fontWeight: '700', marginLeft: 6 }]}>
                  Tự động nhắc lịch 2 lần thông minh
                </Text>
              </View>
              <Text style={[typo.bodySmall, { color: colors.text, marginTop: 4, lineHeight: 18 }]}>
                Khi đến ngày hẹn ({status === 'completed' ? nextDueAt || 'chưa đặt' : scheduledDate}), hệ thống sẽ gửi thông báo đẩy:
              </Text>
              <View style={{ marginTop: 4, gap: 2 }}>
                <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>
                  • <Text style={{ fontWeight: '700', color: colors.text }}>Lần 1:</Text> Trước 1 ngày (lúc 09:00 sáng) để bạn chuẩn bị.
                </Text>
                <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>
                  • <Text style={{ fontWeight: '700', color: colors.text }}>Lần 2:</Text> Đúng ngày hôm đó (lúc 08:00 sáng) nhắc đưa bé đi tiêm.
                </Text>
              </View>
            </View>

            {/* Clinic / Hospital */}
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

            {/* Note */}
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[typo.labelLarge, { color: colors.text, marginBottom: spacing.xs }]}>
                Ghi chú thêm (Tùy chọn)
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Số lô vắc-xin, phản ứng sau tiêm, dặn dò của bác sĩ..."
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

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <Pressable
                onPress={handleClose}
                style={[styles.cancelBtn, { borderColor: colors.border, borderRadius: radius.md }]}
              >
                <Text style={[typo.labelLarge, { color: colors.textSecondary }]}>Hủy</Text>
              </Pressable>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <PrimaryButton
                  title={isLoading ? 'Đang lưu...' : status === 'completed' ? 'Lưu sổ tiêm chủng' : 'Tạo lịch hẹn tiêm'}
                  onPress={handleSubmit}
                  loading={isLoading}
                  disabled={isLoading || !name.trim()}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  content: {
    maxHeight: '92%',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  closeBtn: {
    padding: 4,
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
    paddingVertical: 10,
  },
  errorBox: {
    padding: 10,
    marginBottom: 12,
  },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
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
    paddingVertical: 10,
    borderWidth: 1,
  },
  input: {
    height: 46,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    height: 70,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  sugChip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  doseChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderWidth: 1,
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  reminderNoticeBox: {
    padding: 12,
    borderWidth: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
