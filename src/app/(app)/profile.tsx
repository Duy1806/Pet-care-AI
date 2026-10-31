/**
 * PawCare AI — Profile Screen (Hồ sơ)
 *
 * Features:
 * - User Profile Card (Name, Email, Role badge, Avatar)
 * - My Pets management (Milo, Luna + Add pet)
 * - App settings & Preferences (Theme toggle, SQLite offline status)
 * - Dev Test Lab shortcut (Offline-first test runner)
 * - Logout button with haptics
 */
import React, { useCallback, useState } from 'react';
import {
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
import { useAuthStore } from '@/presentation/stores/useAuthStore';
import { usePetStore } from '@/presentation/stores/usePetStore';
import { ThemeToggle } from '@/presentation/components/ThemeToggle';
import { PrimaryButton } from '@/presentation/components/PrimaryButton';
import { AddPetModal } from '@/presentation/components/AddPetModal';

export default function ProfileScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, logout, isLoading } = useAuthStore();
  const { pets, deletePet } = usePetStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const handleDeletePet = (petId: string, petName: string) => {
    Alert.alert(
      'Xóa thú cưng',
      `Bạn có chắc chắn muốn xóa hồ sơ của bé ${petName}? Dữ liệu sẽ bị xóa khỏi cơ sở dữ liệu.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            void deletePet(petId);
          },
        },
      ],
    );
  };

  const handleLogout = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi PawCare AI?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: () => {
            void logout();
          },
        },
      ],
    );
  }, [logout]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
          },
        ]}
      >
        <Text style={[typo.headlineMedium, { color: colors.text }]}>
          Hồ sơ cá nhân
        </Text>
        <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
          Quản lý tài khoản, thú cưng và cài đặt hệ thống
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + spacing.xxl,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
        }}
      >
        {/* User Profile Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.xl,
              padding: spacing.md,
            },
          ]}
        >
          <View style={styles.userRow}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <MaterialCommunityIcons
                name="account"
                size={36}
                color={colors.primary}
              />
            </View>

            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <Text style={[typo.titleLarge, { color: colors.text }]}>
                {user?.fullName || 'Chủ nuôi thú cưng'}
              </Text>
              <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                {user?.email || 'email@example.com'}
              </Text>

              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: colors.primary + '15', marginTop: spacing.xs },
                ]}
              >
                <MaterialCommunityIcons
                  name="shield-check"
                  size={14}
                  color={colors.primary}
                />
                <Text
                  style={[
                    typo.labelSmall,
                    { color: colors.primary, fontWeight: '700', marginLeft: 4 },
                  ]}
                >
                  {user?.role === 'admin' ? 'Quản trị viên' : 'Chủ nuôi tiêu chuẩn'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* My Pets Section */}
        <View style={{ marginTop: spacing.lg }}>
          <View style={styles.sectionHeader}>
            <Text style={[typo.titleMedium, { color: colors.text }]}>
              Thú cưng đang quản lý ({pets.length})
            </Text>
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsAddModalOpen(true);
              }}
              hitSlop={8}
            >
              <Text style={[typo.labelMedium, { color: colors.primary }]}>
                + Thêm mới
              </Text>
            </Pressable>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl, marginTop: spacing.xs }]}>
            {pets.length > 0 ? (
              pets.map((pet, idx) => (
                <View
                  key={pet.id}
                  style={[
                    styles.petRow,
                    {
                      borderBottomColor: colors.border,
                      borderBottomWidth: idx < pets.length - 1 ? 1 : 0,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.petIconBox,
                      { backgroundColor: pet.species === 'dog' ? '#FFE0B2' : '#E1BEE7' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={pet.species === 'dog' ? 'dog' : 'cat'}
                      size={24}
                      color="#4E342E"
                    />
                  </View>
                  <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                    <Text style={[typo.titleMedium, { color: colors.text }]}>
                      {pet.name}
                    </Text>
                    <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                      {pet.breedName || (pet.species === 'dog' ? 'Chó' : 'Mèo')} • {pet.weightKg} kg
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleDeletePet(pet.id, pet.name)}
                    hitSlop={8}
                    style={{ padding: 4 }}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} />
                  </Pressable>
                </View>
              ))
            ) : (
              <View style={{ padding: spacing.lg, alignItems: 'center' }}>
                <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                  Chưa có thú cưng nào trong cơ sở dữ liệu.
                </Text>
                <Pressable
                  onPress={() => setIsAddModalOpen(true)}
                  style={{ marginTop: spacing.xs }}
                >
                  <Text style={[typo.labelMedium, { color: colors.primary, fontWeight: '700' }]}>
                    Nhấn vào đây để thêm bé đầu tiên
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        {/* App Settings */}
        <View style={{ marginTop: spacing.lg }}>
          <Text style={[typo.titleMedium, { color: colors.text, marginBottom: spacing.xs }]}>
            Cài đặt & Tiện ích
          </Text>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl }]}>
            {/* Setting 1: Theme */}
            <View style={[styles.settingRow, { borderBottomColor: colors.border, borderBottomWidth: 1, padding: spacing.md }]}>
              <View style={styles.settingLeft}>
                <MaterialCommunityIcons name="theme-light-dark" size={22} color={colors.primary} />
                <View style={{ marginLeft: spacing.sm }}>
                  <Text style={[typo.labelLarge, { color: colors.text }]}>Giao diện (Sáng / Tối)</Text>
                  <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>Tùy chỉnh màu nền ứng dụng</Text>
                </View>
              </View>
              <ThemeToggle />
            </View>

            {/* Setting 2: Offline SQLite Sync */}
            <View style={[styles.settingRow, { borderBottomColor: colors.border, borderBottomWidth: 1, padding: spacing.md }]}>
              <View style={styles.settingLeft}>
                <MaterialCommunityIcons name="database-sync-outline" size={22} color="#16A34A" />
                <View style={{ marginLeft: spacing.sm }}>
                  <Text style={[typo.labelLarge, { color: colors.text }]}>Đồng bộ Offline (SQLite)</Text>
                  <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>Dữ liệu sẵn sàng ngoại tuyến</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[typo.labelSmall, { color: '#16A34A', fontWeight: '700' }]}>Hoạt động</Text>
              </View>
            </View>

            {/* Setting 2.5: Sổ tiêm chủng */}
            <Pressable
              onPress={() => router.push('/add-vaccination' as any)}
              style={[styles.settingRow, { borderBottomColor: colors.border, borderBottomWidth: 1, padding: spacing.md }]}
            >
              <View style={styles.settingLeft}>
                <MaterialCommunityIcons name="needle" size={22} color="#0284C7" />
                <View style={{ marginLeft: spacing.sm }}>
                  <Text style={[typo.labelLarge, { color: colors.text }]}>Sổ tiêm chủng & Phòng bệnh</Text>
                  <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>Lịch sử tiêm vắc-xin, tẩy giun & ve rận</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
            </Pressable>

            {/* Setting 3: Dev Test Lab */}
            <Pressable
              onPress={() => router.push('/(app)/dev-test' as any)}
              style={[styles.settingRow, { padding: spacing.md }]}
            >
              <View style={styles.settingLeft}>
                <MaterialCommunityIcons name="wrench-outline" size={22} color="#D97706" />
                <View style={{ marginLeft: spacing.sm }}>
                  <Text style={[typo.labelLarge, { color: colors.text }]}>Phòng thử nghiệm Dev Lab</Text>
                  <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>Kiểm tra đồng bộ SQLite & Supabase</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
            </Pressable>
          </View>
        </View>

        {/* App Info Footer */}
        <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
          <Text style={[typo.labelSmall, { color: colors.textTertiary }]}>
            PawCare AI — Capstone Project v1.0.0
          </Text>
          <Text style={[typo.bodySmall, { color: colors.textTertiary, marginTop: 2 }]}>
            Phát triển ứng dụng di động đa nền tảng (VKU)
          </Text>
        </View>

        {/* Logout Button */}
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton
            title="Đăng xuất"
            variant="outline"
            onPress={handleLogout}
            loading={isLoading}
          />
        </View>
      </ScrollView>

      <AddPetModal
        visible={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {},
  card: {
    borderWidth: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  petIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
});

