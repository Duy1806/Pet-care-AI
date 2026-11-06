/**
 * PawCare AI — PetCare Blog / Kiến thức thú cưng
 *
 * User knowledge hub for pet care guides, nutrition tips, grooming tutorials
 * with species & category filters, search bar, and offline-first reading.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useArticleStore } from '@/presentation/stores/useArticleStore';
import type { Article, TargetSpecies } from '@/domain/entities/Article';

interface SpeciesTab {
  id: TargetSpecies;
  label: string;
  icon: string;
}

const SPECIES_TABS: SpeciesTab[] = [
  { id: 'all', label: 'Tất cả (Chó & Mèo)', icon: 'paw' },
  { id: 'dog', label: 'Chó cưng', icon: 'dog' },
  { id: 'cat', label: 'Mèo cưng', icon: 'cat' },
];

function formatDateVi(dateStr?: string | null): string {
  if (!dateStr) return 'Mới đăng';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export default function BlogScreen() {
  const insets = useSafeAreaInsets();
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const {
    articles,
    categories,
    selectedCategory,
    selectedSpecies,
    searchQuery,
    isLoading,
    loadCategories,
    loadPublishedArticles,
    setSelectedCategory,
    setSelectedSpecies,
    setSearchQuery,
  } = useArticleStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);

  useEffect(() => {
    void loadCategories();
    void loadPublishedArticles();
  }, [loadCategories, loadPublishedArticles]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.allSettled([loadCategories(), loadPublishedArticles()]);
    setIsRefreshing(false);
  };

  const handleSearchSubmit = () => {
    setSearchQuery(localSearch);
  };

  const renderArticleCard = ({ item }: { item: Article }) => {
    const speciesLabel = SPECIES_TABS.find((s) => s.id === item.targetSpecies)?.label || 'Tất cả';

    return (
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({
            pathname: '/article-detail',
            params: { id: item.id },
          });
        }}
        style={({ pressed }) => [
          styles.articleCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.lg,
            opacity: pressed ? 0.92 : 1,
            marginBottom: spacing.md,
          },
        ]}
      >
        {Boolean(item.coverImageUrl) && (
          <View style={styles.cardImageContainer}>
            <Image
              source={{ uri: item.coverImageUrl! }}
              style={styles.cardImage}
              resizeMode="cover"
            />
            {/* Category badge overlay */}
            <View style={styles.badgeRow}>
              <View style={[styles.speciesTag, { backgroundColor: '#0284C7' }]}>
                <Text style={styles.speciesTagText}>{speciesLabel}</Text>
              </View>

              {Boolean(item.categoryName) && (
                <View style={[styles.catTag, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
                  <Text style={styles.catTagText}>{item.categoryName}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={{ padding: spacing.md }}>
          <Text style={[typo.titleMedium, { color: colors.text, fontWeight: '700', lineHeight: 22 }]} numberOfLines={2}>
            {item.title}
          </Text>

          <Text style={[typo.bodySmall, { color: colors.textSecondary, marginTop: 4, lineHeight: 18 }]} numberOfLines={2}>
            {item.excerpt}
          </Text>

          <View style={[styles.cardFooter, { marginTop: spacing.sm, borderTopColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="calendar-outline" size={14} color={colors.textTertiary} />
              <Text style={[typo.labelSmall, { color: colors.textTertiary, marginLeft: 4 }]}>
                {formatDateVi(item.publishedAt)}
              </Text>
            </View>

            {Boolean(item.sourceName) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '50%' }}>
                <MaterialCommunityIcons name="newspaper-variant-outline" size={14} color={colors.textTertiary} />
                <Text style={[typo.labelSmall, { color: colors.textTertiary, marginLeft: 4 }]} numberOfLines={1}>
                  {item.sourceName}
                </Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="eye-outline" size={14} color={colors.textTertiary} />
              <Text style={[typo.labelSmall, { color: colors.textTertiary, marginLeft: 3 }]}>
                {item.viewsCount}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.surfaceElevated }]}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
        </Pressable>

        <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
          <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '800' }]}>
            Kiến thức thú cưng
          </Text>
          <Text style={[typo.bodySmall, { color: colors.textSecondary }]}>
            Cẩm nang & hướng dẫn chăm sóc chuẩn thú y
          </Text>
        </View>
      </View>

      {/* Search Input Bar */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm }}>
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.md,
            },
          ]}
        >
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textTertiary} />
          <TextInput
            value={localSearch}
            onChangeText={(txt) => {
              setLocalSearch(txt);
              if (!txt.trim()) setSearchQuery('');
            }}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
            placeholder="Tìm kiếm kinh nghiệm, tắm, dinh dưỡng..."
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {Boolean(localSearch) && (
            <Pressable
              onPress={() => {
                setLocalSearch('');
                setSearchQuery('');
              }}
            >
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Species Selector Bar */}
      <View style={{ marginTop: spacing.sm }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}
        >
          {SPECIES_TABS.map((tab) => {
            const isSelected = selectedSpecies === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setSelectedSpecies(tab.id);
                }}
                style={[
                  styles.speciesPill,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={tab.icon as any}
                  size={16}
                  color={isSelected ? '#FFF' : colors.textSecondary}
                />
                <Text
                  style={[
                    typo.labelMedium,
                    {
                      color: isSelected ? '#FFF' : colors.text,
                      marginLeft: 4,
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

      {/* Categories Filter Pills */}
      {categories.length > 0 && (
        <View style={{ marginTop: spacing.xs, marginBottom: spacing.xs }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 6 }}
          >
            <Pressable
              onPress={() => {
                void Haptics.selectionAsync();
                setSelectedCategory(null);
              }}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selectedCategory === null ? colors.surfaceElevated : 'transparent',
                  borderColor: selectedCategory === null ? colors.primary : colors.border,
                  borderRadius: radius.md,
                },
              ]}
            >
              <Text
                style={[
                  typo.labelSmall,
                  {
                    color: selectedCategory === null ? colors.primary : colors.textSecondary,
                    fontWeight: selectedCategory === null ? '700' : '500',
                  },
                ]}
              >
                Tất cả chủ đề
              </Text>
            </Pressable>

            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setSelectedCategory(isSelected ? null : cat.id);
                  }}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: isSelected ? colors.surfaceElevated : 'transparent',
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typo.labelSmall,
                      {
                        color: isSelected ? colors.primary : colors.textSecondary,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Article List */}
      <FlatList
        data={articles}
        keyExtractor={(item) => item.id}
        renderItem={renderArticleCard}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + 24,
        }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[typo.bodyMedium, { color: colors.textSecondary, marginTop: spacing.md }]}>
                Đang tải bài viết...
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="book-open-blank-variant" size={56} color={colors.textTertiary} />
              <Text style={[typo.titleMedium, { color: colors.text, marginTop: spacing.md, fontWeight: '700' }]}>
                Không tìm thấy bài viết
              </Text>
              <Text style={[typo.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                Chưa có bài viết nào phù hợp với bộ lọc hoặc từ khóa bạn tìm. Hãy thử chọn loài thú cưng hoặc danh mục khác!
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    height: '100%',
  },
  speciesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  articleCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImageContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
    backgroundColor: '#1E293B',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  badgeRow: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
  },
  speciesTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  speciesTagText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  catTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  catTagText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
});

