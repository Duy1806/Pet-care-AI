/**
 * PawCare AI — Professional Vaccination Tracker Screen (Sổ tiêm chủng & Phòng bệnh)
 *
 * Professional features:
 * - Real-time statistics: Administered (Đã tiêm), Planned (Chờ tiêm / Kế hoạch), Overdue (Quá hạn)
 * - Multi-dimensional filtering: Status tabs + Category pills
 * - Quick Action "Đánh dấu đã tiêm" with next booster scheduling
 * - 2-step automated push notification reminders (1 day before + due date morning)
 * - Clean deletion and update mechanisms synced to Supabase
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '@/presentation/theme';
import { usePetStore } from '@/presentation/stores/usePetStore';
import { useVaccinationStore } from '@/presentation/stores/useVaccinationStore';
import { PrimaryButton } from '@/presentation/components/PrimaryButton';
import type { VaccinationRecord, VaccinationType } from '@/domain/entities/Vaccination';

type StatusFilter = 'all' | 'planned' | 'completed' | 'overdue';

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getDefaultNextDue(type: VaccinationType): string {
  const d = new Date();
  if (type === 'vaccine') {
    d.setFullYear(d.getFullYear() + 1);
  } else if (type === 'deworming') {
    d.setMonth(d.getMonth() + 3);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split('T')[0];
}

export default function VaccinationScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { pets, selectedPet, selectPet, loadPets } = usePetStore();
  const { records, loadVaccinations, deleteVaccination, markAsCompleted, isLoading } = useVaccinationStore();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | VaccinationType>('all');

  // Mark as Completed Modal State
  const [selectedRecordToComplete, setSelectedRecordToComplete] = useState<VaccinationRecord | null>(null);
  const [completeAdministeredAt, setCompleteAdministeredAt] = useState<string>(getTodayString());
  const [completeNextDueAt, setCompleteNextDueAt] = useState<string>('');
  const [completeClinic, setCompleteClinic] = useState<string>('');

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
        `Bạn có chắc chắn muốn xóa bản ghi "${record.name}" khỏi sổ sức khỏe của bé?`,
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

  const handleOpenCompleteModal = (record: VaccinationRecord) => {
    void Haptics.selectionAsync();
    setSelectedRecordToComplete(record);
    setCompleteAdministeredAt(getTodayString());
    setCompleteNextDueAt(getDefaultNextDue(record.type));
    setCompleteClinic(record.vetClinic || '');
  };

  const handleConfirmMarkAsCompleted = async () => {
    if (!selectedRecordToComplete || !selectedPet?.id) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const success = await markAsCompleted(
      selectedRecordToComplete,
      completeAdministeredAt.trim() || getTodayString(),
      completeNextDueAt.trim() || null,
      completeClinic.trim() || null,
      selectedPet.name
    );

    if (success) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedRecordToComplete(null);
    }
  };

  const getDueDaysDiff = useCallback((targetDateStr: string | null): number | null => {
    if (!targetDateStr) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dueDate = new Date(targetDateStr);
    dueDate.setHours(0, 0, 0, 0);
    return Math.round((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }, []);

  const getDueStatus = useCallback(
    (targetDateStr: string | null) => {
      const diffDays = getDueDaysDiff(targetDateStr);
      if (diffDays === null) return null;

      if (diffDays < 0) {
        return {
          label: `Quá hạn ${Math.abs(diffDays)} ngày`,
          color: '#DC2626',
          bg: '#FEF2F2',
          icon: 'alert-circle' as const,
          isOverdue: true,
        };
      } else if (diffDays === 0) {
        return {
          label: 'Hôm nay đến lịch tiêm!',
          color: '#EA580C',
          bg: '#FFF7ED',
          icon: 'bell-ring' as const,
          isOverdue: false,
        };
      } else if (diffDays === 1) {
        return {
          label: 'Ngày mai đến lịch tiêm',
          color: '#D97706',
          bg: '#FFFBEB',
          icon: 'clock-alert-outline' as const,
          isOverdue: false,
        };
      } else if (diffDays <= 14) {
        return {
          label: `Còn ${diffDays} ngày nữa`,
          color: '#2563EB',
          bg: '#EFF6FF',
          icon: 'calendar-clock' as const,
          isOverdue: false,
        };
      }
      return {
        label: `Hẹn tiêm: ${targetDateStr}`,
        color: '#16A34A',
        bg: '#F0FDF4',
        icon: 'calendar-check' as const,
        isOverdue: false,
      };
    },
    [getDueDaysDiff]
  );

  // Statistics Calculation
  const stats = useMemo(() => {
    let completedCount = 0;
    let plannedCount = 0;
    let overdueCount = 0;

    for (const r of records) {
      if (r.status === 'completed') {
        completedCount++;
        if (r.nextDueAt) {
          const diff = getDueDaysDiff(r.nextDueAt);
          if (diff !== null && diff < 0) overdueCount++;
        }
      } else {
        plannedCount++;
        const target = r.nextDueAt || r.administeredAt;
        const diff = getDueDaysDiff(target);
        if (diff !== null && diff < 0) overdueCount++;
      }
    }
    return { completedCount, plannedCount, overdueCount };
  }, [records, getDueDaysDiff]);

  // Filter logic
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // 1. Type filter
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;

      // 2. Status filter
      if (statusFilter === 'all') return true;

      const targetDate = r.nextDueAt || (r.status === 'planned' ? r.administeredAt : null);
      const diff = getDueDaysDiff(targetDate);
      const isOverdue = diff !== null && diff < 0;

      if (statusFilter === 'overdue') return isOverdue;
      if (statusFilter === 'planned') return r.status === 'planned';
      if (statusFilter === 'completed') return r.status === 'completed';

      return true;
    });
  }, [records, typeFilter, statusFilter, getDueDaysDiff]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Bar */}
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
              Sổ tiêm chủng thông minh
            </Text>
            <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
              Theo dõi lịch tiêm phòng & tự động nhắc lịch
            </Text>
          </View>

          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push({
                pathname: '/(app)/add-vaccination',
                params: { petId: selectedPet?.id, defaultStatus: 'completed' },
              } as any);
            }}
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

      {/* Main Scroll Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
        }}
      >
        {/* STATS OVERVIEW CARDS */}
        <View style={styles.statsContainer}>
          <Pressable
            onPress={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
            style={[
              styles.statCard,
              {
                backgroundColor: colors.surface,
                borderColor: statusFilter === 'completed' ? '#16A34A' : colors.border,
                borderRadius: radius.lg,
              },
            ]}
          >
            <View style={[styles.statIconBadge, { backgroundColor: '#DCFCE7' }]}>
              <MaterialCommunityIcons name="check-circle-outline" size={20} color="#16A34A" />
            </View>
            <Text style={[typo.headlineLarge, { color: '#16A34A', marginTop: 4 }]}>
              {stats.completedCount}
            </Text>
            <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>Đã tiêm</Text>
          </Pressable>

          <Pressable
            onPress={() => setStatusFilter(statusFilter === 'planned' ? 'all' : 'planned')}
            style={[
              styles.statCard,
              {
                backgroundColor: colors.surface,
                borderColor: statusFilter === 'planned' ? '#2563EB' : colors.border,
                borderRadius: radius.lg,
              },
            ]}
          >
            <View style={[styles.statIconBadge, { backgroundColor: '#DBEAFE' }]}>
              <MaterialCommunityIcons name="calendar-clock-outline" size={20} color="#2563EB" />
            </View>
            <Text style={[typo.headlineLarge, { color: '#2563EB', marginTop: 4 }]}>
              {stats.plannedCount}
            </Text>
            <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>Chờ tiêm</Text>
          </Pressable>

          <Pressable
            onPress={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
            style={[
              styles.statCard,
              {
                backgroundColor: colors.surface,
                borderColor: statusFilter === 'overdue' ? '#DC2626' : colors.border,
                borderRadius: radius.lg,
              },
            ]}
          >
            <View style={[styles.statIconBadge, { backgroundColor: '#FEE2E2' }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#DC2626" />
            </View>
            <Text style={[typo.headlineLarge, { color: '#DC2626', marginTop: 4 }]}>
              {stats.overdueCount}
            </Text>
            <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>Quá hạn</Text>
          </Pressable>
        </View>

        {/* STATUS FILTER TABS */}
        <View style={[styles.filterBar, { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: colors.border, borderWidth: 1 }]}>
          {[
            { key: 'all', label: 'Tất cả' },
            { key: 'planned', label: 'Chờ tiêm' },
            { key: 'completed', label: 'Đã tiêm' },
            { key: 'overdue', label: 'Quá hạn' },
          ].map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setStatusFilter(tab.key as StatusFilter);
                }}
                style={[
                  styles.filterTab,
                  isActive && {
                    backgroundColor: colors.primaryContainer,
                    borderRadius: radius.md,
                  },
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

        {/* CATEGORY FILTER PILLS (All / Vaccine / Deworming / Flea & Tick) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginVertical: spacing.md }}
        >
          {[
            { key: 'all', label: 'Tất cả loại thuốc' },
            { key: 'vaccine', label: '💉 Vắc-xin' },
            { key: 'deworming', label: '💊 Tẩy giun' },
            { key: 'flea_tick', label: '🛡️ Ve rận & Giun tim' },
          ].map((pill) => {
            const isActive = typeFilter === pill.key;
            return (
              <Pressable
                key={pill.key}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setTypeFilter(pill.key as any);
                }}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isActive ? colors.primary : colors.surfaceElevated,
                    borderColor: isActive ? colors.primary : colors.border,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <Text
                  style={[
                    typo.labelSmall,
                    {
                      color: isActive ? colors.onPrimary : colors.text,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                >
                  {pill.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* RECORDS LIST */}
        {isLoading && filteredRecords.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 8 }]}>
              Đang đồng bộ sổ tiêm chủng...
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
              {statusFilter === 'planned'
                ? 'Không có lịch hẹn chờ tiêm'
                : statusFilter === 'overdue'
                ? 'Tuyệt vời! Không có lịch tiêm nào quá hạn'
                : 'Chưa có thông tin tiêm chủng'}
            </Text>
            <Text
              style={[
                typo.bodySmall,
                { color: colors.textSecondary, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },
              ]}
            >
              Thêm các mũi tiêm đã tiêm hoặc đặt lịch hẹn sắp tới để hệ thống tự động nhắc nhở trước 1 ngày và đúng ngày hẹn cho bạn.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({
                    pathname: '/(app)/add-vaccination',
                    params: { petId: selectedPet?.id, defaultStatus: 'completed' },
                  } as any);
                }}
                style={[styles.addEmptyBtn, { backgroundColor: colors.primary, borderRadius: radius.lg }]}
              >
                <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.onPrimary} />
                <Text style={[typo.labelMedium, { color: colors.onPrimary, marginLeft: 6 }]}>
                  Thêm mũi đã tiêm
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push({
                    pathname: '/(app)/add-vaccination',
                    params: { petId: selectedPet?.id, defaultStatus: 'planned' },
                  } as any);
                }}
                style={[
                  styles.addEmptyBtn,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg },
                ]}
              >
                <MaterialCommunityIcons name="calendar-clock" size={18} color={colors.text} />
                <Text style={[typo.labelMedium, { color: colors.text, marginLeft: 6 }]}>
                  Hẹn lịch tiêm tới
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          filteredRecords.map((rec) => {
            const isPlanned = rec.status === 'planned';
            const targetDate = isPlanned ? (rec.nextDueAt || rec.administeredAt) : rec.nextDueAt;
            const dueStatus = getDueStatus(targetDate);

            const typeBadgeColor =
              rec.type === 'vaccine'
                ? { bg: '#E0F2FE', text: '#0284C7', label: 'Vắc-xin', icon: 'needle' as const }
                : rec.type === 'deworming'
                ? { bg: '#FEF3C7', text: '#D97706', label: 'Tẩy giun', icon: 'pill' as const }
                : { bg: '#DCFCE7', text: '#16A34A', label: 'Ve rận', icon: 'shield-bug-outline' as const };

            return (
              <View
                key={rec.id}
                style={[
                  styles.recordCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isPlanned ? colors.primary : colors.border,
                    borderWidth: isPlanned ? 1.5 : 1,
                    borderRadius: radius.xl,
                  },
                ]}
              >
                {/* Card Top Row: Type Badge + Status Badge + Delete */}
                <View style={styles.recordTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={[styles.typeBadge, { backgroundColor: typeBadgeColor.bg }]}>
                      <MaterialCommunityIcons name={typeBadgeColor.icon} size={14} color={typeBadgeColor.text} />
                      <Text style={[typo.labelSmall, { color: typeBadgeColor.text, fontWeight: '700', marginLeft: 4 }]}>
                        {typeBadgeColor.label}
                      </Text>
                    </View>

                    {/* Status Badge: Đã tiêm vs Kế hoạch */}
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: isPlanned ? '#EFF6FF' : '#DCFCE7',
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={isPlanned ? 'calendar-clock' : 'check-circle'}
                        size={12}
                        color={isPlanned ? '#2563EB' : '#16A34A'}
                      />
                      <Text
                        style={[
                          typo.labelSmall,
                          {
                            color: isPlanned ? '#2563EB' : '#16A34A',
                            fontWeight: '700',
                            marginLeft: 3,
                          },
                        ]}
                      >
                        {isPlanned ? 'Chờ tiêm' : 'Đã tiêm'}
                        {rec.doseNumber ? ` (Mũi ${rec.doseNumber})` : ''}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => handleDelete(rec)}
                    hitSlop={8}
                    style={styles.deleteBtn}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.textTertiary} />
                  </Pressable>
                </View>

                {/* Name */}
                <Text style={[typo.titleLarge, { color: colors.text, marginTop: 8 }]}>
                  {rec.name}
                </Text>

                {/* Date Row */}
                <View style={[styles.infoRow, { marginTop: 6 }]}>
                  <MaterialCommunityIcons
                    name={isPlanned ? 'calendar-clock-outline' : 'calendar-check-outline'}
                    size={16}
                    color={isPlanned ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[typo.bodySmall, { color: colors.textSecondary, marginLeft: 6 }]}>
                    {isPlanned ? 'Ngày hẹn dự kiến:' : 'Ngày đã tiêm:'}{' '}
                    <Text style={{ color: colors.text, fontWeight: '700' }}>
                      {isPlanned ? targetDate : rec.administeredAt}
                    </Text>
                  </Text>
                </View>

                {/* Clinic */}
                {rec.vetClinic && (
                  <View style={[styles.infoRow, { marginTop: 4 }]}>
                    <MaterialCommunityIcons name="hospital-box-outline" size={16} color={colors.textSecondary} />
                    <Text style={[typo.bodySmall, { color: colors.textSecondary, marginLeft: 6 }]}>
                      Phòng khám: {rec.vetClinic}
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

                {/* Due Banner for Next Due Date or Planned Date */}
                {dueStatus && (
                  <View style={[styles.dueBanner, { backgroundColor: dueStatus.bg, borderRadius: radius.md }]}>
                    <MaterialCommunityIcons name={dueStatus.icon} size={16} color={dueStatus.color} />
                    <Text style={[typo.labelMedium, { color: dueStatus.color, fontWeight: '700', marginLeft: 6 }]}>
                      {isPlanned ? dueStatus.label : `Lịch tiêm nhắc: ${dueStatus.label}`}
                    </Text>
                  </View>
                )}

                {/* Smart Notification Indicator */}
                {targetDate && (
                  <View style={styles.notificationTag}>
                    <MaterialCommunityIcons name="bell-check-outline" size={13} color={colors.primary} />
                    <Text style={[typo.labelSmall, { color: colors.primary, marginLeft: 4 }]}>
                      Đã bật nhắc lịch tự động (trước 1 ngày & trong ngày hẹn)
                    </Text>
                  </View>
                )}

                {/* QUICK ACTION BUTTON FOR PLANNED RECORDS */}
                {isPlanned && (
                  <View style={{ marginTop: 12, paddingTop: 10, borderTopColor: colors.border, borderTopWidth: 1 }}>
                    <Pressable
                      onPress={() => handleOpenCompleteModal(rec)}
                      style={[
                        styles.markCompleteBtn,
                        { backgroundColor: colors.primary, borderRadius: radius.md },
                      ]}
                    >
                      <MaterialCommunityIcons name="check-decagram" size={16} color={colors.onPrimary} />
                      <Text style={[typo.labelMedium, { color: colors.onPrimary, fontWeight: '700', marginLeft: 6 }]}>
                        Đã tiêm xong ➔ Đánh dấu hoàn thành
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* MARK AS COMPLETED MODAL */}
      <Modal visible={Boolean(selectedRecordToComplete)} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderRadius: radius.xl }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="check-decagram" size={24} color={colors.primary} />
              <Text style={[typo.titleLarge, { color: colors.text, marginLeft: 8 }]}>
                Đánh dấu đã tiêm
              </Text>
            </View>
            <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
              Cập nhật ngày tiêm thực tế và lên lịch tái chủng tiếp theo cho bé {selectedPet?.name}.
            </Text>

            <View style={{ marginTop: spacing.md }}>
              <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 4 }]}>
                Ngày thực tế đã tiêm:
              </Text>
              <TextInput
                value={completeAdministeredAt}
                onChangeText={setCompleteAdministeredAt}
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

            <View style={{ marginTop: spacing.sm }}>
              <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 4 }]}>
                Hẹn lịch tiêm nhắc mũi tiếp theo:
              </Text>
              <TextInput
                value={completeNextDueAt}
                onChangeText={setCompleteNextDueAt}
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

            <View style={{ marginTop: spacing.sm }}>
              <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 4 }]}>
                Phòng khám thực hiện:
              </Text>
              <TextInput
                value={completeClinic}
                onChangeText={setCompleteClinic}
                placeholder="Tên phòng khám thú y..."
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

            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
              <Pressable
                onPress={() => setSelectedRecordToComplete(null)}
                style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1, borderRadius: radius.md }]}
              >
                <Text style={[typo.labelLarge, { color: colors.textSecondary }]}>Hủy</Text>
              </Pressable>

              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title="Xác nhận đã tiêm"
                  onPress={handleConfirmMarkAsCompleted}
                  loading={isLoading}
                  disabled={isLoading}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  petPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  statIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBar: {
    flexDirection: 'row',
    padding: 4,
    marginBottom: 8,
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  categoryPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 20,
  },
  emptyIconBox: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addEmptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  recordCard: {
    padding: 16,
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
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
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
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  notificationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  markCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    padding: 20,
  },
  input: {
    height: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  modalBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
