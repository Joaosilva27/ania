import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RecipeImage } from './RecipeImage';
import { RecipeMetaRow } from './RecipeMeta';
import { colors, radius, shadows, spacing, type } from '@/theme';
import type { Recipe } from '@/types';

export function RecipeCard({
  recipe,
  onPress,
  onAdd,
  added,
  width = 258,
  badges = [],
}: {
  recipe: Recipe;
  onPress: () => void;
  onAdd?: () => void;
  added?: boolean;
  width?: number;
  badges?: string[];
}) {
  return (
    <View style={[styles.card, { width }]}>
      {/* The add control is a sibling of the open-details Pressable so the web
          build never nests one <button> inside another. */}
      <View style={styles.imageWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${recipe.title}. ${recipe.totalTimeMinutes} minutes, ${recipe.difficulty}. Open recipe details.`}
          onPress={onPress}
          style={({ pressed }) => [styles.imagePress, { opacity: pressed ? 0.92 : 1 }]}
        >
          <RecipeImage recipe={recipe} style={styles.image} />
        </Pressable>
        {badges.length ? (
          <View style={styles.badgeRow}>
            {badges.slice(0, 2).map((badge) => (
              <View key={badge} style={styles.badge}>
                <Text style={[type.caption, { color: colors.greenInk }]}>{badge}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {onAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={added ? `${recipe.title} is already in your plan` : `Add ${recipe.title} to your plan`}
            onPress={added ? undefined : onAdd}
            hitSlop={8}
            style={({ pressed }) => [
              styles.addButton,
              {
                backgroundColor: added ? colors.sage : colors.surface,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}
          >
            <MaterialCommunityIcons
              name={added ? 'check' : 'plus'}
              size={20}
              color={added ? colors.greenInk : colors.ink}
            />
          </Pressable>
        ) : null}
      </View>

      <Pressable accessibilityRole="button" onPress={onPress} style={styles.body}>
        <Text style={[type.cardTitle, { color: colors.ink }]} numberOfLines={2}>
          {recipe.title}
        </Text>
        <View style={{ marginTop: 6 }}>
          <RecipeMetaRow recipe={recipe} />
        </View>
      </Pressable>
    </View>
  );
}

export function RecipeRow({ recipe, onPress, right }: { recipe: Recipe; onPress: () => void; right?: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
    >
      <RecipeImage recipe={recipe} style={styles.rowImage} />
      <View style={{ flex: 1 }}>
        <Text style={[type.cardTitle, { color: colors.ink }]} numberOfLines={2}>
          {recipe.title}
        </Text>
        <Text style={[type.caption, { color: colors.muted, marginTop: 3 }]}>
          {recipe.totalTimeMinutes} min · {recipe.ingredients.length} ingredients
        </Text>
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.card,
  },
  imageWrap: { position: 'relative' },
  imagePress: { width: '100%' },
  image: { width: '100%', height: 300, backgroundColor: colors.surfaceMuted },
  badgeRow: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    backgroundColor: 'rgba(250, 248, 242, 0.94)',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  addButton: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  body: { padding: spacing.md, paddingTop: spacing.sm + 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rowImage: { width: 62, height: 62, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
});
