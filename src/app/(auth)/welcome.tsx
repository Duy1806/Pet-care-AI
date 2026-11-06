/**
 * PawCare AI — Welcome / Onboarding Screen
 *
 * Full-width, uncropped pet photography onboarding pager.
 * Features: smooth slide transitions, animated page indicator,
 * clean typography without clutter or awkward image cropping.
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
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { PrimaryButton } from '@/presentation/components/PrimaryButton';
import { ThemeToggle } from '@/presentation/components/ThemeToggle';
import { useAppTheme } from '@/presentation/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- Slide data ---

interface OnboardingSlide {
  id: string;
  image: any;
  title: string;
  description: string;
}

const slides: OnboardingSlide[] = [
  {
    id: '1',
    image: require('@/assets/images/onboarding/slide-1-scan.jpg'),
    title: 'Nhận diện giống loài bằng AI',
    description:
      'Chụp ảnh thú cưng, AI sẽ nhận diện giống loài kèm độ tin cậy chính xác. Hỗ trợ hàng trăm giống chó và mèo.',
  },
  {
    id: '2',
    image: require('@/assets/images/onboarding/slide-2-nutrition.jpg'),
    title: 'Gợi ý dinh dưỡng thông minh',
    description:
      'Tính khẩu phần theo giống, cân nặng, độ tuổi và mức độ vận động. AI giải thích chi tiết cho bạn.',
  },
  {
    id: '3',
    image: require('@/assets/images/onboarding/slide-3-care.jpg'),
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
    ({ item }: ListRenderItemInfo<OnboardingSlide>) => <SlideItem item={item} />,
    [],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top bar with ThemeToggle and Skip */}
      <View style={[styles.topBar, { top: insets.top + spacing.xs }]}>
        <ThemeToggle color={colors.text} />
        <Pressable
          onPress={handleSkip}
          hitSlop={12}
          accessibilityLabel="Bỏ qua giới thiệu"
          style={styles.skipBtn}
        >
          <Text style={[typo.labelLarge, { color: colors.textSecondary, fontWeight: '600' }]}>
            Bỏ qua
          </Text>
        </Pressable>
      </View>

      {/* Slides Pager */}
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
        style={styles.flatList}
      />

      {/* Bottom controls: Indicator, Action Button, Login Link */}
      <View
        style={[
          styles.bottomContainer,
          {
            paddingBottom: insets.bottom + spacing.md,
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        {/* Page indicator */}
        <View style={[styles.indicatorRow, { marginBottom: spacing.lg }]}>
          {slides.map((_, i) => (
            <PageDot key={i} index={i} activeIndex={activeIndex} />
          ))}
        </View>

        <PrimaryButton
          title={activeIndex < slides.length - 1 ? 'Tiếp theo' : 'Bắt đầu ngay'}
          onPress={handleNext}
        />

        <Pressable
          onPress={handleLogin}
          style={[styles.loginLink, { minHeight: 44 }]}
          accessibilityLabel="Tôi đã có tài khoản"
        >
          <Text style={[typo.bodyMedium, { color: colors.textSecondary }]}>
            Tôi đã có tài khoản?{' '}
            <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontWeight: '700' }}>
              Đăng nhập
            </Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// --- Slide item displaying full, uncropped photo ---

function SlideItem({ item }: { item: OnboardingSlide }) {
  const { colors, typography: typo } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH, paddingTop: insets.top + 52 }]}>
      {/* Full uncropped hero image container */}
      <View style={styles.imageContainer}>
        <Image
          source={item.image}
          style={styles.heroImage}
          contentFit="cover"
          transition={250}
        />
      </View>

      {/* Slide text content */}
      <View style={styles.textContainer}>
        <Text
          style={[
            typo.headlineLarge,
            {
              color: colors.text,
              textAlign: 'center',
              marginBottom: 12,
              fontWeight: '800',
            },
          ]}
        >
          {item.title}
        </Text>
        <Text
          style={[
            typo.bodyMedium,
            {
              color: colors.textSecondary,
              textAlign: 'center',
              lineHeight: 22,
              paddingHorizontal: 8,
            },
          ]}
        >
          {item.description}
        </Text>
      </View>
    </View>
  );
}

// --- Animated page dot ---

function PageDot({ index, activeIndex }: { index: number; activeIndex: number }) {
  const { colors } = useAppTheme();
  const isActive = index === activeIndex;

  const dotStyle = useAnimatedStyle(() => ({
    width: withSpring(isActive ? 24 : 8, { damping: 15, stiffness: 200 }),
    opacity: withTiming(isActive ? 1 : 0.35, { duration: 200 }),
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
  flatList: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    aspectRatio: 1200 / 896,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    paddingHorizontal: 24,
    paddingTop: 28,
    alignItems: 'center',
    width: '100%',
  },
  topBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  bottomContainer: {
    width: '100%',
    alignItems: 'stretch',
  },
  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 6,
  },
  loginLink: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
});
