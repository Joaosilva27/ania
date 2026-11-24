import { RECIPE_BY_ID } from '@/data/recipes';
import { filterRecipesByDiet, hasUnclassifiedIngredients } from '@/services/dietary';
import { getRecommendedRecipes, isRecentlyRejected } from '@/services/recommendations';
import type { InterestId, Recipe, RecipeFeedbackEntry, UserPreferences } from '@/types';

/* ------------------------------------------------------------------ */
/* Filters                                                            */
/* ------------------------------------------------------------------ */

/**
 * Filters are promises. Each one is a predicate that says exactly what it
 * means, so a chip either narrows the deck or visibly cannot (and the deck
 * then says "nothing matches") — never silently does nothing.
 */
export type DiscoveryFilterId =
  | InterestId
  | 'meal-prep'
  | 'budget'
  | 'one-pan'
  | 'under-30';

export interface DiscoveryFilter {
  id: DiscoveryFilterId;
  label: string;
  test: (recipe: Recipe) => boolean;
}

const has = (recipe: Recipe, tag: string): boolean => recipe.tags.includes(tag);

// Cheap comfort food is protein too, but it is not what "healthy" promises,
// so a rich dish only qualifies if it is vegetable-led.
const isQuickHealthyDinner = (recipe: Recipe): boolean =>
  recipe.totalTimeMinutes <= 30 &&
  recipe.mealTypes.includes('dinner') &&
  recipe.cookingMethod !== 'deep-fry' &&
  (has(recipe, 'healthy') || has(recipe, 'veggie') || (has(recipe, 'high-protein') && !has(recipe, 'comfort')));

export const INTEREST_FILTERS: Record<InterestId, (recipe: Recipe) => boolean> = {
  'packed-lunches': (recipe) => has(recipe, 'packed-lunches') || has(recipe, 'meal-prep'),
  'high-protein': (recipe) => has(recipe, 'high-protein'),
  veggie: (recipe) => has(recipe, 'veggie'),
  // "Family friendly" has to mean something checkable: feeds a table, not fussy.
  'family-friendly': (recipe) =>
    has(recipe, 'family-friendly') ||
    (recipe.servings >= 4 && (recipe.difficulty === 'easy' || recipe.difficulty === 'medium')),
  'quick-healthy-dinner': isQuickHealthyDinner,
  'healthy-breakfasts': (recipe) => recipe.mealTypes.includes('breakfast'),
  comfort: (recipe) => has(recipe, 'comfort'),
};

export const DISCOVERY_FILTERS: DiscoveryFilter[] = [
  { id: 'high-protein', label: 'High protein', test: INTEREST_FILTERS['high-protein'] },
  { id: 'quick-healthy-dinner', label: 'Quick & healthy', test: isQuickHealthyDinner },
  { id: 'meal-prep', label: 'Meal prep', test: (recipe) => has(recipe, 'meal-prep') },
  { id: 'veggie', label: 'Veggie', test: INTEREST_FILTERS.veggie },
  { id: 'budget', label: 'Budget', test: (recipe) => recipe.budgetTier === 'budget' },
  { id: 'one-pan', label: 'One pan', test: (recipe) => has(recipe, 'one-pan') },
  { id: 'under-30', label: 'Under 30 min', test: (recipe) => recipe.totalTimeMinutes <= 30 },
];

export function discoveryFilterById(id: string): DiscoveryFilter | undefined {
  return DISCOVERY_FILTERS.find((filter) => filter.id === id);
}

/** Every active chip must pass — chips narrow, they do not widen. */
export function passesFilters(recipe: Recipe, filterIds: string[]): boolean {
  return filterIds.every((id) => {
    const filter = discoveryFilterById(id);
    return filter ? filter.test(recipe) : true;
  });
}

/* ------------------------------------------------------------------ */
/* Exploration queue                                                  */
/* ------------------------------------------------------------------ */

/** Small deterministic PRNG so "Refresh" can reshuffle reproducibly. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWith<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export interface DiscoveryContext {
  preferences: UserPreferences;
  planRecipeIds: string[];
  feedback: Record<string, RecipeFeedbackEntry>;
  /** Active chip ids; empty means "everything". */
  filterIds?: string[];
  limit?: number;
  /** Bumped by "Refresh" to reshuffle without changing the catalogue. */
  seed?: number;
  /** Injectable for tests. */
  recipes?: Recipe[];
  now?: number;
}

/**
 * Discover is for finding things you have not been shown yet, so it does not
 * reuse the recommendation ranking. It walks the catalogue by cuisine in
 * round-robin order (so consecutive cards are genuinely different food),
 * prefers dishes the recommender did *not* put on your home carousel, and only
 * falls back to those once the fresh pool is exhausted.
 */
/** Everything Discover is allowed to show for this person and these chips. */
export function eligibleDiscoveryRecipes(context: DiscoveryContext): Recipe[] {
  const {
    preferences,
    planRecipeIds,
    feedback,
    filterIds = [],
    recipes,
    now = Date.now(),
  } = context;

  const catalogue = recipes ?? Object.values(RECIPE_BY_ID);
  const diet = preferences.dietaryPattern ?? 'none';

  const excluded = new Set<string>(planRecipeIds);
  Object.values(feedback).forEach((entry) => {
    if (entry.status === 'accepted') excluded.add(entry.recipeId);
    if (isRecentlyRejected(entry, now)) excluded.add(entry.recipeId);
  });

  return filterRecipesByDiet(catalogue, diet).filter(
    (recipe) =>
      !excluded.has(recipe.id) &&
      recipe.ingredients.length > 0 &&
      recipe.instructions.length > 0 &&
      !hasUnclassifiedIngredients(recipe.ingredients) &&
      passesFilters(recipe, filterIds),
  );
}

/** Real number of dishes behind the current chips, not the queue's page size. */
export function countDiscoveryMatches(context: DiscoveryContext): number {
  return eligibleDiscoveryRecipes(context).length;
}

export function getDiscoveryQueue(context: DiscoveryContext): Recipe[] {
  const {
    preferences,
    planRecipeIds,
    feedback,
    filterIds = [],
    limit = 60,
    seed = 0,
    recipes,
    now = Date.now(),
  } = context;

  const eligible = eligibleDiscoveryRecipes({ ...context, recipes, now });
  const catalogue = recipes ?? Object.values(RECIPE_BY_ID);

  // What the home screen already offers — kept for later, not for the first
  // swipes, so Discover does not just replay "Recommendations for you".
  const recommended = new Set(
    getRecommendedRecipes({
      preferences,
      planRecipeIds,
      feedback,
      limit: 24,
      recipes: catalogue,
      now,
    }).map((entry) => entry.recipe.id),
  );

  const random = mulberry32(1000 + seed * 7919);
  const fresh = eligible.filter((recipe) => !recommended.has(recipe.id));
  const seen = eligible.filter((recipe) => recommended.has(recipe.id));

  const freshIds = new Set(fresh.map((recipe) => recipe.id));
  const planProteins = new Set(
    planRecipeIds
      .map((id) => RECIPE_BY_ID[id]?.primaryIngredient)
      .filter((value): value is string => Boolean(value)),
  );

  // Cuisine round-robin: shuffle the buckets, then take one dish per cuisine
  // before coming back to any cuisine a second time.
  const buckets = new Map<string, Recipe[]>();
  for (const recipe of fresh) {
    const key = recipe.cuisine || 'World';
    const bucket = buckets.get(key);
    if (bucket) bucket.push(recipe);
    else buckets.set(key, [recipe]);
  }

  const bucketOrder = shuffleWith([...buckets.keys()], random);
  bucketOrder.forEach((key) => {
    const bucket = buckets.get(key) ?? [];
    const rotated = shuffleWith(bucket, random);
    // Recipes whose main protein already fills the plan go to the back of
    // their own bucket, still reachable but not in your face.
    rotated.sort((a, b) => {
      const aPlan = planProteins.has(a.primaryIngredient) ? 1 : 0;
      const bPlan = planProteins.has(b.primaryIngredient) ? 1 : 0;
      return aPlan - bPlan;
    });
    buckets.set(key, rotated);
  });

  const queue: Recipe[] = [];
  let added = true;
  while (added && queue.length < limit) {
    added = false;
    for (const key of bucketOrder) {
      const bucket = buckets.get(key);
      if (!bucket?.length) continue;
      const pick = bucket.shift();
      if (pick) {
        queue.push(pick);
        added = true;
        if (queue.length >= limit) break;
      }
    }
  }

  if (queue.length < limit) {
    const rest = shuffleWith(
      seen.filter((recipe) => freshIds.has(recipe.id) === false),
      random,
    );
    for (const recipe of rest) {
      if (queue.length >= limit) break;
      queue.push(recipe);
    }
  }

  return queue;
}
