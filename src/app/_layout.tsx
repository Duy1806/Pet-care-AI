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
import * as Linking from 'expo-linking';
import { supabase } from '../data/remote/supabaseClient';

function parseUrlParams(rawUrl: string): Record<string, string> {
  const params: Record<string, string> = {};
  const segments = rawUrl.split(/[#?&]/);
  for (const seg of segments) {
    const eqIdx = seg.indexOf('=');
    if (eqIdx !== -1) {
      const key = decodeURIComponent(seg.substring(0, eqIdx));
      const val = decodeURIComponent(seg.substring(eqIdx + 1));
      if (key && val) {
        params[key] = val;
      }
    }
  }
  return params;
}

// Prevent splash screen from auto-hiding before fonts are ready
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { colors } = useAppTheme();
  const segments = useSegments();
  const router = useRouter();
  const { user, session, isInitialized, initialize } = useAuthStore();
  const incomingUrl = Linking.useURL();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Global Recovery & Deep Link listener
  useEffect(() => {
    const handleRecoveryUrl = async (urlStr: string | null) => {
      if (!urlStr) return;
      const parsed = parseUrlParams(urlStr);

      const isRecovery =
        parsed.type === 'recovery' ||
        parsed.step === 'new-password' ||
        Boolean(parsed.access_token && parsed.refresh_token) ||
        urlStr.includes('recovery') ||
        urlStr.includes('forgot-password');

      if (parsed.access_token && parsed.refresh_token) {
        try {
          await supabase.auth.setSession({
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token,
          });
          useAuthStore.setState({ forgotPasswordStep: 'new-password' });
          router.replace('/(auth)/forgot-password?step=new-password' as any);
          return;
        } catch {
          // ignore session setting failure
        }
      } else if (parsed.code) {
        try {
          await supabase.auth.exchangeCodeForSession(parsed.code);
          useAuthStore.setState({ forgotPasswordStep: 'new-password' });
          router.replace('/(auth)/forgot-password?step=new-password' as any);
          return;
        } catch {
          // ignore exchange code failure
        }
      }

      if (isRecovery) {
        useAuthStore.setState({ forgotPasswordStep: 'new-password' });
        router.replace('/(auth)/forgot-password?step=new-password' as any);
      }
    };

    if (incomingUrl) {
      void handleRecoveryUrl(incomingUrl);
    }

    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleRecoveryUrl(url);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        useAuthStore.setState({ forgotPasswordStep: 'new-password' });
        router.replace('/(auth)/forgot-password?step=new-password' as any);
      }
    });

    return () => {
      sub.remove();
      authListener?.subscription.unsubscribe();
    };
  }, [incomingUrl, router]);

  // Auth Guard
  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = (segments[0] as string) === '(auth)';
    const isForgotPassword = (segments[1] as string) === 'forgot-password';
    const isAuthenticated = Boolean(user && session);

    // CRITICAL: If the user is on the forgot-password screen, NEVER redirect away!
    if (isForgotPassword) {
      return;
    }

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
        <Stack.Screen
          name="pet-profile"
          options={{
            animation: 'slide_from_right',
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
