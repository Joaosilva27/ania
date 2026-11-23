import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SwipeRecipeCard } from '@/components/recipes/SwipeRecipeCard';
import { PrimaryButton } from '@/components/ui/Button';
import { EmptyState, ScreenContainer } from '@/components/ui/Screen';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/swipe/SwipeDeck';
import { getRecommendedRecipes } from '@/services/recommendations';
import { useRecipeActions } from '@/hooks/useRecipeActions';
import { recordFeedback } from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import { colors, radius, spacing, type } from '@/theme';
import type { Recipe } from '@/types';

function buildQueue(data: NonNullable<ReturnType<typeof useUserStore.getState>['data']>): Recipe[] {
  return getRecommendedRecipes({
    preferences: data.preferences,
    planRecipeIds: data.plan.items.map((item) => item.recipeId),
    feedback: data.feedback,
    limit: 20,
  }).map((entry) => entry.recipe);
}

export default function DiscoverScreen() {
  const router = useRouter();
  const data = useUserStore((state) => state.data);
  const mutate = useUserStore((state) => state.mutate);
  const { addToPlan, inPlan } = useRecipeActions();
  const deckRef = useRef<SwipeDeckHandle>(null);
  const [queue, setQueue] = useState<Recipe[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const seeded = useRef(false);

  // The profile hydrates after the first render, so seed the deck once it lands
  // (and not again after every decision, which would reshuffle the cards).
  useEffect(() => {
    if (!data || seeded.current) return;
    seeded.current = true;
    setQueue(buildQueue(data));
  }, [data]);

  const handleDecide = useCallback(
    (recipe: Recipe, decision: 'yes' | 'no') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      if (decision === 'yes') {
        addToPlan(recipe, 'discover');
        setToast('Added to your plan!');
      } else {
        mutate((current) => recordFeedback(current, recipe.id, 'rejected', 'discover'));
        setToast('Skipped');
      }
      setTimeout(() => setToast(null), 1200);
    },
    [addToPlan, mutate],
  );

  const refresh = () => {
    if (!data) return;
    seeded.current = true;
    setQueue(buildQueue(data));
    setRound((value) => value + 1);
  };

  if (!data) return null;

  const activeIngredientIndex = queue.length;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[type.screenTitle, { color: colors.ink }]}>Discover something delicious.</Text>
          <Text style={[type.caption, { color: colors.muted, marginTop: 4 }]}>
            Swipe right to add it to your plan.
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={[type.caption, { color: colors.greenInk }]}>{data.plan.items.length} planned</Text>
        </View>
      </View>

      <View style={styles.deck}>
        <SwipeDeck
          ref={deckRef}
          items={queue}
          keyExtractor={(recipe) => recipe.id}
          onDecide={handleDecide}
          yesLabel="Add to plan"
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
            <EmptyState
              icon="compass-outline"
              title={round > 0 ? 'That\u2019s every fresh match for now' : 'You\u2019ve seen all our matches'}
              message="We hide recipes you've skipped for two weeks. Refresh to pull in anything new, or relax a filter in your profile."
              actionLabel="Refresh suggestions"
              onAction={refresh}
            />
          )}
        />
      </View>

      {toast ? (
        <View style={[styles.toast, styles.noTouch]}>
          <MaterialCommunityIcons
            name={toast.startsWith('Added') ? 'check-circle' : 'close-circle-outline'}
            size={16}
            color={toast.startsWith('Added') ? colors.greenInk : colors.inkSoft}
          />
          <Text style={[type.label, { color: toast.startsWith('Added') ? colors.greenInk : colors.inkSoft }]}>
            {toast}
          </Text>
        </View>
      ) : null}

      {activeIngredientIndex === 0 ? (
        <View style={{ marginTop: spacing.sm }}>
          <PrimaryButton label="Browse recommendations instead" variant="secondary" onPress={() => router.push('/(tabs)/home')} />
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip this recipe"
          onPress={() => deckRef.current?.swipe('no')}
          style={({ pressed }) => [styles.round, styles.skip, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
        >
          <MaterialCommunityIcons name="close-thick" size={25} color={colors.coral} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open the current recipe details"
          onPress={() => {
            const current = queue[0];
            if (current) router.push(`/recipe/${current.id}`);
          }}
          style={({ pressed }) => [styles.infoButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialCommunityIcons name="information-outline" size={20} color={colors.inkSoft} />
          <Text style={[type.caption, { color: colors.inkSoft }]}>Details</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add this recipe to your plan"
          onPress={() => deckRef.current?.swipe('yes')}
          style={({ pressed }) => [styles.round, styles.add, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
        >
          <MaterialCommunityIcons name="plus" size={27} color={colors.greenInk} />
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingTop: spacing.sm },
  countBadge: {
    backgroundColor: colors.sage,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  deck: { flex: 1, marginTop: spacing.md },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
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
  infoButton: { alignItems: 'center', gap: 2, paddingHorizontal: spacing.md },
  toast: {
    position: 'absolute',
    top: 86,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noTouch: { pointerEvents: 'none' },
});
