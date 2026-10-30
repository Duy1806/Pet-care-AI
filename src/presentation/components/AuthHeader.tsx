/**
 * PawCare AI — AuthHeader Component
 *
 * Hero photo with curved bottom edge, overlaid with a dark gradient
 * for text legibility. Shows the PawCare AI title and a subtitle.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '../theme';

interface AuthHeaderProps {
  /** Hero background image */
  image: any;
  /** Main title text */
  title: string;
  /** Optional subtitle below title */
  subtitle?: string;
  /** Height of the hero section (default 320) */
  height?: number;
  /** Blurhash placeholder for the image */
  blurhash?: string;
}

export function AuthHeader({
  image,
  title,
  subtitle,
  height = 320,
  blurhash = 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.',
}: AuthHeaderProps) {
  const { colors, typography: typo, spacing, radius } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { height }]}>
      <Image
        source={image}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        placeholder={{ blurhash }}
        transition={400}
      />
      {/* Dark gradient overlay for text legibility */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={StyleSheet.absoluteFill}
      />
      {/* Curved bottom mask */}
      <View
        style={[
          styles.curvedBottom,
          {
            backgroundColor: colors.background,
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
          },
        ]}
      />
      {/* Text content */}
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + spacing.md,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xxxl,
          },
        ]}
      >
        {/* Logo / brand mark */}
        <Text style={[typo.labelMedium, styles.brand, { color: 'rgba(255,255,255,0.8)' }]}>
          🐾 PawCare AI
        </Text>
        <View style={styles.textContainer}>
          <Text style={[typo.displayLarge, { color: '#FFFFFF' }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                typo.bodyLarge,
                { color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  curvedBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  brand: {
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  textContainer: {
    marginBottom: 16,
  },
});

