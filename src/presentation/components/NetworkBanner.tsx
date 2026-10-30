/**
 * PawCare AI — NetworkBanner Component
 *
 * Connected to useSyncStore:
 * - Shows offline warning with pending changes count: "Offline • N thay đổi đang chờ"
 * - Shows active sync indicator: "Đang đồng bộ..."
 * - Supports custom messages on auth screens
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../theme';
import { useSyncStore } from '../stores/useSyncStore';

interface NetworkBannerProps {
  /** Custom message for auth screens */
  offlineMessage?: string;
}

export function NetworkBanner({
  offlineMessage,
}: NetworkBannerProps) {
  const { colors, typography: typo, spacing } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { isOnline, isSyncing, pendingCount, initSync } = useSyncStore();
  const translateY = useSharedValue(-80);

  useEffect(() => {
    void initSync();
  }, [initSync]);

  const shouldShow = !isOnline || isSyncing;

  useEffect(() => {
    translateY.value = withTiming(shouldShow ? 0 : -80, { duration: 300 });
  }, [shouldShow, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Determine message and color
  let message = '';
  let bgColor = colors.warning;
  let iconName: keyof typeof MaterialCommunityIcons.glyphMap = 'wifi-off';

  if (!isOnline) {
    if (offlineMessage) {
      message = offlineMessage;
    } else {
      message = pendingCount > 0
        ? `Ngoại tuyến • ${pendingCount} thay đổi đang chờ đồng bộ`
        : 'Bạn đang ngoại tuyến';
    }
    bgColor = colors.warning;
    iconName = 'wifi-off';
  } else if (isSyncing) {
    message = 'Đang đồng bộ dữ liệu lên máy chủ...';
    bgColor = colors.primary;
    iconName = 'sync';
  }

  return (
    <Animated.View
      pointerEvents={shouldShow ? 'auto' : 'none'}
      style={[
        styles.banner,
        animStyle,
        {
          paddingTop: insets.top + spacing.xs,
          paddingBottom: spacing.sm,
          paddingHorizontal: spacing.md,
          backgroundColor: bgColor,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLabel={shouldShow ? message : undefined}
    >
      <MaterialCommunityIcons
        name={iconName}
        size={16}
        color={isSyncing ? colors.onPrimary : '#1F2937'}
        style={{ marginRight: spacing.sm }}
      />
      <Text
        style={[
          typo.labelMedium,
          { color: isSyncing ? colors.onPrimary : '#1F2937', flex: 1 },
        ]}
        numberOfLines={2}
      >
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
