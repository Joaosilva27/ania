import { RECIPE_BY_ID } from '@/data/recipes';
import { OBSTACLES, INTERESTS, STATEMENTS } from '@/data/taxonomy';
import { filterRecipesByDiet, hasUnclassifiedIngredients } from '@/services/dietary';
import type {
  BudgetTier,
  DietaryPattern,
  Recipe,
  RecipeFeedbackEntry,
  UserPreferences,
} from '@/types';

export const INITIAL_PLAN_SIZE = 3;
export const REJECTION_COOLDOWN_DAYS = 14;

/** Weights from the product spec; they sum to 100 before adjustments. */
export const WEIGHTS = {
  interests: 35,
  goal: 20,
  obstacles: 15,
  statements: 10,
  budget: 10,
} as const;

export interface ScoreBreakdown {
  interests: number;
  goal: number;
  obstacles: number;
  statements: number;
  budget: number;
  /** Learned adjustment from swipe history, -8…+8. */
  affinity: number;
  /** Practical penalties for time pressure / difficulty. */
  adjustments: number;
  total: number;
}

export interface ScoredRecipe {
  recipe: Recipe;
  score: number;
  breakdown: ScoreBreakdown;
  matchedTags: string[];
}

const INTEREST_BOOST_TAGS: Record<string, string[]> = INTERESTS.reduce((acc, interest) => {
  acc[interest.id] = interest.boostTags;
  return acc;
}, {} as Record<string, string[]>);

const GOAL_BOOST_TAGS: Record<string, string[]> = {
  'meal-prep': ['meal-prep', 'leftovers', 'batch'],
  'simple-recipes': ['simple', 'under-30', 'one-pan'],
  'eat-healthier': ['healthy', 'high-protein', 'veggie'],
  'spend-less': ['budget'],
  'more-variety': ['variety'],
};

const OBSTACLE_BOOST_TAGS: Record<string, string[]> = OBSTACLES.reduce((acc, obstacle) => {
  acc[obstacle.id] = obstacle.boostTags;
  return acc;
}, {} as Record<string, string[]>);

const BUDGET_POINTS: Record<BudgetTier, number> = {
  budget: 10,
  moderate: 6,
  higher: 2,
};

function matchesAny(recipeTags: string[], candidates: string[]): boolean {
  return candidates.some((tag) => recipeTags.includes(tag));
}

/**
 * Tags the user has implicitly asked for based on swipe history.
 * A recipes' tags gain +1 per acceptance and -1 per rejection.
 */
export function buildAffinity(
  feedback: Record<string, RecipeFeedbackEntry>,
  recipesById: Record<string, Recipe> = RECIPE_BY_ID,
): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const entry of Object.values(feedback)) {
    const recipe = recipesById[entry.recipeId];
    if (!recipe) continue;
    const delta = entry.status === 'accepted' ? 1 : -1;
    for (const tag of recipe.tags) {
      raw[tag] = (raw[tag] ?? 0) + delta;
    }
  }
  const values = Object.values(raw);
  const maxAbs = Math.max(1, ...values.map((value) => Math.abs(value)));
  const normalised: Record<string, number> = {};
  Object.keys(raw).forEach((tag) => {
    normalised[tag] = raw[tag] / maxAbs;
  });
  return normalised;
}

export interface ScoreOptions {
  affinity?: Record<string, number>;
}

/** Deterministic, explainable scoring. No randomness anywhere. */
export function scoreRecipe(
  recipe: Recipe,
  preferences: UserPreferences,
  options: ScoreOptions = {},
): ScoredRecipe {
  const tags = recipe.tags;
  const matchedTags: string[] = [];

  // ---- interests (35)
  let interests = 0;
  const interests_ = preferences.interests ?? [];
  if (interests_.length) {
    const matched = interests_.filter((interest) =>
      matchesAny(tags, INTEREST_BOOST_TAGS[interest] ?? [interest]),
    );
    matched.forEach((interest) => {
      const boost = INTEREST_BOOST_TAGS[interest];
      boost?.forEach((tag) => {
        if (tags.includes(tag) && !matchedTags.includes(tag)) matchedTags.push(tag);
      });
    });
    interests = (WEIGHTS.interests * matched.length) / interests_.length;
  }

  // ---- primary goal (20)
  let goal = 0;
  if (preferences.primaryGoal) {
    const boost = GOAL_BOOST_TAGS[preferences.primaryGoal] ?? [];
    if (matchesAny(tags, boost)) {
      goal = WEIGHTS.goal;
      boost.forEach((tag) => {
        if (tags.includes(tag) && !matchedTags.includes(tag)) matchedTags.push(tag);
      });
    }
  }

  // ---- obstacles (15)
  let obstacles = 0;
  const obstacleIds = preferences.obstacles ?? [];
  if (obstacleIds.length) {
    const matched = obstacleIds.filter((obstacle) =>
      matchesAny(tags, OBSTACLE_BOOST_TAGS[obstacle] ?? []),
    );
    obstacles = (WEIGHTS.obstacles * matched.length) / obstacleIds.length;
  }

  // ---- statements (10)
  let statements = 0;
  const responses = preferences.statements;
  if (responses) {
    const agreed = STATEMENTS.filter((statement) => responses[statement.key]);
    if (agreed.length) {
      const matched = agreed.filter((statement) => matchesAny(tags, statement.yesTags));
      statements = (WEIGHTS.statements * matched.length) / agreed.length;
    }
  }

  // ---- budget suitability (10)
  let budget = BUDGET_POINTS[recipe.budgetTier] ?? 0;
  if (recipe.budgetTier === 'budget' && preferences.primaryGoal === 'spend-less') {
    budget = WEIGHTS.budget;
  }
  budget = Math.min(WEIGHTS.budget, budget);

  // ---- learned affinity (-8…+8)
  let affinity = 0;
  if (options.affinity) {
    const sum = tags.reduce((acc, tag) => acc + (options.affinity?.[tag] ?? 0), 0);
    affinity = Math.max(-8, Math.min(8, sum * 2));
  }

  // ---- practical adjustments
  let adjustments = 0;
  if (obstacleIds.includes('lack-of-time') && recipe.totalTimeMinutes > 40) adjustments -= 10;
  if (obstacleIds.includes('too-tired') && !matchesAny(tags, ['one-pan', 'low-effort', 'simple'])) {
    adjustments -= 6;
  }
  if (obstacleIds.includes('cooking-difficult')) {
    if (recipe.difficulty === 'hard') adjustments -= 12;
    if (recipe.difficulty === 'medium') adjustments -= 4;
  }
  if (preferences.primaryGoal === 'meal-prep' && !recipe.mealPrepSuitable) adjustments -= 6;

  const raw =
    interests + goal + obstacles + statements + budget + affinity + adjustments;
  const total = Math.max(0, Math.min(100, raw));

  return {
    recipe,
    score: Math.round(total * 100) / 100,
    matchedTags: Array.from(new Set(matchedTags)).slice(0, 3),
    breakdown: {
      interests: Math.round(interests * 10) / 10,
      goal: Math.round(goal * 10) / 10,
      obstacles: Math.round(obstacles * 10) / 10,
      statements: Math.round(statements * 10) / 10,
      budget: Math.round(budget * 10) / 10,
      affinity: Math.round(affinity * 10) / 10,
      adjustments: Math.round(adjustments * 10) / 10,
      total: Math.round(total * 100) / 100,
    },
  };
}

export interface RankOptions extends ScoreOptions {
  /** Hard filters applied before scoring. */
  diet?: DietaryPattern;
  excludeRecipeIds?: string[];
}

export function rankRecipes(
  recipes: Recipe[],
  preferences: UserPreferences,
  options: RankOptions = {},
): ScoredRecipe[] {
  const excluded = new Set(options.excludeRecipeIds ?? []);
  const diet = options.diet ?? preferences.dietaryPattern ?? 'none';

  const eligible = filterRecipesByDiet(recipes, diet).filter(
    (recipe) =>
      !excluded.has(recipe.id) &&
      recipe.ingredients.length > 0 &&
      recipe.instructions.length > 0 &&
      !hasUnclassifiedIngredients(recipe.ingredients),
  );

  return eligible
    .map((recipe) => scoreRecipe(recipe, preferences, { affinity: options.affinity }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.recipe.id.localeCompare(b.recipe.id);
    });
}

/**
 * Greedy diversity pass: each pick penalises recipes that share the previous
 * pick's protein, cuisine or cooking method so a list never reads like five
 * variations of the same dinner.
 */
export function diversifyRecommendations(scored: ScoredRecipe[], limit: number): ScoredRecipe[] {
  const pool = [...scored];
  const picked: ScoredRecipe[] = [];

  while (picked.length < limit && pool.length) {
    let bestIndex = 0;
    let bestValue = -Infinity;

    for (let index = 0; index < pool.length; index += 1) {
      const candidate = pool[index];
      let penalty = 0;
      for (const chosen of picked) {
        if (candidate.recipe.primaryIngredient === chosen.recipe.primaryIngredient) penalty += 8;
        if (candidate.recipe.cuisine === chosen.recipe.cuisine) penalty -= 0;
        if (candidate.recipe.cookingMethod === chosen.recipe.cookingMethod) penalty += 5;
      }
      // Larger penalty for immediate repeats.
      const last = picked[picked.length - 1];
      if (last) {
        if (candidate.recipe.cuisine === last.recipe.cuisine) penalty += 6;
        if (candidate.recipe.primaryIngredient === last.recipe.primaryIngredient) penalty += 6;
      }
      const value = candidate.score - penalty;
      if (value > bestValue) {
        bestValue = value;
        bestIndex = index;
      }
    }

    picked.push(pool.splice(bestIndex, 1)[0]);
  }

  return picked;
}

export interface RecommendationContext {
  preferences: UserPreferences;
  /** Recipes currently in the plan — never suggested as new. */
  planRecipeIds: string[];
  feedback: Record<string, RecipeFeedbackEntry>;
  favorites?: Record<string, string>;
  limit?: number;
  /** Injectable for tests. */
  recipes?: Recipe[];
  now?: number;
  /** When true, include recipes already in the plan (used for "plan" views). */
  includePlanRecipes?: boolean;
}

export function isRecentlyRejected(
  entry: RecipeFeedbackEntry | undefined,
  now: number,
): boolean {
  if (!entry || entry.status !== 'rejected') return false;
  const then = new Date(entry.at).getTime();
  if (Number.isNaN(then)) return false;
  const days = (now - then) / (1000 * 60 * 60 * 24);
  return days < REJECTION_COOLDOWN_DAYS;
}

/**
 * The main entry point used by onboarding, home and discover.
 */
export function getRecommendedRecipes(context: RecommendationContext): ScoredRecipe[] {
  const {
    preferences,
    planRecipeIds,
    feedback,
    limit = 20,
    recipes,
    now = Date.now(),
  } = context;

  const catalogue = recipes ?? Object.values(RECIPE_BY_ID);
  const affinity = buildAffinity(feedback);
  const excluded = new Set<string>(context.includePlanRecipes ? [] : planRecipeIds);

  Object.values(feedback).forEach((entry) => {
    if (entry.status === 'accepted') excluded.add(entry.recipeId);
    if (isRecentlyRejected(entry, now)) excluded.add(entry.recipeId);
  });

  const ranked = rankRecipes(catalogue, preferences, {
    affinity,
    excludeRecipeIds: Array.from(excluded),
  });

  return diversifyRecommendations(ranked, limit);
}

export function recordRecipeFeedback(
  feedback: Record<string, RecipeFeedbackEntry>,
  recipeId: string,
  status: 'accepted' | 'rejected',
  context: string,
  at: string = new Date().toISOString(),
): Record<string, RecipeFeedbackEntry> {
  return {
    ...feedback,
    [recipeId]: { recipeId, status, at, context },
  };
}

/** Human-readable explanation chips for a recommendation. */
export function explainMatch(scored: ScoredRecipe): string[] {
  return scored.matchedTags;
}
