import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SwipeRecipeCard } from '@/components/recipes/SwipeRecipeCard';
import { PrimaryButton } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/Chip';
import { EmptyState, ScreenContainer } from '@/components/ui/Screen';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/swipe/SwipeDeck';
import {
  DISCOVERY_FILTERS,
  countDiscoveryMatches,
  getDiscoveryQueue,
} from '@/services/discovery';
import { useRecipeActions } from '@/hooks/useRecipeActions';
import { recordFeedback } from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import { colors, radius, spacing, type } from '@/theme';
import type { Recipe } from '@/types';

type UserData = NonNullable<ReturnType<typeof useUserStore.getState>['data']>;

function buildQueue(data: UserData, filterIds: string[], seed: number): Recipe[] {
  return getDiscoveryQueue({
    preferences: data.preferences,
    planRecipeIds: data.plan.items.map((item) => item.recipeId),
    feedback: data.feedback,
    filterIds,
    seed,
    limit: 60,
  });
}

export default function DiscoverScreen() {
  const router = useRouter();
  const data = useUserStore((state) => state.data);
  const mutate = useUserStore((state) => state.mutate);
  const { addToPlan } = useRecipeActions();
  const deckRef = useRef<SwipeDeckHandle>(null);
  const [queue, setQueue] = useState<Recipe[]>([]);
  const [filterIds, setFilterIds] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  // Decisions rewrite `data`, but the deck must not reshuffle mid-swipe. The
  // builder only changes with the filters or the round, so that is exactly the
  // effect's dependency; it reads the newest data through a ref (which React
  // does not treat as a dependency) to seed the very first deck.
  const latestData = useRef(data);
  latestData.current = data;
  const hasData = Boolean(data);
  const buildDeck = useCallback(
    (current: UserData) => buildQueue(current, filterIds, round),
    [filterIds, round],
  );

  useEffect(() => {
    const current = latestData.current;
    if (current) setQueue(buildDeck(current));
  }, [buildDeck, hasData]);

  // Counting ~1k recipes is cheaper than a memo whose dependencies would need
  // the whole plan and feedback objects to be recreated anyway.
  const matchCount = data
    ? countDiscoveryMatches({
        preferences: data.preferences,
        planRecipeIds: data.plan.items.map((item) => item.recipeId),
        feedback: data.feedback,
        filterIds,
      })
    : 0;

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

  const toggleFilter = (id: string) => {
    setFilterIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const refresh = () => setRound((value) => value + 1);

  if (!data) return null;

  const activeLabels = filterIds
    .map((id) => DISCOVERY_FILTERS.find((filter) => filter.id === id)?.label)
    .filter(Boolean);

  return (
    <ScreenContainer bottomSpace={104}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[type.noteSmall, { color: colors.primaryDeep }]}>swipe right if it's a yes ♡</Text>
          <Text style={[type.screenTitle, { color: colors.ink, marginTop: -2 }]}>
            Discover something new.
          </Text>
          <Text style={[type.caption, { color: colors.muted, marginTop: 4 }]}>
            {matchCount} {matchCount === 1 ? 'dish' : 'dishes'} to explore
            {activeLabels.length ? ` · ${activeLabels.join(' · ')}` : ''}
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={[type.caption, { color: colors.primaryInk }]}>{data.plan.items.length} planned</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroller}
        contentContainerStyle={styles.chipRow}
      >
        {DISCOVERY_FILTERS.map((filter) => (
          <FilterChip
            key={filter.id}
            label={filter.label}
            active={filterIds.includes(filter.id)}
            onPress={() => toggleFilter(filter.id)}
          />
        ))}
      </ScrollView>

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
              title={
                filterIds.length
                  ? 'Nothing matches those chips'
                  : round > 0
                    ? 'That’s everything for now'
                    : 'You’ve explored it all'
              }
              message={
                filterIds.length
                  ? 'Those filters are strict on purpose. Turn one off to widen the deck.'
                  : 'You have seen every dish we can suggest right now. New recipes get added regularly.'
              }
              actionLabel={filterIds.length ? 'Clear filters' : 'Start over'}
              onAction={() => {
                if (filterIds.length) setFilterIds([]);
                else refresh();
              }}
            />
          )}
        />
      </View>

      {toast ? (
        <View style={[styles.toast, styles.noTouch]}>
          <MaterialCommunityIcons
            name={toast.startsWith('Added') ? 'check-circle' : 'close-circle-outline'}
            size={16}
            color={toast.startsWith('Added') ? colors.primaryInk : colors.inkSoft}
          />
          <Text style={[type.label, { color: toast.startsWith('Added') ? colors.primaryInk : colors.inkSoft }]}>
            {toast}
          </Text>
        </View>
      ) : null}

      {queue.length === 0 ? (
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
          <MaterialCommunityIcons name="close-thick" size={25} color={colors.danger} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Shuffle in a different set of dishes"
          onPress={refresh}
          style={({ pressed }) => [styles.infoButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialCommunityIcons name="shuffle-variant" size={20} color={colors.inkSoft} />
          <Text style={[type.caption, { color: colors.inkSoft }]}>Shuffle</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add this recipe to your plan"
          onPress={() => deckRef.current?.swipe('yes')}
          style={({ pressed }) => [styles.round, styles.add, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
        >
          <MaterialCommunityIcons name="heart" size={26} color={colors.white} />
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingTop: spacing.sm },
  countBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  // Without a fixed height a horizontal ScrollView swallows the deck's space.
  chipScroller: { flexGrow: 0, flexShrink: 0 },
  chipRow: { gap: spacing.xs, paddingVertical: spacing.sm, paddingRight: spacing.lg },
  deck: { flex: 1, marginTop: spacing.xxs },
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
  skip: { backgroundColor: colors.dangerSoft, borderColor: 'rgba(219, 84, 97, 0.24)' },
  add: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
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
