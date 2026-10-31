/**
 * PawCare AI — Add Care Schedule Modal Component
 *
 * Allows owners to create custom care tasks with time, category,
 * and quick-fill suggestions tailored to Dogs & Cats.
 */
import React, { useMemo, useState } from 'react';
import {
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
import { PrimaryButton } from './PrimaryButton';
import { useCareScheduleStore } from '@/presentation/stores/useCareScheduleStore';
import { CARE_SUGGESTIONS, type CareCategory, type CareSuggestion } from '@/domain/entities/CareReminder';
import type { Pet } from '@/domain/entities/Pet';

interface AddCareScheduleModalProps {
  visible: boolean;
  pet: Pet | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const CATEGORIES: { key: CareCategory; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string }[] = [
  { key: 'feeding', label: 'Ăn uống', icon: 'food-drumstick', color: '#EA580C' },
  { key: 'medication', label: 'Thuốc / Men', icon: 'pill', color: '#8B5CF6' },
  { key: 'exercise', label: 'Vận động', icon: 'run-fast', color: '#16A34A' },
  { key: 'grooming', label: 'Chải lông', icon: 'brush', color: '#DB2777' },
  { key: 'water', label: 'Uống nước', icon: 'water-pump', color: '#0284C7' },
  { key: 'hygiene', label: 'Vệ sinh', icon: 'shower-head', color: '#059669' },
  { key: 'other', label: 'Khác', icon: 'clock-check-outline', color: '#64748B' },
];

const POPULAR_TIMES = ['07:00', '07:30', '08:00', '12:00', '17:30', '18:30', '19:30', '21:00'];

export function AddCareScheduleModal({ visible, pet, onClose, onSuccess }: AddCareScheduleModalProps) {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const { addReminder } = useCareScheduleStore();

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('07:30');
  const [category, setCategory] = useState<CareCategory>('feeding');
  const [selectedIcon, setSelectedIcon] = useState('food-drumstick');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Suggestions filtered by pet's species
  const relevantSuggestions = useMemo(() => {
    const s = pet?.species || 'all';
    return CARE_SUGGESTIONS.filter((item) => item.species === s || item.species === 'all');
  }, [pet?.species]);

  const handleSelectSuggestion = (suggestion: CareSuggestion) => {
    void Haptics.selectionAsync();
    setTitle(suggestion.title);
    setTime(suggestion.time);
    setCategory(suggestion.category);
    setSelectedIcon(suggestion.icon);
    setErrorMsg(null);
  };

  const handleCategoryChange = (catKey: CareCategory, iconName: string) => {
    void Haptics.selectionAsync();
    setCategory(catKey);
    setSelectedIcon(iconName);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setErrorMsg('Vui lòng nhập tên hoạt động chăm sóc.');
      return;
    }
    if (!time.trim() || !/^\d{1,2}:\d{2}$/.test(time.trim())) {
      setErrorMsg('Vui lòng nhập giờ hợp lệ (định dạng HH:mm, ví dụ 08:30).');
      return;
    }
    if (!pet?.id) {
      setErrorMsg('Vui lòng chọn thú cưng trước khi lên lịch.');
      return;
    }

    setErrorMsg(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await addReminder({
        petId: pet.id,
        title: title.trim(),
        time: time.trim(),
        category,
        icon: selectedIcon,
      });

      // Reset
      setTitle('');
      setTime('07:30');
      setCategory('feeding');
      setSelectedIcon('food-drumstick');
      onClose();
      onSuccess?.();
    } catch (e: any) {
      setErrorMsg(e?.message || 'Không thể lưu lịch chăm sóc.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              paddingBottom: spacing.md,
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
              borderBottomWidth: 1,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '800' }]}>
              Lên lịch chăm sóc hôm nay
            </Text>
            <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
              {pet ? `Dành riêng cho bé ${pet.name} (${pet.species === 'dog' ? 'Chó' : 'Mèo'})` : 'Chăm sóc thú cưng chu đáo'}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={[styles.closeBtn, { borderColor: colors.border }]}>
            <MaterialCommunityIcons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        >
          {errorMsg && (
            <View style={[styles.errorBox, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderRadius: radius.md }]}>
              <MaterialCommunityIcons name="alert-circle" size={18} color="#DC2626" />
              <Text style={[typo.bodySmall, { color: '#DC2626', marginLeft: 6, flex: 1 }]}>{errorMsg}</Text>
            </View>
          )}

          {/* SECTION: GỢI Ý CHĂM SÓC THEO BÉ */}
          <View style={{ marginBottom: spacing.md }}>
            <View style={styles.sectionTitleRow}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color="#EAB308" />
              <Text style={[typo.labelLarge, { color: colors.text, fontWeight: '700', marginLeft: 6 }]}>
                Gợi ý nhanh theo loài ({pet?.species === 'dog' ? 'Chó' : 'Mèo'})
              </Text>
            </View>
            <Text style={[typo.bodySmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
              Chạm vào một gợi ý bên dưới để tự động điền nhanh:
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {relevantSuggestions.map((sug) => {
                const isSelected = title === sug.title;
                return (
                  <Pressable
                    key={sug.id}
                    onPress={() => handleSelectSuggestion(sug)}
                    style={[
                      styles.suggestionChip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: radius.lg,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={sug.icon as any}
                      size={16}
                      color={isSelected ? colors.onPrimary : colors.primary}
                    />
                    <Text
                      style={[
                        typo.labelMedium,
                        {
                          color: isSelected ? colors.onPrimary : colors.text,
                          fontWeight: isSelected ? '700' : '500',
                          marginLeft: 6,
                        },
                      ]}
                    >
                      {sug.title}
                    </Text>
                    <View
                      style={[
                        styles.timeBadge,
                        {
                          backgroundColor: isSelected ? colors.onPrimary + '20' : colors.surfaceElevated,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          typo.labelSmall,
                          {
                            color: isSelected ? colors.onPrimary : colors.textSecondary,
                            fontWeight: '600',
                          },
                        ]}
                      >
                        {sug.time}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* INPUT 1: TIÊU ĐỀ HOẠT ĐỘNG */}
          <Text style={[typo.labelLarge, { color: colors.text, marginBottom: spacing.xs, marginTop: spacing.xs }]}>
            Tên hoạt động chăm sóc *
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ví dụ: Cho ăn hạt + thịt bò, Uống vitamin, Đi dạo..."
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

          {/* INPUT 2: THỜI GIAN NHẮC HẸN */}
          <Text style={[typo.labelLarge, { color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs }]}>
            Thời gian thực hiện (HH:mm) *
          </Text>
          <TextInput
            value={time}
            onChangeText={setTime}
            placeholder="Ví dụ: 07:30 hoặc 18:00"
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

          {/* Quick time pills */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.xs }}>
            {POPULAR_TIMES.map((pt) => {
              const isSelected = time === pt;
              return (
                <Pressable
                  key={pt}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setTime(pt);
                  }}
                  style={[
                    styles.timePill,
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
                    {pt}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* INPUT 3: PHÂN LOẠI HOẠT ĐỘNG */}
          <Text style={[typo.labelLarge, { color: colors.text, marginTop: spacing.md, marginBottom: spacing.xs }]}>
            Phân loại hoạt động
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => handleCategoryChange(cat.key, cat.icon)}
                  style={[
                    styles.categoryCard,
                    {
                      backgroundColor: isSelected ? cat.color + '15' : colors.surface,
                      borderColor: isSelected ? cat.color : colors.border,
                      borderRadius: radius.lg,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={cat.icon}
                    size={20}
                    color={isSelected ? cat.color : colors.textSecondary}
                  />
                  <Text
                    style={[
                      typo.labelMedium,
                      {
                        color: isSelected ? cat.color : colors.text,
                        fontWeight: isSelected ? '700' : '500',
                        marginTop: 4,
                      },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* SUBMIT BUTTON */}
          <View style={{ marginTop: spacing.xl }}>
            <PrimaryButton
              title={`Lưu vào lịch của bé ${pet?.name || ''}`}
              onPress={handleSubmit}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
  },
  timeBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  input: {
    height: 46,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  timePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  categoryCard: {
    width: '31%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1.5,
  },
});
