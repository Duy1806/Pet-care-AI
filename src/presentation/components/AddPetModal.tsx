/**
 * PawCare AI — Add Pet Modal Component
 *
 * Allows user to create a real pet entry directly in Supabase.
 */
import React, { useState } from 'react';
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
import { usePetStore } from '@/presentation/stores/usePetStore';
import type { Species } from '@/domain/entities/Pet';

interface AddPetModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddPetModal({ visible, onClose, onSuccess }: AddPetModalProps) {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const { addPet, isLoading, error } = usePetStore();

  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('dog');
  const [breedName, setBreedName] = useState('');
  const [weightKg, setWeightKg] = useState('5.0');
  const [sex, setSex] = useState<'male' | 'female'>('male');
  const [isNeutered, setIsNeutered] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setValidationError('Vui lòng nhập tên cho thú cưng.');
      return;
    }
    const weightNum = parseFloat(weightKg);
    if (isNaN(weightNum) || weightNum <= 0) {
      setValidationError('Cân nặng phải là số dương hợp lệ.');
      return;
    }

    setValidationError(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await addPet({
        name: name.trim(),
        species,
        breedName: breedName.trim() || (species === 'dog' ? 'Chó nhà' : 'Mèo nhà'),
        weightKg: weightNum,
        sex,
        isNeutered,
        activityLevel: 'moderate',
      });
      // Reset form
      setName('');
      setBreedName('');
      setWeightKg('5.0');
      onClose();
      onSuccess?.();
    } catch {
      // Error handled by store
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              paddingBottom: spacing.md,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '700' }]}>
                Thêm thú cưng mới
              </Text>
              <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                Dữ liệu sẽ được lưu trực tiếp vào cơ sở dữ liệu
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceElevated }]}
            >
              <MaterialCommunityIcons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingVertical: spacing.sm, paddingBottom: 60 }}
          >
            {/* Error Message */}
            {(validationError || error) && (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: colors.errorContainer, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
                ]}
              >
                <Text style={[typo.bodySmall, { color: colors.error }]}>
                  {validationError || error}
                </Text>
              </View>
            )}

            {/* Species Selector */}
            <Text style={[typo.labelMedium, { color: colors.text, marginBottom: spacing.xs }]}>
              Loài thú cưng
            </Text>
            <View style={styles.speciesRow}>
              <Pressable
                onPress={() => setSpecies('dog')}
                style={[
                  styles.speciesBtn,
                  {
                    backgroundColor: species === 'dog' ? colors.primaryContainer : colors.surfaceElevated,
                    borderColor: species === 'dog' ? colors.primary : colors.border,
                    borderRadius: radius.lg,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="dog"
                  size={24}
                  color={species === 'dog' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    typo.labelMedium,
                    { color: species === 'dog' ? colors.primary : colors.text, marginLeft: 8, fontWeight: species === 'dog' ? '700' : '500' },
                  ]}
                >
                  Chó (Dog)
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setSpecies('cat')}
                style={[
                  styles.speciesBtn,
                  {
                    backgroundColor: species === 'cat' ? colors.primaryContainer : colors.surfaceElevated,
                    borderColor: species === 'cat' ? colors.primary : colors.border,
                    borderRadius: radius.lg,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="cat"
                  size={24}
                  color={species === 'cat' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    typo.labelMedium,
                    { color: species === 'cat' ? colors.primary : colors.text, marginLeft: 8, fontWeight: species === 'cat' ? '700' : '500' },
                  ]}
                >
                  Mèo (Cat)
                </Text>
              </Pressable>
            </View>

            {/* Name Input */}
            <View style={{ marginTop: spacing.md }}>
              <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 6, fontWeight: '700' }]}>
                Tên thú cưng *
              </Text>
              <View
                style={[
                  styles.fieldContainer,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="paw"
                  size={20}
                  color={colors.primary}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Ví dụ: Milo, Bơ, Miu Miu..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.fieldInput, { color: colors.text }]}
                />
              </View>
            </View>

            {/* Breed Input */}
            <View style={{ marginTop: spacing.smd }}>
              <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 6, fontWeight: '700' }]}>
                Giống loài
              </Text>
              <View
                style={[
                  styles.fieldContainer,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="format-list-bulleted-type"
                  size={20}
                  color={colors.primary}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  value={breedName}
                  onChangeText={setBreedName}
                  placeholder="Ví dụ: Poodle, Golden, Mèo Mướp..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.fieldInput, { color: colors.text }]}
                />
              </View>
            </View>

            {/* Weight Input */}
            <View style={{ marginTop: spacing.smd }}>
              <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 6, fontWeight: '700' }]}>
                Cân nặng hiện tại (kg) *
              </Text>
              <View
                style={[
                  styles.fieldContainer,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="scale-bathroom"
                  size={20}
                  color={colors.primary}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  value={weightKg}
                  onChangeText={setWeightKg}
                  placeholder="5.0"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  style={[styles.fieldInput, { color: colors.text }]}
                />
              </View>
            </View>

            {/* Sex & Neutered Row */}
            <View style={[styles.optionsRow, { marginTop: spacing.sm }]}>
              {/* Sex Toggle */}
              <View style={{ flex: 1, marginRight: spacing.xs }}>
                <Text style={[typo.labelSmall, { color: colors.textSecondary, marginBottom: 4 }]}>
                  Giới tính
                </Text>
                <View style={styles.miniBtnRow}>
                  <Pressable
                    onPress={() => setSex('male')}
                    style={[
                      styles.miniBtn,
                      {
                        backgroundColor: sex === 'male' ? colors.primary : colors.surfaceElevated,
                        borderRadius: radius.md,
                      },
                    ]}
                  >
                    <Text style={{ color: sex === 'male' ? colors.onPrimary : colors.text, fontSize: 12, fontWeight: '600' }}>
                      Đực ♂
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSex('female')}
                    style={[
                      styles.miniBtn,
                      {
                        backgroundColor: sex === 'female' ? colors.primary : colors.surfaceElevated,
                        borderRadius: radius.md,
                      },
                    ]}
                  >
                    <Text style={{ color: sex === 'female' ? colors.onPrimary : colors.text, fontSize: 12, fontWeight: '600' }}>
                      Cái ♀
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Neutered Toggle */}
              <View style={{ flex: 1, marginLeft: spacing.xs }}>
                <Text style={[typo.labelSmall, { color: colors.textSecondary, marginBottom: 4 }]}>
                  Triệt sản
                </Text>
                <Pressable
                  onPress={() => setIsNeutered(!isNeutered)}
                  style={[
                    styles.neuteredBtn,
                    {
                      backgroundColor: isNeutered ? colors.primaryContainer : colors.surfaceElevated,
                      borderColor: isNeutered ? colors.primary : colors.border,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isNeutered ? 'check-circle' : 'circle-outline'}
                    size={16}
                    color={isNeutered ? colors.primary : colors.textTertiary}
                  />
                  <Text
                    style={{
                      color: isNeutered ? colors.primary : colors.text,
                      fontSize: 12,
                      fontWeight: isNeutered ? '700' : '500',
                      marginLeft: 4,
                    }}
                  >
                    {isNeutered ? 'Đã triệt sản' : 'Chưa'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Submit Button */}
            <View style={{ marginTop: spacing.lg }}>
              <PrimaryButton
                title="Lưu thú cưng vào cơ sở dữ liệu"
                onPress={handleSubmit}
                loading={isLoading}
              />
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
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {},
  speciesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  speciesBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniBtnRow: {
    flexDirection: 'row',
    gap: 6,
  },
  miniBtn: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  neuteredBtn: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
});
