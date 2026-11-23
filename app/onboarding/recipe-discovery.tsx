import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { SwipeRecipeCard } from '@/components/recipes/SwipeRecipeCard';
import { PrimaryButton } from '@/components/ui/Button';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/swipe/SwipeDeck';
import { getRecommendedRecipes, INITIAL_PLAN_SIZE } from '@/services/recommendations';
import {
  addRecipeToPlan,
  recordFeedback,
  removeRecipeFromPlan,
  setInitialRecipeIds,
} from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import { colors, radius, shadows, spacing, type } from '@/theme';
import type { Recipe } from '@/types';

export default function RecipeDiscoveryScreen() {
  const router = useRouter();
  const data = useUserStore((state) => state.data);
  const mutate = useUserStore((state) => state.mutate);
  const deckRef = useRef<SwipeDeckHandle>(null);
  const navigating = useRef(false);
  const [toast, setToast] = useState<string | null>(null);

  // Frozen at mount: swiping must not reshuffle the deck mid-session.
  const [queue] = useState<Recipe[]>(() => {
    if (!data) return [];
    return getRecommendedRecipes({
      preferences: data.preferences,
      planRecipeIds: data.plan.items.map((item) => item.recipeId),
      feedback: data.feedback,
      limit: 24,
    }).map((entry) => entry.recipe);
  });

  const selectedCount = data?.onboarding.initialRecipeIds.length ?? 0;

  const handleDecide = useCallback(
    (recipe: Recipe, decision: 'yes' | 'no') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

      if (decision === 'no') {
        mutate((current) => recordFeedback(current, recipe.id, 'rejected', 'onboarding'));
        return;
      }

      mutate((current) => {
        const withPlan = addRecipeToPlan(current, recipe.id, 'onboarding', recipe.servings);
        const ids = withPlan.onboarding.initialRecipeIds.filter((id) => id !== recipe.id);
        return setInitialRecipeIds(
          recordFeedback(withPlan, recipe.id, 'accepted', 'onboarding'),
          [...ids, recipe.id],
        );
      });

      setToast('Added to your plan!');
      setTimeout(() => setToast(null), 1400);

      if (selectedCount + 1 >= INITIAL_PLAN_SIZE && !navigating.current) {
        navigating.current = true;
        setTimeout(() => {
          router.replace('/onboarding/initial-plan');
        }, 700);
      }
    },
    [mutate, router, selectedCount],
  );

  const pips = Array.from({ length: INITIAL_PLAN_SIZE }).map((_, index) => index < selectedCount);

  return (
    <OnboardingScaffold
      step="recipe-discovery"
      scroll={false}
      onBack={() => {
        mutate((current) => {
          let next = current;
          for (const id of current.onboarding.initialRecipeIds) {
            next = removeRecipeFromPlan(next, id);
          }
          return setInitialRecipeIds(next, []);
        });
        router.replace('/onboarding/dietary');
      }}
      headerRight={
        <Text style={[type.label, { color: colors.greenDeep }]}>
          {selectedCount} / {INITIAL_PLAN_SIZE}
        </Text>
      }
      footer={
        <View>
          <Text style={[type.caption, styles.counter]}>
            {selectedCount} of {INITIAL_PLAN_SIZE} meals selected
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skip this recipe"
              onPress={() => deckRef.current?.swipe('no')}
              style={({ pressed }) => [styles.round, styles.skip, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
            >
              <MaterialCommunityIcons name="close-thick" size={24} color={colors.coral} />
            </Pressable>
            <View style={styles.pips}>
              {pips.map((filled, index) => (
                <View
                  key={index}
                  style={[
                    styles.pip,
                    { backgroundColor: filled ? colors.greenDeep : colors.borderStrong },
                  ]}
                />
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add this recipe to your plan"
              onPress={() => deckRef.current?.swipe('yes')}
              style={({ pressed }) => [styles.round, styles.add, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
            >
              <MaterialCommunityIcons name="plus" size={26} color={colors.greenInk} />
            </Pressable>
          </View>
        </View>
      }
    >
      <View style={styles.deckWrap}>
        <SwipeDeck
          ref={deckRef}
          items={queue}
          keyExtractor={(recipe) => recipe.id}
          onDecide={handleDecide}
          yesLabel="Add"
          noLabel="Skip"
          renderCard={(recipe) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open details for ${recipe.title}`}
              onPress={() => router.push(`/recipe/${recipe.id}`)}
              style={{ flex: 1 }}
            >
              <SwipeRecipeCard recipe={recipe} />
            </Pressable>
          )}
          renderEmpty={() => (
            <View style={styles.empty}>
              <Text style={[type.cardTitle, { color: colors.ink }]}>You've seen our best matches</Text>
              <Text style={[type.body, { color: colors.muted, textAlign: 'center', marginTop: 4 }]}>
                Your diet is quite specific. Try adding an interest or relaxing a filter and we'll
                find more for you.
              </Text>
              <View style={{ marginTop: spacing.md, width: '100%' }}>
                <PrimaryButton
                  label="Change my preferences"
                  onPress={() => router.replace('/onboarding/preferences')}
                />
              </View>
            </View>
          )}
        />
      </View>

      {toast ? (
        <View style={[styles.toast, styles.noTouch]}>
          <MaterialCommunityIcons name="check-circle" size={16} color={colors.greenInk} />
          <Text style={[type.label, { color: colors.greenInk }]}>{toast}</Text>
        </View>
      ) : null}
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  deckWrap: { flex: 1, paddingTop: spacing.xs },
  counter: { color: colors.muted, textAlign: 'center', marginBottom: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  skip: { backgroundColor: colors.coralSoft, borderColor: 'rgba(224,107,81,0.25)' },
  add: { backgroundColor: colors.sage, borderColor: 'rgba(90,138,69,0.25)' },
  pips: { flexDirection: 'row', gap: 8 },
  pip: { width: 26, height: 4, borderRadius: radius.pill },
  toast: {
    position: 'absolute',
    top: 96,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.sage,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    ...shadows.soft,
  },
  empty: { alignItems: 'center', padding: spacing.lg },
  noTouch: { pointerEvents: 'none' },
});
