/**
 * PawCare AI — Theme Store
 *
 * Manages the user's theme preference (light / dark / system).
 * Persists the choice — in Phase 2 this will sync with the user's profile.
 */
import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

/**
 * Cycles through: system → light → dark → system
 */
const nextMode = (current: ThemeMode): ThemeMode => {
  switch (current) {
    case 'system':
      return 'light';
    case 'light':
      return 'dark';
    case 'dark':
      return 'system';
  }
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeMode: 'system',
  setThemeMode: (mode) => set({ themeMode: mode }),
  toggleTheme: () => set({ themeMode: nextMode(get().themeMode) }),
}));
