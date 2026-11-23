import { RECIPE_BY_ID, RECIPE_CATALOGUE } from '@/data/recipes';
import { INGREDIENT_MAP } from '@/data/ingredients';
import { buildShoppingList, countPlanIngredients } from '@/services/shopping/aggregate';
import type { MealPlan, Recipe, UserPreferences } from '@/types';

export const EMPTY_PREFERENCES: UserPreferences = {
  primaryGoal: null,
  obstacles: [],
  interests: [],
  dietaryPattern: 'none',
  statements: null,
  updatedAt: new Date(0).toISOString(),
};

export function createEmptyPlan(): MealPlan {
  return { items: [], version: 0, updatedAt: new Date(0).toISOString() };
}

export function planRecipeIds(plan: MealPlan): string[] {
  return plan.items.map((item) => item.recipeId);
}

export function isInPlan(plan: MealPlan, recipeId: string): boolean {
  return plan.items.some((item) => item.recipeId === recipeId);
}

export function planRecipes(plan: MealPlan): Recipe[] {
  return plan.items
    .map((item) => RECIPE_BY_ID[item.recipeId])
    .filter((recipe): recipe is Recipe => Boolean(recipe));
}

/** Used by home, plan and shopping screens so every count is real. */
export function planSummary(plan: MealPlan, checked?: Record<string, boolean>) {
  const list = buildShoppingList({ plan, checked });
  return {
    recipeCount: plan.items.length,
    ingredientCount: countPlanIngredients(plan),
    checkedCount: list.checkedCount,
    totalShoppingItems: list.totalCount,
    estimatedServings: plan.items.reduce((acc, item) => acc + (item.servings || 0), 0),
  };
}

/**
 * Data-integrity check used by tests and by the seed script: every recipe must
 * be complete enough to actually cook and to aggregate.
 */
export function validateCatalogue(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const recipe of RECIPE_CATALOGUE) {
    if (seen.has(recipe.id)) problems.push(`Duplicate recipe id: ${recipe.id}`);
    seen.add(recipe.id);

    if (!recipe.title.trim()) problems.push(`${recipe.id}: missing title`);
    if (!recipe.description.trim()) problems.push(`${recipe.id}: missing description`);
    if (recipe.servings < 1) problems.push(`${recipe.id}: invalid servings`);
    if (recipe.ingredients.length < 4) problems.push(`${recipe.id}: too few ingredients`);
    if (recipe.instructions.length < 4) problems.push(`${recipe.id}: too few instructions`);
    if (recipe.totalTimeMinutes <= 0) problems.push(`${recipe.id}: invalid total time`);
    if (recipe.tags.length === 0) problems.push(`${recipe.id}: no tags`);
    if (recipe.mealTypes.length === 0) problems.push(`${recipe.id}: no meal types`);

    for (const ingredient of recipe.ingredients) {
      if (!INGREDIENT_MAP[ingredient.ingredientId]) {
        problems.push(`${recipe.id}: unknown ingredient "${ingredient.ingredientId}"`);
      }
      if (!Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) {
        problems.push(`${recipe.id}: invalid quantity for "${ingredient.ingredientId}"`);
      }
    }
  }

  return problems;
}
