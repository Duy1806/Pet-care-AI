/**
 * PawCare AI — Spacing & Layout Constants
 *
 * Built on an 8pt grid. All spacing values are multiples of 4.
 */

/** Spacing scale (4-based increments) */
export const spacing = {
  /** 4px — hairline gaps, icon padding */
  xs: 4,
  /** 8px — tight element spacing */
  sm: 8,
  /** 12px — form field gaps */
  smd: 12,
  /** 16px — standard content padding */
  md: 16,
  /** 20px — section gaps */
  mlg: 20,
  /** 24px — card internal padding */
  lg: 24,
  /** 32px — section separators */
  xl: 32,
  /** 40px — large gaps */
  xxl: 40,
  /** 48px — hero spacing */
  xxxl: 48,
  /** 64px — screen-level padding top */
  huge: 64,
} as const;

/** Border radius presets */
export const radius = {
  /** 8px — buttons, small cards */
  sm: 8,
  /** 12px — input fields */
  md: 12,
  /** 16px — medium cards */
  lg: 16,
  /** 24px — large cards, bottom sheets */
  xl: 24,
  /** 32px — hero cards, onboarding */
  xxl: 32,
  /** Fully round — avatars, FABs */
  full: 9999,
} as const;

/** Standard layout values */
export const layout = {
  /** Minimum touch target for accessibility (48dp) */
  minTouchTarget: 48,
  /** Standard screen horizontal padding */
  screenPaddingHorizontal: spacing.lg,
  /** Standard content max width on tablets */
  maxContentWidth: 480,
  /** Default input field height */
  inputHeight: 56,
  /** Default button height */
  buttonHeight: 56,
  /** Default icon size */
  iconSize: 24,
  /** Small icon size */
  iconSizeSm: 20,
  /** Large icon size */
  iconSizeLg: 32,
  /** Tab bar height */
  tabBarHeight: 84,
  /** Hero image curved bottom radius */
  heroCurveRadius: 32,
} as const;

