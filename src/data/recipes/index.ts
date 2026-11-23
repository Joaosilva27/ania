import type { Recipe, ShoppingCategory } from '@/types';
import importedRecipes from './imported.json';

/**
 * The single source of recipes for the app and for the Firestore seed script.
 *
 * Every entry is a real, published recipe imported from a public source by
 * `scripts/import-recipes.mjs` (TheMealDB and the Wikibooks Cookbook). The
 * importer guarantees each record has a bundled photograph, a source credit and
 * an ingredient id for every line, so the catalogue can be trusted as data.
 */
export const RECIPE_CATALOGUE: Recipe[] = importedRecipes as unknown as Recipe[];

export const RECIPE_BY_ID: Record<string, Recipe> = RECIPE_CATALOGUE.reduce(
  (acc, recipe) => {
    acc[recipe.id] = recipe;
    return acc;
  },
  {} as Record<string, Recipe>,
);

export function getRecipeById(id: string | undefined | null): Recipe | undefined {
  if (!id) return undefined;
  return RECIPE_BY_ID[id];
}

export function getRecipesByIds(ids: string[]): Recipe[] {
  return ids.map((id) => RECIPE_BY_ID[id]).filter((recipe): recipe is Recipe => Boolean(recipe));
}

/** Display order for the shopping list's category sections. */
export const SHOPPING_CATEGORY_ORDER: ShoppingCategory[] = [
  'fruit-veg',
  'meat-fish',
  'dairy-eggs',
  'bread-bakery',
  'frozen',
  'spices-herbs',
  'baking',
  'sauces-condiments',
  'storecupboard',
  'world-foods',
  'other',
];

export const SHOPPING_CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  'meat-fish': 'Meat & Fish',
  'fruit-veg': 'Fruit & Veg',
  'dairy-eggs': 'Dairy & Eggs',
  'spices-herbs': 'Spices & Herbs',
  baking: 'Baking Ingredients',
  'sauces-condiments': 'Sauces & Condiments',
  storecupboard: 'Storecupboard',
  'world-foods': 'World Foods',
  'bread-bakery': 'Bread & Bakery',
  frozen: 'Frozen Foods',
  other: 'Other',
};

export const SHOPPING_CATEGORY_ICONS: Record<ShoppingCategory, string> = {
  'meat-fish': 'food-drumstick-outline',
  'fruit-veg': 'carrot',
  'dairy-eggs': 'egg-outline',
  'spices-herbs': 'shaker-outline',
  baking: 'cupcake',
  'sauces-condiments': 'bottle-tonic-outline',
  storecupboard: 'package-variant-closed',
  'world-foods': 'globe-model',
  'bread-bakery': 'bread-slice-outline',
  frozen: 'snowflake',
  other: 'basket-outline',
};
