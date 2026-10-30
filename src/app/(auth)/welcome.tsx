/**
 * PawCare AI — Welcome / Onboarding Screen
 *
 * 3-slide parallax pager with full-bleed pet photos.
 * Features: animated page indicator, glassmorphism floating card,
 * floating glass chips over photos, fade/parallax transitions.
 *
 * All text in Vietnamese.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  type SharedValue,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { GlassCard } from '@/presentation/components/GlassCard';
import { PrimaryButton } from '@/presentation/components/PrimaryButton';
import { ThemeToggle } from '@/presentation/components/ThemeToggle';
import { useAppTheme } from '@/presentation/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- Slide data ---

interface OnboardingSlide {
  id: string;
  image: any;
  chipLabel: string;
  title: string;
  description: string;
}

const slides: OnboardingSlide[] = [
  {
    id: '1',
    image: require('@/assets/images/onboarding/slide-1-scan.jpg'),
    chipLabel: 'Golden Retriever 98%',
    title: 'Nhận diện giống loài bằng AI',
    description:
      'Chụp ảnh thú cưng, AI sẽ nhận diện giống loài kèm độ tin cậy chính xác. Hỗ trợ hàng trăm giống chó và mèo.',
  },
  {
    id: '2',
    image: require('@/assets/images/onboarding/slide-2-nutrition.jpg'),
    chipLabel: 'Khẩu phần: 320 kcal/ngày',
    title: 'Gợi ý dinh dưỡng thông minh',
    description:
      'Tính khẩu phần theo giống, cân nặng, độ tuổi và mức độ vận động. AI giải thích chi tiết cho bạn.',
  },
  {
    id: '3',
    image: require('@/assets/images/onboarding/slide-3-care.jpg'),
    chipLabel: 'Tiêm phòng: 3 ngày nữa',
    title: 'Chăm sóc thú cưng mỗi ngày',
    description:
      'Hồ sơ sức khỏe, biểu đồ tăng trưởng, nhắc lịch tiêm phòng, tẩy giun và tái khám. Không bỏ lỡ điều gì.',
  },
];

const VIEWABILITY_CONFIG = { viewAreaCoveragePercentThreshold: 50 };

export default function WelcomeScreen() {
  const { colors, typography: typo, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const handleNext = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      router.replace('/(auth)/register' as any);
    }
  }, [activeIndex]);

  const handleLogin = useCallback(() => {
    router.push('/(auth)/login' as any);
  }, []);

  const handleSkip = useCallback(() => {
    router.replace('/(auth)/login' as any);
  }, []);

  const renderSlide = useCallback(
    ({ item, index }: ListRenderItemInfo<OnboardingSlide>) => (
      <SlideItem item={item} index={index} scrollX={scrollX} />
    ),
    [scrollX],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY_CONFIG}
        bounces={false}
      />

      {/* Skip button (top right) */}
      <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
        <ThemeToggle color="rgba(255,255,255,0.9)" />
        <Pressable
          onPress={handleSkip}
          hitSlop={12}
          accessibilityLabel="Bỏ qua giới thiệu"
        >
          <Text style={[typo.labelLarge, { color: 'rgba(255,255,255,0.9)' }]}>
            Bỏ qua
          </Text>
        </Pressable>
      </View>

      {/* Bottom floating glass card */}
      <View
        style={[
          styles.bottomCard,
          {
            paddingBottom: insets.bottom + spacing.md,
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        <GlassCard padding="lg">
          {/* Page indicator */}
          <View style={[styles.indicatorRow, { marginBottom: spacing.md }]}>
            {slides.map((_, i) => (
              <PageDot key={i} index={i} activeIndex={activeIndex} />
            ))}
          </View>

          <Text style={[typo.headlineLarge, { color: colors.text, marginBottom: spacing.sm }]}>
            {slides[activeIndex].title}
          </Text>
          <Text
            style={[
              typo.bodyMedium,
              { color: colors.textSecondary, marginBottom: spacing.lg },
            ]}
          >
            {slides[activeIndex].description}
          </Text>

          <PrimaryButton
            title={activeIndex < slides.length - 1 ? 'Tiếp theo' : 'Bắt đầu'}
            onPress={handleNext}
          />

          <Pressable
            onPress={handleLogin}
            style={[styles.loginLink, { minHeight: 48 }]}
            accessibilityLabel="Tôi đã có tài khoản"
          >
            <Text style={[typo.bodyMedium, { color: colors.textSecondary }]}>
              Tôi đã có tài khoản?{' '}
              <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>
                Đăng nhập
              </Text>
            </Text>
          </Pressable>
        </GlassCard>
      </View>
    </View>
  );
}

// --- Slide item with parallax ---

function SlideItem({
  item,
  index,
  scrollX,
}: {
  item: OnboardingSlide;
  index: number;
  scrollX: SharedValue<number>;
}) {
  const { typography: typo, radius } = useAppTheme();

  const imageAnimStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [-SCREEN_WIDTH * 0.3, 0, SCREEN_WIDTH * 0.3],
      Extrapolation.CLAMP,
    );
    return { transform: [{ translateX }] };
  });

  const chipAnimStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [20, 0, 20],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ translateY }] };
  });

  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <Animated.View style={[StyleSheet.absoluteFill, imageAnimStyle]}>
        <Image
          source={item.image}
          style={[StyleSheet.absoluteFill, { width: SCREEN_WIDTH * 1.3 }]}
          contentFit="cover"
          transition={300}
        />
      </Animated.View>
      {/* Dark gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.55)']}
        locations={[0.3, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Floating glass chip */}
      <Animated.View
        style={[
          styles.chip,
          chipAnimStyle,
          {
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: radius.full,
            borderColor: 'rgba(255,255,255,0.3)',
          },
        ]}
      >
        <Text style={[typo.labelMedium, { color: '#FFFFFF' }]}>
          {item.chipLabel}
        </Text>
      </Animated.View>
    </View>
  );
}

// --- Animated page dot ---

function PageDot({ index, activeIndex }: { index: number; activeIndex: number }) {
  const { colors } = useAppTheme();
  const isActive = index === activeIndex;

  const dotStyle = useAnimatedStyle(() => ({
    width: withSpring(isActive ? 24 : 8, { damping: 15, stiffness: 200 }),
    opacity: withTiming(isActive ? 1 : 0.4, { duration: 200 }),
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        dotStyle,
        { backgroundColor: colors.primary, borderRadius: 4 },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slide: {
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  indicatorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    height: 6,
  },
  chip: {
    position: 'absolute',
    top: '35%',
    right: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
  },
  loginLink: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
});
