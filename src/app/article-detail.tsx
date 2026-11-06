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
import { useAffiliateProductStore } from '@/presentation/stores/useAffiliateProductStore';
import type { Article, TargetSpecies } from '@/domain/entities/Article';
import type { AffiliateProduct } from '@/domain/entities/AffiliateProduct';

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

interface ParsedBlock {
  type: 'h2' | 'h3' | 'quote' | 'bullet' | 'numbered' | 'paragraph';
  number?: string;
  text: string;
}

/** Render inline text with **bold** formatting support */
function renderInlineText(text: string, baseStyle: any, boldStyle: any) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <Text style={baseStyle}>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
          return (
            <Text key={idx} style={boldStyle}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

/** Rich Text / Markdown Content Renderer */
function RenderArticleContent({ content, isLargeFont, colors, spacing, radius }: any) {
  if (!content) return null;

  // 1. Clean & normalize linebreaks (convert literal \n or \\n from database/JSON to real newlines)
  const normalized = String(content)
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // 2. Parse line-by-line into structured semantic blocks
  const rawLines = normalized.split('\n');
  const blocks: ParsedBlock[] = [];

  let currentQuote: string[] = [];
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      blocks.push({ type: 'paragraph', text: currentParagraph.join(' ') });
      currentParagraph = [];
    }
  };

  const flushQuote = () => {
    if (currentQuote.length > 0) {
      blocks.push({ type: 'quote', text: currentQuote.join(' ') });
      currentQuote = [];
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i].trim();

    if (!rawLine) {
      flushParagraph();
      flushQuote();
      continue;
    }

    // Heading 2 (## ...)
    if (rawLine.startsWith('## ')) {
      flushParagraph();
      flushQuote();
      blocks.push({ type: 'h2', text: rawLine.replace(/^##\s+/, '') });
      continue;
    }

    // Heading 3 (### ...)
    if (rawLine.startsWith('### ')) {
      flushParagraph();
      flushQuote();
      blocks.push({ type: 'h3', text: rawLine.replace(/^###\s+/, '') });
      continue;
    }

    // Blockquote (> ...)
    if (rawLine.startsWith('>') || rawLine.startsWith('> ')) {
      flushParagraph();
      const quoteText = rawLine.replace(/^>\s*/, '');
      currentQuote.push(quoteText);
      continue;
    } else {
      flushQuote();
    }

    // Bullet item (- ... or * ... or • ...)
    if (rawLine.startsWith('- ') || rawLine.startsWith('* ') || rawLine.startsWith('• ')) {
      flushParagraph();
      blocks.push({ type: 'bullet', text: rawLine.replace(/^[-*•]\s+/, '') });
      continue;
    }

    // Numbered item (1. ... or 2) ...)
    const numMatch = rawLine.match(/^(\d+)[\.\)]\s+(.*)/);
    if (numMatch) {
      flushParagraph();
      blocks.push({ type: 'numbered', number: numMatch[1], text: numMatch[2] });
      continue;
    }

    // Regular line in paragraph
    currentParagraph.push(rawLine);
  }

  flushParagraph();
  flushQuote();

  const isLarge = Boolean(isLargeFont);
  const baseFontSize = isLarge ? 17 : 15;
  const baseLineHeight = isLarge ? 28 : 25;

  const textBase = {
    fontSize: baseFontSize,
    lineHeight: baseLineHeight,
    color: colors.text,
  };
  const textBold = {
    fontSize: baseFontSize,
    lineHeight: baseLineHeight,
    fontWeight: '700' as const,
    color: colors.text,
  };

  return (
    <View style={{ marginTop: spacing.md, gap: 10 }}>
      {blocks.map((block, idx) => {
        if (block.type === 'h2') {
          return (
            <View key={idx} style={{ marginTop: 20, marginBottom: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 4,
                    height: isLarge ? 24 : 20,
                    backgroundColor: colors.primary,
                    borderRadius: 2,
                    marginRight: 8,
                  }}
                />
                <Text
                  style={{
                    fontSize: isLarge ? 20 : 18,
                    fontWeight: '800',
                    color: colors.text,
                    flex: 1,
                    lineHeight: isLarge ? 28 : 26,
                  }}
                >
                  {block.text}
                </Text>
              </View>
            </View>
          );
        }

        if (block.type === 'h3') {
          return (
            <Text
              key={idx}
              style={{
                fontSize: isLarge ? 18 : 16,
                fontWeight: '700',
                color: colors.text,
                marginTop: 14,
                marginBottom: 2,
                lineHeight: isLarge ? 26 : 24,
              }}
            >
              {block.text}
            </Text>
          );
        }

        if (block.type === 'quote') {
          const isWarning =
            block.text.toLowerCase().includes('cảnh báo') ||
            block.text.toLowerCase().includes('nguy hiểm') ||
            block.text.toLowerCase().includes('lưu ý');
          const accentColor = isWarning ? '#EAB308' : colors.primary;
          const iconName = isWarning ? 'alert-circle-outline' : 'lightbulb-on-outline';

          return (
            <View
              key={idx}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                backgroundColor: colors.surfaceElevated,
                borderLeftWidth: 4,
                borderLeftColor: accentColor,
                borderRadius: radius.md,
                padding: 12,
                marginVertical: 6,
                gap: 10,
              }}
            >
              <MaterialCommunityIcons
                name={iconName as any}
                size={22}
                color={accentColor}
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                {renderInlineText(
                  block.text,
                  { fontSize: isLarge ? 15 : 14, lineHeight: isLarge ? 24 : 22, color: colors.text },
                  { fontWeight: '700', color: accentColor }
                )}
              </View>
            </View>
          );
        }

        if (block.type === 'bullet') {
          return (
            <View
              key={idx}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingLeft: 4,
                marginVertical: 2,
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 18, lineHeight: baseLineHeight, marginRight: 8 }}>
                •
              </Text>
              <View style={{ flex: 1 }}>
                {renderInlineText(block.text, textBase, textBold)}
              </View>
            </View>
          );
        }

        if (block.type === 'numbered') {
          return (
            <View
              key={idx}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingLeft: 2,
                marginVertical: 4,
              }}
            >
              <View
                style={{
                  width: isLarge ? 26 : 24,
                  height: isLarge ? 26 : 24,
                  borderRadius: 13,
                  backgroundColor: colors.primaryContainer || colors.surfaceElevated,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                  marginTop: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>
                  {block.number}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                {renderInlineText(block.text, textBase, textBold)}
              </View>
            </View>
          );
        }

        // Standard Paragraph
        return (
          <View key={idx} style={{ marginVertical: 3 }}>
            {renderInlineText(block.text, textBase, textBold)}
          </View>
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
  const { getProductsByArticleId } = useAffiliateProductStore();

  const [article, setArticle] = useState<Article | null>(currentArticle?.id === id ? currentArticle : null);
  const [fontSizeMode, setFontSizeMode] = useState<'normal' | 'large'>('normal');
  const [relatedProducts, setRelatedProducts] = useState<AffiliateProduct[]>([]);

  useEffect(() => {
    if (id) {
      void loadArticleDetail(id).then((res) => {
        if (res) setArticle(res);
      });
      void getProductsByArticleId(id).then((prods) => {
        setRelatedProducts(prods);
      });
    }
  }, [id, loadArticleDetail, getProductsByArticleId]);

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

        <Text style={[typo.titleMedium, { color: colors.text, flex: 1, marginHorizontal: spacing.sm, fontWeight: '700' }]} numberOfLines={1}>
          Kiến thức thú cưng
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Toggle Font Size (Normal: 15px / Large: 17px) */}
          <Pressable
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFontSizeMode((prev) => (prev === 'normal' ? 'large' : 'normal'));
            }}
            style={[
              styles.navIconBtn,
              {
                backgroundColor: fontSizeMode === 'large' ? colors.primaryContainer || '#DBEAFE' : colors.surfaceElevated,
                borderColor: fontSizeMode === 'large' ? colors.primary : 'transparent',
                borderWidth: fontSizeMode === 'large' ? 1 : 0,
              },
            ]}
            hitSlop={8}
          >
            <MaterialCommunityIcons
              name={fontSizeMode === 'normal' ? 'format-size' : 'format-font-size-increase'}
              size={20}
              color={fontSizeMode === 'large' ? colors.primary : colors.text}
            />
          </Pressable>

          <Pressable
            onPress={handleShare}
            style={[styles.navIconBtn, { backgroundColor: colors.surfaceElevated }]}
            hitSlop={8}
          >
            <MaterialCommunityIcons name="share-variant-outline" size={20} color={colors.text} />
          </Pressable>
        </View>
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

          {/* Full Content with Rich Markdown Rendering & Font Scaling */}
          <RenderArticleContent
            content={article.content}
            isLargeFont={fontSizeMode === 'large'}
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

          {/* Related Affiliate Products Section */}
          {relatedProducts.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="shopping-outline" size={20} color={colors.primary} />
                  <Text style={[typo.titleLarge, { color: colors.text, fontWeight: '700', marginLeft: 8 }]}>
                    Sản phẩm liên quan khuyên dùng
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push('/shop')}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                  hitSlop={8}
                >
                  <Text style={[typo.labelMedium, { color: colors.primary, fontWeight: '600' }]}>Xem Shop</Text>
                  <MaterialCommunityIcons name="chevron-right" size={16} color={colors.primary} />
                </Pressable>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {relatedProducts.map((prod) => (
                  <View
                    key={prod.id}
                    style={[
                      styles.relatedProductCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderRadius: radius.md,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: prod.imageUrl || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400' }}
                      style={styles.relatedProductThumb}
                      resizeMode="cover"
                    />
                    <View style={{ padding: 10, flex: 1, justifyContent: 'space-between' }}>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <View
                            style={{
                              backgroundColor: colors.primaryContainer || '#DBEAFE',
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>
                              {prod.merchantName || 'Shopee'}
                            </Text>
                          </View>
                        </View>
                        <Text style={[typo.titleSmall, { color: colors.text, fontWeight: '700' }]} numberOfLines={2}>
                          {prod.name}
                        </Text>
                        <Text style={[typo.labelLarge, { color: '#E11D48', fontWeight: '800', marginTop: 4 }]}>
                          {prod.price > 0 ? `${prod.price.toLocaleString('vi-VN')} đ` : 'Xem giá ưu đãi'}
                        </Text>
                      </View>

                      <Pressable
                        onPress={async () => {
                          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          if (prod.affiliateUrl) {
                            try {
                              await WebBrowser.openBrowserAsync(prod.affiliateUrl);
                            } catch {
                              await Linking.openURL(prod.affiliateUrl).catch(() => {
                                Alert.alert('Lỗi', 'Không thể mở liên kết mua sắm.');
                              });
                            }
                          }
                        }}
                        style={[styles.buyBtnSmall, { backgroundColor: colors.primary, borderRadius: radius.sm }]}
                      >
                        <MaterialCommunityIcons name="cart-outline" size={14} color="#FFF" />
                        <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>Mua ngay</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

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
  relatedProductCard: {
    width: 190,
    borderWidth: 1,
    overflow: 'hidden',
  },
  relatedProductThumb: {
    width: '100%',
    height: 120,
    backgroundColor: '#334155',
  },
  buyBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 8,
  },
});

