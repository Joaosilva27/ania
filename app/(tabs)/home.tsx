import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { RecipeCard } from '@/components/recipes/RecipeCard';
import { RecipeImage } from '@/components/recipes/RecipeImage';
import { PrimaryButton } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/Chip';
import { Banner, EmptyState, ScreenContainer, SectionHeading } from '@/components/ui/Screen';
import { RECIPE_BY_ID } from '@/data/recipes';
import { GOAL_LABELS, INTERESTS, INTEREST_LABELS, TAG_LABELS } from '@/data/taxonomy';
import { useRecipeActions } from '@/hooks/useRecipeActions';
import { getRecommendedRecipes } from '@/services/recommendations';
import { countPlanIngredients } from '@/services/shopping/aggregate';
import { useUserStore } from '@/store/userStore';
import { colors, radius, spacing, type } from '@/theme';
import type { InterestId } from '@/types';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const data = useUserStore((state) => state.data);
  const syncState = useUserStore((state) => state.syncState);
  const { addToPlan, inPlan } = useRecipeActions();
  const [activeInterests, setActiveInterests] = useState<InterestId[]>([]);

  const preferences = data?.preferences;
  const plan = data?.plan;

  const recommendations = useMemo(() => {
    if (!data) return [];
    return getRecommendedRecipes({
      preferences: data.preferences,
      planRecipeIds: data.plan.items.map((item) => item.recipeId),
      feedback: data.feedback,
      limit: 16,
    }).map((entry) => entry.recipe);
  }, [data]);

  const filtered = useMemo(() => {
    if (!activeInterests.length) return recommendations;
    const tags = activeInterests.flatMap(
      (id) => INTERESTS.find((interest) => interest.id === id)?.boostTags ?? [],
    );
    return recommendations.filter((recipe) => recipe.tags.some((tag) => tags.includes(tag)));
  }, [recommendations, activeInterests]);

  const planRecipes = (plan?.items ?? [])
    .map((item) => RECIPE_BY_ID[item.recipeId])
    .filter(Boolean);
  const ingredientCount = useMemo(() => (plan ? countPlanIngredients(plan) : 0), [plan]);
  const selectedInterests = (preferences?.interests ?? []).slice(0, 6);
  const firstName = data?.profile.displayName?.split(' ')[0] ?? 'there';
  const cardWidth = Math.min(268, width * 0.68);

  const toggleInterest = (id: InterestId) => {
    setActiveInterests((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  if (!data) return null;

  return (
    <ScreenContainer scroll contentStyle={{ paddingTop: spacing.sm }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[type.caption, { color: colors.muted, letterSpacing: 0.4 }]}>
            {greeting()}, {firstName}.
          </Text>
          <Text style={[type.screenTitle, { color: colors.ink, marginTop: 2 }]}>
            What are we cooking today?
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
          onPress={() => router.push('/(tabs)/profile')}
          style={({ pressed }) => [styles.avatar, { opacity: pressed ? 0.8 : 1 }]}
        >
          <Text style={[type.bodyMedium, { color: colors.greenInk }]}>
            {initials(data.profile.displayName || 'You')}
          </Text>
        </Pressable>
      </View>

      {syncState === 'pending' ? (
        <View style={{ marginBottom: spacing.sm }}>
          <Banner
            tone="warning"
            icon="cloud-off-outline"
            message="Saved on this device. We'll sync to your account when you're back online."
          />
        </View>
      ) : null}

      {/* Interests */}
      {selectedInterests.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {selectedInterests.map((interest) => (
            <FilterChip
              key={interest}
              label={INTEREST_LABELS[interest] ?? interest}
              active={activeInterests.includes(interest)}
              onPress={() => toggleInterest(interest)}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.goalRow}>
        <MaterialCommunityIcons name="target" size={14} color={colors.greenDeep} />
        <Text style={[type.caption, { color: colors.muted }]}>
          {preferences?.primaryGoal
            ? `Focus: ${GOAL_LABELS[preferences.primaryGoal]}`
            : 'Add a goal in your profile to refine suggestions'}
        </Text>
      </View>

      {/* Recommendations */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeading
          title="Recommendations for you"
          subtitle={
            activeInterests.length
              ? `Filtered by ${activeInterests.map((id) => INTEREST_LABELS[id]).join(', ')}`
              : 'Meals we think you\u2019ll love'
          }
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open Discover"
              onPress={() => router.push('/(tabs)/discover')}
              hitSlop={8}
            >
              <Text style={[type.label, { color: colors.greenDeep }]}>Swipe mode</Text>
            </Pressable>
          }
        />

        {filtered.length ? (
          <FlatList
            horizontal
            data={filtered}
            keyExtractor={(recipe) => recipe.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}
            snapToInterval={cardWidth + spacing.sm}
            decelerationRate="fast"
            renderItem={({ item }) => (
              <RecipeCard
                recipe={item}
                width={cardWidth}
                badges={item.tags
                  .filter((tag) => ['high-protein', 'budget', 'meal-prep'].includes(tag))
                  .slice(0, 2)
                  .map((tag) => TAG_LABELS[tag] ?? tag)}
                onPress={() => router.push(`/recipe/${item.id}`)}
                onAdd={() => addToPlan(item, 'home')}
                added={inPlan(item.id)}
              />
            )}
          />
        ) : (
          <EmptyState
            title="No matches with those filters"
            message="Try turning a chip off, or update your interests in your profile."
            actionLabel="Clear filters"
            onAction={() => setActiveInterests([])}
          />
        )}
      </View>

      {/* Meal plan */}
      <View style={{ marginTop: spacing.xl }}>
        <SectionHeading
          title="Your meal plan"
          subtitle={`${planRecipes.length} ${planRecipes.length === 1 ? 'recipe' : 'recipes'} · ${ingredientCount} ingredients`}
        />

        {planRecipes.length ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: spacing.xs, paddingRight: spacing.lg }}
            >
              {planRecipes.map((recipe) => (
                <Pressable
                  key={recipe.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${recipe.title}`}
                  onPress={() => router.push(`/recipe/${recipe.id}`)}
                  style={({ pressed }) => [styles.planThumb, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <RecipeImage recipe={recipe} style={styles.planThumbImage} />
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.planSummary}>
              <View style={{ flex: 1 }}>
                <Text style={[type.bodyMedium, { color: colors.ink }]}>
                  {planRecipes.length} recipes · {ingredientCount} ingredients
                </Text>
                <Text style={[type.caption, { color: colors.muted, marginTop: 2 }]}>
                  Your shopping list is already built.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open your shopping list"
                onPress={() => router.push('/shopping-list')}
                style={styles.listLink}
              >
                <MaterialCommunityIcons name="basket-outline" size={18} color={colors.greenInk} />
              </Pressable>
            </View>

            <View style={{ marginTop: spacing.sm }}>
              <PrimaryButton
                label="View plan"
                onPress={() => router.push('/(tabs)/plan')}
                variant="secondary"
              />
            </View>
          </>
        ) : (
          <EmptyState
            icon="basket-outline"
            title="Your plan is empty"
            message="Add a recipe from the carousel above or swipe through Discover."
            actionLabel="Open Discover"
            onAction={() => router.push('/(tabs)/discover')}
          />
        )}
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(90,138,69,0.25)',
  },
  chipRow: { gap: spacing.xs, paddingVertical: spacing.sm, paddingRight: spacing.lg },
  goalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs },
  planThumb: { borderRadius: radius.md, overflow: 'hidden' },
  planThumbImage: { width: 72, height: 72, borderRadius: radius.md },
  planSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  listLink: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
