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
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useArticleStore } from '@/presentation/stores/useArticleStore';
import type { Article, ArticleStatus, TargetSpecies } from '@/domain/entities/Article';
import {
  adminRepo,
  type AdminPetItem,
  type AdminStats,
  type AdminUserItem,
  type AdminVaccinationItem,
} from '@/data/repositories/AdminRepository';

type AdminTab = 'overview' | 'articles' | 'users' | 'pets' | 'vaccinations';

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

  // Article store integration
  const {
    adminArticles,
    categories,
    loadAdminArticles,
    loadCategories,
    createArticle,
    updateArticle,
    deleteArticle,
    toggleStatus,
    createCategory,
  } = useArticleStore();

  const [articleStatusFilter, setArticleStatusFilter] = useState<'all' | 'published' | 'draft' | 'hidden'>('all');
  const [searchArticleText, setSearchArticleText] = useState('');

  // Article Modal States
  const [isArticleModalVisible, setIsArticleModalVisible] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCategoryId, setFormCategoryId] = useState<string>('');
  const [formSpecies, setFormSpecies] = useState<TargetSpecies>('all');
  const [formCoverUrl, setFormCoverUrl] = useState('');
  const [formExcerpt, setFormExcerpt] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formSourceName, setFormSourceName] = useState('');
  const [formSourceUrl, setFormSourceUrl] = useState('');
  const [formStatus, setFormStatus] = useState<ArticleStatus>('published');
  const [isSavingArticle, setIsSavingArticle] = useState(false);
  const [coverImageError, setCoverImageError] = useState(false);

  // Category Modal State
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

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
        loadAdminArticles(),
        loadCategories(),
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
  }, [loadAdminArticles, loadCategories]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void loadAdminData();
  };

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return adminArticles.filter((art) => {
      if (articleStatusFilter !== 'all' && art.status !== articleStatusFilter) return false;
      if (searchArticleText.trim()) {
        const query = searchArticleText.toLowerCase();
        return (
          art.title.toLowerCase().includes(query) ||
          art.excerpt.toLowerCase().includes(query) ||
          (art.categoryName && art.categoryName.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [adminArticles, articleStatusFilter, searchArticleText]);

  const openCreateArticleModal = () => {
    setEditingArticle(null);
    setFormTitle('');
    setFormCategoryId(categories[0]?.id || '');
    setFormSpecies('all');
    setFormCoverUrl('');
    setCoverImageError(false);
    setFormExcerpt('');
    setFormContent('');
    setFormSourceName('');
    setFormSourceUrl('');
    setFormStatus('published');
    setIsArticleModalVisible(true);
  };

  const openEditArticleModal = (art: Article) => {
    setEditingArticle(art);
    setFormTitle(art.title);
    setFormCategoryId(art.categoryId || '');
    setFormSpecies(art.targetSpecies);
    setFormCoverUrl(art.coverImageUrl || '');
    setCoverImageError(false);
    setFormExcerpt(art.excerpt);
    setFormContent(art.content);
    setFormSourceName(art.sourceName || '');
    setFormSourceUrl(art.sourceUrl || '');
    setFormStatus(art.status);
    setIsArticleModalVisible(true);
  };

  const handleSaveArticle = async () => {
    if (!formTitle.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tiêu đề bài viết.');
      return;
    }
    if (!formExcerpt.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mô tả ngắn tóm tắt.');
      return;
    }
    if (!formContent.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập nội dung chi tiết bài viết.');
      return;
    }

    setIsSavingArticle(true);
    try {
      if (editingArticle) {
        await updateArticle(editingArticle.id, {
          title: formTitle.trim(),
          categoryId: formCategoryId || null,
          targetSpecies: formSpecies,
          coverImageUrl: formCoverUrl.trim() || null,
          excerpt: formExcerpt.trim(),
          content: formContent.trim(),
          sourceName: formSourceName.trim() || null,
          sourceUrl: formSourceUrl.trim() || null,
          status: formStatus,
        });
        Alert.alert('Thành công', 'Đã cập nhật bài viết thành công!');
      } else {
        await createArticle({
          title: formTitle.trim(),
          categoryId: formCategoryId || null,
          targetSpecies: formSpecies,
          coverImageUrl: formCoverUrl.trim() || null,
          excerpt: formExcerpt.trim(),
          content: formContent.trim(),
          sourceName: formSourceName.trim() || null,
          sourceUrl: formSourceUrl.trim() || null,
          status: formStatus,
        });
        Alert.alert('Thành công', 'Đã thêm bài viết mới vào hệ thống!');
      }
      setIsArticleModalVisible(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Lỗi lưu bài viết', err?.message || 'Không thể lưu bài viết. Vui lòng kiểm tra quyền Admin.');
    } finally {
      setIsSavingArticle(false);
    }
  };

  const handleDeleteArticle = (art: Article) => {
    Alert.alert(
      'Xác nhận xóa bài viết',
      `Bạn có chắc chắn muốn xóa bài viết:\n"${art.title}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa bài',
          style: 'destructive',
          onPress: async () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await deleteArticle(art.id);
              Alert.alert('Đã xóa', 'Bài viết đã được gỡ bỏ khỏi hệ thống.');
            } catch (err: any) {
              Alert.alert('Không thể xóa', err?.message || 'Có lỗi xảy ra khi xóa bài viết.');
            }
          },
        },
      ]
    );
  };

  const handleToggleArticleStatus = async (art: Article) => {
    const nextStatus: ArticleStatus = art.status === 'published' ? 'hidden' : 'published';
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await toggleStatus(art.id, nextStatus);
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể đổi trạng thái bài viết.');
    }
  };

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

  const handleSaveCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên danh mục.');
      return;
    }
    setIsSavingCategory(true);
    try {
      await createCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsCategoryModalVisible(false);
      Alert.alert('Thành công', 'Đã thêm danh mục bài viết mới!');
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể tạo danh mục mới.');
    } finally {
      setIsSavingCategory(false);
    }
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

      {/* 5 Tabs Selector */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {[
            { key: 'overview', label: 'Tổng quan', icon: 'view-dashboard-outline' },
            { key: 'articles', label: `Bài viết (${adminArticles.length})`, icon: 'book-open-page-variant-outline' },
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

          {/* TAB: ARTICLE & KNOWLEDGE MANAGEMENT */}
          {activeTab === 'articles' && (
            <View style={{ gap: spacing.md }}>
              {/* Header Action Buttons */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    openCreateArticleModal();
                  }}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.primary,
                    paddingVertical: 12,
                    borderRadius: radius.md,
                    gap: 6,
                  }}
                >
                  <MaterialCommunityIcons name="pencil-plus" size={18} color="#FFF" />
                  <Text style={[typo.labelLarge, { color: '#FFF', fontWeight: '700' }]}>
                    Thêm bài viết mới
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsCategoryModalVisible(true);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: radius.md,
                    gap: 6,
                  }}
                >
                  <MaterialCommunityIcons name="folder-plus-outline" size={18} color={colors.text} />
                  <Text style={[typo.labelMedium, { color: colors.text, fontWeight: '600' }]}>
                    + Danh mục ({categories.length})
                  </Text>
                </Pressable>
              </View>

              {/* Search Bar */}
              <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
                <TextInput
                  value={searchArticleText}
                  onChangeText={setSearchArticleText}
                  placeholder="Tìm kiếm bài viết theo tiêu đề, danh mục..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.searchInput, typo.bodySmall, { color: colors.text }]}
                />
                {searchArticleText.length > 0 && (
                  <Pressable onPress={() => setSearchArticleText('')}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={colors.textTertiary} />
                  </Pressable>
                )}
              </View>

              {/* Status Filter Chips */}
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { key: 'all', label: `Tất cả (${adminArticles.length})` },
                  { key: 'published', label: `Đã xuất bản (${adminArticles.filter((a) => a.status === 'published').length})` },
                  { key: 'draft', label: `Bản nháp (${adminArticles.filter((a) => a.status === 'draft').length})` },
                  { key: 'hidden', label: `Đã ẩn (${adminArticles.filter((a) => a.status === 'hidden').length})` },
                ].map((item) => {
                  const isSel = articleStatusFilter === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setArticleStatusFilter(item.key as any);
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: radius.md,
                        backgroundColor: isSel ? colors.primary : colors.surface,
                        borderColor: isSel ? colors.primary : colors.border,
                        borderWidth: 1,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: isSel ? '700' : '500', color: isSel ? '#FFF' : colors.textSecondary }}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Article List */}
              {filteredArticles.length === 0 ? (
                <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: 24 }]}>
                  <MaterialCommunityIcons name="book-open-outline" size={48} color={colors.textTertiary} />
                  <Text style={[typo.titleSmall, { color: colors.text, marginTop: 8, fontWeight: '700' }]}>
                    Chưa có bài viết nào
                  </Text>
                  <Text style={[typo.caption, { color: colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>
                    Bấm nút "Thêm bài viết mới" phía trên để soạn thảo và xuất bản kiến thức cho cộng đồng.
                  </Text>
                </View>
              ) : (
                filteredArticles.map((art) => {
                  const isPublished = art.status === 'published';
                  const isDraft = art.status === 'draft';
                  const statusBg = isPublished ? '#DCFCE7' : isDraft ? '#F1F5F9' : '#FEF3C7';
                  const statusColor = isPublished ? '#15803D' : isDraft ? '#64748B' : '#B45309';
                  const statusLabel = isPublished ? 'Đã xuất bản' : isDraft ? 'Bản nháp' : 'Đã ẩn';

                  return (
                    <View
                      key={art.id}
                      style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: radius.lg,
                        padding: 14,
                        gap: 10,
                      }}
                    >
                      {/* Top Row: Badges */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
                          <View style={{ backgroundColor: statusBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: statusColor }}>
                              {statusLabel}
                            </Text>
                          </View>

                          <View style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#0284C7' }}>
                              {art.targetSpecies === 'all' ? 'Tất cả' : art.targetSpecies === 'dog' ? 'Chó' : art.targetSpecies === 'cat' ? 'Mèo' : art.targetSpecies}
                            </Text>
                          </View>

                          {Boolean(art.categoryName) && (
                            <Text style={[typo.caption, { color: colors.textSecondary, fontWeight: '600' }]} numberOfLines={1}>
                              {art.categoryName}
                            </Text>
                          )}
                        </View>

                        <Text style={[typo.caption, { color: colors.textTertiary }]}>
                          👁️ {art.viewsCount}
                        </Text>
                      </View>

                      {/* Content Row: Thumbnail & Title/Excerpt */}
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        {Boolean(art.coverImageUrl) && (
                          <Image
                            source={{ uri: art.coverImageUrl! }}
                            style={{ width: 68, height: 68, borderRadius: 8, backgroundColor: '#E2E8F0' }}
                          />
                        )}
                        <View style={{ flex: 1, justifyContent: 'center' }}>
                          <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '700' }]} numberOfLines={2}>
                            {art.title}
                          </Text>
                          <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 4 }]} numberOfLines={2}>
                            {art.excerpt}
                          </Text>
                        </View>
                      </View>

                      {/* Source & Date info */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
                        <Text style={[typo.caption, { color: colors.textTertiary }]}>
                          {art.sourceName ? `Nguồn: ${art.sourceName}` : 'Tác giả: Admin'}
                        </Text>
                        <Text style={[typo.caption, { color: colors.textTertiary }]}>
                          {art.publishedAt ? art.publishedAt.split('T')[0] : art.createdAt.split('T')[0]}
                        </Text>
                      </View>

                      {/* Actions: Sửa, Ẩn/Hiện, Xóa */}
                      <View style={{ flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
                        <Pressable
                          onPress={() => openEditArticleModal(art)}
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: colors.surfaceElevated,
                            paddingVertical: 8,
                            borderRadius: radius.md,
                            gap: 4,
                          }}
                        >
                          <MaterialCommunityIcons name="pencil-outline" size={15} color={colors.primary} />
                          <Text style={[typo.labelSmall, { color: colors.primary, fontWeight: '700' }]}>
                            Sửa
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => handleToggleArticleStatus(art)}
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: colors.surfaceElevated,
                            paddingVertical: 8,
                            borderRadius: radius.md,
                            gap: 4,
                          }}
                        >
                          <MaterialCommunityIcons
                            name={isPublished ? 'eye-off-outline' : 'eye-outline'}
                            size={15}
                            color={isPublished ? '#D97706' : '#16A34A'}
                          />
                          <Text
                            style={[
                              typo.labelSmall,
                              { color: isPublished ? '#D97706' : '#16A34A', fontWeight: '700' },
                            ]}
                          >
                            {isPublished ? 'Ẩn bài' : 'Xuất bản'}
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => handleDeleteArticle(art)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            backgroundColor: '#FEE2E2',
                            borderRadius: radius.md,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={16} color="#DC2626" />
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
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

      {/* MODAL 1: ADD / EDIT ARTICLE */}
      <Modal
        visible={isArticleModalVisible}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setIsArticleModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Compact Top Header with Safe Notch Padding */}
          <View
            style={[
              styles.modalHeader,
              {
                paddingTop: Math.max(insets.top, 24) + 6,
                paddingBottom: 10,
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Pressable
              onPress={() => setIsArticleModalVisible(false)}
              hitSlop={10}
              style={{ padding: 4 }}
            >
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </Pressable>

            <Text
              style={[typo.titleSmall, { color: colors.text, fontWeight: '800', flex: 1, textAlign: 'center', marginHorizontal: 8 }]}
              numberOfLines={1}
            >
              {editingArticle ? 'Chỉnh sửa bài viết' : 'Thêm bài viết mới'}
            </Text>

            <Pressable
              onPress={handleSaveArticle}
              disabled={isSavingArticle}
              hitSlop={6}
              style={{
                backgroundColor: colors.primary,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: radius.full,
                minWidth: 54,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSavingArticle ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Lưu</Text>
              )}
            </Pressable>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 14,
                paddingTop: 10,
                paddingBottom: insets.bottom + 40,
                gap: 10,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Title */}
              <View>
                <Text style={[typo.labelSmall, { color: colors.text, marginBottom: 3, fontWeight: '700' }]}>
                  Tiêu đề bài viết *
                </Text>
                <TextInput
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder="Ví dụ: Hướng dẫn chăm sóc lông chó mèo"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.modalInputCompact, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                />
              </View>

              {/* Category Picker */}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text style={[typo.labelSmall, { color: colors.text, fontWeight: '700' }]}>
                    Danh mục bài viết
                  </Text>
                  <Pressable onPress={() => setIsCategoryModalVisible(true)} hitSlop={6}>
                    <Text style={{ fontSize: 11, color: colors.primary, fontWeight: '700' }}>+ Thêm danh mục</Text>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {categories.map((c) => {
                    const isSel = formCategoryId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setFormCategoryId(c.id)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: radius.sm,
                          backgroundColor: isSel ? colors.primary : colors.surface,
                          borderColor: isSel ? colors.primary : colors.border,
                          borderWidth: 1,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: isSel ? '700' : '500', color: isSel ? '#FFF' : colors.text }}>
                          {c.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Target Species Picker (Strictly Dog & Cat Only) */}
              <View>
                <Text style={[typo.labelSmall, { color: colors.text, marginBottom: 3, fontWeight: '700' }]}>
                  Đối tượng thú cưng áp dụng (Chó & Mèo)
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[
                    { key: 'all', label: 'Tất cả (Chó & Mèo)', icon: 'paw' },
                    { key: 'dog', label: 'Chó cưng', icon: 'dog' },
                    { key: 'cat', label: 'Mèo cưng', icon: 'cat' },
                  ].map((s) => {
                    const isSel = formSpecies === s.key;
                    return (
                      <Pressable
                        key={s.key}
                        onPress={() => setFormSpecies(s.key as TargetSpecies)}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingVertical: 7,
                          paddingHorizontal: 6,
                          borderRadius: radius.sm,
                          backgroundColor: isSel ? colors.primary : colors.surface,
                          borderColor: isSel ? colors.primary : colors.border,
                          borderWidth: 1,
                          gap: 4,
                        }}
                      >
                        <MaterialCommunityIcons
                          name={s.icon as any}
                          size={14}
                          color={isSel ? '#FFFFFF' : colors.textSecondary}
                        />
                        <Text style={{ fontSize: 11, fontWeight: isSel ? '700' : '500', color: isSel ? '#FFF' : colors.text }}>
                          {s.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Cover Image URL */}
              <View>
                <Text style={[typo.labelSmall, { color: colors.text, marginBottom: 3, fontWeight: '700' }]}>
                  Đường dẫn ảnh bìa (Cover Image URL)
                </Text>
                <TextInput
                  value={formCoverUrl}
                  onChangeText={(val) => {
                    setFormCoverUrl(val);
                    setCoverImageError(false);
                  }}
                  placeholder="https://images.unsplash.com/..."
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.modalInputCompact, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                />
                {Boolean(formCoverUrl.trim()) &&
                  (formCoverUrl.trim().startsWith('http://') || formCoverUrl.trim().startsWith('https://')) &&
                  !coverImageError && (
                    <View style={{ height: 85, borderRadius: 6, marginTop: 6, overflow: 'hidden', backgroundColor: colors.surfaceElevated }}>
                      <Image
                        source={{ uri: formCoverUrl.trim() }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                        onError={() => setCoverImageError(true)}
                      />
                    </View>
                )}
              </View>

              {/* Excerpt */}
              <View>
                <Text style={[typo.labelSmall, { color: colors.text, marginBottom: 3, fontWeight: '700' }]}>
                  Mô tả ngắn (Tóm tắt 1-2 câu) *
                </Text>
                <TextInput
                  value={formExcerpt}
                  onChangeText={setFormExcerpt}
                  placeholder="Tóm tắt ngắn gọn nội dung bài viết..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={2}
                  style={[styles.modalInputCompact, { height: 46, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, textAlignVertical: 'top' }]}
                />
              </View>

              {/* Full Content */}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text style={[typo.labelSmall, { color: colors.text, fontWeight: '700' }]}>
                    Nội dung chi tiết bài viết *
                  </Text>
                  <Text style={{ fontSize: 10, color: colors.primary }}>
                    ## tiêu đề, - gạch đầu dòng, &gt; lưu ý
                  </Text>
                </View>
                <TextInput
                  value={formContent}
                  onChangeText={setFormContent}
                  placeholder="Soạn thảo nội dung bài viết tại đây..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={5}
                  style={[styles.modalInputCompact, { height: 110, backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, textAlignVertical: 'top' }]}
                />
              </View>

              {/* Source Reference: Website Name & URL */}
              <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 8, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialCommunityIcons name="shield-check-outline" size={15} color={colors.primary} />
                  <Text style={[typo.labelSmall, { color: colors.text, fontWeight: '700' }]}>
                    Nguồn tham khảo & Bản quyền
                  </Text>
                </View>

                <TextInput
                  value={formSourceName}
                  onChangeText={setFormSourceName}
                  placeholder="Tên website / tác giả nguồn (ví dụ: AKC, PetMD...)"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.modalInputCompact, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
                />

                <TextInput
                  value={formSourceUrl}
                  onChangeText={setFormSourceUrl}
                  placeholder="Đường dẫn liên kết URL nguồn gốc (https://...)"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.modalInputCompact, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
                />
              </View>

              {/* Status Selector */}
              <View>
                <Text style={[typo.labelSmall, { color: colors.text, marginBottom: 3, fontWeight: '700' }]}>
                  Trạng thái đăng bài
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[
                    { key: 'published', label: '✅ Xuất bản', color: '#16A34A' },
                    { key: 'draft', label: '📝 Bản nháp', color: '#64748B' },
                    { key: 'hidden', label: '🔒 Tạm ẩn', color: '#D97706' },
                  ].map((st) => {
                    const isSel = formStatus === st.key;
                    return (
                      <Pressable
                        key={st.key}
                        onPress={() => setFormStatus(st.key as ArticleStatus)}
                        style={{
                          flex: 1,
                          paddingVertical: 7,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: radius.sm,
                          backgroundColor: isSel ? colors.surfaceElevated : colors.surface,
                          borderColor: isSel ? st.color : colors.border,
                          borderWidth: isSel ? 2 : 1,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: isSel ? '700' : '500', color: isSel ? st.color : colors.textSecondary }}>
                          {st.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* MODAL 2: ADD CATEGORY */}
      <Modal
        visible={isCategoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCategoryModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.categoryDialog, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
            <Text style={[typo.titleMedium, { color: colors.text, fontWeight: '800', marginBottom: 12 }]}>
              Thêm danh mục bài viết mới
            </Text>

            <Text style={[typo.caption, { color: colors.textSecondary, marginBottom: 6 }]}>
              Tên danh mục (ví dụ: Chăm sóc răng miệng, Đồ chơi & Phụ kiện)
            </Text>
            <TextInput
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="Nhập tên danh mục..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text, marginBottom: 16 }]}
            />

            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end' }}>
              <Pressable
                onPress={() => {
                  setNewCategoryName('');
                  setIsCategoryModalVisible(false);
                }}
                style={{ paddingVertical: 8, paddingHorizontal: 14 }}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Hủy</Text>
              </Pressable>

              <Pressable
                onPress={handleSaveCategory}
                disabled={isSavingCategory}
                style={{
                  backgroundColor: colors.primary,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: radius.md,
                }}
              >
                {isSavingCategory ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Lưu danh mục</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalInputCompact: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  categoryDialog: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
    borderWidth: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderWidth: 1,
  },
});
