import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Flower } from '@/components/cute/Decor';
import { RecipeImage } from './RecipeImage';
import { RecipeMetaRow } from './RecipeMeta';
import { colors, gradients, radius, shadows, spacing, type } from '@/theme';
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
                <View style={styles.badgeDot} />
                <Text style={[type.caption, { color: colors.primaryInk }]}>{badge}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Flower
          size={16}
          color="rgba(255,255,255,0.95)"
          center={colors.primarySoft}
          style={styles.cardFlower}
        />
        {onAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={added ? `${recipe.title} is already in your plan` : `Add ${recipe.title} to your plan`}
            onPress={added ? undefined : onAdd}
            hitSlop={8}
            style={({ pressed }) => [styles.addShell, { transform: [{ scale: pressed ? 0.9 : 1 }] }]}
          >
            <LinearGradient
              colors={added ? gradients.buttonSoft : gradients.button}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addButton}
            >
              <MaterialCommunityIcons
                name={added ? 'heart' : 'heart-plus'}
                size={19}
                color={added ? colors.primaryDeep : colors.white}
              />
            </LinearGradient>
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
    borderRadius: radius.xxl,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 6,
    ...shadows.card,
  },
  imageWrap: { position: 'relative', borderRadius: radius.xl, overflow: 'hidden' },
  imagePress: { width: '100%' },
  image: { width: '100%', height: 214, backgroundColor: colors.surfaceMuted },
  badgeRow: {
    position: 'absolute',
    left: spacing.xs + 2,
    top: spacing.xs + 2,
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: 4,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  badgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  cardFlower: { position: 'absolute', top: 12, right: 12, opacity: 0.9 },
  addShell: {
    position: 'absolute',
    right: spacing.xs + 2,
    bottom: spacing.xs + 2,
    borderRadius: radius.pill,
    ...shadows.soft,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  body: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.xs + 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rowImage: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
});
