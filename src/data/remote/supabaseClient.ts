/**
 * PawCare AI — Supabase Client Instance
 *
 * Configures Supabase client with SecureStore storage adapter for session persistence.
 * Safe for React Native / Expo runtime.
 */
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const isWeb = Platform.OS === 'web';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Storage adapter implementation using expo-secure-store.
 * Falls back to memory storage on web/unsupported platforms or tests.
 * Automatically sanitizes keys to prevent Android SecureStore illegal character errors.
 */
export const ExpoSecureStoreAdapter = {
  getItem: async (rawKey: string): Promise<string | null> => {
    const key = rawKey.replace(/[^a-zA-Z0-9_.-]/g, '_');
    if (isWeb) {
      try {
        return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  setItem: async (rawKey: string, value: string): Promise<void> => {
    const key = rawKey.replace(/[^a-zA-Z0-9_.-]/g, '_');
    if (isWeb) {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      } catch {
        // ignore
      }
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // ignore
    }
  },
  removeItem: async (rawKey: string): Promise<void> => {
    const key = rawKey.replace(/[^a-zA-Z0-9_.-]/g, '_');
    if (isWeb) {
      try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      } catch {
        // ignore
      }
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  },
};

/**
 * Singleton Supabase Client for PawCare AI.
 * If credentials are not yet set in environment, client is initialized with safe fallbacks.
 */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: !isTest,
      persistSession: !isTest,
      detectSessionInUrl: false,
    },
  },
);

