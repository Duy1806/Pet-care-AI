/**
 * PawCare AI — Shadow Presets
 *
 * Layered soft shadows for elevated surfaces.
 * Uses React Native shadow properties (iOS) + elevation (Android).
 */
import { Platform, ViewStyle } from 'react-native';

interface ShadowPreset {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

/** Create a shadow that works on both platforms */
const createShadow = (
  offsetY: number,
  blurRadius: number,
  opacity: number,
  elevation: number,
): ShadowPreset => ({
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: offsetY },
  shadowOpacity: opacity,
  shadowRadius: blurRadius,
  elevation,
});

export const shadows = {
  /** Subtle shadow for cards and inputs */
  sm: createShadow(1, 3, 0.06, 1),
  /** Standard elevation for floating elements */
  md: createShadow(4, 8, 0.08, 3),
  /** High elevation for modals and overlays */
  lg: createShadow(8, 16, 0.1, 6),
  /** Extra-high elevation for floating action buttons */
  xl: createShadow(12, 24, 0.12, 8),
} as const;

/** Apply a shadow preset as a ViewStyle spread */
export const applyShadow = (preset: ShadowPreset): ViewStyle => {
  if (Platform.OS === 'android') {
    return { elevation: preset.elevation };
  }
  return {
    shadowColor: preset.shadowColor,
    shadowOffset: preset.shadowOffset,
    shadowOpacity: preset.shadowOpacity,
    shadowRadius: preset.shadowRadius,
  };
};

