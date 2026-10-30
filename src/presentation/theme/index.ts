/**
 * PawCare AI — Theme Provider & Hooks
 *
 * Centralized theme system with light/dark mode support.
 * Uses React context to provide semantic color tokens to all components.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { type ColorTokens, lightColors, darkColors } from './colors';
import { typography } from './typography';
import { spacing, radius, layout } from './spacing';
import { shadows, applyShadow } from './shadows';
import { useThemeStore } from '../stores/useThemeStore';

export interface AppTheme {
  colors: ColorTokens;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  layout: typeof layout;
  shadows: typeof shadows;
  applyShadow: typeof applyShadow;
  isDark: boolean;
}

const ThemeContext = createContext<AppTheme | null>(null);

/**
 * Hook to access the current theme.
 * Must be used within a ThemeProvider.
 */
export function useAppTheme(): AppTheme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return theme;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Provides the app theme to all descendants.
 * Respects system color scheme with manual override from useThemeStore.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const { themeMode } = useThemeStore();

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemScheme === 'dark';
    }
    return themeMode === 'dark';
  }, [themeMode, systemScheme]);

  const theme = useMemo<AppTheme>(
    () => ({
      colors: isDark ? darkColors : lightColors,
      typography,
      spacing,
      radius,
      layout,
      shadows,
      applyShadow,
      isDark,
    }),
    [isDark],
  );

  return React.createElement(ThemeContext.Provider, { value: theme }, children);
}

// Re-export all theme modules for convenient imports
export { lightColors, darkColors } from './colors';
export type { ColorTokens } from './colors';
export { typography, FontFamily } from './typography';
export { spacing, radius, layout } from './spacing';
export { shadows, applyShadow } from './shadows';

