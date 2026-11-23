import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '@/theme';

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
          backgroundColor: active ? colors.ink : colors.surface,
          borderColor: active ? colors.ink : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon ? (
        <MaterialCommunityIcons
          name={icon}
          size={14}
          color={active ? colors.background : colors.inkSoft}
          style={{ marginRight: 6 }}
        />
      ) : null}
      <Text style={[type.label, { color: active ? colors.background : colors.inkSoft }]}>{label}</Text>
    </Pressable>
  );
}

export function TagBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'green' | 'orange';
}) {
  const palette = {
    neutral: { background: colors.surfaceMuted, color: colors.muted },
    green: { background: colors.sage, color: colors.greenInk },
    orange: { background: colors.orangeSoft, color: '#7A4A17' },
  }[tone];
  return (
    <View style={[styles.tag, { backgroundColor: palette.background }]}>
      <Text style={[type.caption, { color: palette.color }]}>{label}</Text>
    </View>
  );
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
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: selected ? colors.surfaceSage : colors.surface,
          borderColor: selected ? colors.green : colors.border,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      {icon ? (
        <View style={[styles.optionIcon, { backgroundColor: selected ? colors.surface : colors.surfaceMuted }]}>
          <MaterialCommunityIcons name={icon} size={20} color={selected ? colors.greenDeep : colors.inkSoft} />
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
            backgroundColor: selected ? colors.greenDeep : 'transparent',
            borderColor: selected ? colors.greenDeep : colors.borderStrong,
          },
        ]}
      >
        {selected ? (
          <MaterialCommunityIcons name="check" size={14} color={colors.white} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  tag: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginRight: 6,
    marginBottom: 6,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  circle: { borderRadius: radius.pill },
  square: { borderRadius: 7 },
});
