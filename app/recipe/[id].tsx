import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, Sparkle } from '@/components/cute/Decor';
import { IngredientIcon } from '@/components/shopping/IngredientIcon';
import { RecipeImage } from '@/components/recipes/RecipeImage';
import { RecipeStatsGrid } from '@/components/recipes/RecipeMeta';
import { PriceSummary } from '@/components/pricing/PriceSummary';
import { IconButton, PrimaryButton } from '@/components/ui/Button';
import { TagBadge } from '@/components/ui/Chip';
import { EmptyState, ScreenContainer } from '@/components/ui/Screen';
import { INGREDIENT_MAP } from '@/data/ingredients';
import { getRecipeById } from '@/data/recipes';
import { DIETARY_LABELS, TAG_LABELS } from '@/data/taxonomy';
import { useLivePrices } from '@/hooks/useLivePrices';
import { useRecipeActions } from '@/hooks/useRecipeActions';
import { basketForRecipe } from '@/services/pricing/live';
import { clampServings, scaledIngredients } from '@/services/recipes/servings';
import { useUserStore } from '@/store/userStore';
import { colors, radius, spacing, type } from '@/theme';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const recipe = getRecipeById(id);
  const data = useUserStore((state) => state.data);
  const { addToPlan, inPlan, setServings, toggleFavoriteRecipe, favorites } = useRecipeActions();
  const [localServings, setLocalServings] = useState<number>(recipe?.servings ?? 2);

  if (!recipe) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <EmptyState
          icon="book-open-page-variant-outline"
          title="Recipe not found"
          message="This recipe may have been removed from the catalogue."
          actionLabel="Back to Home"
          onAction={() => router.replace('/(tabs)/home')}
        />
      </ScreenContainer>
    );
  }

  const planItem = data?.plan.items.find((item) => item.recipeId === recipe.id);
  const servings = planItem ? planItem.servings : localServings;
  const ingredients = scaledIngredients(recipe, servings);
  const isFavorite = Boolean(favorites[recipe.id]);
  const stores = data?.preferences.supermarkets ?? [];
  const basket = useMemo(() => basketForRecipe(recipe, servings), [recipe, servings]);
  const live = useLivePrices(basket, stores, servings);

  const changeServings = (next: number) => {
    const clamped = clampServings(next);
    if (planItem) setServings(recipe.id, clamped);
    else setLocalServings(clamped);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
      >
        <View style={styles.hero}>
          <RecipeImage recipe={recipe} style={StyleSheet.absoluteFill} priority="high" />
          <SafeAreaView edges={['top']} style={styles.heroOverlay}>
            <View style={styles.heroButtons}>
              <IconButton
                icon="arrow-left"
                accessibilityLabel="Go back"
                onPress={() => router.back()}
                background="rgba(255,249,247,0.92)"
              />
              <IconButton
                icon={isFavorite ? 'heart' : 'heart-outline'}
                accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Save to favourites'}
                color={isFavorite ? colors.danger : colors.ink}
                onPress={() => toggleFavoriteRecipe(recipe.id)}
                background="rgba(255,249,247,0.92)"
              />
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.content}>
          <View style={styles.tagRow}>
            {recipe.tags
              .filter((tag) => ['high-protein', 'budget', 'meal-prep', 'under-30', 'comfort'].includes(tag))
              .slice(0, 3)
              .map((tag) => (
                <TagBadge key={tag} label={TAG_LABELS[tag] ?? tag} tone="primary" />
              ))}
            {recipe.dietaryClassification
              .filter((diet) => diet !== 'carnivore')
              .slice(0, 1)
              .map((diet) => (
                <TagBadge key={diet} label={DIETARY_LABELS[diet] ?? diet} tone="accent" />
              ))}
          </View>

          <Text style={[type.screenTitle, { color: colors.ink }]}>{recipe.title}</Text>
          <Text style={[type.body, { color: colors.inkSoft, marginTop: spacing.xs }]}>
            {recipe.description}
          </Text>

          <View style={{ marginTop: spacing.md }}>
            <RecipeStatsGrid recipe={recipe} />
          </View>

          <View style={{ marginTop: spacing.sm }}>
            <PriceSummary
              result={live.result}
              label="Basket"
              perServing
              compact
              loading={live.loading}
              error={live.error}
              onRetry={live.refresh}
            />
          </View>

          {recipe.nutrition ? (
            <View style={styles.nutritionRow}>
              {[
                { label: 'kcal', value: recipe.nutrition.calories },
                { label: 'protein', value: `${recipe.nutrition.proteinGrams} g` },
                { label: 'carbs', value: `${recipe.nutrition.carbsGrams} g` },
                { label: 'fat', value: `${recipe.nutrition.fatGrams} g` },
              ].map((item) => (
                <View key={item.label} style={styles.nutritionItem}>
                  <Text style={[type.bodyMedium, { color: colors.ink }]}>{item.value}</Text>
                  <Text style={[type.caption, { color: colors.muted }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {recipe.nutrition ? (
            <Text style={[type.caption, { color: colors.faint, marginTop: 4 }]}>
              Nutrition is approximate — taken from the recipe source, not measured.
            </Text>
          ) : null}

          {/* Servings */}
          <View style={styles.servingsRow}>
            <View style={{ flex: 1 }}>
              <Text style={[type.cardTitle, { color: colors.ink }]}>Servings</Text>
              <Text style={[type.caption, { color: colors.muted }]}>
                Quantities scale with your choice.
              </Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fewer servings"
                onPress={() => changeServings(servings - 1)}
                style={styles.stepperButton}
                hitSlop={4}
              >
                <MaterialCommunityIcons name="minus" size={18} color={colors.ink} />
              </Pressable>
              <Text style={[type.bodyMedium, { color: colors.ink, minWidth: 28, textAlign: 'center' }]}>
                {servings}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More servings"
                onPress={() => changeServings(servings + 1)}
                style={styles.stepperButton}
                hitSlop={4}
              >
                <MaterialCommunityIcons name="plus" size={18} color={colors.ink} />
              </Pressable>
            </View>
          </View>

          {/* Ingredients */}
          <View style={styles.sectionTitleRow}>
            <Heart size={13} color={colors.primary} />
            <Text style={[type.sectionTitle, styles.sectionTitle]}>Ingredients</Text>
          </View>
          <View style={styles.ingredientList}>
            {ingredients.map((ingredient) => (
              <View key={`${ingredient.ingredientId}-${ingredient.unit}-${ingredient.preparation ?? ''}`} style={styles.ingredientRow}>
                <IngredientIcon ingredientId={ingredient.ingredientId} size={36} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { color: colors.ink }]}>
                    {ingredient.displayName ??
                      INGREDIENT_MAP[ingredient.ingredientId]?.name ??
                      ingredient.ingredientId}
                    {ingredient.optional ? (
                      <Text style={[type.caption, { color: colors.faint }]}> (optional)</Text>
                    ) : null}
                  </Text>
                  {ingredient.preparation ? (
                    <Text style={[type.caption, { color: colors.muted }]}>{ingredient.preparation}</Text>
                  ) : null}
                </View>
                <Text style={[type.label, { color: colors.inkSoft }]}>{ingredient.scaledLabel}</Text>
              </View>
            ))}
          </View>

          {/* Method */}
          <View style={styles.sectionTitleRow}>
            <Sparkle size={13} color={colors.butter} />
            <Text style={[type.sectionTitle, styles.sectionTitle]}>Method</Text>
          </View>
          <View style={{ gap: spacing.md }}>
            {recipe.instructions.map((instruction) => (
              <View key={instruction.step} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={[type.label, { color: colors.white }]}>{instruction.step}</Text>
                </View>
                <Text style={[type.body, { color: colors.inkSoft, flex: 1 }]}>{instruction.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.footerNote}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color={colors.primaryDeep} />
            <Text style={[type.caption, { color: colors.inkSoft, flex: 1 }]}>
              {recipe.mealPrepSuitable
                ? 'Good for meal prep — cool quickly and store in the fridge for up to 3 days.'
                : 'Best eaten fresh, though leftovers keep for a day in the fridge.'}
            </Text>
          </View>

          {recipe.source ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open the original recipe on ${recipe.source.name}`}
              onPress={() => Linking.openURL(recipe.source!.url)}
              style={styles.credit}
            >
              <MaterialCommunityIcons name="heart-outline" size={13} color={colors.muted} />
              <Text style={[type.caption, { color: colors.muted, flex: 1 }]}>
                Recipe & photo from {recipe.source.name}
                {recipe.source.author ? ` · ${recipe.source.author}` : ''} · {recipe.source.license}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={planItem ? 'In your plan' : 'Add to my plan'}
          icon={planItem ? 'check' : 'plus'}
          variant={planItem ? 'secondary' : 'primary'}
          onPress={() => (planItem ? router.push('/shopping-list') : addToPlan(recipe, 'recipe-detail'))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { height: 410, backgroundColor: colors.surfaceMuted },
  heroOverlay: { flex: 1, paddingHorizontal: spacing.md },
  heroButtons: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.xs },
  content: {
    marginTop: -radius.xxl,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs },
  nutritionRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    backgroundColor: colors.lavenderSoft,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
  },
  nutritionItem: { flex: 1, alignItems: 'center' },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: { color: colors.ink },
  ingredientList: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  stepRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  credit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerNote: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.mintSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: 'rgba(255, 247, 250, 0.96)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
