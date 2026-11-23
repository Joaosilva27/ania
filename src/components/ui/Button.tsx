import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadows, spacing, type } from '@/theme';

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
    primary: { background: colors.ink, text: colors.background, border: colors.ink },
    secondary: { background: colors.surface, text: colors.ink, border: colors.borderStrong },
    ghost: { background: 'transparent', text: colors.ink, border: 'transparent' },
    danger: { background: colors.coralSoft, text: colors.coral, border: colors.coralSoft },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          opacity: isDisabled ? 0.45 : 1,
          width: fullWidth ? '100%' : undefined,
          transform: [{ scale: pressed && !isDisabled ? 0.985 : 1 }],
        },
        variant === 'primary' && !isDisabled ? shadows.soft : null,
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
        </>
      )}
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
  color = colors.ink,
  background = colors.surface,
  accessibilityLabel,
  disabled,
  bordered,
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
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function TextButton({
  label,
  onPress,
  color = colors.inkSoft,
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

export function Pill({
  label,
  tone = 'sage',
}: {
  label: string;
  tone?: 'sage' | 'orange' | 'neutral' | 'dark';
}) {
  const toneStyles = {
    sage: { backgroundColor: colors.sage, color: colors.greenInk },
    orange: { backgroundColor: colors.orangeSoft, color: '#7A4A17' },
    neutral: { backgroundColor: colors.surfaceMuted, color: colors.inkSoft },
    dark: { backgroundColor: colors.ink, color: colors.background },
  }[tone];

  return (
    <View style={[styles.pill, { backgroundColor: toneStyles.backgroundColor }]}>
      <Text style={[type.caption, { color: toneStyles.color, fontFamily: type.label.fontFamily }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  icon: { marginRight: spacing.xs },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  textButton: { paddingVertical: spacing.xs, alignSelf: 'center' },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
});
