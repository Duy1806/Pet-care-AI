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
import { FloatingAssistantBubble } from '../presentation/components/FloatingAssistantBubble';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useChatStore } from '../presentation/stores/useChatStore';
import { useSyncStore } from '../presentation/stores/useSyncStore';

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
    void useSyncStore.getState().initSync();
  }, [initialize]);

  // Global Recovery & Deep Link listener
  useEffect(() => {
    const handleRecoveryUrl = async (urlStr: string | null) => {
      if (!urlStr) return;
      const parsed = parseUrlParams(urlStr);

      const isRecovery =
        parsed.type === 'recovery' ||
        parsed.step === 'new-password' ||
        urlStr.includes('recovery') ||
        urlStr.includes('forgot-password');

      if (isRecovery) {
        useAuthStore.setState({ forgotPasswordStep: 'new-password' });
      }

      if (parsed.access_token && parsed.refresh_token) {
        try {
          await supabase.auth.setSession({
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token,
          });
          if (isRecovery) {
            router.replace('/(auth)/forgot-password?step=new-password' as any);
          } else {
            // OAuth or Magic Link sign in -> Initialize session
            await useAuthStore.getState().initialize();
          }
          return;
        } catch {
          // ignore session setting failure
        }
      } else if (parsed.code) {
        try {
          await supabase.auth.exchangeCodeForSession(parsed.code);
          if (isRecovery) {
            router.replace('/(auth)/forgot-password?step=new-password' as any);
          } else {
            // OAuth sign in -> Initialize session
            await useAuthStore.getState().initialize();
          }
          return;
        } catch {
          // ignore exchange code failure
        }
      }

      if (isRecovery) {
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

  // Auth Guard & Role-based Branching
  useEffect(() => {
    if (!isInitialized) return;

    const segs = segments as unknown as string[];
    const inAuthGroup = segs[0] === '(auth)';
    const isForgotPassword = segs.includes('forgot-password');
    const isPasswordRecovery = useAuthStore.getState().forgotPasswordStep === 'new-password';
    const isAdminRoute = segs[0] === 'admin';
    const isAppRoute = segs[0] === '(app)';
    const isAuthenticated = Boolean(user && session);

    // CRITICAL: If the user is on the forgot-password screen or resetting password, NEVER redirect away!
    if (isForgotPassword || isPasswordRecovery) {
      return;
    }

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/welcome' as any);
    } else if (isAuthenticated && inAuthGroup) {
      // Immediate branching right at login / authentication initialization
      if (user?.role === 'admin') {
        router.replace('/admin' as any);
      } else {
        router.replace('/(app)' as any);
      }
    } else if (isAuthenticated && isAdminRoute && user?.role !== 'admin') {
      // Strict Security Guard: Standard users can NEVER access Admin Portal
      router.replace('/(app)' as any);
    } else if (isAuthenticated && isAppRoute && user?.role === 'admin') {
      // Admins enter directly into Admin Portal, not user app
      router.replace('/admin' as any);
    }
  }, [user, session, isInitialized, segments, router]);

  // Synchronize active user for Chat Store to ensure strict multi-user privacy
  useEffect(() => {
    void useChatStore.getState().setUser(user?.id ?? null);
  }, [user?.id]);

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
        <Stack.Screen
          name="blog"
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="article-detail"
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="shop"
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="admin"
          options={{
            animation: 'slide_from_right',
          }}
        />
      </Stack>
      {/* AI Assistant Chat Bubble: Chỉ hiển thị cho Chủ nuôi (User) trong App, ẩn hoàn toàn ở Admin */}
      {Boolean(user && session && user.role !== 'admin' && (segments as unknown as string[])[0] !== 'admin') && (
        <FloatingAssistantBubble />
      )}
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
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
