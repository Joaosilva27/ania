import type { Recipe, ShoppingCategory } from '@/types';
import { BEEF_RECIPES } from './beef';
import { BREAKFAST_RECIPES } from './breakfast';
import { CHICKEN_RECIPES } from './chicken';
import { FISH_RECIPES } from './fish';
import { VEGAN_RECIPES } from './vegan';
import { VEGETARIAN_RECIPES } from './vegetarian';

/** The single source of recipes for the app and for the Firestore seed script. */
export const RECIPE_CATALOGUE: Recipe[] = [
  ...CHICKEN_RECIPES,
  ...BEEF_RECIPES,
  ...FISH_RECIPES,
  ...VEGETARIAN_RECIPES,
  ...VEGAN_RECIPES,
  ...BREAKFAST_RECIPES,
];

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

export { BEEF_RECIPES, BREAKFAST_RECIPES, CHICKEN_RECIPES, FISH_RECIPES, VEGAN_RECIPES, VEGETARIAN_RECIPES };
