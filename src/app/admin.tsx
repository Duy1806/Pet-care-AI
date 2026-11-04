/**
 * PawCare AI — Admin Portal (Trung tâm Quản trị & Điều hành Hệ thống)
 *
 * Professional administrative dashboard for platform operations:
 * - 📊 Overview & System KPIs (Users, Pets, Dogs vs Cats ratio, Overdue vaccines)
 * - 👥 User & Owner Management (List, search, inspect pet counts, toggle admin privileges)
 * - 🐾 Master Pet Registry (All pets in system, health metrics, weight, neutered status, owner contacts)
 * - 💉 Vaccination & Preventive Hub (Immunization schedule, overdue/upcoming medical alerts)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '@/presentation/theme';
import { useAuthStore } from '@/presentation/stores/useAuthStore';
import {
  adminRepo,
  type AdminPetItem,
  type AdminStats,
  type AdminUserItem,
  type AdminVaccinationItem,
} from '@/data/repositories/AdminRepository';

type AdminTab = 'overview' | 'users' | 'pets' | 'vaccinations';

export default function AdminScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Data states
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalPets: 0,
    dogCount: 0,
    catCount: 0,
    totalVaccinations: 0,
    overdueVaccinations: 0,
    upcomingVaccinations: 0,
  });
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [petsList, setPetsList] = useState<AdminPetItem[]>([]);
  const [vaccinationsList, setVaccinationsList] = useState<AdminVaccinationItem[]>([]);

  // Search & filter states
  const [searchUserText, setSearchUserText] = useState('');
  const [searchPetText, setSearchPetText] = useState('');
  const [petSpeciesFilter, setPetSpeciesFilter] = useState<'all' | 'dog' | 'cat'>('all');
  const [vaccineStatusFilter, setVaccineStatusFilter] = useState<'all' | 'overdue' | 'upcoming' | 'completed'>('all');

  // Load all admin data
  const loadAdminData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [newStats, users, pets, vaccs] = await Promise.all([
        adminRepo.getStats(),
        adminRepo.getAllUsers(),
        adminRepo.getAllPets(),
        adminRepo.getAllVaccinations(),
      ]);

      setStats(newStats);
      setUsersList(users);
      setPetsList(pets);
      setVaccinationsList(vaccs);
    } catch (e) {
      console.warn('[AdminScreen] load error:', e);
    } finally {
      setIsLoadingData(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void loadAdminData();
  };

  // Toggle user role
  const handleToggleUserRole = (targetUser: AdminUserItem) => {
    const nextRole = targetUser.role === 'admin' ? 'owner' : 'admin';
    const roleLabel = nextRole === 'admin' ? 'Quản trị viên (Admin)' : 'Chủ nuôi tiêu chuẩn (Owner)';

    Alert.alert(
      'Thay đổi vai trò',
      `Bạn có chắc chắn muốn chuyển vai trò của "${targetUser.fullName}" thành ${roleLabel}?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xác nhận',
          onPress: async () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            const ok = await adminRepo.updateUserRole(targetUser.id, nextRole);
            if (ok) {
              setUsersList((prev) =>
                prev.map((u) => (u.id === targetUser.id ? { ...u, role: nextRole } : u))
              );
              Alert.alert('Thành công', `Đã cập nhật vai trò của ${targetUser.fullName}`);
            } else {
              Alert.alert('Lỗi', 'Không thể cập nhật vai trò tài khoản.');
            }
          },
        },
      ]
    );
  };

  const handleAdminLogout = () => {
    Alert.alert(
      'Đăng xuất Quản trị viên',
      'Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc Quản trị viên không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await logout();
            router.replace('/(auth)/welcome' as any);
          },
        },
      ]
    );
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    const q = searchUserText.toLowerCase().trim();
    if (!q) return usersList;
    return usersList.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.includes(q)
    );
  }, [usersList, searchUserText]);

  // Filtered pets
  const filteredPets = useMemo(() => {
    let list = petsList;
    if (petSpeciesFilter !== 'all') {
      list = list.filter((p) => p.species === petSpeciesFilter);
    }
    const q = searchPetText.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.breedName.toLowerCase().includes(q) ||
        p.ownerName.toLowerCase().includes(q) ||
        p.ownerPhone.includes(q)
    );
  }, [petsList, petSpeciesFilter, searchPetText]);

  // Filtered vaccinations
  const filteredVaccinations = useMemo(() => {
    let list = vaccinationsList;
    if (vaccineStatusFilter !== 'all') {
      list = list.filter((v) => v.status === vaccineStatusFilter);
    }
    return list;
  }, [vaccinationsList, vaccineStatusFilter]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      {/* Top Admin Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.adminHeaderIconCircle, { backgroundColor: '#FEF3C7' }]}>
          <MaterialCommunityIcons name="shield-crown" size={22} color="#D97706" />
        </View>

        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[typo.titleMedium, { color: colors.text, fontWeight: '800' }]}>
              Admin Portal
            </Text>
            <View style={styles.verifiedBadge}>
              <Text style={{ fontSize: 9, color: '#16A34A', fontWeight: '800' }}>
                RLS Cloud
              </Text>
            </View>
          </View>
          <Text style={[typo.caption, { color: colors.textSecondary }]} numberOfLines={1}>
            {user?.fullName ? `Quản trị viên: ${user.fullName}` : 'Hệ thống Quản trị & Vận hành PawCare AI'}
          </Text>
        </View>

        {/* Action Buttons: Làm mới & Đăng xuất */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={onRefresh}
            hitSlop={6}
            style={[styles.backBtn, { backgroundColor: colors.surfaceElevated }]}
          >
            <MaterialCommunityIcons name="refresh" size={18} color={colors.primary} />
          </Pressable>

          <Pressable
            onPress={handleAdminLogout}
            hitSlop={6}
            style={[styles.logoutBtn, { backgroundColor: colors.errorContainer }]}
          >
            <MaterialCommunityIcons name="logout" size={16} color={colors.error} />
            <Text style={[typo.labelSmall, { color: colors.error, fontWeight: '700', marginLeft: 4 }]}>
              Đăng xuất
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 4 Tabs Selector */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {[
            { key: 'overview', label: 'Tổng quan', icon: 'view-dashboard-outline' },
            { key: 'users', label: `Người dùng (${usersList.length})`, icon: 'account-group-outline' },
            { key: 'pets', label: `Thú cưng (${petsList.length})`, icon: 'paw-outline' },
            { key: 'vaccinations', label: `Sổ tiêm (${vaccinationsList.length})`, icon: 'needle' },
          ].map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setActiveTab(tab.key as AdminTab);
                }}
                style={[
                  styles.tabChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={tab.icon as any}
                  size={16}
                  color={isSelected ? '#FFFFFF' : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    typo.labelMedium,
                    { color: isSelected ? '#FFFFFF' : colors.text, fontWeight: isSelected ? '700' : '500' },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {isLoadingData ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 12 }]}>
            Đang tải dữ liệu vận hành hệ thống...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 40 }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {/* TAB 1: OVERVIEW & SYSTEM KPIS */}
          {activeTab === 'overview' && (
            <View style={{ gap: spacing.md }}>
              {/* Primary KPI Grid */}
              <View style={styles.kpiGrid}>
                {/* Total Users */}
                <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.kpiIconWrapper, { backgroundColor: '#DBEAFE' }]}>
                    <MaterialCommunityIcons name="account-group" size={24} color="#1D4ED8" />
                  </View>
                  <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '800', marginTop: 8 }]}>
                    {stats.totalUsers}
                  </Text>
                  <Text style={[typo.caption, { color: colors.textSecondary }]}>Chủ nuôi đã đăng ký</Text>
                </View>

                {/* Total Pets */}
                <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.kpiIconWrapper, { backgroundColor: '#DCFCE7' }]}>
                    <MaterialCommunityIcons name="paw" size={24} color="#15803D" />
                  </View>
                  <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '800', marginTop: 8 }]}>
                    {stats.totalPets}
                  </Text>
                  <Text style={[typo.caption, { color: colors.textSecondary }]}>Thú cưng trong hệ thống</Text>
                </View>

                {/* Total Vaccinations */}
                <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.kpiIconWrapper, { backgroundColor: '#E0E7FF' }]}>
                    <MaterialCommunityIcons name="needle" size={24} color="#4338CA" />
                  </View>
                  <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '800', marginTop: 8 }]}>
                    {stats.totalVaccinations}
                  </Text>
                  <Text style={[typo.caption, { color: colors.textSecondary }]}>Hồ sơ tiêm phòng</Text>
                </View>

                {/* Overdue Vaccine Alerts */}
                <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.kpiIconWrapper, { backgroundColor: '#FEE2E2' }]}>
                    <MaterialCommunityIcons name="alert-decagram" size={24} color="#B91C1C" />
                  </View>
                  <Text style={[typo.titleLarge, { color: '#B91C1C', fontWeight: '800', marginTop: 8 }]}>
                    {stats.overdueVaccinations}
                  </Text>
                  <Text style={[typo.caption, { color: colors.textSecondary }]}>Mũi tiêm quá hạn</Text>
                </View>
              </View>

              {/* Pet Ratio Card */}
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="chart-pie" size={20} color={colors.primary} />
                  <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '700', marginLeft: 8 }]}>
                    Cơ cấu Thú cưng Hệ thống
                  </Text>
                </View>

                <View style={{ marginTop: 12 }}>
                  <View style={styles.ratioBarContainer}>
                    <View
                      style={[
                        styles.ratioSegment,
                        {
                          backgroundColor: '#3B82F6',
                          flex: Math.max(stats.dogCount, 0.1),
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.ratioSegment,
                        {
                          backgroundColor: '#EC4899',
                          flex: Math.max(stats.catCount, 0.1),
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.ratioLegend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
                      <Text style={[typo.bodySmall, { color: colors.text }]}>
                        Chó: <Text style={{ fontWeight: '700' }}>{stats.dogCount}</Text> ({stats.totalPets > 0 ? Math.round((stats.dogCount / stats.totalPets) * 100) : 0}%)
                      </Text>
                    </View>

                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#EC4899' }]} />
                      <Text style={[typo.bodySmall, { color: colors.text }]}>
                        Mèo: <Text style={{ fontWeight: '700' }}>{stats.catCount}</Text> ({stats.totalPets > 0 ? Math.round((stats.catCount / stats.totalPets) * 100) : 0}%)
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Medical Due Summary */}
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="clock-alert-outline" size={20} color="#D97706" />
                  <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '700', marginLeft: 8 }]}>
                    Điều phối Tiêm chủng & Phòng ngừa
                  </Text>
                </View>

                <View style={{ marginTop: 12, gap: 10 }}>
                  <View style={[styles.alertSummaryRow, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                    <MaterialCommunityIcons name="alert-circle" size={20} color="#DC2626" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[typo.labelMedium, { color: '#991B1B', fontWeight: '700' }]}>
                        {stats.overdueVaccinations} mũi tiêm bị trễ hạn
                      </Text>
                      <Text style={[typo.caption, { color: '#B91C1C' }]}>
                        Cần nhắc nhở chủ nuôi đưa bé đi tiêm phòng sớm
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.alertSummaryRow, { backgroundColor: '#FEF9C3', borderColor: '#FDE047' }]}>
                    <MaterialCommunityIcons name="calendar-clock" size={20} color="#CA8A04" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[typo.labelMedium, { color: '#854D0E', fontWeight: '700' }]}>
                        {stats.upcomingVaccinations} mũi tiêm sắp đến hạn (14 ngày tới)
                      </Text>
                      <Text style={[typo.caption, { color: '#A16207' }]}>
                        Đã sẵn sàng trong lịch nhắc nhở tự động
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Infrastructure Status */}
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="server-network" size={20} color={colors.primary} />
                  <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '700', marginLeft: 8 }]}>
                    Trạng thái Hạ tầng & Kết nối
                  </Text>
                </View>

                <View style={{ marginTop: 12, gap: 10 }}>
                  <View style={styles.serviceRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.statusDot, { backgroundColor: '#16A34A' }]} />
                      <Text style={[typo.bodySmall, { color: colors.text, marginLeft: 8 }]}>
                        Supabase PostgreSQL Cloud
                      </Text>
                    </View>
                    <Text style={[typo.labelSmall, { color: '#16A34A', fontWeight: '700' }]}>Trực tuyến</Text>
                  </View>

                  <View style={styles.serviceRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.statusDot, { backgroundColor: '#16A34A' }]} />
                      <Text style={[typo.bodySmall, { color: colors.text, marginLeft: 8 }]}>
                        SQLite Offline Engine (Local)
                      </Text>
                    </View>
                    <Text style={[typo.labelSmall, { color: '#16A34A', fontWeight: '700' }]}>Đồng bộ 100%</Text>
                  </View>

                  <View style={styles.serviceRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.statusDot, { backgroundColor: '#16A34A' }]} />
                      <Text style={[typo.bodySmall, { color: colors.text, marginLeft: 8 }]}>
                        Google Gemini 2.5 Flash API
                      </Text>
                    </View>
                    <Text style={[typo.labelSmall, { color: '#16A34A', fontWeight: '700' }]}>Sẵn sàng</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <View style={{ gap: spacing.md }}>
              <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
                <TextInput
                  value={searchUserText}
                  onChangeText={setSearchUserText}
                  placeholder="Tìm kiếm chủ nuôi theo tên, email, sđt..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.searchInput, typo.bodySmall, { color: colors.text }]}
                />
                {searchUserText.length > 0 && (
                  <Pressable onPress={() => setSearchUserText('')}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={colors.textTertiary} />
                  </Pressable>
                )}
              </View>

              {filteredUsers.length === 0 ? (
                <View style={styles.emptyBox}>
                  <MaterialCommunityIcons name="account-search" size={40} color={colors.textTertiary} />
                  <Text style={[typo.bodyMedium, { color: colors.textTertiary, marginTop: 8 }]}>
                    Không tìm thấy người dùng phù hợp
                  </Text>
                </View>
              ) : (
                filteredUsers.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.userCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.userAvatarWrapper, { backgroundColor: colors.primaryContainer }]}>
                        {item.avatarUrl ? (
                          <Image source={{ uri: item.avatarUrl }} style={styles.userAvatar} />
                        ) : (
                          <MaterialCommunityIcons name="account" size={24} color={colors.primary} />
                        )}
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '700' }]}>
                            {item.fullName}
                          </Text>
                          <View
                            style={[
                              styles.rolePill,
                              { backgroundColor: item.role === 'admin' ? '#FEF08A' : colors.surfaceElevated },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '800',
                                color: item.role === 'admin' ? '#A16207' : colors.textSecondary,
                              }}
                            >
                              {item.role === 'admin' ? '👑 Quản trị viên' : 'Chủ nuôi'}
                            </Text>
                          </View>
                        </View>

                        <Text style={[typo.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                          {item.email} {item.phone ? `• 📞 ${item.phone}` : ''}
                        </Text>
                        <Text style={[typo.caption, { color: colors.primary, marginTop: 2, fontWeight: '600' }]}>
                          🐾 Đang nuôi {item.petCount} bé thú cưng
                        </Text>
                      </View>

                      {/* Role action button */}
                      <Pressable
                        onPress={() => handleToggleUserRole(item)}
                        hitSlop={8}
                        style={[styles.roleActionBtn, { borderColor: colors.border }]}
                      >
                        <MaterialCommunityIcons
                          name={item.role === 'admin' ? 'shield-remove-outline' : 'shield-account-outline'}
                          size={16}
                          color={item.role === 'admin' ? colors.error : colors.primary}
                        />
                        <Text style={[typo.labelSmall, { color: item.role === 'admin' ? colors.error : colors.primary, marginLeft: 4 }]}>
                          {item.role === 'admin' ? 'Hạ quyền' : 'Thăng Admin'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 3: MASTER PET REGISTRY */}
          {activeTab === 'pets' && (
            <View style={{ gap: spacing.md }}>
              {/* Search Bar */}
              <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
                <TextInput
                  value={searchPetText}
                  onChangeText={setSearchPetText}
                  placeholder="Tìm theo tên bé, giống loài, tên chủ nuôi..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.searchInput, typo.bodySmall, { color: colors.text }]}
                />
                {searchPetText.length > 0 && (
                  <Pressable onPress={() => setSearchPetText('')}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={colors.textTertiary} />
                  </Pressable>
                )}
              </View>

              {/* Species filter chips */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[
                  { key: 'all', label: `Tất cả (${petsList.length})` },
                  { key: 'dog', label: `🐕 Chó (${petsList.filter((p) => p.species === 'dog').length})` },
                  { key: 'cat', label: `🐈 Mèo (${petsList.filter((p) => p.species === 'cat').length})` },
                ].map((f) => (
                  <Pressable
                    key={f.key}
                    onPress={() => setPetSpeciesFilter(f.key as any)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: petSpeciesFilter === f.key ? colors.primary : colors.surfaceElevated,
                        borderColor: petSpeciesFilter === f.key ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typo.labelSmall,
                        { color: petSpeciesFilter === f.key ? '#FFFFFF' : colors.text, fontWeight: '700' },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {filteredPets.length === 0 ? (
                <View style={styles.emptyBox}>
                  <MaterialCommunityIcons name="paw-off" size={40} color={colors.textTertiary} />
                  <Text style={[typo.bodyMedium, { color: colors.textTertiary, marginTop: 8 }]}>
                    Không tìm thấy thú cưng nào
                  </Text>
                </View>
              ) : (
                filteredPets.map((pet) => (
                  <View
                    key={pet.id}
                    style={[
                      styles.petCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.petAvatarWrapper, { backgroundColor: pet.species === 'dog' ? '#DBEAFE' : '#FCE7F3' }]}>
                        {pet.photoUrl ? (
                          <Image source={{ uri: pet.photoUrl }} style={styles.petAvatar} />
                        ) : (
                          <MaterialCommunityIcons
                            name={pet.species === 'dog' ? 'dog' : 'cat'}
                            size={26}
                            color={pet.species === 'dog' ? '#1D4ED8' : '#DB2777'}
                          />
                        )}
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '800' }]}>
                              {pet.name}
                            </Text>
                            <Text style={{ marginLeft: 6, fontSize: 13 }}>
                              {pet.sex === 'male' ? '♂️' : pet.sex === 'female' ? '♀️' : '⚪'}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.neuteredBadge,
                              { backgroundColor: pet.isNeutered ? '#DCFCE7' : colors.surfaceElevated },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: '700',
                                color: pet.isNeutered ? '#15803D' : colors.textSecondary,
                              }}
                            >
                              {pet.isNeutered ? '✂️ Đã triệt sản' : 'Chưa triệt sản'}
                            </Text>
                          </View>
                        </View>

                        <Text style={[typo.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                          Giống: <Text style={{ color: colors.text, fontWeight: '600' }}>{pet.breedName}</Text>
                          {pet.weightKg ? ` • ${pet.weightKg} kg` : ''}
                        </Text>

                        {/* Owner Contact info */}
                        <View style={[styles.petOwnerRow, { backgroundColor: colors.surfaceElevated, marginTop: 8 }]}>
                          <MaterialCommunityIcons name="account-heart-outline" size={14} color={colors.primary} />
                          <Text style={[typo.caption, { color: colors.text, marginLeft: 6, flex: 1 }]} numberOfLines={1}>
                            Chủ nuôi: <Text style={{ fontWeight: '700' }}>{pet.ownerName}</Text>
                            {pet.ownerPhone ? ` • 📞 ${pet.ownerPhone}` : ''}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 4: VACCINATION & MEDICAL HUB */}
          {activeTab === 'vaccinations' && (
            <View style={{ gap: spacing.md }}>
              {/* Status filter chips */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { key: 'all', label: `Tất cả (${vaccinationsList.length})` },
                  { key: 'overdue', label: `⚠️ Quá hạn (${stats.overdueVaccinations})`, color: '#DC2626' },
                  { key: 'upcoming', label: `📅 Sắp đến hạn (${stats.upcomingVaccinations})`, color: '#D97706' },
                  { key: 'completed', label: `✅ Đã tiêm`, color: '#16A34A' },
                ].map((f) => (
                  <Pressable
                    key={f.key}
                    onPress={() => setVaccineStatusFilter(f.key as any)}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: vaccineStatusFilter === f.key ? (f.color || colors.primary) : colors.surfaceElevated,
                        borderColor: vaccineStatusFilter === f.key ? (f.color || colors.primary) : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        typo.labelSmall,
                        { color: vaccineStatusFilter === f.key ? '#FFFFFF' : colors.text, fontWeight: '700' },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {filteredVaccinations.length === 0 ? (
                <View style={styles.emptyBox}>
                  <MaterialCommunityIcons name="needle-off" size={40} color={colors.textTertiary} />
                  <Text style={[typo.bodyMedium, { color: colors.textTertiary, marginTop: 8 }]}>
                    Không có hồ sơ tiêm chủng phù hợp
                  </Text>
                </View>
              ) : (
                filteredVaccinations.map((vac) => {
                  const isOverdue = vac.status === 'overdue';
                  const isUpcoming = vac.status === 'upcoming';
                  const badgeBg = isOverdue ? '#FEE2E2' : isUpcoming ? '#FEF9C3' : '#DCFCE7';
                  const badgeColor = isOverdue ? '#B91C1C' : isUpcoming ? '#854D0E' : '#15803D';
                  const badgeText = isOverdue ? '⚠️ Quá hạn tiêm' : isUpcoming ? '📅 Sắp đến hạn' : '✅ Đã hoàn thành';

                  return (
                    <View
                      key={vac.id}
                      style={[
                        styles.vaccCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: isOverdue ? '#FCA5A5' : colors.border,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <MaterialCommunityIcons
                            name={vac.petSpecies === 'dog' ? 'dog' : 'cat'}
                            size={18}
                            color={colors.primary}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '800' }]}>
                            {vac.petName}
                          </Text>
                          <Text style={[typo.caption, { color: colors.textSecondary, marginLeft: 6 }]}>
                            ({vac.ownerName})
                          </Text>
                        </View>

                        <View style={[styles.vaccStatusBadge, { backgroundColor: badgeBg }]}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: badgeColor }}>
                            {badgeText}
                          </Text>
                        </View>
                      </View>

                      {/* Vaccine Name */}
                      <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="needle" size={16} color={colors.primary} />
                        <Text style={[typo.labelLarge, { color: colors.text, fontWeight: '700', marginLeft: 6 }]}>
                          {vac.name}
                        </Text>
                      </View>

                      {/* Dates */}
                      <View style={styles.vaccDatesRow}>
                        <Text style={[typo.caption, { color: colors.textSecondary }]}>
                          Đã tiêm: <Text style={{ color: colors.text, fontWeight: '600' }}>{vac.administeredAt ? vac.administeredAt.split('T')[0] : 'N/A'}</Text>
                        </Text>

                        {vac.nextDueAt && (
                          <Text style={[typo.caption, { color: isOverdue ? '#DC2626' : colors.textSecondary }]}>
                            Tái chủng: <Text style={{ color: isOverdue ? '#DC2626' : colors.text, fontWeight: '700' }}>{vac.nextDueAt.split('T')[0]}</Text>
                          </Text>
                        )}
                      </View>

                      {/* Clinic & Notes */}
                      {(vac.vetClinic || vac.note) && (
                        <View style={[styles.vaccClinicRow, { backgroundColor: colors.surfaceElevated }]}>
                          {vac.vetClinic ? (
                            <Text style={[typo.caption, { color: colors.textSecondary }]}>
                              🏥 {vac.vetClinic}
                            </Text>
                          ) : null}
                          {vac.note ? (
                            <Text style={[typo.caption, { color: colors.textTertiary, fontStyle: 'italic', marginTop: 2 }]}>
                              Ghi chú: {vac.note}
                            </Text>
                          ) : null}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  adminHeaderIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  verifiedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  tabBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiCard: {
    width: '48%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  kpiIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratioBarContainer: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
  },
  ratioSegment: {
    height: '100%',
  },
  ratioLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  alertSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 0,
  },
  emptyBox: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  userAvatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  rolePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
  },
  roleActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  petCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  petAvatarWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  petAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  neuteredBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  petOwnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  vaccCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  vaccStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  vaccDatesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  vaccClinicRow: {
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
});
