import { RECIPE_CATALOGUE, RECIPE_BY_ID } from '@/data/recipes';
import { SUPERMARKETS } from '@/data/supermarkets';
import { formatEuro, pricePlan, priceRecipe } from '@/services/pricing';
import type { MealPlan, Recipe } from '@/types';

const allStores = SUPERMARKETS.map((market) => market.id);

/** A recipe with known quantities so the arithmetic can be checked by hand. */
const fixture: Recipe = {
  ...RECIPE_CATALOGUE[0],
  id: 'pricing-fixture',
  servings: 2,
  ingredients: [
    { ingredientId: 'chicken-breast', quantity: 500, unit: 'g' },
    { ingredientId: 'rice', quantity: 200, unit: 'g' },
  ],
  instructions: RECIPE_CATALOGUE[0].instructions,
};

import priceBook from '@/data/prices.pt.json';

const book = priceBook as unknown as { items: Record<string, { perKg: Record<string, number> }> };
const priceOf = (id: string, store: string) => book.items[id].perKg[store];

describe('priceRecipe', () => {
  it('prices each line at the shop’s €/kg for the amount used', () => {
    const result = priceRecipe(fixture, { stores: allStores });
    const expected =
      (500 * priceOf('chicken-breast', 'lidl')) / 1000 + (200 * priceOf('rice', 'lidl')) / 1000;
    const lidl = result.quotes.find((quote) => quote.store === 'lidl');
    expect(lidl?.total).toBeCloseTo(Math.round(expected * 100) / 100, 2);
  });

  it('quotes only the shops the person chose, cheapest first', () => {
    const result = priceRecipe(fixture, { stores: ['continente', 'lidl'] });
    expect(result.quotes.map((quote) => quote.store)).toEqual(['lidl', 'continente']);
    expect(result.best?.store).toBe('lidl');
    expect(result.quotes).toHaveLength(2);
  });

  it('scales the cost with servings', () => {
    const forTwo = priceRecipe(fixture, { stores: ['lidl'] });
    const forFour = priceRecipe(fixture, { stores: ['lidl'], servings: 4 });
    expect(forFour.best!.total).toBeCloseTo(forTwo.best!.total * 2, 1);
    expect(forFour.perServing).toBeCloseTo(forTwo.perServing!, 2);
  });

  it('returns nothing useful without shops rather than inventing a price', () => {
    const result = priceRecipe(fixture, { stores: [] });
    expect(result.best).toBeNull();
    expect(result.perServing).toBeNull();
  });

  it('counts the lines it could not price', () => {
    const odd: Recipe = {
      ...fixture,
      ingredients: [{ ingredientId: 'definitely-not-an-ingredient', quantity: 2, unit: 'unit' }],
    };
    const result = priceRecipe(odd, { stores: ['lidl'] });
    expect(result.quotes).toHaveLength(0);
    expect(result.best).toBeNull();
  });

  it('handles every recipe in the catalogue without crashing', () => {
    for (const recipe of RECIPE_CATALOGUE.slice(0, 200)) {
      const result = priceRecipe(recipe, { stores: allStores });
      if (result.best) {
        expect(result.best.total).toBeGreaterThan(0);
        expect(Number.isFinite(result.best.total)).toBe(true);
      }
    }
  });
});

describe('pricePlan', () => {
  const plan: MealPlan = {
    items: [
      { recipeId: 'pricing-fixture', servings: 2, addedAt: '2026-11-24T00:00:00.000Z', source: 'test' },
      { recipeId: RECIPE_CATALOGUE[3].id, servings: RECIPE_CATALOGUE[3].servings, addedAt: '2026-11-24T00:00:00.000Z', source: 'test' },
    ],
    version: 1,
    updatedAt: '2026-11-24T00:00:00.000Z',
  };

  it('adds the dishes up per shop', () => {
    const recipesById = { ...RECIPE_BY_ID, 'pricing-fixture': fixture };
    const result = pricePlan(plan, { stores: allStores, recipesById });
    expect(result.quotes).toHaveLength(allStores.length);
    const single = priceRecipe(fixture, { stores: allStores });
    for (const quote of result.quotes) {
      const alone = single.quotes.find((entry) => entry.store === quote.store)!;
      expect(quote.total).toBeGreaterThan(alone.total);
    }
  });

  it('ignores plan entries whose recipe is gone', () => {
    const result = pricePlan(
      { ...plan, items: [{ recipeId: 'deleted-recipe', servings: 2, addedAt: '', source: 'x' }] },
      { stores: allStores },
    );
    expect(result.best).toBeNull();
  });
});

describe('formatEuro', () => {
  it('uses Portuguese formatting', () => {
    expect(formatEuro(4.2)).toBe('4,20 €');
    expect(formatEuro(12)).toBe('12,00 €');
  });
});
