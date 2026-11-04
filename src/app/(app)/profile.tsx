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
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { useAppTheme } from '@/presentation/theme';
import { useAuthStore } from '@/presentation/stores/useAuthStore';
import { usePetStore } from '@/presentation/stores/usePetStore';
import { ThemeToggle } from '@/presentation/components/ThemeToggle';
import { PrimaryButton } from '@/presentation/components/PrimaryButton';
import { AddPetModal } from '@/presentation/components/AddPetModal';
import { adminRepo } from '@/data/repositories/AdminRepository';

export default function ProfileScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, logout, updateProfile, isLoading } = useAuthStore();
  const { pets, deletePet } = usePetStore();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState(user?.fullName || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editAvatarUrl, setEditAvatarUrl] = useState(user?.avatarUrl || null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setEditFullName(user.fullName || '');
      setEditPhone(user.phone || '');
      setEditAvatarUrl(user.avatarUrl || null);
    }
  }, [user]);

  const handleDeletePet = (petId: string, petName: string) => {
    Alert.alert(
      'Xóa thú cưng',
      `Bạn có chắc chắn muốn xóa hồ sơ của bé ${petName}? Dữ liệu sẽ bị xóa khỏi cơ sở dữ liệu.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePet(petId);
            } catch (err: any) {
              Alert.alert('Không thể xóa', err?.message || 'Có lỗi xảy ra khi xóa hồ sơ thú cưng.');
            }
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

  const handlePickAvatar = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Ảnh đại diện chủ nuôi',
      'Chọn phương thức cập nhật ảnh đại diện:',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: '📸 Chụp ảnh mới',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Cần quyền truy cập', 'Vui lòng cho phép ứng dụng truy cập máy ảnh trong Cài đặt.');
                return;
              }
              const res = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.6,
                base64: true,
              });
              if (!res.canceled && res.assets && res.assets[0]) {
                const asset = res.assets[0];
                const finalUrl = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
                setEditAvatarUrl(finalUrl);
                void updateProfile({ avatarUrl: finalUrl });
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (err: any) {
              Alert.alert('Lỗi chụp ảnh', err?.message || 'Không thể chụp ảnh lúc này.');
            }
          },
        },
        {
          text: '🖼️ Chọn từ thư viện',
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert('Cần quyền truy cập', 'Vui lòng cho phép ứng dụng truy cập thư viện ảnh trong Cài đặt.');
                return;
              }
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.6,
                base64: true,
              });
              if (!res.canceled && res.assets && res.assets[0]) {
                const asset = res.assets[0];
                const finalUrl = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
                setEditAvatarUrl(finalUrl);
                void updateProfile({ avatarUrl: finalUrl });
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (err: any) {
              Alert.alert('Lỗi chọn ảnh', err?.message || 'Không thể chọn ảnh từ thư viện.');
            }
          },
        },
      ]
    );
  };

  const handleSaveProfile = async () => {
    if (!editFullName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ và tên của bạn.');
      return;
    }
    setIsSavingProfile(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const ok = await updateProfile({
        fullName: editFullName.trim(),
        phone: editPhone.trim(),
        avatarUrl: editAvatarUrl,
      });
      if (ok) {
        setIsEditModalOpen(false);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Thành công', 'Thông tin hồ sơ của bạn đã được cập nhật!');
      } else {
        Alert.alert('Lỗi cập nhật', 'Không thể lưu thông tin lúc này. Vui lòng thử lại.');
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

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
            {/* Avatar with Camera Badge */}
            <Pressable
              onPress={handlePickAvatar}
              hitSlop={6}
              style={[
                styles.avatarCircle,
                {
                  backgroundColor: colors.primaryContainer,
                  borderColor: colors.border,
                  borderWidth: 1,
                },
              ]}
            >
              {user?.avatarUrl ? (
                <Image
                  source={{ uri: user.avatarUrl }}
                  style={{ width: '100%', height: '100%', borderRadius: 32 }}
                  resizeMode="cover"
                />
              ) : (
                <MaterialCommunityIcons
                  name="account"
                  size={36}
                  color={colors.primary}
                />
              )}
              <View style={[styles.avatarCameraBadge, { backgroundColor: colors.primary }]}>
                <MaterialCommunityIcons name="camera" size={11} color="#FFFFFF" />
              </View>
            </Pressable>

            <View style={{ marginLeft: spacing.md, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '700', flex: 1 }]} numberOfLines={1}>
                  {user?.fullName || 'Chủ nuôi thú cưng'}
                </Text>
                <Pressable
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEditFullName(user?.fullName || '');
                    setEditPhone(user?.phone || '');
                    setEditAvatarUrl(user?.avatarUrl || null);
                    setIsEditModalOpen(true);
                  }}
                  hitSlop={8}
                  style={[styles.editProfileBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={14} color={colors.primary} />
                  <Text style={[typo.labelSmall, { color: colors.primary, fontWeight: '700', marginLeft: 4 }]}>
                    Sửa
                  </Text>
                </Pressable>
              </View>

              <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                {user?.email || 'email@example.com'}
              </Text>

              {user?.phone ? (
                <Text style={[typo.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  📞 {user.phone}
                </Text>
              ) : null}

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

        {/* VIP Admin Portal Card (Dành riêng cho Quản trị viên) */}
        {user?.role === 'admin' ? (
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/admin' as any);
            }}
            style={[
              styles.adminVipCard,
              {
                backgroundColor: '#FEF3C7',
                borderColor: '#F59E0B',
                marginTop: spacing.md,
                borderRadius: radius.xl,
              },
            ]}
          >
            <View style={[styles.adminVipIconCircle, { backgroundColor: '#F59E0B' }]}>
              <MaterialCommunityIcons name="shield-crown" size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[typo.titleSmall, { color: '#92400E', fontWeight: '800' }]}>
                  Bảng Điều Khiển Admin Portal
                </Text>
                <View style={{ backgroundColor: '#D97706', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, marginLeft: 6 }}>
                  <Text style={{ fontSize: 10, color: '#FFFFFF', fontWeight: '800' }}>VIP</Text>
                </View>
              </View>
              <Text style={[typo.caption, { color: '#B45309', marginTop: 2 }]}>
                Giám sát KPI, người dùng, tư vấn AI & danh mục giống loài
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#92400E" />
          </Pressable>
        ) : null}

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
                <Pressable
                  key={pet.id}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    router.push({
                      pathname: '/pet-profile',
                      params: { petId: pet.id },
                    } as any);
                  }}
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
                      {
                        backgroundColor: pet.species === 'dog' ? '#FFE0B2' : '#E1BEE7',
                        overflow: 'hidden',
                      },
                    ]}
                  >
                    {pet.photoUrl ? (
                      <Image source={{ uri: pet.photoUrl }} style={{ width: 44, height: 44, borderRadius: 12 }} resizeMode="cover" />
                    ) : (
                      <MaterialCommunityIcons
                        name={pet.species === 'dog' ? 'dog' : 'cat'}
                        size={24}
                        color="#4E342E"
                      />
                    )}
                  </View>
                  <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                    <Text style={[typo.titleMedium, { color: colors.text }]}>
                      {pet.name}
                    </Text>
                    <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
                      {pet.breedName || (pet.species === 'dog' ? 'Chó' : 'Mèo')} • {pet.weightKg} kg
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textTertiary} />
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeletePet(pet.id, pet.name);
                      }}
                      hitSlop={8}
                      style={{ padding: 4 }}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} />
                    </Pressable>
                  </View>
                </Pressable>
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

            {/* Setting 3: Trung tâm Quản trị Admin (Chỉ hiển thị khi là admin) */}
            {user?.role === 'admin' && (
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/admin' as any);
                }}
                style={[styles.settingRow, { borderBottomColor: colors.border, borderBottomWidth: 1, padding: spacing.md }]}
              >
                <View style={styles.settingLeft}>
                  <MaterialCommunityIcons name="shield-crown-outline" size={22} color="#D97706" />
                  <View style={{ marginLeft: spacing.sm }}>
                    <Text style={[typo.labelLarge, { color: '#B45309', fontWeight: '700' }]}>Trung tâm Quản trị Admin</Text>
                    <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>Xem báo cáo KPI, người dùng & AI</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#D97706" />
              </Pressable>
            )}

            {/* Setting 4: Chuyển vai trò thử nghiệm (Owner <-> Admin) */}
            <Pressable
              onPress={async () => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const nextRole = user?.role === 'admin' ? 'owner' : 'admin';
                try {
                  if (user) {
                    await adminRepo.updateUserRole(user.id, nextRole);
                    useAuthStore.setState((s) => ({
                      user: s.user ? { ...s.user, role: nextRole } : null,
                    }));
                    Alert.alert(
                      'Chuyển vai trò thành công',
                      `Tài khoản đã đổi sang quyền: ${nextRole === 'admin' ? 'Quản trị viên (Admin)' : 'Chủ nuôi tiêu chuẩn (Owner)'}.`
                    );
                  }
                } catch (err: any) {
                  Alert.alert('Lỗi cập nhật', err?.message || 'Không thể đổi vai trò');
                }
              }}
              style={[styles.settingRow, { padding: spacing.md }]}
            >
              <View style={styles.settingLeft}>
                <MaterialCommunityIcons name="account-switch-outline" size={22} color={colors.primary} />
                <View style={{ marginLeft: spacing.sm }}>
                  <Text style={[typo.labelLarge, { color: colors.text }]}>Vai trò: {user?.role === 'admin' ? 'Quản trị viên (Admin)' : 'Chủ nuôi (Owner)'}</Text>
                  <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>Chạm để đổi sang {user?.role === 'admin' ? 'Owner' : 'Admin'}</Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: user?.role === 'admin' ? '#FEF3C7' : colors.primaryContainer }]}>
                <Text style={[typo.labelSmall, { color: user?.role === 'admin' ? '#B45309' : colors.primary, fontWeight: '700' }]}>
                  {user?.role === 'admin' ? 'Admin' : 'Owner'}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* App Info Footer */}
        <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
          <Text style={[typo.labelSmall, { color: colors.textTertiary }]}>
            PawCare AI • Phiên bản 1.0.0
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

      {/* Modal Chỉnh sửa thông tin chủ nuôi */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.editModalContainer, { backgroundColor: colors.background }]}
        >
          {/* Header Modal */}
          <View
            style={[
              styles.editModalHeader,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '700' }]}>
                Chỉnh sửa hồ sơ chủ nuôi
              </Text>
              <Text style={[typo.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Cập nhật họ tên, số điện thoại & ảnh đại diện
              </Text>
            </View>
            <Pressable
              onPress={() => setIsEditModalOpen(false)}
              hitSlop={10}
              style={[styles.closeModalBtn, { backgroundColor: colors.surfaceElevated }]}
            >
              <MaterialCommunityIcons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            {/* Avatar Preview & Update */}
            <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
              <Pressable onPress={handlePickAvatar} style={styles.avatarEditWrapper}>
                <View
                  style={[
                    styles.avatarEditPreview,
                    {
                      backgroundColor: colors.primaryContainer,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {editAvatarUrl || user?.avatarUrl ? (
                    <Image
                      source={{ uri: editAvatarUrl || user?.avatarUrl || '' }}
                      style={{ width: '100%', height: '100%', borderRadius: 48 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <MaterialCommunityIcons name="account" size={54} color={colors.primary} />
                  )}
                </View>
                <View style={[styles.avatarCameraFloatingBadge, { backgroundColor: colors.primary }]}>
                  <MaterialCommunityIcons name="camera" size={16} color="#FFFFFF" />
                </View>
              </Pressable>
              <Pressable onPress={handlePickAvatar} style={{ marginTop: 8 }}>
                <Text style={[typo.labelSmall, { color: colors.primary, fontWeight: '700' }]}>
                  Đổi ảnh đại diện
                </Text>
              </Pressable>
            </View>

            {/* Inputs */}
            <View style={{ gap: spacing.md }}>
              <View>
                <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 6 }]}>
                  Họ và tên chủ nuôi <Text style={{ color: colors.error }}>*</Text>
                </Text>
                <TextInput
                  value={editFullName}
                  onChangeText={setEditFullName}
                  placeholder="Nhập họ và tên..."
                  placeholderTextColor={colors.textTertiary}
                  style={[
                    styles.inputField,
                    typo.bodyMedium,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                      borderRadius: radius.md,
                    },
                  ]}
                />
              </View>

              <View>
                <Text style={[typo.labelMedium, { color: colors.text, marginBottom: 6 }]}>
                  Số điện thoại liên hệ
                </Text>
                <TextInput
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="Ví dụ: 0912345678"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                  style={[
                    styles.inputField,
                    typo.bodyMedium,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                      borderRadius: radius.md,
                    },
                  ]}
                />
              </View>

              <View>
                <Text style={[typo.labelMedium, { color: colors.textSecondary, marginBottom: 6 }]}>
                  Email tài khoản
                </Text>
                <TextInput
                  value={user?.email || ''}
                  editable={false}
                  style={[
                    styles.inputField,
                    typo.bodyMedium,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                      color: colors.textSecondary,
                      borderRadius: radius.md,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Submit Buttons */}
            <View style={{ marginTop: spacing.xl, gap: 10 }}>
              <PrimaryButton
                title={isSavingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
                onPress={handleSaveProfile}
                loading={isSavingProfile}
              />
              <Pressable
                onPress={() => setIsEditModalOpen(false)}
                style={[styles.cancelModalBtn, { borderColor: colors.border, borderRadius: radius.md }]}
              >
                <Text style={[typo.labelLarge, { color: colors.textSecondary, textAlign: 'center' }]}>
                  Hủy bỏ
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  editModalContainer: {
    flex: 1,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeModalBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditWrapper: {
    position: 'relative',
    width: 96,
    height: 96,
  },
  avatarEditPreview: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    overflow: 'hidden',
  },
  avatarCameraFloatingBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  inputField: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  cancelModalBtn: {
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminVipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1.5,
    elevation: 2,
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  adminVipIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

