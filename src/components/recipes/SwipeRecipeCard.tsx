import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RecipeImage } from './RecipeImage';
import { RecipeMetaRow } from './RecipeMeta';
import { TagBadge } from '@/components/ui/Chip';
import { colors, radius, shadows, spacing, type } from '@/theme';
import type { Recipe } from '@/types';

export function SwipeRecipeCard({ recipe }: { recipe: Recipe }) {
  const badges: Array<{
    label: string;
    tone: 'primary' | 'accent' | 'lavender' | 'mint' | 'butter' | 'neutral';
  }> = [];
  if (recipe.tags.includes('high-protein')) badges.push({ label: 'High protein', tone: 'primary' });
  if (recipe.dietaryClassification.includes('vegan')) badges.push({ label: 'Vegan', tone: 'mint' });
  else if (recipe.dietaryClassification.includes('vegetarian'))
    badges.push({ label: 'Veggie', tone: 'mint' });
  if (recipe.budgetTier === 'budget') badges.push({ label: 'Budget', tone: 'butter' });

  return (
    <View style={styles.card}>
      <RecipeImage recipe={recipe} style={styles.image} />
      <View style={styles.info}>
        <View style={styles.badgeRow}>
          {badges.slice(0, 3).map((badge) => (
            <TagBadge key={badge.label} label={badge.label} tone={badge.tone} />
          ))}
        </View>
        <Text style={[type.recipeTitle, styles.title]} numberOfLines={3}>
          {recipe.title}
        </Text>
        <RecipeMetaRow recipe={recipe} tint={colors.muted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.xxl,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.white,
    ...shadows.floating,
  },
  image: { ...StyleSheet.absoluteFillObject },
  info: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xxs },
  title: { color: colors.ink, marginBottom: spacing.xs },
});
