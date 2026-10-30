/**
 * PawCare AI — Typography System
 *
 * Plus Jakarta Sans for headings (display, headline, title)
 * Inter for body text (body, label, caption)
 * 8pt baseline grid
 */
import { TextStyle } from 'react-native';

/** Font family constants — values match the loaded Google Fonts keys */
export const FontFamily = {
  heading: 'PlusJakartaSans_700Bold',
  headingSemiBold: 'PlusJakartaSans_600SemiBold',
  headingMedium: 'PlusJakartaSans_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

/** Named typography presets — use these in all components */
export const typography: Record<string, TextStyle> = {
  displayLarge: {
    fontFamily: FontFamily.heading,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  displayMedium: {
    fontFamily: FontFamily.heading,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.3,
  },
  headlineLarge: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  headlineMedium: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 20,
    lineHeight: 28,
  },
  titleLarge: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  titleMedium: {
    fontFamily: FontFamily.headingSemiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  bodyLarge: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  },
  bodySmall: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    lineHeight: 16,
  },
  labelLarge: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  labelSmall: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.1,
  },
  caption: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
} as const;

