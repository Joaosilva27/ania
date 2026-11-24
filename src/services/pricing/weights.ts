import type { Unit } from '@/types';

/**
 * From a recipe line to the weight the shop is actually asked for.
 *
 * Shops sell by weight, so a clove of garlic or "2 spring onions" has to become
 * grams. Measured units convert exactly; counted ones use the typical weight of
 * one piece, which the basket states nowhere as fact — it only decides how much
 * of a pack you need.
 */

/** Grams per unit of the recipe's own measurement. */
export const UNIT_GRAMS: Record<Unit, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
  pinch: 0.5,
  unit: 0,
  piece: 0,
  clove: 4,
  slice: 0,
  head: 0,
  bunch: 0,
  sprig: 2,
  handful: 30,
  can: 400,
};

/** Typical weight of one countable item, by department. */
export const COUNT_GRAMS: Record<string, number> = {
  'fruit-veg': 120,
  'meat-fish': 150,
  'dairy-eggs': 60,
  'bread-bakery': 40,
  baking: 15,
  'spices-herbs': 2,
  'sauces-condiments': 15,
  storecupboard: 100,
  'world-foods': 100,
  frozen: 100,
  other: 100,
};

/**
 * Where a department average is plainly wrong. A bunch of spring onions is 30 g
 * of onions, not 240 g, and pricing it as a quarter of a melon is how a basket
 * ends up needing eight packets of chives.
 */
export const PIECE_GRAMS: Record<string, number> = {
  'spring-onions': 15,
  scallion: 15,
  cebolinho: 15,
  coriander: 30,
  cilantro: 30,
  'cilantro-leave': 30,
  parsley: 30,
  salsa: 30,
  basil: 20,
  mint: 20,
  thyme: 5,
  dill: 5,
  'red-chilli': 15,
  jalapeno: 15,
  ginger: 50,
  lime: 80,
  lemon: 100,
  avocado: 150,
  lettuce: 200,
  'cherry-tomatoes': 15,
};

export function gramsFor(quantity: number, unit: Unit, category: string, ingredientId?: string): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  const direct = UNIT_GRAMS[unit] ?? 0;
  if (direct > 0) return quantity * direct;
  if (unit === 'slice') {
    const slice = category === 'bread-bakery' ? 25 : category === 'meat-fish' ? 40 : category === 'dairy-eggs' ? 20 : 30;
    return quantity * slice;
  }
  if (unit === 'head') return quantity * (category === 'fruit-veg' ? 300 : 250);
  if (unit === 'bunch') return quantity * 30;
  const piece = (ingredientId ? PIECE_GRAMS[ingredientId] : undefined) ?? COUNT_GRAMS[category] ?? 100;
  return quantity * piece;
}
