import { classifyIngredients } from '@/services/dietary';
import type {
  BudgetTier,
  Difficulty,
  MealType,
  Recipe,
  RecipeIngredient,
  RecipeInstruction,
  RecipeNutrition,
  Unit,
} from '@/types';

/** Compact ingredient constructor keeps the seed catalogue readable. */
export function ing(
  ingredientId: string,
  quantity: number,
  unit: Unit,
  preparation?: string,
  optional = false,
): RecipeIngredient {
  const ingredient: RecipeIngredient = { ingredientId, quantity, unit };
  if (preparation) ingredient.preparation = preparation;
  if (optional) ingredient.optional = true;
  return ingredient;
}

/** Turn plain sentences into numbered instruction objects. */
export function steps(texts: string[]): RecipeInstruction[] {
  return texts.map((text, index) => ({ step: index + 1, text }));
}

export const CATALOGUE_TIMESTAMP = '2026-01-12T09:00:00.000Z';

export interface RecipeSeed
  extends Omit<
    Recipe,
    | 'totalTimeMinutes'
    | 'dietaryClassification'
    | 'slug'
    | 'createdAt'
    | 'updatedAt'
    | 'imageUrl'
    | 'galleryImages'
    | 'imageKey'
  > {
  slug?: string;
  imageKey?: string;
  /** Remote URL once assets are hosted on Firebase Storage; empty = bundled asset only. */
  imageUrl?: string;
  galleryImages?: string[];
  dietaryClassification?: Recipe['dietaryClassification'];
}

/**
 * Fills in derived fields so the seed data cannot drift: total time is always
 * prep + cook, and dietary classification always comes from the ingredients.
 */
export function defineRecipe(seed: RecipeSeed): Recipe {
  const slug = seed.slug ?? seed.id;
  const classification = classifyIngredients(seed.ingredients);
  return {
    ...seed,
    slug,
    imageKey: seed.imageKey ?? seed.id,
    imageUrl: seed.imageUrl ?? '',
    galleryImages: seed.galleryImages ?? [],
    totalTimeMinutes: seed.preparationTimeMinutes + seed.cookingTimeMinutes,
    dietaryClassification: seed.dietaryClassification ?? classification,
    createdAt: CATALOGUE_TIMESTAMP,
    updatedAt: CATALOGUE_TIMESTAMP,
  };
}

export type { BudgetTier, Difficulty, MealType, RecipeNutrition };
