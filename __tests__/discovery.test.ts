import { RECIPE_BY_ID } from '@/data/recipes';
import type { Recipe, RecipeFeedbackEntry, UserPreferences } from '@/types';
import {
  DISCOVERY_FILTERS,
  getDiscoveryQueue,
  passesFilters,
} from '@/services/discovery';
import { getRecommendedRecipes } from '@/services/recommendations';

const catalogue = Object.values(RECIPE_BY_ID);

const preferences: UserPreferences = {
  primaryGoal: 'meal-prep',
  interests: ['high-protein', 'quick-healthy-dinner'],
  obstacles: ['lack-of-time'],
  dietaryPattern: 'none',
  statements: {
    budget_concern: false,
    recipe_search_frustration: true,
    processed_food_concern: false,
    last_minute_shopping: false,
    healthy_weekly_meals: true,
  },
} as UserPreferences;

const context = {
  preferences,
  planRecipeIds: [],
  feedback: {} as Record<string, RecipeFeedbackEntry>,
  limit: 40,
  recipes: catalogue,
};

describe('discovery filters are real predicates', () => {
  it('only returns high-protein dishes when that chip is on', () => {
    const queue = getDiscoveryQueue({ ...context, filterIds: ['high-protein'] });
    expect(queue.length).toBeGreaterThan(10);
    expect(queue.every((recipe) => recipe.tags.includes('high-protein'))).toBe(true);
  });

  it('quick & healthy means quick, dinner and not heavy', () => {
    const queue = getDiscoveryQueue({ ...context, filterIds: ['quick-healthy-dinner'] });
    expect(queue.length).toBeGreaterThan(5);
    expect(queue.every((recipe) => recipe.totalTimeMinutes <= 30)).toBe(true);
    expect(queue.every((recipe) => recipe.mealTypes.includes('dinner'))).toBe(true);
    expect(
      queue.every(
        (recipe) =>
          recipe.tags.includes('healthy') ||
          recipe.tags.includes('veggie') ||
          recipe.tags.includes('high-protein'),
      ),
    ).toBe(true);
    // Nothing deep-fried counts, however fast it is.
    expect(queue.every((recipe) => recipe.cookingMethod !== 'deep-fry')).toBe(true);
    // Heavy comfort food does not count as "healthy" unless veg-led.
    expect(
      queue.every(
        (recipe) =>
          !recipe.tags.includes('comfort') ||
          recipe.tags.includes('veggie') ||
          recipe.tags.includes('healthy'),
      ),
    ).toBe(true);
  });

  it('stacking chips narrows the deck instead of widening it', () => {
    const highProtein = getDiscoveryQueue({ ...context, filterIds: ['high-protein'], limit: 500 });
    const stacked = getDiscoveryQueue({
      ...context,
      filterIds: ['high-protein', 'under-30'],
      limit: 500,
    });
    expect(stacked.length).toBeLessThan(highProtein.length);
    expect(stacked.every((recipe) => passesFilters(recipe, ['high-protein', 'under-30']))).toBe(true);
  });

  it('every advertised chip actually filters the catalogue', () => {
    for (const filter of DISCOVERY_FILTERS) {
      const matching = catalogue.filter((recipe: Recipe) => filter.test(recipe));
      expect(matching.length).toBeGreaterThan(0);
      expect(matching.length).toBeLessThan(catalogue.length);
    }
  });
});

describe('discover is exploration, not the recommendation list', () => {
  it('does not open with the dishes already on the home carousel', () => {
    const queue = getDiscoveryQueue({ ...context, limit: 40 });
    const recommended = getRecommendedRecipes({
      preferences,
      planRecipeIds: [],
      feedback: {},
      limit: 24,
      recipes: catalogue,
    }).map((entry) => entry.recipe.id);

    const opening = queue.slice(0, 10).map((recipe) => recipe.id);
    const overlap = opening.filter((id) => recommended.includes(id));
    expect(overlap.length).toBe(0);
  });

  it('spreads cuisines so consecutive cards are different food', () => {
    const queue = getDiscoveryQueue({ ...context, limit: 30 });
    const opening = queue.slice(0, 8).map((recipe) => recipe.cuisine);
    expect(new Set(opening).size).toBeGreaterThanOrEqual(4);
  });

  it('never repeats a recipe you added to the plan or rejected recently', () => {
    const planRecipeIds = [catalogue[0].id];
    const feedback: Record<string, RecipeFeedbackEntry> = {
      [catalogue[1].id]: {
        recipeId: catalogue[1].id,
        status: 'rejected',
        at: new Date().toISOString(),
        context: 'discover',
      },
    };
    const queue = getDiscoveryQueue({ ...context, planRecipeIds, feedback, limit: 60 });
    const ids = queue.map((recipe) => recipe.id);
    expect(ids).not.toContain(planRecipeIds[0]);
    expect(ids).not.toContain(catalogue[1].id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reshuffles between rounds without losing stability within a round', () => {
    const first = getDiscoveryQueue({ ...context, seed: 1, limit: 20 }).map((recipe) => recipe.id);
    const sameRound = getDiscoveryQueue({ ...context, seed: 1, limit: 20 }).map((recipe) => recipe.id);
    const nextRound = getDiscoveryQueue({ ...context, seed: 2, limit: 20 }).map((recipe) => recipe.id);
    expect(sameRound).toEqual(first);
    expect(nextRound).not.toEqual(first);
  });

  it('respects the dietary pattern', () => {
    const queue = getDiscoveryQueue({
      ...context,
      preferences: { ...preferences, dietaryPattern: 'vegan' },
      limit: 60,
    });
    expect(queue.length).toBeGreaterThan(0);
    expect(
      queue.every((recipe) => recipe.dietaryClassification.includes('vegan')),
    ).toBe(true);
  });
});
