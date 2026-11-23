import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { RecipeImage } from '@/components/recipes/RecipeImage';
import { PrimaryButton, TextButton } from '@/components/ui/Button';
import { RECIPE_BY_ID } from '@/data/recipes';
import { INITIAL_PLAN_SIZE } from '@/services/recommendations';
import { countPlanIngredients } from '@/services/shopping/aggregate';
import {
  removeRecipeFromPlan,
  setInitialRecipeIds,
  setOnboardingStep,
} from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import { colors, radius, spacing, type } from '@/theme';

export default function InitialPlanScreen() {
  const router = useRouter();
  const data = useUserStore((state) => state.data);
  const mutate = useUserStore((state) => state.mutate);
  const ids = data?.onboarding.initialRecipeIds ?? [];
  const recipes = ids.map((id) => RECIPE_BY_ID[id]).filter(Boolean);
  const complete = recipes.length === INITIAL_PLAN_SIZE;

  const remove = (recipeId: string) => {
    mutate((current) =>
      setInitialRecipeIds(removeRecipeFromPlan(current, recipeId), [
        ...current.onboarding.initialRecipeIds.filter((id) => id !== recipeId),
      ]),
    );
  };

  const buildList = () => {
    mutate((current) => setOnboardingStep(current, 'shopping-preview'));
    router.push('/onboarding/shopping-preview');
  };

  return (
    <OnboardingScaffold
      step="initial-plan"
      onBack={() => router.replace('/onboarding/dietary')}
      footer={
        <View style={{ gap: spacing.xs }}>
          <PrimaryButton
            label="Build my shopping list"
            onPress={buildList}
            disabled={!complete}
            icon="basket-outline"
          />
          {!complete ? (
            <TextButton
              label="Pick another meal"
              onPress={() => router.replace('/onboarding/recipe-discovery')}
            />
          ) : null}
        </View>
      }
    >
      <Text style={[type.body, { color: colors.muted }]}>
        {complete
          ? 'Three meals, one shop. Remove or replace any of these before we build your list.'
          : `You have ${recipes.length} of ${INITIAL_PLAN_SIZE}. Add another meal to continue.`}
      </Text>

      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        {recipes.map((recipe) => (
          <View key={recipe.id} style={styles.card}>
            <RecipeImage recipe={recipe} style={styles.image} />
            <View style={{ flex: 1 }}>
              <Text style={[type.cardTitle, { color: colors.ink }]} numberOfLines={2}>
                {recipe.title}
              </Text>
              <Text style={[type.caption, { color: colors.muted, marginTop: 2 }]}>
                {recipe.totalTimeMinutes} min · {recipe.ingredients.length} ingredients
              </Text>
              <View style={styles.cardActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${recipe.title}`}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                  hitSlop={6}
                  style={styles.viewPill}
                >
                  <MaterialCommunityIcons name="eye-outline" size={13} color={colors.primaryInk} />
                  <Text style={[type.caption, { color: colors.primaryInk }]}>View recipe</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${recipe.title} from the plan`}
                  onPress={() => remove(recipe.id)}
                  hitSlop={6}
                  style={styles.removePill}
                >
                  <MaterialCommunityIcons name="close" size={13} color={colors.danger} />
                  <Text style={[type.caption, { color: colors.danger }]}>Remove</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.summary}>
        <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.primaryDeep} />
        <Text style={[type.caption, { color: colors.inkSoft, flex: 1 }]}>
          {recipes.length} recipes · {countPlanIngredients(data?.plan ?? { items: [], version: 0, updatedAt: '' })}{' '}
          unique ingredients already on your list
        </Text>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
  },
  image: { width: 74, height: 74, borderRadius: radius.md },
  viewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  removePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  cardActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceTint,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
});
