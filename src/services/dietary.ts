import { INGREDIENT_MAP } from '@/data/ingredients';
import type {
  DietaryPattern,
  Recipe,
  RecipeIngredient,
  RecipeInstruction,
} from '@/types';

/**
 * Dietary classification derived from structured ingredient origins.
 *
 * This is deliberately the single source of truth for whether a recipe may be
 * shown to a vegetarian/vegan/pescatarian user: a title like "veggie bowl" can
 * never sneak meat past the filter.
 */
export function classifyIngredients(ingredients: RecipeIngredient[]): DietaryPattern[] {
  let hasMeat = false;
  let hasFish = false;
  let hasAnimalProduce = false;

  for (const ingredient of ingredients) {
    if (ingredient.optional) {
      // Optional ingredients still count: a recipe offered to a vegan should
      // not require them to skip a component.
    }
    const definition = INGREDIENT_MAP[ingredient.ingredientId];
    if (!definition) continue; // unknown ingredient: treated as unclassified below
    switch (definition.origin) {
      case 'meat':
        hasMeat = true;
        break;
      case 'fish':
        hasFish = true;
        break;
      case 'dairy':
      case 'egg':
      case 'honey':
        hasAnimalProduce = true;
        break;
      default:
        break;
    }
  }

  if (hasMeat) return ['carnivore'];
  if (hasFish) return ['pescatarian', 'carnivore'];
  if (hasAnimalProduce) return ['vegetarian', 'pescatarian', 'carnivore'];
  return ['vegan', 'vegetarian', 'pescatarian', 'carnivore'];
}

/**
 * Recipes with any ingredient missing from the registry are considered
 * unclassified and are excluded from restricted diets until reviewed.
 */
export function hasUnclassifiedIngredients(ingredients: RecipeIngredient[]): boolean {
  return ingredients.some((ingredient) => !INGREDIENT_MAP[ingredient.ingredientId]);
}

export function isRecipeAllowedForDiet(recipe: Recipe, diet: DietaryPattern): boolean {
  if (diet === 'none' || diet === 'carnivore') return true;
  if (hasUnclassifiedIngredients(recipe.ingredients)) return false;
  return recipe.dietaryClassification.includes(diet);
}

export function filterRecipesByDiet(recipes: Recipe[], diet: DietaryPattern): Recipe[] {
  return recipes.filter((recipe) => isRecipeAllowedForDiet(recipe, diet));
}

/** Recipes already in the plan that break a newly chosen restriction. */
export function findDietConflicts(recipes: Recipe[], diet: DietaryPattern): Recipe[] {
  return recipes.filter((recipe) => !isRecipeAllowedForDiet(recipe, diet));
}

export function dietConfidenceNote(diet: DietaryPattern): string {
  switch (diet) {
    case 'vegan':
      return 'We only show recipes whose ingredients contain no animal products.';
    case 'vegetarian':
      return 'Recipes containing meat or fish are always filtered out.';
    case 'pescatarian':
      return 'Fish is allowed; other meat is filtered out.';
    case 'carnivore':
      return 'Treated as a meat-inclusive preference, not a medical diet.';
    default:
      return 'Every recipe in the catalogue is available to you.';
  }
}
