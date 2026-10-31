/**
 * PawCare AI — Vaccination Tracker Screen (Sổ tiêm chủng & Phòng bệnh)
 *
 * Full-featured vaccination log:
 * - Switch between pets
 * - Filter by type: Vaccine, Deworming, Flea & Tick
 * - Visual status badges: Up to date / Upcoming / Overdue
 * - Add new records persisted directly to Supabase
 * - Delete records with confirmation
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '@/presentation/theme';
import { usePetStore } from '@/presentation/stores/usePetStore';
import { useVaccinationStore } from '@/presentation/stores/useVaccinationStore';
import { AddVaccinationModal } from '@/presentation/components/AddVaccinationModal';
import type { VaccinationRecord, VaccinationType } from '@/domain/entities/Vaccination';

export default function VaccinationScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { pets, selectedPet, selectPet, loadPets } = usePetStore();
  const { records, loadVaccinations, deleteVaccination, isLoading } = useVaccinationStore();

  const [activeTab, setActiveTab] = useState<'all' | VaccinationType>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    if (pets.length === 0) {
      void loadPets();
    }
  }, [pets.length, loadPets]);

  useEffect(() => {
    if (selectedPet?.id) {
      void loadVaccinations(selectedPet.id);
    } else if (pets[0]?.id) {
      selectPet(pets[0]);
      void loadVaccinations(pets[0].id);
    }
  }, [selectedPet?.id, pets, selectPet, loadVaccinations]);

  const handleDelete = useCallback(
    (record: VaccinationRecord) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        'Xóa mũi tiêm',
        `Bạn có chắc chắn muốn xóa bản ghi "${record.name}" khỏi sổ sức khỏe?`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xóa',
            style: 'destructive',
            onPress: () => {
              if (selectedPet?.id) {
                void deleteVaccination(record.id, selectedPet.id);
              }
            },
          },
        ]
      );
    },
    [selectedPet, deleteVaccination]
  );

  const filteredRecords = records.filter((r) => {
    if (activeTab === 'all') return true;
    return r.type === activeTab;
  });

  const getDueStatus = (nextDueAt: string | null) => {
    if (!nextDueAt) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dueDate = new Date(nextDueAt);
    dueDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `Quá hạn ${Math.abs(diffDays)} ngày`,
        color: '#C62828',
        bg: '#FFEBEE',
        icon: 'alert-circle' as const,
      };
    } else if (diffDays === 0) {
      return {
        label: 'Đến hạn hôm nay',
        color: '#E65100',
        bg: '#FFF3E0',
        icon: 'bell-ring' as const,
      };
    } else if (diffDays <= 14) {
      return {
        label: `Còn ${diffDays} ngày nữa`,
        color: '#F57F17',
        bg: '#FFFDE7',
        icon: 'clock-alert-outline' as const,
      };
    }
    return {
      label: `Hẹn tiêm: ${nextDueAt}`,
      color: '#2E7D32',
      bg: '#E8F5E9',
      icon: 'calendar-check' as const,
    };
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header with Back Button */}
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
            onPress={() => router.back()}
            hitSlop={8}
            style={[styles.backBtn, { borderColor: colors.border }]}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={[typo.headlineMedium, { color: colors.text }]}>
              Sổ tiêm chủng
            </Text>
            <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
              Theo dõi lịch tiêm phòng & ngừa bệnh
            </Text>
          </View>

          <Pressable
            onPress={() => setIsAddModalOpen(true)}
            style={[styles.addTopBtn, { backgroundColor: colors.primary, borderRadius: radius.full }]}
          >
            <MaterialCommunityIcons name="plus" size={18} color={colors.onPrimary} />
            <Text style={[typo.labelMedium, { color: colors.onPrimary, marginLeft: 4 }]}>
              Thêm
            </Text>
          </Pressable>
        </View>

        {/* Pet Selector Bar */}
        {pets.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginTop: spacing.md, paddingBottom: 4 }}
          >
            {pets.map((p) => {
              const isSelected = selectedPet?.id === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    selectPet(p);
                  }}
                  style={[
                    styles.petPill,
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
        )}
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {[
          { key: 'all', label: 'Tất cả' },
          { key: 'vaccine', label: 'Vắc-xin' },
          { key: 'deworming', label: 'Tẩy giun' },
          { key: 'flea_tick', label: 'Ve rận' },
        ].map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                void Haptics.selectionAsync();
                setActiveTab(tab.key as any);
              }}
              style={[
                styles.filterTab,
                { borderBottomColor: isActive ? colors.primary : 'transparent' },
              ]}
            >
              <Text
                style={[
                  typo.labelMedium,
                  {
                    color: isActive ? colors.primary : colors.textSecondary,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Content List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
        }}
      >
        {isLoading && filteredRecords.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 8 }]}>
              Đang tải sổ tiêm chủng từ máy chủ...
            </Text>
          </View>
        ) : filteredRecords.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl },
            ]}
          >
            <View style={[styles.emptyIconBox, { backgroundColor: colors.primaryContainer }]}>
              <MaterialCommunityIcons name="needle" size={40} color={colors.primary} />
            </View>
            <Text style={[typo.titleLarge, { color: colors.text, marginTop: spacing.md }]}>
              Chưa có mũi tiêm nào
            </Text>
            <Text
              style={[
                typo.bodySmall,
                { color: colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
              ]}
            >
              Hãy thêm thông tin tiêm phòng hoặc tẩy giun của bé {selectedPet?.name || 'cưng'} để ứng dụng tự động nhắc lịch khi đến ngày hẹn.
            </Text>

            <Pressable
              onPress={() => setIsAddModalOpen(true)}
              style={[styles.addEmptyBtn, { backgroundColor: colors.primary, borderRadius: radius.lg }]}
            >
              <MaterialCommunityIcons name="plus" size={20} color={colors.onPrimary} />
              <Text style={[typo.labelLarge, { color: colors.onPrimary, marginLeft: 6 }]}>
                Thêm mũi tiêm ngay
              </Text>
            </Pressable>
          </View>
        ) : (
          filteredRecords.map((rec) => {
            const dueStatus = getDueStatus(rec.nextDueAt);
            const typeIcon =
              rec.type === 'vaccine'
                ? 'needle'
                : rec.type === 'deworming'
                ? 'pill'
                : 'shield-bug-outline';
            const typeBadgeColor =
              rec.type === 'vaccine'
                ? { bg: '#E0F2FE', text: '#0284C7', label: 'Vắc-xin' }
                : rec.type === 'deworming'
                ? { bg: '#FEF3C7', text: '#D97706', label: 'Tẩy giun' }
                : { bg: '#DCFCE7', text: '#16A34A', label: 'Ve rận' };

            return (
              <View
                key={rec.id}
                style={[
                  styles.recordCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl },
                ]}
              >
                {/* Card Top Row */}
                <View style={styles.recordTopRow}>
                  <View style={[styles.typeBadge, { backgroundColor: typeBadgeColor.bg }]}>
                    <MaterialCommunityIcons name={typeIcon} size={14} color={typeBadgeColor.text} />
                    <Text style={[typo.labelSmall, { color: typeBadgeColor.text, fontWeight: '700', marginLeft: 4 }]}>
                      {typeBadgeColor.label}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleDelete(rec)}
                    hitSlop={8}
                    style={styles.deleteBtn}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.textTertiary} />
                  </Pressable>
                </View>

                {/* Vaccine Name */}
                <Text style={[typo.titleLarge, { color: colors.text, marginTop: 6 }]}>
                  {rec.name}
                </Text>

                {/* Administered Date */}
                <View style={[styles.infoRow, { marginTop: 6 }]}>
                  <MaterialCommunityIcons name="calendar-check-outline" size={16} color={colors.textSecondary} />
                  <Text style={[typo.bodySmall, { color: colors.textSecondary, marginLeft: 6 }]}>
                    Đã tiêm ngày: <Text style={{ color: colors.text, fontWeight: '600' }}>{rec.administeredAt}</Text>
                  </Text>
                </View>

                {/* Clinic info */}
                {rec.vetClinic && (
                  <View style={[styles.infoRow, { marginTop: 4 }]}>
                    <MaterialCommunityIcons name="hospital-box-outline" size={16} color={colors.textSecondary} />
                    <Text style={[typo.bodySmall, { color: colors.textSecondary, marginLeft: 6 }]}>
                      Tại: {rec.vetClinic}
                    </Text>
                  </View>
                )}

                {/* Note */}
                {rec.note && (
                  <View style={[styles.infoRow, { marginTop: 4 }]}>
                    <MaterialCommunityIcons name="note-text-outline" size={16} color={colors.textSecondary} />
                    <Text style={[typo.bodySmall, { color: colors.textSecondary, marginLeft: 6, fontStyle: 'italic' }]}>
                      &ldquo;{rec.note}&rdquo;
                    </Text>
                  </View>
                )}

                {/* Due Date Status Banner */}
                {dueStatus && (
                  <View style={[styles.dueBanner, { backgroundColor: dueStatus.bg, borderRadius: radius.md }]}>
                    <MaterialCommunityIcons name={dueStatus.icon} size={16} color={dueStatus.color} />
                    <Text style={[typo.labelMedium, { color: dueStatus.color, fontWeight: '700', marginLeft: 6 }]}>
                      Lịch tiêm nhắc: {dueStatus.label}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Modal */}
      <AddVaccinationModal
        visible={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          if (selectedPet?.id) {
            void loadVaccinations(selectedPet.id);
          }
        }}
        pets={pets}
        selectedPetId={selectedPet?.id}
      />
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
  addTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  petPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  filterBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
    borderWidth: 1,
    marginTop: 20,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 20,
  },
  recordCard: {
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  recordTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deleteBtn: {
    padding: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 12,
  },
});
