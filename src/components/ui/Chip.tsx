import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, gradients, radius, shadows, spacing, type } from '@/theme';

export function FilterChip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      accessibilityLabel={`${label}${active ? ', selected' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? 'transparent' : colors.surface,
          borderColor: active ? 'transparent' : colors.borderStrong,
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
        active ? shadows.soft : null,
      ]}
    >
      {active ? (
        <LinearGradient
          colors={gradients.button}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.chipFill}
        >
          <ChipLabel label={label} icon={icon} color={colors.white} />
        </LinearGradient>
      ) : (
        <View style={styles.chipPad}>
          <ChipLabel label={label} icon={icon} color={colors.inkSoft} />
        </View>
      )}
    </Pressable>
  );
}

function ChipLabel({
  label,
  icon,
  color,
}: {
  label: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
}) {
  return (
    <View style={styles.chipRow}>
      {icon ? (
        <MaterialCommunityIcons name={icon} size={14} color={color} style={{ marginRight: 6 }} />
      ) : null}
      <Text style={[type.label, { color }]}>{label}</Text>
    </View>
  );
}

const TAG_TONES = {
  neutral: { background: colors.surfaceMuted, color: colors.inkSoft, dot: colors.faint },
  primary: { background: colors.primarySoft, color: colors.primaryInk, dot: colors.primary },
  accent: { background: colors.accentSoft, color: colors.accentInk, dot: colors.accent },
  peach: { background: colors.accentSoft, color: colors.accentInk, dot: colors.accent },
  lavender: { background: colors.lavenderSoft, color: colors.lavenderInk, dot: colors.lavender },
  mint: { background: colors.mintSoft, color: colors.mintInk, dot: colors.mint },
  butter: { background: colors.butterSoft, color: colors.butterInk, dot: colors.butter },
} as const;

export function TagBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: keyof typeof TAG_TONES;
}) {
  const palette = TAG_TONES[tone];
  return (
    <View style={[styles.tag, { backgroundColor: palette.background }]}>
      <View style={[styles.tagDot, { backgroundColor: palette.dot }]} />
      <Text style={[type.caption, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

const OPTION_TINTS = [
  { bg: colors.primarySoft, ink: colors.primaryDeep },
  { bg: colors.lavenderSoft, ink: colors.lavenderDeep },
  { bg: colors.mintSoft, ink: colors.mintDeep },
  { bg: colors.butterSoft, ink: colors.butterDeep },
] as const;

/** Stable per-option pastel so a list of cards looks like a handful of stickers. */
function tintFor(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) hash = (hash * 31 + title.charCodeAt(i)) % 997;
  return OPTION_TINTS[hash % OPTION_TINTS.length];
}

export function SelectableCard({
  title,
  description,
  icon,
  selected,
  onPress,
  multi,
  accessibilityLabel,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
  accessibilityLabel?: string;
}) {
  const tint = tintFor(title);
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        selected ? shadows.soft : null,
      ]}
    >
      {icon ? (
        <View style={[styles.optionIcon, { backgroundColor: selected ? colors.white : tint.bg }]}>
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={selected ? colors.primaryDeep : tint.ink}
          />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[type.cardTitle, { color: colors.ink }]}>{title}</Text>
        {description ? (
          <Text style={[type.caption, { color: colors.muted, marginTop: 3 }]}>{description}</Text>
        ) : null}
      </View>
      <View
        style={[
          styles.indicator,
          multi ? styles.square : styles.circle,
          {
            backgroundColor: selected ? colors.primaryDeep : 'transparent',
            borderColor: selected ? colors.primaryDeep : colors.borderStrong,
          },
        ]}
      >
        {selected ? <MaterialCommunityIcons name="check" size={14} color={colors.white} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  chipFill: { paddingHorizontal: spacing.md, height: '100%', justifyContent: 'center' },
  chipPad: { paddingHorizontal: spacing.md },
  chipRow: { flexDirection: 'row', alignItems: 'center' },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginRight: 6,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tagDot: { width: 5, height: 5, borderRadius: 3 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  circle: { borderRadius: radius.pill },
  square: { borderRadius: 8 },
});
