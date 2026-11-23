import { INGREDIENT_MAP } from '@/data/ingredients';
import {
  RECIPE_BY_ID,
  SHOPPING_CATEGORY_LABELS,
  SHOPPING_CATEGORY_ORDER,
} from '@/data/recipes';
import type {
  IngredientFamily,
  ManualShoppingItem,
  MealPlan,
  Recipe,
  ShoppingCategory,
} from '@/types';
import { formatQuantity, mergeQuantities, type MergedQuantity } from './units';

export interface ShoppingListItem {
  /** Stable generated key. */
  id: string;
  ingredientId: string | null;
  name: string;
  category: ShoppingCategory;
  family: IngredientFamily;
  icon?: string;
  pantryStaple: boolean;
  quantities: MergedQuantity[];
  quantityLabel: string;
  /** Recipes that need it (provenance for the UI). */
  recipeIds: string[];
  recipeTitles: string[];
  optional: boolean;
  checked: boolean;
  manual: boolean;
}

export interface ShoppingListSection {
  category: ShoppingCategory;
  label: string;
  items: ShoppingListItem[];
}

export interface ShoppingList {
  sections: ShoppingListSection[];
  items: ShoppingListItem[];
  /** Every line the user can tick, generated + manual. */
  totalCount: number;
  checkedCount: number;
  generatedCount: number;
  recipeCount: number;
}

export interface BuildShoppingListInput {
  plan: MealPlan;
  /** Provide for tests/offline; defaults to the bundled catalogue. */
  recipesById?: Record<string, Recipe>;
  checked?: Record<string, boolean>;
  manualItems?: ManualShoppingItem[];
}

export function quantityLabel(quantities: MergedQuantity[]): string {
  if (!quantities.length) return '';
  return quantities.map((entry) => formatQuantity(entry.amount, entry.unit)).join(' + ');
}

/**
 * Build the combined grocery list straight from the meal plan.
 *
 * - ingredients are grouped by canonical id, so 200 g + 150 g rice = 350 g
 * - compatible units are converted; incompatible ones stay separate lines
 * - quantities are scaled by the servings the user chose for each recipe
 * - manual items are kept in a separate namespace
 */
export function buildShoppingList(input: BuildShoppingListInput): ShoppingList {
  const recipesById = input.recipesById ?? RECIPE_BY_ID;
  const checked = input.checked ?? {};
  const manualItems = input.manualItems ?? [];

  interface Bucket {
    ingredientId: string;
    quantities: Array<{ quantity: number; unit: import('@/types').Unit }>;
    recipeIds: string[];
    recipeTitles: string[];
    optionalFlags: boolean[];
  }

  const buckets = new Map<string, Bucket>();
  let recipeCount = 0;

  for (const planItem of input.plan.items) {
    const recipe = recipesById[planItem.recipeId];
    if (!recipe) continue;
    recipeCount += 1;
    const targetServings = planItem.servings > 0 ? planItem.servings : recipe.servings;
    const factor = targetServings / recipe.servings;

    for (const ingredient of recipe.ingredients) {
      const definition = INGREDIENT_MAP[ingredient.ingredientId];
      if (!definition) continue;
      const quantity = ingredient.quantity * factor;
      if (!Number.isFinite(quantity) || quantity <= 0) continue;

      const existing = buckets.get(ingredient.ingredientId) ?? {
        ingredientId: ingredient.ingredientId,
        quantities: [],
        recipeIds: [],
        recipeTitles: [],
        optionalFlags: [],
      };
      existing.quantities.push({ quantity, unit: ingredient.unit });
      if (!existing.recipeIds.includes(recipe.id)) {
        existing.recipeIds.push(recipe.id);
        existing.recipeTitles.push(recipe.title);
      }
      existing.optionalFlags.push(Boolean(ingredient.optional));
      buckets.set(ingredient.ingredientId, existing);
    }
  }

  const generated: ShoppingListItem[] = [];
  buckets.forEach((bucket) => {
    const definition = INGREDIENT_MAP[bucket.ingredientId];
    if (!definition) return;
    // Dry spices and baking staples read better as spoons than as millilitres.
    const spoonMode = definition.category === 'spices-herbs' || definition.category === 'baking';
    const quantities = mergeQuantities(bucket.quantities, {
      volumeMode: spoonMode ? 'spoon' : 'ml',
    });
    if (!quantities.length) return;
    generated.push({
      id: `gen:${bucket.ingredientId}`,
      ingredientId: bucket.ingredientId,
      name: definition.name,
      category: definition.category,
      family: definition.family,
      icon: definition.icon,
      pantryStaple: definition.pantryStaple,
      quantities,
      quantityLabel: quantityLabel(quantities),
      recipeIds: bucket.recipeIds,
      recipeTitles: bucket.recipeTitles,
      optional: bucket.optionalFlags.every(Boolean),
      checked: Boolean(checked[bucket.ingredientId]),
      manual: false,
    });
  });

  const manual: ShoppingListItem[] = manualItems.map((item) => ({
    id: `manual:${item.id}`,
    ingredientId: null,
    name: item.name,
    category: item.category,
    family: 'other',
    pantryStaple: false,
    quantities: [],
    quantityLabel: item.quantityLabel ?? '',
    recipeIds: [],
    recipeTitles: [],
    optional: false,
    checked: Boolean(checked[`manual:${item.id}`]),
    manual: true,
  }));

  const all = [...generated, ...manual];

  const sections: ShoppingListSection[] = SHOPPING_CATEGORY_ORDER.map((category) => ({
    category,
    label: SHOPPING_CATEGORY_LABELS[category],
    items: all
      .filter((item) => item.category === category)
      .sort((a, b) => {
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        return a.name.localeCompare(b.name);
      }),
  })).filter((section) => section.items.length > 0);

  return {
    sections,
    items: all,
    totalCount: all.length,
    checkedCount: all.filter((item) => item.checked).length,
    generatedCount: generated.length,
    recipeCount,
  };
}

/** Number of unique ingredients for a plan, used on the home screen. */
export function countPlanIngredients(plan: MealPlan, recipesById = RECIPE_BY_ID): number {
  const ids = new Set<string>();
  for (const item of plan.items) {
    const recipe = recipesById[item.recipeId];
    if (!recipe) continue;
    for (const ingredient of recipe.ingredients) {
      if (INGREDIENT_MAP[ingredient.ingredientId]) ids.add(ingredient.ingredientId);
    }
  }
  return ids.size;
}

/**
 * Drop checked entries that no longer correspond to anything in the list so
 * the shopping document does not grow forever. Checked state for ingredients
 * that still exist is preserved by identity.
 */
export function pruneChecked(
  checked: Record<string, boolean>,
  items: ShoppingListItem[],
): Record<string, boolean> {
  const validKeys = new Set<string>();
  for (const item of items) {
    if (item.manual) validKeys.add(`manual:${item.id.replace(/^manual:/, '')}`);
    else if (item.ingredientId) validKeys.add(item.ingredientId);
  }
  const next: Record<string, boolean> = {};
  Object.keys(checked).forEach((key) => {
    if (checked[key] && validKeys.has(key)) next[key] = true;
  });
  return next;
}
