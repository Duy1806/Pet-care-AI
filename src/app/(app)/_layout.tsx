/**
 * PawCare AI — Main App Navigation Layout (Bottom Tab Bar)
 *
 * Provides a 4-tab bottom navigation:
 * 1. Home (Trang chủ)
 * 2. Breed Scanner (Nhận diện giống loài)
 * 3. Nutrition (Gợi ý dinh dưỡng)
 * 4. Profile (Hồ sơ)
 */
import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAppTheme } from '@/presentation/theme';

export default function AppLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
      screenListeners={{
        tabPress: () => {
          void Haptics.selectionAsync();
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'home-variant' : 'home-variant-outline'}
              size={24}
              color={color as string}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="breed-scanner"
        options={{
          title: 'Nhận diện',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'camera-iris' : 'camera-outline'}
              size={24}
              color={color as string}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Dinh dưỡng',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'food-drumstick' : 'food-drumstick-outline'}
              size={24}
              color={color as string}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Hồ sơ',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'account-circle' : 'account-circle-outline'}
              size={24}
              color={color as string}
            />
          ),
        }}
      />

      {/* Hidden developer / debug route */}
      <Tabs.Screen
        name="dev-test"
        options={{
          href: null,
        }}
      />

      {/* Sổ tiêm chủng chuyên biệt */}
      <Tabs.Screen
        name="vaccinations"
        options={{
          href: null,
        }}
      />

      {/* Trang thêm mũi tiêm & lên lịch hẹn tiêm phòng */}
      <Tabs.Screen
        name="add-vaccination"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
