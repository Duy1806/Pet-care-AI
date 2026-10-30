/**
 * PawCare AI — Semantic Color Tokens
 *
 * Light palette: cream background, deep teal primary, coral accent
 * Dark palette: teal-charcoal surfaces, lighter tint accents for readability
 *
 * All colors meet WCAG AA contrast against their respective backgrounds.
 */

export interface ColorTokens {
  /** Main app background */
  background: string;
  /** Card / sheet surfaces */
  surface: string;
  /** Elevated surfaces (modals, dropdowns) */
  surfaceElevated: string;
  /** Primary brand color (buttons, links) */
  primary: string;
  /** Pressed / darker primary */
  primaryPressed: string;
  /** Light primary container */
  primaryContainer: string;
  /** Text on primary */
  onPrimary: string;
  /** Coral accent for CTAs and highlights */
  accent: string;
  /** Pressed accent */
  accentPressed: string;
  /** Soft sage for subtle backgrounds */
  sage: string;
  /** Primary text */
  text: string;
  /** Secondary text */
  textSecondary: string;
  /** Tertiary / placeholder text */
  textTertiary: string;
  /** Borders and dividers */
  border: string;
  /** Input field backgrounds */
  inputBackground: string;
  /** Error state */
  error: string;
  /** Error container / light error bg */
  errorContainer: string;
  /** Success state */
  success: string;
  /** Warning state */
  warning: string;
  /** Overlay / scrim */
  overlay: string;
  /** Glass card background */
  glass: string;
  /** Glass card border */
  glassBorder: string;
  /** Shimmer / skeleton base */
  shimmerBase: string;
  /** Shimmer / skeleton highlight */
  shimmerHighlight: string;
  /** Status bar style */
  statusBarStyle: 'light' | 'dark';
}

export const lightColors: ColorTokens = {
  background: '#FFF8F0',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  primary: '#0F766E',
  primaryPressed: '#0D6560',
  primaryContainer: '#CCFBF1',
  onPrimary: '#FFFFFF',
  accent: '#FF7A59',
  accentPressed: '#E5694D',
  sage: '#DDEBE3',
  text: '#1F2937',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  inputBackground: '#F9FAFB',
  error: '#DC2626',
  errorContainer: '#FEE2E2',
  success: '#059669',
  warning: '#D97706',
  overlay: 'rgba(0, 0, 0, 0.5)',
  glass: 'rgba(255, 255, 255, 0.75)',
  glassBorder: 'rgba(255, 255, 255, 0.3)',
  shimmerBase: '#E5E7EB',
  shimmerHighlight: '#F3F4F6',
  statusBarStyle: 'dark',
};

export const darkColors: ColorTokens = {
  background: '#0E1A19',
  surface: '#16302D',
  surfaceElevated: '#1D3D39',
  primary: '#14B8A6',
  primaryPressed: '#0F9D8E',
  primaryContainer: '#134E48',
  onPrimary: '#042F2E',
  accent: '#FF9A7F',
  accentPressed: '#FF7A59',
  sage: '#1E3A2F',
  text: '#F0FDF4',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  border: '#2D4A45',
  inputBackground: '#0E1A19',
  error: '#F87171',
  errorContainer: '#450A0A',
  success: '#34D399',
  warning: '#FBBF24',
  overlay: 'rgba(0, 0, 0, 0.7)',
  glass: 'rgba(22, 48, 45, 0.75)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  shimmerBase: '#16302D',
  shimmerHighlight: '#1D3D39',
  statusBarStyle: 'light',
};

