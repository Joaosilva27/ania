/**
 * Domain types for the recipe catalogue.
 *
 * Everything in this file is intentionally serialisable: the same shapes are
 * used by the bundled seed catalogue, the Firestore `recipes` collection and
 * the pure-logic test-suite.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

/** The user's primary dietary pattern. */
export type DietaryPattern = 'none' | 'vegetarian' | 'vegan' | 'pescatarian' | 'carnivore';

/**
 * Where an ingredient comes from. This is the structured signal the dietary
 * filter uses — never the recipe title.
 */
export type AnimalOrigin = 'none' | 'meat' | 'fish' | 'dairy' | 'egg' | 'honey';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type ShoppingCategory =
  | 'meat-fish'
  | 'fruit-veg'
  | 'dairy-eggs'
  | 'spices-herbs'
  | 'baking'
  | 'sauces-condiments'
  | 'storecupboard'
  | 'world-foods'
  | 'bread-bakery'
  | 'frozen'
  | 'other';

/** Coarse family used for the fallback layer of the ingredient icon system. */
export type IngredientFamily =
  | 'meat'
  | 'fish'
  | 'dairy'
  | 'egg'
  | 'vegetable'
  | 'fruit'
  | 'grain'
  | 'spice'
  | 'sauce'
  | 'pantry'
  | 'bakery'
  | 'frozen'
  | 'other';

/** Units the shopping-list engine understands. */
export type Unit =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'tsp'
  | 'tbsp'
  | 'cup'
  | 'unit'
  | 'piece'
  | 'clove'
  | 'slice'
  | 'head'
  | 'bunch'
  | 'sprig'
  | 'handful'
  | 'pinch'
  | 'can';

/** Qualitative, human-reviewed affordability signal (no invented prices). */
export type BudgetTier = 'budget' | 'moderate' | 'higher';

export interface IngredientDefinition {
  /** Stable canonical id used for aggregation. */
  id: string;
  /** Canonical display name. */
  name: string;
  category: ShoppingCategory;
  family: IngredientFamily;
  /** Specific icon override (MaterialCommunityIcons glyph name). */
  icon?: string;
  origin: AnimalOrigin;
  /** Salt, oil, pepper… things most kitchens already own. */
  pantryStaple: boolean;
  /** Alternative names that map onto this canonical ingredient. */
  aliases: string[];
  allergens: string[];
}

export interface RecipeIngredient {
  ingredientId: string;
  /** Optional per-recipe label, e.g. "Chicken thighs, boneless". */
  displayName?: string;
  quantity: number;
  unit: Unit;
  preparation?: string;
  optional?: boolean;
}

export interface RecipeInstruction {
  step: number;
  text: string;
  durationMinutes?: number;
}

export interface RecipeNutrition {
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  /** Always true in Phase 1 — values are editorial estimates, not lab data. */
  isEstimate: true;
}

/** Where a bundled recipe came from — shown as a credit on the recipe page. */
export interface RecipeSource {
  name: string;
  url: string;
  license: string;
  author?: string;
}

export interface Recipe {
  id: string;
  slug: string;
  title: string;
  description: string;

  imageUrl: string;
  galleryImages: string[];
  /** Key into the bundled image registry (offline/cached asset). */
  imageKey: string;

  preparationTimeMinutes: number;
  cookingTimeMinutes: number;
  totalTimeMinutes: number;

  difficulty: Difficulty;

  servings: number;

  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];

  /** Interest ids plus descriptor tags used by the recommendation engine. */
  tags: string[];

  /** Derived from structured ingredient origins, never from the title. */
  dietaryClassification: DietaryPattern[];

  mealTypes: MealType[];

  mealPrepSuitable: boolean;

  nutrition?: RecipeNutrition;

  budgetTier: BudgetTier;
  currency?: string;

  /** Diversity axes used to avoid near-duplicate recommendations. */
  cuisine: string;
  primaryIngredient: string;
  cookingMethod: string;

  createdAt: string;
  updatedAt: string;

  /** Present on imported recipes; absent on anything written by hand. */
  source?: RecipeSource;
}

/* ------------------------------------------------------------------ */
/* Taxonomy                                                           */
/* ------------------------------------------------------------------ */

export type GoalId =
  | 'meal-prep'
  | 'simple-recipes'
  | 'eat-healthier'
  | 'spend-less'
  | 'more-variety';

export type ObstacleId =
  | 'lack-of-time'
  | 'too-tired'
  | 'cooking-difficult'
  | 'lack-inspiration'
  | 'cant-find-recipes';

export type InterestId =
  | 'packed-lunches'
  | 'high-protein'
  | 'veggie'
  | 'family-friendly'
  | 'quick-healthy-dinner'
  | 'healthy-breakfasts'
  | 'comfort';

export type StatementKey =
  | 'budget_concern'
  | 'recipe_search_frustration'
  | 'processed_food_concern'
  | 'last_minute_shopping'
  | 'healthy_weekly_meals';

export type StatementResponses = Record<StatementKey, boolean>;
