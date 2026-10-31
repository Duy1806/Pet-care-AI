/**
 * PawCare AI — Home Screen (Trang chủ)
 *
 * Real-time Pet Care Dashboard:
 * - Real user profile & theme toggle
 * - Real pet switcher connected to Supabase Database
 * - Quick feature shortcuts (Quét giống, Dinh dưỡng, Tiêm phòng, Cấp cứu)
 * - Today's Care Checklist with toggleable state
 * - Add Pet Modal with instant database persistence
 * - Daily AI Pet Care Tip
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useAuthStore } from '@/presentation/stores/useAuthStore';
import { usePetStore } from '@/presentation/stores/usePetStore';
import { useVaccinationStore } from '@/presentation/stores/useVaccinationStore';
import { useCareScheduleStore } from '@/presentation/stores/useCareScheduleStore';
import { ThemeToggle } from '@/presentation/components/ThemeToggle';
import { NetworkBanner } from '@/presentation/components/NetworkBanner';
import { AddPetModal } from '@/presentation/components/AddPetModal';
import { AddCareScheduleModal } from '@/presentation/components/AddCareScheduleModal';
import { CARE_SUGGESTIONS, type CareCategory } from '@/domain/entities/CareReminder';

const CATEGORY_COLORS: Record<CareCategory, string> = {
  feeding: '#EA580C',
  medication: '#8B5CF6',
  exercise: '#16A34A',
  grooming: '#DB2777',
  water: '#0284C7',
  hygiene: '#059669',
  other: '#64748B',
};

export default function HomeScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { pets, selectedPet, selectPet, loadPets, isLoading: isPetsLoading } = usePetStore();
  const { alerts, loadAlerts } = useVaccinationStore();

  const {
    reminders,
    isLoading: isCareLoading,
    loadReminders,
    toggleReminder,
    deleteReminder,
    addQuickSuggestion,
  } = useCareScheduleStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCareModalOpen, setIsCareModalOpen] = useState(false);

  const activePet = selectedPet || (pets.length > 0 ? pets[0] : null);

  useEffect(() => {
    void loadPets();
  }, [loadPets]);

  useEffect(() => {
    if (pets.length > 0) {
      void loadAlerts(pets);
    }
  }, [pets, loadAlerts]);

  useEffect(() => {
    if (activePet?.id) {
      void loadReminders(activePet.id);
    }
  }, [activePet?.id, loadReminders]);

  const suggestedItems = useMemo(() => {
    const species = activePet?.species || 'all';
    return CARE_SUGGESTIONS.filter(
      (item) => item.species === species || item.species === 'all'
    );
  }, [activePet?.species]);

  const remainingSuggestions = useMemo(() => {
    return suggestedItems.filter(
      (sug) => !reminders.some((r) => r.title === sug.title)
    );
  }, [suggestedItems, reminders]);

  const completedCount = useMemo(() => {
    return reminders.filter((r) => r.isDone).length;
  }, [reminders]);

  const handlePressBell = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (alerts.length > 0) {
      const urgent = alerts[0];
      Alert.alert(
        '🔔 Nhắc nhở lịch tiêm phòng',
        `Bé ${urgent.petName} có lịch tiêm "${urgent.record.name}" ${urgent.status === 'overdue' ? `đã quá hạn ${Math.abs(urgent.daysDiff)} ngày!` : urgent.status === 'today' ? 'vào hôm nay!' : `vào ngày ${urgent.record.nextDueAt} (còn ${urgent.daysDiff} ngày).`}\n\nBạn có muốn mở sổ tiêm chủng để kiểm tra?`,
        [
          { text: 'Để sau', style: 'cancel' },
          { text: 'Mở sổ tiêm chủng', onPress: () => router.push('/vaccinations' as any) },
        ]
      );
    } else {
      Alert.alert('🔔 Thông báo', 'Hiện tại không có lịch tiêm phòng nào sắp tới hạn. Thú cưng của bạn đều đang có lịch tiêm đầy đủ!');
    }
  }, [alerts]);

  const handleToggleReminder = useCallback(
    (id: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void toggleReminder(id);
    },
    [toggleReminder]
  );

  const handleDeleteReminder = useCallback(
    (id: string, title: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        'Xóa lịch chăm sóc',
        `Bạn có chắc muốn xóa lịch "${title}" không?`,
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xóa',
            style: 'destructive',
            onPress: () => {
              void deleteReminder(id);
            },
          },
        ]
      );
    },
    [deleteReminder]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <NetworkBanner />

      {/* Top Header */}
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
        <View style={styles.userInfoRow}>
          <View
            style={[
              styles.avatarContainer,
              { backgroundColor: colors.primaryContainer },
            ]}
          >
            <MaterialCommunityIcons
              name="paw"
              size={24}
              color={colors.primary}
            />
          </View>
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
              Xin chào 👋
            </Text>
            <Text style={[typo.titleLarge, { color: colors.text }]}>
              {user?.fullName || 'Chủ nuôi thú cưng'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <ThemeToggle />
          <Pressable
            hitSlop={8}
            onPress={handlePressBell}
            style={[
              styles.bellButton,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
          >
            <MaterialCommunityIcons
              name={alerts.length > 0 ? "bell-badge-outline" : "bell-outline"}
              size={20}
              color={alerts.length > 0 ? colors.accent : colors.text}
            />
            {alerts.length > 0 && (
              <View style={[styles.notificationDot, { backgroundColor: colors.accent }]} />
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing.xxl,
        }}
      >
        {/* Section 1: Real Pet Card Carousel */}
        <View style={{ marginTop: spacing.md, paddingHorizontal: spacing.lg }}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[typo.titleMedium, { color: colors.text }]}>
              Thú cưng của bạn
            </Text>
            <Pressable
              onPress={() => setIsAddModalOpen(true)}
              hitSlop={8}
            >
              <Text style={[typo.labelMedium, { color: colors.primary }]}>
                + Thêm thú cưng
              </Text>
            </Pressable>
          </View>

          {isPetsLoading && pets.length === 0 ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 8 }]}>
                Đang tải dữ liệu thú cưng từ cơ sở dữ liệu...
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.md, paddingVertical: spacing.xs }}
            >
              {pets.map((pet) => {
                const isSelected = selectedPet?.id === pet.id;
                return (
                  <Pressable
                    key={pet.id}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      selectPet(pet);
                      router.push({
                        pathname: '/pet-profile',
                        params: { petId: pet.id },
                      } as any);
                    }}
                    style={[
                      styles.petCard,
                      {
                        backgroundColor: isSelected ? colors.primaryContainer : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                        borderRadius: radius.xl,
                        padding: spacing.md,
                      },
                    ]}
                  >
                    <View style={styles.petCardTop}>
                      <View
                        style={[
                          styles.petAvatar,
                          {
                            backgroundColor: pet.species === 'dog' ? '#FFE0B2' : '#E1BEE7',
                            overflow: 'hidden',
                          },
                        ]}
                      >
                        {pet.photoUrl ? (
                          <Image source={{ uri: pet.photoUrl }} style={{ width: '100%', height: '100%', borderRadius: 24 }} resizeMode="cover" />
                        ) : (
                          <MaterialCommunityIcons
                            name={pet.species === 'dog' ? 'dog' : 'cat'}
                            size={28}
                            color="#4E342E"
                          />
                        )}
                      </View>
                      {isSelected && (
                        <View
                          style={[
                            styles.activeBadge,
                            { backgroundColor: colors.primary },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="check"
                            size={12}
                            color={colors.onPrimary}
                          />
                        </View>
                      )}
                    </View>

                    <Text
                      style={[
                        typo.titleLarge,
                        { color: colors.text, marginTop: spacing.xs },
                      ]}
                      numberOfLines={1}
                    >
                      {pet.name}
                    </Text>
                    <Text
                      style={[typo.bodySmall, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {pet.breedName || (pet.species === 'dog' ? 'Chó' : 'Mèo')}
                    </Text>

                    <View
                      style={[
                        styles.petStatPill,
                        { backgroundColor: colors.surface, marginTop: spacing.sm },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="scale-bathroom"
                        size={14}
                        color={colors.primary}
                      />
                      <Text
                        style={[
                          typo.labelSmall,
                          { color: colors.text, marginLeft: 4, fontWeight: '700' },
                        ]}
                      >
                        {pet.weightKg} kg
                      </Text>
                    </View>
                  </Pressable>
                );
              })}

              {/* Add Pet Card */}
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsAddModalOpen(true);
                }}
                style={[
                  styles.addPetCard,
                  {
                    borderColor: colors.border,
                    borderRadius: radius.xl,
                    padding: spacing.md,
                    minHeight: 140,
                  },
                ]}
              >
                <View
                  style={[
                    styles.addPetIconBox,
                    { backgroundColor: colors.surfaceElevated },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="plus"
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <Text style={[typo.labelMedium, { color: colors.primary, marginTop: spacing.sm }]}>
                  Thêm bé cưng
                </Text>
              </Pressable>
            </ScrollView>
          )}
        </View>

        {/* Section 1.5: Vaccination Alert Banner (if upcoming or overdue) */}
        {alerts.length > 0 && (
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/vaccinations' as any);
            }}
            style={[
              styles.alertBanner,
              {
                backgroundColor: alerts[0].status === 'overdue' ? '#FFEBEE' : '#FFF8E1',
                borderColor: alerts[0].status === 'overdue' ? '#FFCDD2' : '#FFE082',
                borderRadius: radius.xl,
                marginHorizontal: spacing.lg,
                marginTop: spacing.md,
                padding: spacing.md,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={[
                  styles.alertIconCircle,
                  {
                    backgroundColor: alerts[0].status === 'overdue' ? '#FFCDD2' : '#FFE082',
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={alerts[0].status === 'overdue' ? 'alert-decagram' : 'needle'}
                  size={22}
                  color={alerts[0].status === 'overdue' ? '#C62828' : '#D97706'}
                />
              </View>

              <View style={{ flex: 1, marginLeft: spacing.sm, justifyContent: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <MaterialCommunityIcons
                      name={alerts[0].status === 'overdue' ? 'alert-circle' : 'bell-ring'}
                      size={16}
                      color={alerts[0].status === 'overdue' ? '#C62828' : '#D97706'}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        typo.labelLarge,
                        {
                          color: alerts[0].status === 'overdue' ? '#C62828' : '#B45309',
                          fontWeight: '700',
                          includeFontPadding: false,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {alerts[0].status === 'overdue'
                        ? 'Quá hạn tiêm phòng!'
                        : alerts[0].status === 'today'
                        ? 'Lịch tiêm hôm nay!'
                        : 'Nhắc lịch tiêm sắp tới'}
                    </Text>
                  </View>
                  {alerts.length > 1 && (
                    <Text style={[typo.labelSmall, { color: colors.textSecondary, marginLeft: 6 }]}>
                      +{alerts.length - 1} lịch khác
                    </Text>
                  )}
                </View>

                <Text
                  style={[typo.bodySmall, { color: colors.text, marginTop: 3, includeFontPadding: false }]}
                  numberOfLines={1}
                >
                  Bé <Text style={{ fontWeight: '700' }}>{alerts[0].petName}</Text>: {alerts[0].record.name} ({alerts[0].record.nextDueAt})
                </Text>
              </View>

              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={alerts[0].status === 'overdue' ? '#C62828' : '#D97706'}
                style={{ marginLeft: 4 }}
              />
            </View>
          </Pressable>
        )}

        {/* Section 2: Quick Actions Grid */}
        <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.lg }}>
          <Text style={[typo.titleMedium, { color: colors.text, marginBottom: spacing.sm }]}>
            Chức năng nổi bật
          </Text>

          <View style={styles.quickGrid}>
            {/* Action 1: Quét AI */}
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(app)/breed-scanner' as any);
              }}
              style={[
                styles.actionCard,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
              ]}
            >
              <View
                style={[
                  styles.actionIconBox,
                  { backgroundColor: '#E0F2FE' },
                ]}
              >
                <MaterialCommunityIcons
                  name="camera-iris"
                  size={26}
                  color="#0284C7"
                />
              </View>
              <Text style={[typo.labelLarge, { color: colors.text, marginTop: spacing.xs }]}>
                Nhận diện giống
              </Text>
              <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                Quét AI Vision
              </Text>
            </Pressable>

            {/* Action 2: Dinh dưỡng */}
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(app)/nutrition' as any);
              }}
              style={[
                styles.actionCard,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
              ]}
            >
              <View
                style={[
                  styles.actionIconBox,
                  { backgroundColor: '#FEF3C7' },
                ]}
              >
                <MaterialCommunityIcons
                  name="food-drumstick"
                  size={26}
                  color="#D97706"
                />
              </View>
              <Text style={[typo.labelLarge, { color: colors.text, marginTop: spacing.xs }]}>
                Gợi ý dinh dưỡng
              </Text>
              <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                Tính calo RER/MER
              </Text>
            </Pressable>

            {/* Action 3: Sổ tiêm phòng */}
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({
                  pathname: '/vaccinations',
                  params: selectedPet?.id ? { petId: selectedPet.id } : undefined,
                } as any);
              }}
              style={[
                styles.actionCard,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
              ]}
            >
              <View
                style={[
                  styles.actionIconBox,
                  { backgroundColor: '#DCFCE7' },
                ]}
              >
                <MaterialCommunityIcons
                  name="needle"
                  size={26}
                  color="#16A34A"
                />
              </View>
              <Text style={[typo.labelLarge, { color: colors.text, marginTop: spacing.xs }]}>
                Sổ tiêm chủng
              </Text>
              <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                Nhắc ngừa bệnh
              </Text>
            </Pressable>

            {/* Action 4: Hồ sơ & Bác sĩ */}
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({
                  pathname: '/pet-profile',
                  params: selectedPet?.id ? { petId: selectedPet.id } : undefined,
                } as any);
              }}
              style={[
                styles.actionCard,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
              ]}
            >
              <View
                style={[
                  styles.actionIconBox,
                  { backgroundColor: '#FCE7F3' },
                ]}
              >
                <MaterialCommunityIcons
                  name="account-details"
                  size={26}
                  color="#DB2777"
                />
              </View>
              <Text style={[typo.labelLarge, { color: colors.text, marginTop: spacing.xs }]}>
                Hồ sơ thú cưng
              </Text>
              <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                Quản lý chi tiết
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Section 3: Today's Care Reminders Checklist */}
        <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.lg }}>
          <View style={styles.sectionHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[typo.titleMedium, { color: colors.text }]}>
                Lịch chăm sóc hôm nay
              </Text>
              {activePet && (
                <View
                  style={{
                    backgroundColor: colors.primaryContainer,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 12,
                  }}
                >
                  <Text style={[typo.labelSmall, { color: colors.primary, fontWeight: '700' }]}>
                    {activePet.name}
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsCareModalOpen(true);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.primary,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: radius.full,
                gap: 4,
              }}
            >
              <MaterialCommunityIcons name="plus" size={16} color={colors.onPrimary} />
              <Text style={[typo.labelSmall, { color: colors.onPrimary, fontWeight: '700' }]}>
                Lên lịch
              </Text>
            </Pressable>
          </View>

          {isCareLoading && reminders.length === 0 ? (
            <View
              style={[
                styles.remindersCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                  padding: spacing.xl,
                  marginTop: spacing.xs,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
              ]}
            >
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                Đang tải lịch chăm sóc...
              </Text>
            </View>
          ) : reminders.length === 0 ? (
            /* Empty State with Suggestions */
            <View
              style={[
                styles.remindersCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                  padding: spacing.md,
                  marginTop: spacing.xs,
                },
              ]}
            >
              <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: colors.surfaceElevated,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: spacing.xs,
                  }}
                >
                  <MaterialCommunityIcons name="calendar-clock-outline" size={28} color={colors.primary} />
                </View>
                <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '700', textAlign: 'center' }]}>
                  Chưa có lịch chăm sóc hôm nay
                </Text>
                <Text
                  style={[
                    typo.bodySmall,
                    { color: colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: spacing.sm },
                  ]}
                >
                  Chọn gợi ý chuẩn chuyên gia cho {activePet ? `bé ${activePet.name}` : 'thú cưng'} hoặc tự tạo lịch mới:
                </Text>
              </View>

              {/* Suggested 1-tap list */}
              <View style={{ marginTop: spacing.xs, gap: 8 }}>
                {suggestedItems.slice(0, 4).map((sug) => {
                  const color = CATEGORY_COLORS[sug.category] || colors.primary;
                  return (
                    <Pressable
                      key={sug.id}
                      onPress={() => {
                        if (!activePet) return;
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        void addQuickSuggestion(activePet.id, sug);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: radius.lg,
                        paddingHorizontal: spacing.sm,
                        paddingVertical: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: color + '20',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: spacing.sm,
                        }}
                      >
                        <MaterialCommunityIcons name={sug.icon as any} size={18} color={color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[typo.labelMedium, { color: colors.text }]} numberOfLines={1}>
                          {sug.title}
                        </Text>
                        <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>
                          {sug.time} • {sug.description}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: colors.primaryContainer,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: radius.full,
                          gap: 2,
                        }}
                      >
                        <MaterialCommunityIcons name="plus" size={12} color={colors.primary} />
                        <Text style={[typo.labelSmall, { color: colors.primary, fontWeight: '700' }]}>
                          Thêm
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsCareModalOpen(true);
                }}
                style={{
                  marginTop: spacing.md,
                  paddingVertical: 10,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  borderStyle: 'dashed',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={[typo.labelMedium, { color: colors.primary, fontWeight: '700' }]}>
                  + Tự tạo lịch chăm sóc mới
                </Text>
              </Pressable>
            </View>
          ) : (
            /* Reminder List with Progress Bar */
            <View
              style={[
                styles.remindersCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderRadius: radius.xl,
                  padding: spacing.md,
                  marginTop: spacing.xs,
                },
              ]}
            >
              {/* Progress Bar & Counter */}
              <View style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>
                    Tiến độ hoàn thành
                  </Text>
                  <Text style={[typo.labelSmall, { color: colors.primary, fontWeight: '700' }]}>
                    {completedCount}/{reminders.length} ({Math.round((completedCount / reminders.length) * 100)}%)
                  </Text>
                </View>
                <View
                  style={{
                    height: 6,
                    backgroundColor: colors.surfaceElevated,
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      width: `${reminders.length > 0 ? (completedCount / reminders.length) * 100 : 0}%`,
                      backgroundColor: completedCount === reminders.length ? colors.success : colors.primary,
                      borderRadius: 3,
                    }}
                  />
                </View>
              </View>

              {/* Item List */}
              {reminders.map((item, idx) => {
                const itemColor = CATEGORY_COLORS[item.category] || colors.primary;
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.reminderRow,
                      {
                        borderBottomColor: colors.border,
                        borderBottomWidth: idx < reminders.length - 1 ? 1 : 0,
                        paddingVertical: spacing.smd,
                      },
                    ]}
                  >
                    <Pressable
                      onPress={() => handleToggleReminder(item.id)}
                      style={styles.reminderLeft}
                    >
                      <View
                        style={[
                          styles.reminderIconBox,
                          { backgroundColor: itemColor + '20' },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={(item.icon as any) || 'clock-check-outline'}
                          size={20}
                          color={itemColor}
                        />
                      </View>
                      <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                        <Text
                          style={[
                            typo.bodyMedium,
                            {
                              color: item.isDone ? colors.textTertiary : colors.text,
                              textDecorationLine: item.isDone ? 'line-through' : 'none',
                              fontWeight: item.isDone ? '400' : '600',
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <MaterialCommunityIcons name="clock-outline" size={12} color={colors.textSecondary} />
                          <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                            {item.time}
                          </Text>
                        </View>
                      </View>
                    </Pressable>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Pressable
                        onPress={() => handleToggleReminder(item.id)}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons
                          name={item.isDone ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                          size={24}
                          color={item.isDone ? colors.success : colors.textTertiary}
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => handleDeleteReminder(item.id, item.title)}
                        hitSlop={8}
                      >
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={18}
                          color={colors.textTertiary}
                        />
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              {/* Quick Add Suggestions Strip below list */}
              {remainingSuggestions.length > 0 && activePet && (
                <View style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopColor: colors.border, borderTopWidth: 1 }}>
                  <Text style={[typo.labelSmall, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                    💡 Gợi ý thêm cho bé {activePet.name}:
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {remainingSuggestions.slice(0, 4).map((sug) => {
                      const color = CATEGORY_COLORS[sug.category] || colors.primary;
                      return (
                        <Pressable
                          key={sug.id}
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            void addQuickSuggestion(activePet.id, sug);
                          }}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: colors.surfaceElevated,
                            borderColor: colors.border,
                            borderWidth: 1,
                            borderRadius: radius.full,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            gap: 6,
                          }}
                        >
                          <MaterialCommunityIcons name={sug.icon as any} size={14} color={color} />
                          <Text style={[typo.labelSmall, { color: colors.text }]}>
                            +{sug.title} ({sug.time})
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Section 4: Daily AI Pet Care Tip */}
        <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.lg }}>
          <View
            style={[
              styles.tipCard,
              {
                backgroundColor: colors.primaryContainer,
                borderColor: colors.primary,
                borderRadius: radius.xl,
                padding: spacing.md,
              },
            ]}
          >
            <View style={styles.tipHeader}>
              <MaterialCommunityIcons
                name="lightbulb-on"
                size={22}
                color={colors.primary}
              />
              <Text
                style={[
                  typo.labelLarge,
                  { color: colors.primary, marginLeft: spacing.xs, fontWeight: '700' },
                ]}
              >
                Mẹo chăm sóc từ AI hôm nay
              </Text>
            </View>
            <Text
              style={[
                typo.bodySmall,
                { color: colors.text, marginTop: spacing.xs, lineHeight: 20 },
              ]}
            >
              {selectedPet ? (
                <>
                  Đối với bé <Text style={{ fontWeight: '700' }}>{selectedPet.name}</Text> ({selectedPet.breedName || 'Thú cưng'}), hãy duy trì khẩu phần ăn đều đặn theo cân nặng {selectedPet.weightKg} kg và cho uống đủ nước mỗi ngày để phòng tránh sỏi thận.
                </>
              ) : (
                'Hãy thêm thú cưng đầu tiên của bạn vào hệ thống để AI đưa ra lời khuyên dinh dưỡng và theo dõi sức khỏe chuyên biệt nhất!'
              )}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Add Pet Modal */}
      <AddPetModal
        visible={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Add Care Schedule Modal */}
      <AddCareScheduleModal
        visible={isCareModalOpen}
        pet={activePet}
        onClose={() => setIsCareModalOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  petCard: {
    width: 156,
    borderWidth: 1.5,
  },
  petCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  petAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  petStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  addPetCard: {
    width: 130,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPetIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: '48%',
    padding: 14,
    borderWidth: 1,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  remindersCard: {
    borderWidth: 1,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  reminderIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipCard: {
    borderWidth: 1,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertBanner: {
    borderWidth: 1,
  },
  alertIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
