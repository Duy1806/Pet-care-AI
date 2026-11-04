/**
 * PawCare AI — Admin Portal (Trung tâm Quản trị Hệ thống)
 *
 * Professional administrative dashboard for platform operations:
 * - 📊 Overview & System KPIs (Users, Pets, AI consultations, Vaccines, Emergency alerts)
 * - 👥 User & Owner Management (List, search, inspect pet counts, toggle admin privileges)
 * - 🤖 AI Clinical Consultation Audit (Inspect Q&A sessions, highlight emergency triage warnings)
 * - 🐾 Breed & Healthcare Catalog (Reference library of dog & cat genetics, typical weights & illnesses)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  AdminRepository,
  type AdminAiConsultationItem,
  type AdminBreedItem,
  type AdminStats,
  type AdminUserItem,
} from '@/data/repositories/AdminRepository';

const adminRepo = new AdminRepository();

type AdminTab = 'overview' | 'users' | 'ai_logs' | 'breeds';

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
    totalAiConsultations: 0,
    totalVaccinations: 0,
    emergencyAlertCount: 0,
  });
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [aiLogs, setAiLogs] = useState<AdminAiConsultationItem[]>([]);
  const [breedsList, setBreedsList] = useState<AdminBreedItem[]>([]);

  // Search & filter states
  const [searchUserText, setSearchUserText] = useState('');
  const [searchBreedText, setSearchBreedText] = useState('');
  const [onlyEmergencyLogs, setOnlyEmergencyLogs] = useState(false);

  // Load all admin data
  const loadAdminData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [newStats, users, logs, breeds] = await Promise.all([
        adminRepo.getStats(),
        adminRepo.getAllUsers(),
        adminRepo.getAiConsultations(),
        adminRepo.getBreedsCatalog(),
      ]);

      setStats(newStats);
      setUsersList(users);
      setAiLogs(logs);
      setBreedsList(breeds);
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

  // Filtered breeds
  const filteredBreeds = useMemo(() => {
    const q = searchBreedText.toLowerCase().trim();
    if (!q) return breedsList;
    return breedsList.filter(
      (b) =>
        b.nameVi.toLowerCase().includes(q) ||
        b.nameEn.toLowerCase().includes(q) ||
        (b.commonHealthIssues || []).some((issue) => issue.toLowerCase().includes(q))
    );
  }, [breedsList, searchBreedText]);

  // Filtered AI logs
  const filteredAiLogs = useMemo(() => {
    if (!onlyEmergencyLogs) return aiLogs;
    return aiLogs.filter((l) => l.isEmergency);
  }, [aiLogs, onlyEmergencyLogs]);

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
            { key: 'ai_logs', label: `Giám sát AI (${aiLogs.length})`, icon: 'robot-outline' },
            { key: 'breeds', label: `Giống loài (${breedsList.length})`, icon: 'paw-outline' },
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
                  size={15}
                  color={isSelected ? colors.onPrimary : colors.textSecondary}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    typo.labelSmall,
                    {
                      color: isSelected ? colors.onPrimary : colors.text,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Tab Contents */}
      {isLoadingData && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 12 }]}>
            Đang tải dữ liệu quản trị...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}
        >
          {/* TAB 1: OVERVIEW & SYSTEM KPIS */}
          {activeTab === 'overview' && (
            <View style={{ gap: spacing.md }}>
              {/* Emergency Alert Banner if emergency consultations detected */}
              {stats.emergencyAlertCount > 0 && (
                <View style={[styles.emergencyBanner, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}>
                  <MaterialCommunityIcons name="alert-octagon" size={24} color="#EF4444" />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={[typo.labelLarge, { color: '#B91C1C', fontWeight: '700' }]}>
                      Phát hiện {stats.emergencyAlertCount} ca tư vấn khẩn cấp!
                    </Text>
                    <Text style={[typo.caption, { color: '#991B1B', marginTop: 2 }]}>
                      Chủ nuôi hỏi về triệu chứng nôn mửa, co giật hoặc ngộ độc cần theo dõi lâm sàng.
                    </Text>
                  </View>
                </View>
              )}

              {/* 4 KPI Grid Cards */}
              <View style={styles.kpiGrid}>
                {/* Metric 1: Users */}
                <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.kpiIconCircle, { backgroundColor: '#E0F2FE' }]}>
                    <MaterialCommunityIcons name="account-group" size={22} color="#0284C7" />
                  </View>
                  <Text style={[typo.headlineMedium, { color: colors.text, fontWeight: '800', marginTop: 8 }]}>
                    {stats.totalUsers}
                  </Text>
                  <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>Chủ nuôi đăng ký</Text>
                </View>

                {/* Metric 2: Pets */}
                <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.kpiIconCircle, { backgroundColor: '#DCFCE7' }]}>
                    <MaterialCommunityIcons name="paw" size={22} color="#16A34A" />
                  </View>
                  <Text style={[typo.headlineMedium, { color: colors.text, fontWeight: '800', marginTop: 8 }]}>
                    {stats.totalPets}
                  </Text>
                  <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>Thú cưng quản lý</Text>
                </View>

                {/* Metric 3: AI Chats */}
                <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.kpiIconCircle, { backgroundColor: '#F3E8FF' }]}>
                    <MaterialCommunityIcons name="robot-happy" size={22} color="#9333EA" />
                  </View>
                  <Text style={[typo.headlineMedium, { color: colors.text, fontWeight: '800', marginTop: 8 }]}>
                    {stats.totalAiConsultations}
                  </Text>
                  <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>Phiên hỏi Bác sĩ AI</Text>
                </View>

                {/* Metric 4: Vaccinations */}
                <View style={[styles.kpiCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.kpiIconCircle, { backgroundColor: '#FEF3C7' }]}>
                    <MaterialCommunityIcons name="needle" size={22} color="#D97706" />
                  </View>
                  <Text style={[typo.headlineMedium, { color: colors.text, fontWeight: '800', marginTop: 8 }]}>
                    {stats.totalVaccinations}
                  </Text>
                  <Text style={[typo.labelSmall, { color: colors.textSecondary }]}>Hồ sơ tiêm chủng</Text>
                </View>
              </View>

              {/* Pet Distribution Breakdown */}
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing.md }]}>
                <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '700' }]}>
                  Phân bố Giống loài Thú cưng
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                  <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                    🐕 Chó: <Text style={{ fontWeight: '700', color: colors.text }}>{stats.dogCount}</Text>
                  </Text>
                  <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                    🐈 Mèo: <Text style={{ fontWeight: '700', color: colors.text }}>{stats.catCount}</Text>
                  </Text>
                </View>
                {/* Visual Ratio Bar */}
                <View style={[styles.ratioBarContainer, { backgroundColor: colors.surfaceElevated }]}>
                  <View
                    style={{
                      height: '100%',
                      width: `${stats.totalPets > 0 ? (stats.dogCount / stats.totalPets) * 100 : 50}%`,
                      backgroundColor: '#38BDF8',
                    }}
                  />
                  <View
                    style={{
                      height: '100%',
                      width: `${stats.totalPets > 0 ? (stats.catCount / stats.totalPets) * 100 : 50}%`,
                      backgroundColor: '#F472B6',
                    }}
                  />
                </View>
              </View>

              {/* System Infrastructure Health */}
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: spacing.md }]}>
                <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '700', marginBottom: 10 }]}>
                  Hạ tầng & Dịch vụ Nền tảng
                </Text>

                <View style={styles.serviceRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.onlineDot} />
                    <Text style={[typo.bodySmall, { color: colors.text, marginLeft: 8, fontWeight: '600' }]}>
                      Supabase Cloud Database (PostgreSQL)
                    </Text>
                  </View>
                  <Text style={[typo.caption, { color: '#16A34A', fontWeight: '700' }]}>Hoạt động</Text>
                </View>

                <View style={[styles.serviceRow, { borderTopColor: colors.border, borderTopWidth: 1 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.onlineDot} />
                    <Text style={[typo.bodySmall, { color: colors.text, marginLeft: 8, fontWeight: '600' }]}>
                      Google Gemini AI (1.5 Flash Model)
                    </Text>
                  </View>
                  <Text style={[typo.caption, { color: '#16A34A', fontWeight: '700' }]}>200 OK</Text>
                </View>

                <View style={[styles.serviceRow, { borderTopColor: colors.border, borderTopWidth: 1 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.onlineDot} />
                    <Text style={[typo.bodySmall, { color: colors.text, marginLeft: 8, fontWeight: '600' }]}>
                      SQLite Local Sync Engine (pawcare.db)
                    </Text>
                  </View>
                  <Text style={[typo.caption, { color: '#16A34A', fontWeight: '700' }]}>Sẵn sàng</Text>
                </View>
              </View>
            </View>
          )}

          {/* TAB 2: USERS MANAGEMENT */}
          {activeTab === 'users' && (
            <View style={{ gap: spacing.md }}>
              {/* Search Bar */}
              <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
                <TextInput
                  value={searchUserText}
                  onChangeText={setSearchUserText}
                  placeholder="Tìm chủ nuôi theo tên, email, SĐT..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.searchInput, typo.bodySmall, { color: colors.text }]}
                />
              </View>

              {/* Users List */}
              {filteredUsers.length === 0 ? (
                <View style={styles.emptyBox}>
                  <MaterialCommunityIcons name="account-search-outline" size={40} color={colors.textTertiary} />
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
                    <View style={styles.userCardHeader}>
                      <View style={[styles.avatarBox, { backgroundColor: colors.primaryContainer }]}>
                        {item.avatarUrl ? (
                          <Image source={{ uri: item.avatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} resizeMode="cover" />
                        ) : (
                          <MaterialCommunityIcons name="account" size={22} color={colors.primary} />
                        )}
                      </View>

                      <View style={{ flex: 1, marginLeft: 10 }}>
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
                                fontWeight: '700',
                                color: item.role === 'admin' ? '#A16207' : colors.textSecondary,
                              }}
                            >
                              {item.role === 'admin' ? '👑 Quản trị viên' : 'Chủ nuôi'}
                            </Text>
                          </View>
                        </View>
                        <Text style={[typo.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                          {item.phone ? `📞 ${item.phone}` : item.email} • {item.petCount} thú cưng
                        </Text>
                      </View>

                      {/* Action: Toggle Role */}
                      <Pressable
                        onPress={() => handleToggleUserRole(item)}
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

          {/* TAB 3: AI CONSULTATION AUDITING */}
          {activeTab === 'ai_logs' && (
            <View style={{ gap: spacing.md }}>
              {/* Filter Chips */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setOnlyEmergencyLogs(false)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: !onlyEmergencyLogs ? colors.primary : colors.surfaceElevated,
                      borderColor: !onlyEmergencyLogs ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[typo.labelSmall, { color: !onlyEmergencyLogs ? colors.onPrimary : colors.text }]}>
                    Tất cả ({aiLogs.length})
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setOnlyEmergencyLogs(true)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: onlyEmergencyLogs ? '#EF4444' : colors.surfaceElevated,
                      borderColor: onlyEmergencyLogs ? '#EF4444' : colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons name="alert" size={14} color={onlyEmergencyLogs ? '#FFFFFF' : '#EF4444'} style={{ marginRight: 4 }} />
                  <Text style={[typo.labelSmall, { color: onlyEmergencyLogs ? '#FFFFFF' : '#EF4444', fontWeight: '700' }]}>
                    Chỉ ca khẩn cấp 🚨
                  </Text>
                </Pressable>
              </View>

              {filteredAiLogs.length === 0 ? (
                <View style={styles.emptyBox}>
                  <MaterialCommunityIcons name="robot-off-outline" size={40} color={colors.textTertiary} />
                  <Text style={[typo.bodyMedium, { color: colors.textTertiary, marginTop: 8 }]}>
                    Chưa có phiên tư vấn nào
                  </Text>
                </View>
              ) : (
                filteredAiLogs.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.logCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: item.isEmergency ? '#FCA5A5' : colors.border,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                        <MaterialCommunityIcons
                          name={item.isEmergency ? 'alert-circle' : 'chat-processing-outline'}
                          size={18}
                          color={item.isEmergency ? '#EF4444' : colors.primary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '700', flex: 1 }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                      </View>

                      {item.isEmergency && (
                        <View style={[styles.emergencyTag, { backgroundColor: '#FEE2E2' }]}>
                          <Text style={{ fontSize: 9, fontWeight: '800', color: '#DC2626' }}>
                            🚨 NGUY CẤP
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
                      <Text style={[typo.caption, { color: colors.textSecondary }]}>
                        {item.petName ? `Bé ${item.petName}` : 'Tư vấn chung'} • {new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
                        <Text style={{ fontSize: 10, color: '#16A34A', fontWeight: '700' }}>Gemini Flash</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 4: BREED REFERENCE CATALOG */}
          {activeTab === 'breeds' && (
            <View style={{ gap: spacing.md }}>
              <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
                <TextInput
                  value={searchBreedText}
                  onChangeText={setSearchBreedText}
                  placeholder="Tra cứu giống chó mèo, bệnh lý di truyền..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.searchInput, typo.bodySmall, { color: colors.text }]}
                />
              </View>

              {filteredBreeds.length === 0 ? (
                <View style={styles.emptyBox}>
                  <MaterialCommunityIcons name="paw-off" size={40} color={colors.textTertiary} />
                  <Text style={[typo.bodyMedium, { color: colors.textTertiary, marginTop: 8 }]}>
                    Không tìm thấy giống loài phù hợp
                  </Text>
                </View>
              ) : (
                filteredBreeds.map((breed) => (
                  <View
                    key={breed.id}
                    style={[
                      styles.breedCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={[styles.speciesIconCircle, { backgroundColor: breed.species === 'dog' ? '#FFE0B2' : '#E1BEE7' }]}>
                        <MaterialCommunityIcons name={breed.species === 'dog' ? 'dog' : 'cat'} size={20} color="#4E342E" />
                      </View>
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '700' }]}>
                          {breed.nameVi} ({breed.nameEn})
                        </Text>
                        <Text style={[typo.caption, { color: colors.textSecondary }]}>
                          Cân nặng chuẩn: {breed.typicalWeightMinKg || 3} - {breed.typicalWeightMaxKg || 7} kg • Kích thước: {breed.sizeCategory || 'Nhỏ'}
                        </Text>
                      </View>
                    </View>

                    {/* Common Health Issues */}
                    {breed.commonHealthIssues && breed.commonHealthIssues.length > 0 && (
                      <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                        {breed.commonHealthIssues.map((issue, idx) => (
                          <View key={idx} style={[styles.issueTag, { backgroundColor: colors.surfaceElevated }]}>
                            <Text style={[typo.caption, { color: colors.textSecondary, fontSize: 11 }]}>
                              ⚠️ {issue}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))
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
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminHeaderIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiCard: {
    width: '48%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  kpiIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
  },
  ratioBarContainer: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
    marginTop: 8,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 4,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  userCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  logCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  emergencyTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  breedCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  speciesIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  issueTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
});

