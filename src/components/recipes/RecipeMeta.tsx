import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '@/theme';
import type { Difficulty, Recipe } from '@/types';

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

export function RecipeMetaRow({
  recipe,
  tint = colors.muted,
  compact = false,
}: {
  recipe: Recipe;
  tint?: string;
  compact?: boolean;
}) {
  const items = [
    { icon: 'clock-outline' as const, label: `${recipe.totalTimeMinutes} min` },
    { icon: 'signal-cellular-2' as const, label: DIFFICULTY_LABEL[recipe.difficulty] },
    { icon: 'basket-outline' as const, label: `${recipe.ingredients.length} ingredients` },
  ];
  return (
    <View style={styles.row}>
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          {index > 0 ? <Text style={[type.caption, { color: tint }]}>·</Text> : null}
          <View style={styles.metaItem}>
            <MaterialCommunityIcons name={item.icon} size={compact ? 12 : 14} color={tint} />
            <Text style={[type.caption, { color: tint }]}>{item.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

export function RecipeStatsGrid({ recipe }: { recipe: Recipe }) {
  const stats = [
    { label: 'Prep', value: `${recipe.preparationTimeMinutes} min` },
    { label: 'Cook', value: `${recipe.cookingTimeMinutes} min` },
    { label: 'Total', value: `${recipe.totalTimeMinutes} min` },
    { label: 'Serves', value: String(recipe.servings) },
  ];
  return (
    <View style={styles.grid}>
      {stats.map((stat) => (
        <View key={stat.label} style={styles.gridItem}>
          <Text style={[type.caption, { color: colors.muted }]}>{stat.label}</Text>
          <Text style={[type.bodyMedium, { color: colors.ink }]}>{stat.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  grid: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
  gridItem: { flex: 1, alignItems: 'center', gap: 2 },
});
