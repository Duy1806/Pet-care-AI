/**
 * PawCare AI — Dev Test Screen (Offline-First & Sync Engine Lab)
 *
 * Demonstrates:
 * 1. Simulating Offline / Airplane mode toggle
 * 2. Creating pets offline (instant local write + pending_create badge)
 * 3. Adding weight logs offline (+0.5 kg)
 * 4. Watching pendingCount increment in real-time
 * 5. Reconnecting and watching changes automatically push & mark 'synced'
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/presentation/components/GlassCard';
import { PrimaryButton } from '@/presentation/components/PrimaryButton';
import { NetworkBanner } from '@/presentation/components/NetworkBanner';
import { useAppTheme } from '@/presentation/theme';
import { useAuthStore } from '@/presentation/stores/useAuthStore';
import { useSyncStore } from '@/presentation/stores/useSyncStore';
import { getDatabase } from '@/data/local/database';
import { PetDao, type LocalPet } from '@/data/local/PetDao';
import { WeightLogDao, type LocalWeightLog } from '@/data/local/WeightLogDao';
import { calculateNutrition } from '@/domain/services/NutritionCalculator';

export default function DevTestScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const {
    isOnline,
    isSimulatedOffline,
    isSyncing,
    pendingCount,
    lastSyncedAt,
    lastError,
    toggleSimulatedOffline,
    syncNow,
    refreshPendingCount,
  } = useSyncStore();

  const [pets, setPets] = useState<LocalPet[]>([]);
  const [selectedPet, setSelectedPet] = useState<LocalPet | null>(null);
  const [weightLogs, setWeightLogs] = useState<LocalWeightLog[]>([]);
  const [nutritionPreview, setNutritionPreview] = useState<string | null>(null);

  const ownerId = user?.id || 'mock-user-001';

  // Load pets from SQLite on mount
  useEffect(() => {
    let active = true;
    const fetchInitialData = async () => {
      try {
        const db = await getDatabase();
        const petDao = new PetDao(db);
        const list = await petDao.getAll(ownerId);
        if (active) {
          setPets(list);
          if (list.length > 0) {
            setSelectedPet((prev) => prev ?? list[0]);
          }
        }
        await refreshPendingCount();
      } catch {
        // ignore
      }
    };
    void fetchInitialData();
    return () => {
      active = false;
    };
  }, [ownerId, refreshPendingCount]);

  const loadLocalData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const petDao = new PetDao(db);
      const list = await petDao.getAll(ownerId);
      setPets(list);
      await refreshPendingCount();
    } catch {
      // ignore
    }
  }, [ownerId, refreshPendingCount]);

  // Load weight logs when selected pet changes
  useEffect(() => {
    if (!selectedPet) return;
    const fetchLogs = async () => {
      try {
        const db = await getDatabase();
        const weightDao = new WeightLogDao(db);
        const logs = await weightDao.getByPetId(selectedPet.id);
        setWeightLogs(logs);

        // Preview RER/MER calculation
        const nut = calculateNutrition({
          species: selectedPet.species === 'cat' ? 'cat' : 'dog',
          weightKg: selectedPet.current_weight_kg || 5,
          lifeStage: 'adult',
          isNeutered: selectedPet.is_neutered === 1,
          activityLevel: (selectedPet.activity_level as any) || 'moderate',
        });
        setNutritionPreview(`${nut.merKcal} kcal/ngày (RER: ${nut.rerKcal} kcal, hệ số: ${nut.activityFactor}x)`);
      } catch {
        // ignore
      }
    };
    void fetchLogs();
  }, [selectedPet]);

  // Action 1: Create a pet offline
  const handleCreatePet = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const db = await getDatabase();
    const petDao = new PetDao(db);

    const breedsSample = ['Corgi Chân Ngắn', 'Mèo Anh Lông Ngắn', 'Poodle Toy', 'Husky Bắc Cực'];
    const randomBreed = breedsSample[Math.floor(Math.random() * breedsSample.length)];
    const isCat = randomBreed.includes('Mèo');

    await petDao.create(ownerId, {
      name: `${isCat ? 'Mèo' : 'Cún'} #${Math.floor(Math.random() * 900) + 100}`,
      species: isCat ? 'cat' : 'dog',
      breed_name_custom: randomBreed,
      current_weight_kg: isCat ? 4.2 : 11.5,
      is_neutered: true,
      activity_level: 'moderate',
      notes: 'Tạo từ Dev Test Lab',
    });

    await loadLocalData();
  }, [ownerId, loadLocalData]);

  // Action 2: Add weight log
  const handleAddWeight = useCallback(async () => {
    if (!selectedPet) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const db = await getDatabase();
    const weightDao = new WeightLogDao(db);

    const newWeight = Math.round(((selectedPet.current_weight_kg || 5) + 0.5) * 10) / 10;
    await weightDao.add(selectedPet.id, newWeight, `Cân định kỳ: ${newWeight} kg`);

    await loadLocalData();
    // Update selected pet weight in state
    setSelectedPet((prev) => (prev ? { ...prev, current_weight_kg: newWeight } : null));
  }, [selectedPet, loadLocalData]);

  // Action 3: Trigger manual sync
  const handleSync = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await syncNow();
    await loadLocalData();
  }, [syncNow, loadLocalData]);

  const getStatusBadge = (status: LocalPet['sync_status']) => {
    switch (status) {
      case 'synced':
        return { label: 'Đã đồng bộ', color: colors.success };
      case 'pending_create':
        return { label: 'Chờ tạo', color: colors.warning };
      case 'pending_update':
        return { label: 'Chờ cập nhật', color: colors.primary };
      case 'pending_delete':
        return { label: 'Chờ xóa', color: colors.error };
      case 'conflict':
        return { label: 'Xung đột', color: colors.error };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <NetworkBanner />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </Pressable>
        <Text style={[typo.titleLarge, { color: colors.text, marginLeft: spacing.md }]}>
          🛠️ Dev Test Lab (Offline-First)
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Airplane Mode Toggle */}
        <GlassCard style={{ marginTop: spacing.sm, marginBottom: spacing.md }}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[typo.titleMedium, { color: colors.text }]}>
                Chế độ máy bay (Mô phỏng Offline)
              </Text>
              <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                {isSimulatedOffline
                  ? 'Đang ngắt kết nối Internet để thử nghiệm ghi offline'
                  : 'Đang kết nối bình thường'}
              </Text>
            </View>
            <Switch
              value={isSimulatedOffline}
              onValueChange={toggleSimulatedOffline}
              trackColor={{ false: colors.border, true: colors.warning }}
              thumbColor={isSimulatedOffline ? '#FFFFFF' : colors.textTertiary}
            />
          </View>
        </GlassCard>

        {/* Live Status Indicators */}
        <View style={[styles.gridRow, { gap: spacing.sm, marginBottom: spacing.md }]}>
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
              },
            ]}
          >
            <Text style={[typo.caption, { color: colors.textSecondary }]}>MẠNG</Text>
            <Text
              style={[
                typo.titleMedium,
                { color: isOnline ? colors.success : colors.warning, marginTop: 4 },
              ]}
            >
              {isOnline ? '🟢 Online' : '🟠 Offline'}
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.md,
                padding: spacing.md,
              },
            ]}
          >
            <Text style={[typo.caption, { color: colors.textSecondary }]}>CHỜ ĐỒNG BỘ</Text>
            <Text
              style={[
                typo.headlineMedium,
                { color: pendingCount > 0 ? colors.warning : colors.text, marginTop: 4 },
              ]}
            >
              {pendingCount} thay đổi
            </Text>
          </View>
        </View>

        {/* Sync Controls */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
          <PrimaryButton
            title={isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
            onPress={handleSync}
            loading={isSyncing}
            disabled={!isOnline}
            style={{ flex: 1 }}
          />
        </View>

        {lastError ? (
          <Text style={[typo.caption, { color: colors.error, marginBottom: spacing.md }]}>
            Lỗi đồng bộ gần nhất: {lastError}
          </Text>
        ) : lastSyncedAt ? (
          <Text style={[typo.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Đã đồng bộ lúc: {lastSyncedAt}
          </Text>
        ) : null}

        {/* Pet Creation & List */}
        <View style={[styles.sectionHeader, { marginBottom: spacing.sm }]}>
          <Text style={[typo.headlineSmall, { color: colors.text }]}>
            Thú cưng trong SQLite ({pets.length})
          </Text>
          <Pressable onPress={handleCreatePet} style={styles.addBtn}>
            <MaterialCommunityIcons name="plus-circle" size={20} color={colors.primary} />
            <Text style={[typo.labelMedium, { color: colors.primary, marginLeft: 4 }]}>
              Thêm Offline
            </Text>
          </Pressable>
        </View>

        {pets.length === 0 ? (
          <GlassCard style={{ padding: spacing.lg, alignItems: 'center' }}>
            <Text style={[typo.bodyMedium, { color: colors.textSecondary }]}>
              Chưa có thú cưng nào. Nhấn &ldquo;Thêm Offline&rdquo; để kiểm tra tính năng lưu trên máy!
            </Text>
          </GlassCard>
        ) : (
          <FlatList
            data={pets}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const badge = getStatusBadge(item.sync_status);
              const isSelected = selectedPet?.id === item.id;
              return (
                <Pressable
                  onPress={() => setSelectedPet(item)}
                  style={[
                    styles.petItem,
                    {
                      backgroundColor: isSelected ? colors.primaryContainer : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typo.titleMedium, { color: colors.text }]}>
                      {item.name} ({item.species === 'cat' ? '🐱 Mèo' : '🐶 Chó'})
                    </Text>
                    <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                      {item.breed_name_custom || 'Chưa rõ giống'} • Cân nặng: {item.current_weight_kg || 0} kg
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: badge.color + '20',
                        borderColor: badge.color,
                        borderRadius: radius.full,
                      },
                    ]}
                  >
                    <Text style={[typo.caption, { color: badge.color, fontWeight: '700' }]}>
                      {badge.label}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        {/* Selected Pet Detail: Weight Logs & Nutrition Calculation */}
        {selectedPet && (
          <View style={{ marginTop: spacing.md }}>
            <GlassCard style={{ marginBottom: spacing.md }}>
              <Text style={[typo.titleLarge, { color: colors.text, marginBottom: spacing.xs }]}>
                Dinh dưỡng tự động: {selectedPet.name}
              </Text>
              <Text style={[typo.bodySmall, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                Tính toán theo công thức WSAVA RER:
              </Text>
              <Text style={[typo.labelLarge, { color: colors.primary }]}>
                {nutritionPreview}
              </Text>
            </GlassCard>

            <View style={[styles.sectionHeader, { marginBottom: spacing.sm }]}>
              <Text style={[typo.titleMedium, { color: colors.text }]}>
                Nhật ký cân nặng ({weightLogs.length})
              </Text>
              <Pressable onPress={handleAddWeight} style={styles.addBtn}>
                <MaterialCommunityIcons name="scale-bathroom" size={18} color={colors.primary} />
                <Text style={[typo.labelMedium, { color: colors.primary, marginLeft: 4 }]}>
                  Ghi +0.5 kg
                </Text>
              </Pressable>
            </View>

            {weightLogs.slice(-3).map((w) => (
              <View
                key={w.id}
                style={[
                  styles.weightRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderRadius: radius.sm,
                    padding: spacing.smd,
                    marginBottom: spacing.xs,
                  },
                ]}
              >
                <Text style={[typo.bodyMedium, { color: colors.text }]}>
                  {w.weight_kg} kg
                </Text>
                <Text style={[typo.caption, { color: colors.textSecondary }]}>
                  {w.sync_status === 'synced' ? 'Đã đồng bộ' : 'Chờ đẩy lên'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gridRow: {
    flexDirection: 'row',
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
  },
  petItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  weightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  },
});
