import type { Recipe, RecipeIngredient } from '@/types';
import { formatQuantity } from '@/services/shopping/units';

export function scaleQuantity(quantity: number, baseServings: number, targetServings: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  if (baseServings <= 0 || targetServings <= 0) return 0;
  const scaled = (quantity * targetServings) / baseServings;
  return Math.round(scaled * 100) / 100;
}

export interface ScaledIngredient extends RecipeIngredient {
  scaledQuantity: number;
  scaledLabel: string;
}

export function scaledIngredients(recipe: Recipe, servings?: number): ScaledIngredient[] {
  const target = servings && servings > 0 ? servings : recipe.servings;
  return recipe.ingredients.map((ingredient) => {
    const scaledQuantity = scaleQuantity(ingredient.quantity, recipe.servings, target);
    return {
      ...ingredient,
      scaledQuantity,
      scaledLabel: formatQuantity(scaledQuantity, ingredient.unit),
    };
  });
}

export function clampServings(value: number, min = 1, max = 12): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
