/**
 * PawCare AI — PetCare Shop (Sản phẩm dành cho thú cưng & Tiếp thị liên kết)
 *
 * Displays curated pet care products from top e-commerce platforms (Shopee, Lazada, Tiki).
 * Includes species filters (Chó & Mèo), category filtering, search,
 * product detail modal, affiliate disclosure banner, and direct external linking.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
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
import * as WebBrowser from 'expo-web-browser';

import { useAppTheme } from '@/presentation/theme';
import { useAffiliateProductStore } from '@/presentation/stores/useAffiliateProductStore';
import type { AffiliateProduct, ProductPetType } from '@/domain/entities/AffiliateProduct';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 12) / 2;

function formatPriceVND(price: number): string {
  if (!price && price !== 0) return 'Giá liên hệ';
  return `${price.toLocaleString('vi-VN')} đ`;
}

function getMerchantColor(merchant: string): { bg: string; text: string } {
  const m = (merchant || '').toLowerCase();
  if (m.includes('shopee')) return { bg: '#FFF1EE', text: '#EE4D2D' };
  if (m.includes('lazada')) return { bg: '#EBF3FF', text: '#0F146D' };
  if (m.includes('tiki')) return { bg: '#E6F8FE', text: '#1A94FF' };
  return { bg: '#F1F5F9', text: '#475569' };
}

export default function ShopScreen() {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();

  const {
    products,
    categories,
    selectedCategory,
    selectedPetType,
    searchQuery,
    isLoading,
    loadCategories,
    loadActiveProducts,
    setSelectedCategory,
    setSelectedPetType,
    setSearchQuery,
  } = useAffiliateProductStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AffiliateProduct | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

  useEffect(() => {
    void loadCategories();
    void loadActiveProducts();
  }, [loadCategories, loadActiveProducts]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([loadCategories(), loadActiveProducts()]);
    setIsRefreshing(false);
  }, [loadCategories, loadActiveProducts]);

  const handleOpenAffiliateLink = async (product: AffiliateProduct) => {
    if (!product.affiliateUrl) {
      Alert.alert('Thông báo', 'Đường dẫn sản phẩm hiện chưa khả dụng.');
      return;
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await WebBrowser.openBrowserAsync(product.affiliateUrl);
    } catch {
      await Linking.openURL(product.affiliateUrl).catch(() => {
        Alert.alert('Lỗi liên kết', 'Không thể mở trang mua sắm. Vui lòng thử lại sau.');
      });
    }
  };

  const handlePressProduct = (product: AffiliateProduct) => {
    void Haptics.selectionAsync();
    setSelectedProduct(product);
    setIsDetailModalVisible(true);
  };

  const petTypeTabs: Array<{ key: ProductPetType; label: string; icon: string }> = [
    { key: 'all', label: 'Tất cả', icon: 'paw' },
    { key: 'dog', label: '🐕 Chó cưng', icon: 'dog' },
    { key: 'cat', label: '🐈 Mèo cưng', icon: 'cat' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Navigation Bar */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + spacing.xs,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={[styles.navIconBtn, { backgroundColor: colors.surfaceElevated }]}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </Pressable>

        <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[typo.titleMedium, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
              PetCare Shop
            </Text>
            <View style={[styles.verifiedTag, { backgroundColor: '#FEF3C7' }]}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: '#B45309' }}>OFFICIAL</Text>
            </View>
          </View>
          <Text style={[typo.caption, { color: colors.textSecondary }]} numberOfLines={1}>
            Sản phẩm & Đồ dùng thú cưng chọn lọc
          </Text>
        </View>

        <Pressable
          onPress={onRefresh}
          style={[styles.navIconBtn, { backgroundColor: colors.surfaceElevated }]}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="refresh" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Affiliate Disclosure / Transparency Banner */}
        <View style={[styles.disclosureBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
          <Text style={[typo.caption, { color: colors.textSecondary, flex: 1, lineHeight: 18 }]}>
            <Text style={{ fontWeight: '700', color: colors.text }}>Minh bạch tiếp thị:</Text> Các sản phẩm dưới đây được gợi ý từ các sàn thương mại uy tín. PetCare AI có thể nhận hoa hồng nếu bạn mua hàng thành công. Giá mang tính tham khảo.
          </Text>
        </View>

        {/* Search Input Bar */}
        <View style={{ paddingHorizontal: 16, marginTop: spacing.sm }}>
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm sữa tắm, thức ăn, phụ kiện cho cún miu..."
              placeholderTextColor={colors.textTertiary}
              style={[styles.searchInput, typo.bodySmall, { color: colors.text }]}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                <MaterialCommunityIcons name="close-circle" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Species Filter Tabs */}
        <View style={{ marginTop: spacing.sm }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            {petTypeTabs.map((tab) => {
              const isSelected = selectedPetType === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setSelectedPetType(tab.key);
                  }}
                  style={[
                    styles.speciesTab,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typo.labelMedium,
                      {
                        color: isSelected ? '#FFFFFF' : colors.text,
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

        {/* Category Filter Horizontal Scroll */}
        {categories.length > 0 && (
          <View style={{ marginTop: spacing.sm }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              <Pressable
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSelectedCategory(null);
                }}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: selectedCategory === null ? colors.surfaceElevated : colors.surface,
                    borderColor: selectedCategory === null ? colors.primary : colors.border,
                    borderWidth: selectedCategory === null ? 1.5 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: selectedCategory === null ? '700' : '500',
                    color: selectedCategory === null ? colors.primary : colors.textSecondary,
                  }}
                >
                  Tất cả danh mục
                </Text>
              </Pressable>

              {categories.map((cat) => {
                const isSel = selectedCategory === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setSelectedCategory(cat.id);
                    }}
                    style={[
                      styles.categoryPill,
                      {
                        backgroundColor: isSel ? colors.surfaceElevated : colors.surface,
                        borderColor: isSel ? colors.primary : colors.border,
                        borderWidth: isSel ? 1.5 : 1,
                      },
                    ]}
                  >
                    {Boolean(cat.icon) && (
                      <MaterialCommunityIcons
                        name={cat.icon as any}
                        size={14}
                        color={isSel ? colors.primary : colors.textSecondary}
                        style={{ marginRight: 4 }}
                      />
                    )}
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isSel ? '700' : '500',
                        color: isSel ? colors.primary : colors.textSecondary,
                      }}
                    >
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Products Grid Section */}
        <View style={{ paddingHorizontal: 16, marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '800' }]}>
              Sản phẩm đề xuất ({products.length})
            </Text>
            <Text style={[typo.caption, { color: colors.textSecondary }]}>
              {selectedPetType === 'dog' ? 'Chó cưng' : selectedPetType === 'cat' ? 'Mèo cưng' : 'Chó & Mèo'}
            </Text>
          </View>

          {isLoading && !isRefreshing ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[typo.caption, { color: colors.textSecondary, marginTop: 8 }]}>
                Đang tìm sản phẩm phù hợp...
              </Text>
            </View>
          ) : products.length === 0 ? (
            <View style={[styles.emptyContainer, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.lg }]}>
              <MaterialCommunityIcons name="shopping-search" size={48} color={colors.textTertiary} />
              <Text style={[typo.titleSmall, { color: colors.text, marginTop: 10, fontWeight: '700' }]}>
                Không tìm thấy sản phẩm
              </Text>
              <Text style={[typo.caption, { color: colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>
                Thử đổi từ khóa tìm kiếm hoặc chọn danh mục khác nhé.
              </Text>
            </View>
          ) : (
            <View style={styles.productGrid}>
              {products.map((item) => {
                const merchantStyle = getMerchantColor(item.merchantName);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handlePressProduct(item)}
                    style={[
                      styles.productCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                      },
                    ]}
                  >
                    {/* Image Box */}
                    <View style={styles.cardImageWrapper}>
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.cardImage} resizeMode="cover" />
                      ) : (
                        <View style={[styles.placeholderBox, { backgroundColor: colors.surfaceElevated }]}>
                          <MaterialCommunityIcons name="package-variant" size={32} color={colors.textTertiary} />
                        </View>
                      )}

                      {/* Merchant Badge (Shopee, Lazada, Tiki) */}
                      <View style={[styles.merchantBadge, { backgroundColor: merchantStyle.bg }]}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: merchantStyle.text }}>
                          {item.merchantName}
                        </Text>
                      </View>

                      {/* Pet species icon badge */}
                      {item.petType !== 'all' && (
                        <View style={styles.speciesIconBadge}>
                          <MaterialCommunityIcons
                            name={item.petType === 'dog' ? 'dog' : 'cat'}
                            size={12}
                            color="#FFFFFF"
                          />
                        </View>
                      )}
                    </View>

                    {/* Info */}
                    <View style={styles.cardInfo}>
                      <Text style={[typo.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.categoryName || 'Sản phẩm'}
                      </Text>

                      <Text
                        style={[typo.labelMedium, { color: colors.text, fontWeight: '700', marginTop: 2, height: 36 }]}
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>

                      {/* Price & Action Button */}
                      <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#DC2626' }}>
                          {formatPriceVND(item.price)}
                        </Text>

                        <Pressable
                          onPress={() => handleOpenAffiliateLink(item)}
                          hitSlop={6}
                          style={[styles.buyBtn, { backgroundColor: colors.primary }]}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>Mua</Text>
                          <MaterialCommunityIcons name="arrow-top-right" size={12} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Product Detail Modal */}
      <Modal
        visible={isDetailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismissArea} onPress={() => setIsDetailModalVisible(false)} />
          {selectedProduct && (
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: colors.surface,
                  borderTopLeftRadius: radius.xl,
                  borderTopRightRadius: radius.xl,
                  paddingBottom: Math.max(insets.bottom, 20),
                },
              ]}
            >
              <View style={styles.modalDragHandle} />

              {/* Close Button */}
              <View style={styles.modalHeaderRow}>
                <Text style={[typo.titleMedium, { color: colors.text, fontWeight: '800', flex: 1 }]}>
                  Chi tiết sản phẩm
                </Text>
                <Pressable onPress={() => setIsDetailModalVisible(false)} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                {/* Large Product Image */}
                {selectedProduct.imageUrl ? (
                  <Image
                    source={{ uri: selectedProduct.imageUrl }}
                    style={{ width: '100%', height: 200, borderRadius: radius.md }}
                    resizeMode="cover"
                  />
                ) : null}

                {/* Tags row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  <View
                    style={[
                      styles.merchantBadgeInline,
                      { backgroundColor: getMerchantColor(selectedProduct.merchantName).bg },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: getMerchantColor(selectedProduct.merchantName).text }}>
                      {selectedProduct.merchantName}
                    </Text>
                  </View>

                  <View style={[styles.catBadgeInline, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>
                      {selectedProduct.categoryName || 'Phụ kiện'}
                    </Text>
                  </View>

                  <View style={[styles.catBadgeInline, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>
                      {selectedProduct.petType === 'dog' ? '🐕 Dành cho Chó' : selectedProduct.petType === 'cat' ? '🐈 Dành cho Mèo' : '🐕🐈 Chó & Mèo'}
                    </Text>
                  </View>
                </View>

                {/* Title */}
                <Text style={[typo.titleMedium, { color: colors.text, fontWeight: '800', marginTop: 10 }]}>
                  {selectedProduct.name}
                </Text>

                {/* Price */}
                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6, gap: 6 }}>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#DC2626' }}>
                    {formatPriceVND(selectedProduct.price)}
                  </Text>
                  <Text style={[typo.caption, { color: colors.textSecondary }]}>
                    (Giá tham khảo)
                  </Text>
                </View>

                {/* Description */}
                <Text style={[typo.labelLarge, { color: colors.text, marginTop: 14, fontWeight: '700' }]}>
                  Mô tả sản phẩm
                </Text>
                <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 4, lineHeight: 22 }]}>
                  {selectedProduct.description}
                </Text>

                {/* Disclaimer in Modal */}
                <View style={[styles.modalDisclaimer, { backgroundColor: colors.surfaceElevated, borderRadius: radius.sm }]}>
                  <MaterialCommunityIcons name="information-outline" size={16} color={colors.textSecondary} />
                  <Text style={[typo.caption, { color: colors.textSecondary, flex: 1, lineHeight: 18 }]}>
                    Khi nhấn "Mua ngay", bạn sẽ được chuyển hướng sang nền tảng bán hàng của đối tác ({selectedProduct.merchantName}). PetCare AI không xử lý giao dịch hoặc giao hàng trực tiếp.
                  </Text>
                </View>
              </ScrollView>

              {/* Action Button: Mua ngay trên sàn */}
              <Pressable
                onPress={() => handleOpenAffiliateLink(selectedProduct)}
                style={[styles.modalBuyBtn, { backgroundColor: colors.primary, borderRadius: radius.full }]}
              >
                <MaterialCommunityIcons name="shopping-outline" size={20} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15, marginLeft: 8 }}>
                  Mua ngay trên {selectedProduct.merchantName}
                </Text>
                <MaterialCommunityIcons name="arrow-top-right" size={16} color="#FFFFFF" style={{ marginLeft: 4 }} />
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  navIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  disclosureBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    padding: 0,
  },
  speciesTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  productCard: {
    width: CARD_WIDTH,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImageWrapper: {
    width: '100%',
    height: 130,
    position: 'relative',
    backgroundColor: '#F8FAFC',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  placeholderBox: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  speciesIconBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    padding: 10,
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalContent: {
    padding: 16,
    maxHeight: '85%',
  },
  modalDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  merchantBadgeInline: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catBadgeInline: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modalDisclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    marginTop: 14,
    gap: 8,
  },
  modalBuyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 14,
  },
});
