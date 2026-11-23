import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Sparkle } from '@/components/cute/Decor';
import { colors, gradients, radius, shadows, spacing, type } from '@/theme';

type StickerTone = 'candy' | 'lavender' | 'mint' | 'sunrise' | 'blush';

const TONES: Record<StickerTone, { colors: readonly [string, string]; ink: string }> = {
  candy: { colors: gradients.candy, ink: colors.primaryInk },
  lavender: { colors: gradients.lavender, ink: colors.lavenderInk },
  mint: { colors: gradients.mint, ink: colors.mintInk },
  sunrise: { colors: gradients.sunrise, ink: colors.accentInk },
  blush: { colors: gradients.hero, ink: colors.primaryInk },
};

/**
 * A soft pastel card with a white sticker border. Used for gentle callouts:
 * focus of the week, plan summaries, encouragement.
 */
export function Sticker({
  children,
  tone = 'candy',
  style,
  title,
  icon,
  tilt = 0,
  tape = false,
}: {
  children?: React.ReactNode;
  tone?: StickerTone;
  style?: StyleProp<ViewStyle>;
  title?: string;
  icon?: React.ReactNode;
  tilt?: number;
  /** Little strip of "washi tape" across the top — scrapbook charm. */
  tape?: boolean;
}) {
  const palette = TONES[tone];
  return (
    <View
      style={[
        styles.shell,
        shadows.soft,
        { transform: [{ rotate: `${tilt}deg` }] },
        style,
      ]}
    >
      <LinearGradient
        colors={palette.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.inner}
      >
        <Sparkle size={12} color={colors.white} style={styles.sparkle} />
        {tape ? <View style={styles.tape} /> : null}
        {title ? (
          <View style={styles.titleRow}>
            {icon}
            <Text style={[type.cardTitle, { color: palette.ink }]}>{title}</Text>
          </View>
        ) : null}
        {children}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.white,
  },
  inner: { padding: spacing.md, gap: spacing.xxs, borderRadius: radius.lg - 3, overflow: 'hidden' },
  sparkle: { position: 'absolute', top: 8, right: 10 },
  tape: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    width: 74,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    transform: [{ rotate: '-4deg' }],
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
