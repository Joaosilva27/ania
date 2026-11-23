import { RECIPE_CATALOGUE, RECIPE_BY_ID } from '@/data/recipes';
import {
  buildAffinity,
  diversifyRecommendations,
  getRecommendedRecipes,
  rankRecipes,
  recordRecipeFeedback,
  scoreRecipe,
} from '@/services/recommendations';
import type { RecipeFeedbackEntry, StatementResponses, UserPreferences } from '@/types';

const NOW = new Date('2026-03-01T12:00:00.000Z').getTime();

const allYes: StatementResponses = {
  budget_concern: true,
  recipe_search_frustration: true,
  processed_food_concern: true,
  last_minute_shopping: true,
  healthy_weekly_meals: true,
};

function prefs(overrides: Partial<UserPreferences> = {}): UserPreferences {
  return {
    primaryGoal: 'meal-prep',
    obstacles: ['lack-of-time', 'too-tired'],
    interests: ['high-protein', 'quick-healthy-dinner', 'comfort'],
    dietaryPattern: 'none',
    statements: allYes,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const baseContext = {
  planRecipeIds: [] as string[],
  feedback: {} as Record<string, RecipeFeedbackEntry>,
  now: NOW,
};

describe('scoreRecipe', () => {
  it('scores recipes deterministically on a 0–100 scale', () => {
    const recipe = RECIPE_BY_ID['honey-garlic-chicken-broccoli-rice'];
    const a = scoreRecipe(recipe, prefs());
    const b = scoreRecipe(recipe, prefs());
    expect(a.score).toBe(b.score);
    expect(a.score).toBeGreaterThan(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.breakdown.interests).toBeGreaterThan(0);
    expect(a.breakdown.goal).toBeGreaterThan(0);
  });

  it('rewards interest matches over non-matches', () => {
    const chicken = scoreRecipe(RECIPE_BY_ID['honey-garlic-chicken-broccoli-rice'], prefs());
    const oats = scoreRecipe(RECIPE_BY_ID['healthy-overnight-oats'], prefs());
    expect(chicken.score).toBeGreaterThan(oats.score);
  });

  it('rewards the primary goal', () => {
    const mealPrep = scoreRecipe(RECIPE_BY_ID['tuna-pasta-bake'], prefs());
    const noGoal = scoreRecipe(RECIPE_BY_ID['tuna-pasta-bake'], prefs({ primaryGoal: null }));
    expect(mealPrep.score).toBeGreaterThan(noGoal.score);
  });

  it('penalises long recipes when the user lacks time', () => {
    const quick = scoreRecipe(
      RECIPE_BY_ID['quick-beef-stir-fry'],
      prefs({ obstacles: ['lack-of-time'], interests: [] }),
    );
    const slow = scoreRecipe(
      RECIPE_BY_ID['cottage-pie'],
      prefs({ obstacles: ['lack-of-time'], interests: [] }),
    );
    expect(quick.score).toBeGreaterThan(slow.score);
  });

  it('penalises hard recipes for people who find cooking difficult', () => {
    const hard = scoreRecipe(
      RECIPE_BY_ID['cottage-pie'],
      prefs({ obstacles: ['cooking-difficult'], interests: [] }),
    );
    const easy = scoreRecipe(
      RECIPE_BY_ID['coconut-chickpea-curry'],
      prefs({ obstacles: ['cooking-difficult'], interests: [] }),
    );
    expect(hard.breakdown.adjustments).toBeLessThan(0);
    expect(easy.score).toBeGreaterThan(hard.score);
  });
});

describe('rankRecipes', () => {
  it('applies the dietary filter as a hard constraint', () => {
    const ranked = rankRecipes(RECIPE_CATALOGUE, prefs({ dietaryPattern: 'vegan' }));
    expect(ranked.length).toBeGreaterThan(0);
    for (const entry of ranked) {
      expect(entry.recipe.dietaryClassification).toContain('vegan');
    }
  });

  it('excludes recipes passed in the exclusion list', () => {
    const ranked = rankRecipes(RECIPE_CATALOGUE, prefs(), {
      excludeRecipeIds: ['honey-garlic-chicken-broccoli-rice'],
    });
    expect(ranked.some((entry) => entry.recipe.id === 'honey-garlic-chicken-broccoli-rice')).toBe(
      false,
    );
  });

  it('is stable across identical calls', () => {
    const first = rankRecipes(RECIPE_CATALOGUE, prefs()).map((entry) => entry.recipe.id);
    const second = rankRecipes(RECIPE_CATALOGUE, prefs()).map((entry) => entry.recipe.id);
    expect(first).toEqual(second);
  });
});

describe('diversifyRecommendations', () => {
  it('avoids returning only one protein', () => {
    const ranked = rankRecipes(RECIPE_CATALOGUE, prefs());
    const diversified = diversifyRecommendations(ranked, 6);
    const proteins = new Set(diversified.map((entry) => entry.recipe.primaryIngredient));
    expect(diversified).toHaveLength(6);
    expect(proteins.size).toBeGreaterThan(2);
  });
});

describe('getRecommendedRecipes', () => {
  it('respects diet, plan and rejections', () => {
    const feedback: Record<string, RecipeFeedbackEntry> = {
      'cream-of-the-crop': { recipeId: 'nope', status: 'rejected', at: '2026-02-28T12:00:00.000Z', context: 'discover' },
      'teriyaki-chicken-rice-bowls': {
        recipeId: 'teriyaki-chicken-rice-bowls',
        status: 'rejected',
        at: '2026-02-20T12:00:00.000Z',
        context: 'discover',
      },
    };
    const results = getRecommendedRecipes({
      ...baseContext,
      preferences: prefs(),
      planRecipeIds: ['honey-garlic-chicken-broccoli-rice'],
      feedback,
    });
    const ids = results.map((entry) => entry.recipe.id);
    expect(ids).not.toContain('honey-garlic-chicken-broccoli-rice');
    expect(ids).not.toContain('teriyaki-chicken-rice-bowls');
  });

  it('lets a rejected recipe return after the cooldown', () => {
    const old = new Date(NOW - 20 * 24 * 60 * 60 * 1000).toISOString();
    const results = getRecommendedRecipes({
      ...baseContext,
      preferences: prefs({ interests: ['comfort'] }),
      limit: 100,
      feedback: {
        'teriyaki-chicken-rice-bowls': {
          recipeId: 'teriyaki-chicken-rice-bowls',
          status: 'rejected',
          at: old,
          context: 'discover',
        },
      },
    });
    expect(results.map((entry) => entry.recipe.id)).toContain('teriyaki-chicken-rice-bowls');
  });

  it('never suggests a recipe that violates the chosen diet', () => {
    const results = getRecommendedRecipes({
      ...baseContext,
      preferences: prefs({ dietaryPattern: 'vegetarian' }),
    });
    expect(results.length).toBeGreaterThan(5);
    for (const entry of results) {
      expect(entry.recipe.dietaryClassification).toContain('vegetarian');
    }
  });

  it('learns from accepted and rejected swipes', () => {
    const feedback = recordRecipeFeedback(
      {},
      'beef-and-bean-chilli',
      'accepted',
      'onboarding',
    );
    const affinity = buildAffinity(feedback);
    expect(affinity['comfort']).toBeGreaterThan(0);
    const chilli = scoreRecipe(RECIPE_BY_ID['beef-and-bean-chilli'], prefs(), { affinity });
    const withoutAffinity = scoreRecipe(RECIPE_BY_ID['beef-and-bean-chilli'], prefs());
    expect(chilli.breakdown.affinity).toBeGreaterThan(0);
    expect(chilli.score).toBeGreaterThanOrEqual(withoutAffinity.score);
  });

  it('produces the spec scenario for a budget-conscious meal-prepper', () => {
    const scenario = prefs({
      primaryGoal: 'meal-prep',
      obstacles: ['lack-of-time', 'too-tired'],
      interests: ['high-protein', 'quick-healthy-dinner', 'comfort'],
      dietaryPattern: 'none',
    });
    const results = getRecommendedRecipes({
      ...baseContext,
      preferences: scenario,
      limit: 8,
    });
    const titles = results.map((entry) => entry.recipe.title);
    expect(results).toHaveLength(8);
    // Every top pick is a real dinner-ish recipe with protein, not a random breakfast.
    expect(titles).toContain('Honey Garlic Chicken with Broccoli Rice');
    expect(titles.some((title) => title.includes('Oats'))).toBe(false);
    // No duplicate recipes.
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('returns an empty list instead of violating a diet with no matches', () => {
    const results = getRecommendedRecipes({
      ...baseContext,
      preferences: prefs({ dietaryPattern: 'vegan' }),
      recipes: [RECIPE_BY_ID['creamy-butter-chicken']],
    });
    expect(results).toEqual([]);
  });
});
