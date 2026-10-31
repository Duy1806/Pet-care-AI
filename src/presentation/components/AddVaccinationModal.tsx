/**
 * PawCare AI — Add Vaccination Modal
 *
 * Allows pet owners to record a vaccination, deworming, or flea/tick treatment
 * and schedule the next due date for automatic reminders.
 */
import React, { useState } from 'react';
import {
  Modal,
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
import type { VaccinationType } from '@/domain/entities/Vaccination';

interface AddVaccinationModalProps {
  visible: boolean;
  onClose: () => void;
  pets: Pet[];
  selectedPetId?: string;
}

const TYPE_OPTIONS: { type: VaccinationType; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { type: 'vaccine', label: 'Vắc-xin', icon: 'needle' },
  { type: 'deworming', label: 'Tẩy giun', icon: 'pill' },
  { type: 'flea_tick', label: 'Ve rận', icon: 'shield-bug-outline' },
];

const SUGGESTED_NAMES: Record<VaccinationType, string[]> = {
  vaccine: [
    'Phòng bệnh dại (Rabies)',
    'Vắc-xin 7 bệnh (Chó)',
    'Vắc-xin 4 bệnh FVRCP (Mèo)',
    'Phòng ho cũi chó (Bordetella)',
  ],
  deworming: [
    'Tẩy giun định kỳ (Drontal / Sanpet)',
    'Tẩy giun sán tổng hợp',
  ],
  flea_tick: [
    'Viên nhai NexGard / Bravecto',
    'Nhỏ gáy Revolution / Frontline',
    'Xịt trị ve rận Hantox',
  ],
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

export function AddVaccinationModal({
  visible,
  onClose,
  pets,
  selectedPetId,
}: AddVaccinationModalProps) {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const { addVaccination, isLoading, error } = useVaccinationStore();

  const [activePetId, setActivePetId] = useState<string>(
    selectedPetId || (pets[0]?.id ?? '')
  );
  const [type, setType] = useState<VaccinationType>('vaccine');
  const [name, setName] = useState<string>('');
  const [administeredAt, setAdministeredAt] = useState<string>(getTodayString());
  const [nextDueAt, setNextDueAt] = useState<string>(getDefaultNextDue('vaccine'));
  const [vetClinic, setVetClinic] = useState<string>('');
  const [note, setNote] = useState<string>('');

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
    if (!activePetId) {
      return;
    }
    if (!name.trim()) {
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const success = await addVaccination({
      petId: activePetId,
      type,
      name: name.trim(),
      administeredAt: administeredAt.trim() || getTodayString(),
      nextDueAt: nextDueAt.trim() || null,
      vetClinic: vetClinic.trim() || null,
      note: note.trim() || null,
    });

    if (success) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setName('');
      setVetClinic('');
      setNote('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: colors.surface, borderRadius: radius.xxl }]}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[typo.headlineMedium, { color: colors.text }]}>
                Thêm mũi tiêm / phòng bệnh
              </Text>
              <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                Lưu vào sổ sức khỏe & tự động nhắc lịch
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.errorContainer, borderRadius: radius.md }]}>
                <Text style={[typo.bodySmall, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

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
                Phân loại
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
                Tên vắc-xin / thuốc <Text style={{ color: colors.primary }}>*</Text>
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nhập tên vắc-xin hoặc thuốc..."
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

              {/* Suggestions Chips */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {SUGGESTED_NAMES[type].map((sug, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => handleSelectSuggestion(sug)}
                    style={[
                      styles.sugChip,
                      { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: radius.full },
                    ]}
                  >
                    <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>+ {sug}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Dates: Administered & Next Due */}
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

            {/* Clinic Name */}
            <View style={{ marginBottom: spacing.md }}>
              <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 4 }]}>
                Phòng khám thú y / Bác sĩ (tùy chọn)
              </Text>
              <TextInput
                value={vetClinic}
                onChangeText={setVetClinic}
                placeholder="VD: Bệnh viện thú y PetCare, Bác sĩ Nam..."
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

            {/* Notes */}
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 4 }]}>
                Ghi chú (Số lô, biểu hiện sau tiêm...)
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="VD: Bé khỏe mạnh, không sốt, hẹn tái khám sau 1 năm..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={2}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    color: colors.text,
                    borderRadius: radius.md,
                    minHeight: 60,
                    textAlignVertical: 'top',
                  },
                ]}
              />
            </View>

            {/* Actions */}
            <PrimaryButton
              title="Lưu mũi tiêm vào sổ sức khỏe"
              onPress={handleSubmit}
              loading={isLoading}
              disabled={!name.trim()}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    maxHeight: '90%',
    padding: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    padding: 4,
  },
  errorBox: {
    padding: 10,
    marginBottom: 12,
  },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderWidth: 1,
  },
  input: {
    height: 46,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  sugChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
});
