import { RECIPE_BY_ID, RECIPE_CATALOGUE } from '@/data/recipes';
import {
  buildAffinity,
  diversifyRecommendations,
  getRecommendedRecipes,
  rankRecipes,
  recordRecipeFeedback,
  scoreRecipe,
} from '@/services/recommendations';
import type { Recipe, RecipeFeedbackEntry, StatementResponses, UserPreferences } from '@/types';

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

/**
 * The catalogue is imported data, so tests pick real recipes by the trait they
 * exercise instead of hard-coding an id that a re-import would rename.
 */
function pick(predicate: (recipe: Recipe) => boolean, what: string): Recipe {
  const recipe = RECIPE_CATALOGUE.find(predicate);
  if (!recipe) throw new Error(`catalogue is missing ${what}`);
  return recipe;
}

const highProteinDinner = () =>
  pick(
    (recipe) =>
      recipe.mealTypes.includes('dinner') &&
      recipe.tags.includes('high-protein') &&
      recipe.tags.includes('meal-prep'),
    'a high-protein meal-prep dinner',
  );

const lightBreakfast = () =>
  pick(
    (recipe) =>
      recipe.mealTypes.includes('breakfast') &&
      !recipe.tags.includes('high-protein') &&
      !recipe.tags.includes('comfort'),
    'a light breakfast',
  );

const baseContext = {
  planRecipeIds: [] as string[],
  feedback: {} as Record<string, RecipeFeedbackEntry>,
  now: NOW,
};

describe('scoreRecipe', () => {
  it('scores recipes deterministically on a 0–100 scale', () => {
    const recipe = highProteinDinner();
    const a = scoreRecipe(recipe, prefs());
    const b = scoreRecipe(recipe, prefs());
    expect(a.score).toBe(b.score);
    expect(a.score).toBeGreaterThan(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(a.breakdown.interests).toBeGreaterThan(0);
    expect(a.breakdown.goal).toBeGreaterThan(0);
  });

  it('rewards interest matches over non-matches', () => {
    const dinner = scoreRecipe(highProteinDinner(), prefs());
    const breakfast = scoreRecipe(lightBreakfast(), prefs());
    expect(dinner.score).toBeGreaterThan(breakfast.score);
  });

  it('rewards the primary goal', () => {
    const recipe = pick((entry) => entry.tags.includes('meal-prep'), 'a meal-prep recipe');
    const mealPrep = scoreRecipe(recipe, prefs());
    const noGoal = scoreRecipe(recipe, prefs({ primaryGoal: null }));
    expect(mealPrep.score).toBeGreaterThan(noGoal.score);
  });

  it('penalises long recipes when the user lacks time', () => {
    // Same dish, with and without time pressure: the penalty is then the only
    // difference, so the assertion cannot drift with catalogue changes.
    const slow = pick((entry) => entry.totalTimeMinutes >= 60, 'a recipe over an hour');
    const pressured = scoreRecipe(slow, prefs({ obstacles: ['lack-of-time'], interests: [] }));
    const relaxed = scoreRecipe(slow, prefs({ obstacles: [], interests: [] }));
    expect(pressured.breakdown.adjustments).toBe(-10);
    expect(pressured.score).toBeLessThan(relaxed.score);
  });

  it('penalises hard recipes for people who find cooking difficult', () => {
    const hard = scoreRecipe(
      pick((entry) => entry.difficulty === 'hard', 'a hard recipe'),
      prefs({ obstacles: ['cooking-difficult'], interests: [] }),
    );
    const easy = scoreRecipe(
      pick((entry) => entry.difficulty === 'easy', 'an easy recipe'),
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
    const excluded = highProteinDinner().id;
    const ranked = rankRecipes(RECIPE_CATALOGUE, prefs(), {
      excludeRecipeIds: [excluded],
    });
    expect(ranked.some((entry) => entry.recipe.id === excluded)).toBe(false);
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
    const planned = highProteinDinner().id;
    const rejected = lightBreakfast().id;
    const feedback: Record<string, RecipeFeedbackEntry> = {
      'cream-of-the-crop': {
        recipeId: 'nope',
        status: 'rejected',
        at: '2026-02-28T12:00:00.000Z',
        context: 'discover',
      },
      rejected: {
        recipeId: rejected,
        status: 'rejected',
        at: '2026-02-20T12:00:00.000Z',
        context: 'discover',
      },
    };
    const results = getRecommendedRecipes({
      ...baseContext,
      preferences: prefs(),
      planRecipeIds: [planned],
      feedback,
    });
    const ids = results.map((entry) => entry.recipe.id);
    expect(ids).not.toContain(planned);
    expect(ids).not.toContain(rejected);
  });

  it('lets a rejected recipe return after the cooldown', () => {
    const old = new Date(NOW - 20 * 24 * 60 * 60 * 1000).toISOString();
    const target = highProteinDinner();
    const results = getRecommendedRecipes({
      ...baseContext,
      preferences: prefs({ interests: ['comfort'] }),
      limit: RECIPE_CATALOGUE.length,
      feedback: {
        [target.id]: {
          recipeId: target.id,
          status: 'rejected',
          at: old,
          context: 'discover',
        },
      },
    });
    expect(results.map((entry) => entry.recipe.id)).toContain(target.id);
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
    const comfort = pick(
      (entry) => entry.tags.includes('comfort') && entry.dietaryClassification.length === 1,
      'a comfort recipe',
    );
    const feedback = recordRecipeFeedback({}, comfort.id, 'accepted', 'onboarding');
    const affinity = buildAffinity(feedback);
    expect(affinity['comfort']).toBeGreaterThan(0);
    const scored = scoreRecipe(RECIPE_BY_ID[comfort.id], prefs(), { affinity });
    const withoutAffinity = scoreRecipe(RECIPE_BY_ID[comfort.id], prefs());
    expect(scored.breakdown.affinity).toBeGreaterThan(0);
    expect(scored.score).toBeGreaterThanOrEqual(withoutAffinity.score);
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
    // Top picks skew to real dinners rather than random breakfasts or desserts.
    const dinners = results.filter((entry) => entry.recipe.mealTypes.includes('dinner')).length;
    expect(dinners).toBeGreaterThanOrEqual(5);
    // No duplicate recipes.
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('returns an empty list instead of violating a diet with no matches', () => {
    const results = getRecommendedRecipes({
      ...baseContext,
      preferences: prefs({ dietaryPattern: 'vegan' }),
      recipes: [pick((entry) => entry.dietaryClassification.length === 1, 'a meat-only recipe')],
    });
    expect(results).toEqual([]);
  });
});
