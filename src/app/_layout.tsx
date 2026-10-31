/**
 * PawCare AI — Root Layout
 *
 * Handles:
 * - Google Fonts loading (Inter & Plus Jakarta Sans)
 * - Splash screen orchestration
 * - Global ThemeProvider
 * - Auth session initialization & navigation guard
 */
import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts as useInter,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  useFonts as useJakarta,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { ThemeProvider, useAppTheme } from '../presentation/theme';
import { useAuthStore } from '../presentation/stores/useAuthStore';

// Prevent splash screen from auto-hiding before fonts are ready
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { colors } = useAppTheme();
  const segments = useSegments();
  const router = useRouter();
  const { user, session, isInitialized, initialize } = useAuthStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Auth Guard
  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = (segments[0] as string) === '(auth)';
    const isAuthenticated = Boolean(user && session);

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/welcome' as any);
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(app)' as any);
    }
  }, [user, session, isInitialized, segments, router]);

  return (
    <>
      <StatusBar style={colors.statusBarStyle} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen
          name="vaccinations"
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="add-vaccination"
          options={{
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [interLoaded, interError] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [jakartaLoaded, jakartaError] = useJakarta({
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  const [fontTimeout, setFontTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFontTimeout(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const fontsLoaded =
    (interLoaded && jakartaLoaded) ||
    Boolean(interError) ||
    Boolean(jakartaError) ||
    fontTimeout;

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}
