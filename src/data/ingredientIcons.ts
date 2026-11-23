import type { IngredientFamily, ShoppingCategory } from '@/types';

/**
 * Icon maps for the layered IngredientIcon system. Kept free of React Native
 * imports so `scripts/verify-icons.ts` can validate every name against the
 * bundled glyphmap.
 */

export const FAMILY_ICONS: Record<IngredientFamily, string> = {
  meat: 'food-drumstick',
  fish: 'fish',
  dairy: 'cheese',
  egg: 'egg',
  vegetable: 'carrot',
  fruit: 'food-apple',
  grain: 'barley',
  spice: 'shaker-outline',
  sauce: 'bottle-tonic-outline',
  pantry: 'package-variant-closed',
  bakery: 'bread-slice',
  frozen: 'snowflake',
  other: 'silverware-fork-knife',
};

export const CATEGORY_ICONS: Record<ShoppingCategory, string> = {
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
