/**
 * PawCare AI — Article Detail Screen (Chi tiết bài viết & Kiến thức thú cưng)
 *
 * Displays full editorial content with rich formatting, species badge,
 * source attribution, and external reference URL linking.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';

import { useAppTheme } from '@/presentation/theme';
import { useArticleStore } from '@/presentation/stores/useArticleStore';
import type { Article, TargetSpecies } from '@/domain/entities/Article';

function getSpeciesLabel(species?: TargetSpecies): { label: string; icon: string; color: string } {
  switch (species) {
    case 'dog':
      return { label: 'Chó cưng', icon: 'dog', color: '#0284C7' };
    case 'cat':
      return { label: 'Mèo cưng', icon: 'cat', color: '#7C3AED' };
    default:
      return { label: 'Chó & Mèo', icon: 'paw', color: '#16A34A' };
  }
}

function formatDateVi(dateStr?: string | null): string {
  if (!dateStr) return 'Gần đây';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

/** Rich Text / Markdown Content Renderer */
function RenderArticleContent({ content, colors, typo, spacing, radius }: any) {
  const blocks = content.split('\n\n');

  return (
    <View style={{ marginTop: spacing.md }}>
      {blocks.map((block: string, index: number) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Heading 2 (##)
        if (trimmed.startsWith('## ')) {
          const headingText = trimmed.replace('## ', '');
          return (
            <View key={index} style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 4,
                    height: 20,
                    backgroundColor: colors.primary,
                    borderRadius: 2,
                    marginRight: spacing.sm,
                  }}
                />
                <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '700' }]}>
                  {headingText}
                </Text>
              </View>
            </View>
          );
        }

        // Heading 3 (###)
        if (trimmed.startsWith('### ')) {
          const headingText = trimmed.replace('### ', '');
          return (
            <Text
              key={index}
              style={[
                typo.titleMedium,
                { color: colors.text, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.xs },
              ]}
            >
              {headingText}
            </Text>
          );
        }

        // Blockquote / Tip (> ...)
        if (trimmed.startsWith('> ')) {
          const tipText = trimmed.replace(/^>\s*/gm, '');
          return (
            <View
              key={index}
              style={[
                styles.tipBox,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.primary,
                  borderRadius: radius.md,
                  marginVertical: spacing.sm,
                  padding: spacing.md,
                },
              ]}
            >
              <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color={colors.primary} />
              <Text style={[typo.bodyMedium, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>
                {tipText}
              </Text>
            </View>
          );
        }

        // Bullet lists
        if (trimmed.includes('\n- ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const lines = trimmed.split('\n');
          return (
            <View key={index} style={{ marginVertical: spacing.xs }}>
              {lines.map((line, lIdx) => {
                const cleanLine = line.replace(/^[-*]\s+/, '').trim();
                return (
                  <View key={lIdx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 3 }}>
                    <Text style={{ color: colors.primary, marginRight: 8, fontSize: 16, lineHeight: 22 }}>•</Text>
                    <Text style={[typo.bodyMedium, { color: colors.text, flex: 1, lineHeight: 24 }]}>
                      {cleanLine}
                    </Text>
                  </View>
                );
              })}
            </View>
          );
        }

        // Numbered lists (1. , 2. )
        if (/^\d+\.\s/.test(trimmed)) {
          const lines = trimmed.split('\n');
          return (
            <View key={index} style={{ marginVertical: spacing.xs }}>
              {lines.map((line, lIdx) => {
                const match = line.match(/^(\d+)\.\s+(.*)/);
                if (match) {
                  return (
                    <View key={lIdx} style={{ flexDirection: 'row', alignItems: 'flex-start', marginVertical: 4 }}>
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: colors.surfaceElevated,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 8,
                          marginTop: 1,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                          {match[1]}
                        </Text>
                      </View>
                      <Text style={[typo.bodyMedium, { color: colors.text, flex: 1, lineHeight: 24 }]}>
                        {match[2]}
                      </Text>
                    </View>
                  );
                }
                return (
                  <Text key={lIdx} style={[typo.bodyMedium, { color: colors.text, lineHeight: 24 }]}>
                    {line}
                  </Text>
                );
              })}
            </View>
          );
        }

        // Standard Paragraph
        return (
          <Text
            key={index}
            style={[
              typo.bodyLarge,
              { color: colors.text, lineHeight: 26, marginVertical: spacing.xs },
            ]}
          >
            {trimmed}
          </Text>
        );
      })}
    </View>
  );
}

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const { currentArticle, loadArticleDetail, isLoading, articles } = useArticleStore();

  const [article, setArticle] = useState<Article | null>(currentArticle?.id === id ? currentArticle : null);

  useEffect(() => {
    if (id) {
      void loadArticleDetail(id).then((res) => {
        if (res) setArticle(res);
      });
    }
  }, [id, loadArticleDetail]);

  const handleOpenSource = async () => {
    if (!article?.sourceUrl) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await WebBrowser.openBrowserAsync(article.sourceUrl);
    } catch {
      await Linking.openURL(article.sourceUrl).catch(() => {
        Alert.alert('Không thể mở liên kết', 'Vui lòng kiểm tra lại đường dẫn trang web.');
      });
    }
  };

  const handleShare = async () => {
    if (!article) return;
    void Haptics.selectionAsync();
    try {
      await Share.share({
        title: article.title,
        message: `${article.title}\n\nĐọc thêm cẩm nang chăm sóc thú cưng tại PetCare AI!\n${article.sourceUrl ? `Nguồn tham khảo: ${article.sourceUrl}` : ''}`,
      });
    } catch {}
  };

  if (isLoading && !article) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[typo.bodyMedium, { color: colors.textSecondary, marginTop: spacing.md }]}>
          Đang tải bài viết...
        </Text>
      </View>
    );
  }

  if (!article) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="file-document-remove-outline" size={64} color={colors.textTertiary} />
        <Text style={[typo.titleLarge, { color: colors.text, marginTop: spacing.md }]}>
          Bài viết không tồn tại
        </Text>
        <Text style={[typo.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
          Bài viết có thể đã bị ẩn hoặc gỡ bỏ bởi quản trị viên.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.primary, borderRadius: radius.md, marginTop: spacing.lg }]}
        >
          <Text style={[typo.labelLarge, { color: '#FFF' }]}>Quay lại</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const speciesInfo = getSpeciesLabel(article.targetSpecies);
  const relatedArticles = articles.filter((a) => a.id !== article.id && a.status === 'published').slice(0, 3);

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

        <Text style={[typo.titleMedium, { color: colors.text, flex: 1, marginHorizontal: spacing.sm }]} numberOfLines={1}>
          Kiến thức thú cưng
        </Text>

        <Pressable
          onPress={handleShare}
          style={[styles.navIconBtn, { backgroundColor: colors.surfaceElevated }]}
          hitSlop={8}
        >
          <MaterialCommunityIcons name="share-variant-outline" size={22} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {/* Cover Image */}
        {Boolean(article.coverImageUrl) && (
          <View style={styles.coverWrapper}>
            <Image
              source={{ uri: article.coverImageUrl! }}
              style={styles.coverImage}
              resizeMode="cover"
            />
            {/* Overlay Badges */}
            <View style={styles.badgeOverlay}>
              <View style={[styles.speciesBadge, { backgroundColor: speciesInfo.color }]}>
                <MaterialCommunityIcons name={speciesInfo.icon as any} size={14} color="#FFF" />
                <Text style={styles.speciesBadgeText}>{speciesInfo.label}</Text>
              </View>

              {Boolean(article.categoryName) && (
                <View style={[styles.catBadge, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
                  <Text style={styles.catBadgeText}>{article.categoryName}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          {/* Metadata Row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="calendar-clock" size={15} color={colors.textSecondary} />
              <Text style={[typo.labelSmall, { color: colors.textSecondary, marginLeft: 4 }]}>
                {formatDateVi(article.publishedAt)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="eye-outline" size={15} color={colors.textSecondary} />
              <Text style={[typo.labelSmall, { color: colors.textSecondary, marginLeft: 4 }]}>
                {article.viewsCount} lượt xem
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="account-edit-outline" size={15} color={colors.textSecondary} />
              <Text style={[typo.labelSmall, { color: colors.textSecondary, marginLeft: 4 }]} numberOfLines={1}>
                {article.authorName}
              </Text>
            </View>
          </View>

          {/* Title */}
          <Text style={[typo.headlineMedium, { color: colors.text, marginTop: spacing.sm, fontWeight: '800', lineHeight: 32 }]}>
            {article.title}
          </Text>

          {/* Excerpt Summary Box */}
          <View
            style={[
              styles.excerptCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.md,
                marginTop: spacing.md,
                padding: spacing.md,
              },
            ]}
          >
            <Text style={[typo.bodyMedium, { color: colors.textSecondary, fontStyle: 'italic', lineHeight: 22 }]}>
              "{article.excerpt}"
            </Text>
          </View>

          {/* Full Content */}
          <RenderArticleContent
            content={article.content}
            colors={colors}
            typo={typo}
            spacing={spacing}
            radius={radius}
          />

          {/* Source Attribution Card */}
          <View
            style={[
              styles.sourceCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radius.lg,
                marginTop: spacing.xl,
                padding: spacing.md,
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <MaterialCommunityIcons name="shield-check-outline" size={20} color={colors.primary} />
              <Text style={[typo.labelLarge, { color: colors.text, marginLeft: spacing.xs, fontWeight: '700' }]}>
                Nguồn tham khảo & Bản quyền
              </Text>
            </View>

            <Text style={[typo.bodySmall, { color: colors.textSecondary, lineHeight: 18 }]}>
              Nội dung bài viết được Ban biên tập PetCare AI tổng hợp, biên dịch và tóm tắt có chọn lọc từ nguồn chuyên môn uy tín:
            </Text>

            {Boolean(article.sourceName) && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
                <MaterialCommunityIcons name="newspaper-variant-outline" size={16} color={colors.text} />
                <Text style={[typo.labelMedium, { color: colors.text, marginLeft: 6, fontWeight: '600' }]}>
                  {article.sourceName}
                </Text>
              </View>
            )}

            {Boolean(article.sourceUrl) && (
              <Pressable
                onPress={handleOpenSource}
                style={[
                  styles.openSourceBtn,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    marginTop: spacing.sm,
                  },
                ]}
              >
                <MaterialCommunityIcons name="open-in-new" size={16} color={colors.primary} />
                <Text style={[typo.labelMedium, { color: colors.primary, marginLeft: 6, fontWeight: '600' }]}>
                  Mở bài viết nguồn gốc trên trình duyệt
                </Text>
              </Pressable>
            )}
          </View>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '700', marginBottom: spacing.md }]}>
                Bài viết liên quan
              </Text>

              {relatedArticles.map((rel) => {
                const relSpecies = getSpeciesLabel(rel.targetSpecies);
                return (
                  <Pressable
                    key={rel.id}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push({
                        pathname: '/article-detail',
                        params: { id: rel.id },
                      });
                    }}
                    style={[
                      styles.relatedCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                        marginBottom: spacing.sm,
                      },
                    ]}
                  >
                    {Boolean(rel.coverImageUrl) && (
                      <Image source={{ uri: rel.coverImageUrl! }} style={styles.relatedThumb} />
                    )}
                    <View style={{ flex: 1, marginLeft: spacing.sm, justifyContent: 'center' }}>
                      <Text style={[typo.labelSmall, { color: relSpecies.color, fontWeight: '700' }]}>
                        {relSpecies.label}
                      </Text>
                      <Text style={[typo.titleSmall, { color: colors.text, marginTop: 2 }]} numberOfLines={2}>
                        {rel.title}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  navIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  coverWrapper: {
    width: '100%',
    height: 230,
    position: 'relative',
    backgroundColor: '#1E293B',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  badgeOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  speciesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  speciesBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  catBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  catBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  excerptCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#0284C7',
    borderWidth: 1,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 3,
  },
  sourceCard: {
    borderWidth: 1,
  },
  openSourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  relatedCard: {
    flexDirection: 'row',
    padding: 10,
    borderWidth: 1,
  },
  relatedThumb: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
});

