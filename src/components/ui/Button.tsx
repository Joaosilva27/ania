import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, gradients, radius, shadows, spacing, type } from '@/theme';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  fullWidth?: boolean;
  testID?: string;
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
  variant = 'primary',
  fullWidth = true,
}: PrimaryButtonProps) {
  const isDisabled = Boolean(disabled) || Boolean(loading);

  const palette = {
    primary: { text: colors.white, border: 'transparent' },
    secondary: { text: colors.primaryInk, border: colors.borderStrong },
    ghost: { text: colors.primaryDeep, border: 'transparent' },
    danger: { text: colors.danger, border: 'transparent' },
  }[variant];

  const gradient =
    variant === 'primary'
      ? gradients.button
      : variant === 'secondary'
        ? ([colors.surface, colors.surface] as const)
        : variant === 'danger'
          ? ([colors.dangerSoft, colors.dangerSoft] as const)
          : ([colors.surface, colors.surface] as const);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.shell,
        {
          opacity: isDisabled ? 0.45 : 1,
          width: fullWidth ? '100%' : undefined,
          transform: [{ scale: pressed && !isDisabled ? 0.975 : 1 }],
        },
        variant === 'primary' && !isDisabled ? shadows.card : null,
        variant === 'ghost' ? styles.transparent : null,
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.inner,
          {
            borderColor: palette.border,
            borderWidth: palette.border === 'transparent' ? 0 : 1.5,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={palette.text} />
        ) : (
          <>
            {icon ? (
              <MaterialCommunityIcons name={icon} size={19} color={palette.text} style={styles.icon} />
            ) : null}
            <Text style={[type.button, { color: palette.text }]}>{label}</Text>
            {variant === 'primary' ? (
              <Text style={[styles.sparkle, { color: palette.text }]}>✦</Text>
            ) : null}
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  size?: number;
  color?: string;
  background?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  bordered?: boolean;
}

export function IconButton({
  icon,
  onPress,
  size = 22,
  color = colors.primaryInk,
  background = colors.surface,
  accessibilityLabel,
  disabled,
  bordered = true,
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={disabled ? undefined : onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: background,
          borderColor: bordered ? colors.border : 'transparent',
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
          transform: [{ scale: pressed ? 0.92 : 1 }],
        },
        shadows.soft,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function TextButton({
  label,
  onPress,
  color = colors.primaryDeep,
}: {
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [styles.textButton, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={[type.label, { color, textDecorationLine: 'underline' }]}>{label}</Text>
    </Pressable>
  );
}

const PILL_TONES = {
  primary: { backgroundColor: colors.primarySoft, color: colors.primaryInk },
  accent: { backgroundColor: colors.accentSoft, color: colors.accentInk },
  peach: { backgroundColor: colors.accentSoft, color: colors.accentInk },
  lavender: { backgroundColor: colors.lavenderSoft, color: colors.lavenderInk },
  mint: { backgroundColor: colors.mintSoft, color: colors.mintInk },
  butter: { backgroundColor: colors.butterSoft, color: colors.butterInk },
  neutral: { backgroundColor: colors.surfaceMuted, color: colors.inkSoft },
  dark: { backgroundColor: colors.ink, color: colors.white },
} as const;

export function Pill({
  label,
  tone = 'primary',
  icon,
}: {
  label: string;
  tone?: keyof typeof PILL_TONES;
  icon?: IconName;
}) {
  const toneStyles = PILL_TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: toneStyles.backgroundColor }]}>
      {icon ? (
        <MaterialCommunityIcons name={icon} size={12} color={toneStyles.color} style={{ marginRight: 5 }} />
      ) : null}
      <Text style={[type.caption, { color: toneStyles.color, fontFamily: type.label.fontFamily }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radius.pill,
    overflow: 'visible',
  },
  transparent: { backgroundColor: 'transparent' },
  inner: {
    minHeight: 56,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  icon: { marginRight: spacing.xs },
  sparkle: { fontSize: 13, marginLeft: spacing.xs, opacity: 0.85 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  textButton: { paddingVertical: spacing.xs, alignSelf: 'center' },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
});
