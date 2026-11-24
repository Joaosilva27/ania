import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RecipeImage } from '@/components/recipes/RecipeImage';
import { PrimaryButton } from '@/components/ui/Button';
import { EmptyState, ScreenContainer } from '@/components/ui/Screen';
import { RECIPE_BY_ID } from '@/data/recipes';
import { LEGACY_RECIPE_TITLES } from '@/data/recipes/legacy';
import { useLivePrices } from '@/hooks/useLivePrices';
import { useRecipeActions } from '@/hooks/useRecipeActions';
import { PriceSummary } from '@/components/pricing/PriceSummary';
import { basketForPlan } from '@/services/pricing/live';
import { countPlanIngredients } from '@/services/shopping/aggregate';
import { confirmAction } from '@/lib/dialogs';
import { useUserStore } from '@/store/userStore';
import { colors, radius, spacing, type } from '@/theme';

export default function PlanScreen() {
  const router = useRouter();
  const data = useUserStore((state) => state.data);
  const { removeFromPlan, setServings } = useRecipeActions();

  const items = data?.plan.items ?? [];
  const ingredientCount = useMemo(
    () => (data ? countPlanIngredients(data.plan) : 0),
    [data],
  );
  const stores = data?.preferences.supermarkets ?? [];
  const basket = useMemo(() => basketForPlan(items), [items]);
  const live = useLivePrices(basket, stores);

  const confirmRemove = (recipeId: string, title: string) => {
    void confirmAction({
      title: 'Remove recipe?',
      message: `This will update your shopping list for “${title}”.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Keep it',
      destructive: true,
    }).then((confirmed) => {
      if (confirmed) removeFromPlan(recipeId);
    });
  };

  return (
    <ScreenContainer scroll bottomSpace={104} contentStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xxl }}>
                <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[type.note, { color: colors.primaryDeep }]}>your week, sorted</Text>
          <Text style={[type.screenTitle, { color: colors.ink, marginTop: -2 }]}>Your meal plan</Text>
          <Text style={[type.caption, { color: colors.muted, marginTop: 4 }]}>
            {items.length} {items.length === 1 ? 'recipe' : 'recipes'} · {ingredientCount} unique
            ingredients
          </Text>
        </View>
      </View>

      {items.length ? (
        <>
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={[type.sectionTitle, { color: colors.primaryInk }]}>{items.length}</Text>
              <Text style={[type.caption, { color: colors.inkSoft }]}>recipes</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={[type.sectionTitle, { color: colors.primaryInk }]}>{ingredientCount}</Text>
              <Text style={[type.caption, { color: colors.inkSoft }]}>ingredients</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={[type.sectionTitle, { color: colors.primaryInk }]}>
                {items.reduce((acc, item) => acc + item.servings, 0)}
              </Text>
              <Text style={[type.caption, { color: colors.inkSoft }]}>servings</Text>
            </View>
          </View>

          <View style={{ marginTop: spacing.sm }}>
            <PriceSummary
              result={live.result}
              label="Your basket"
              compact
              loading={live.loading}
              error={live.error}
              onRetry={live.refresh}
            />
          </View>

          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {items.map((item) => {
              const recipe = RECIPE_BY_ID[item.recipeId];
              if (!recipe) {
                // Saved before the catalogue was replaced: show it honestly
                // instead of letting a chosen meal disappear without a word.
                const legacyTitle = LEGACY_RECIPE_TITLES[item.recipeId];
                return (
                  <View key={item.recipeId} style={[styles.card, styles.missingCard]}>
                    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                      <View style={styles.missingIcon}>
                        <MaterialCommunityIcons
                          name="book-remove-outline"
                          size={24}
                          color={colors.muted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[type.cardTitle, { color: colors.inkSoft }]} numberOfLines={2}>
                          {legacyTitle ?? 'A saved recipe'}
                        </Text>
                        <Text style={[type.caption, { color: colors.muted, marginTop: 2 }]}>
                          No longer in the catalogue — swap it for another or remove it.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardFooter}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Find a replacement for ${legacyTitle ?? 'this recipe'}`}
                        onPress={() => router.push('/(tabs)/discover')}
                        style={styles.swapButton}
                      >
                        <MaterialCommunityIcons
                          name="swap-horizontal"
                          size={15}
                          color={colors.primaryInk}
                        />
                        <Text style={[type.caption, { color: colors.primaryInk }]}>Replace</Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${legacyTitle ?? 'this recipe'} from the plan`}
                        onPress={() => confirmRemove(item.recipeId, legacyTitle ?? 'this recipe')}
                        hitSlop={6}
                        style={styles.removeButton}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.danger} />
                      </Pressable>
                    </View>
                  </View>
                );
              }
              return (
                <View key={item.recipeId} style={styles.card}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${recipe.title}`}
                    onPress={() => router.push(`/recipe/${recipe.id}`)}
                    style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}
                  >
                    <RecipeImage recipe={recipe} style={styles.image} />
                    <View style={{ flex: 1 }}>
                      <Text style={[type.cardTitle, { color: colors.ink }]} numberOfLines={2}>
                        {recipe.title}
                      </Text>
                      <Text style={[type.caption, { color: colors.muted, marginTop: 2 }]}>
                        {recipe.totalTimeMinutes} min · {recipe.ingredients.length} ingredients
                      </Text>
                    </View>
                  </Pressable>

                  <View style={styles.cardFooter}>
                    <View style={styles.stepper}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Fewer servings for ${recipe.title}`}
                        onPress={() => setServings(recipe.id, item.servings - 1)}
                        style={styles.stepperButton}
                        hitSlop={4}
                      >
                        <MaterialCommunityIcons name="minus" size={16} color={colors.ink} />
                      </Pressable>
                      <Text style={[type.label, { color: colors.ink, minWidth: 62, textAlign: 'center' }]}>
                        {item.servings} {item.servings === 1 ? 'serving' : 'servings'}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`More servings for ${recipe.title}`}
                        onPress={() => setServings(recipe.id, item.servings + 1)}
                        style={styles.stepperButton}
                        hitSlop={4}
                      >
                        <MaterialCommunityIcons name="plus" size={16} color={colors.ink} />
                      </Pressable>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${recipe.title} from the plan`}
                      onPress={() => confirmRemove(recipe.id, recipe.title)}
                      hitSlop={6}
                      style={styles.removeButton}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={{ gap: spacing.xs, marginTop: spacing.lg }}>
            <PrimaryButton
              label="View shopping list"
              icon="basket-outline"
              onPress={() => router.push('/shopping-list')}
            />
            <PrimaryButton
              label="Add another recipe"
              variant="secondary"
              icon="plus"
              onPress={() => router.push('/(tabs)/discover')}
            />
          </View>
        </>
      ) : (
        <View style={{ marginTop: spacing.lg }}>
          <EmptyState
            icon="calendar-blank-outline"
            title="No meals planned yet"
            message="Swipe through Discover or add a recommendation from Home to start your plan."
            actionLabel="Discover recipes"
            onAction={() => router.push('/(tabs)/discover')}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceTint,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  divider: { width: 1, height: 30, backgroundColor: 'rgba(59, 39, 51, 0.12)' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  image: { width: 76, height: 76, borderRadius: radius.md },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.xs + 2,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: { padding: spacing.xs },
  missingCard: {
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
  },
  missingIcon: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
});
