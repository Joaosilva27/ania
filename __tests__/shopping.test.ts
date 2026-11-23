import { defineRecipe, ing, steps } from '@/data/builders';
import { INGREDIENT_MAP } from '@/data/ingredients';
import { RECIPE_CATALOGUE, RECIPE_BY_ID } from '@/data/recipes';
import { buildShoppingList, countPlanIngredients, pruneChecked } from '@/services/shopping/aggregate';
import { mergeQuantities, formatQuantity } from '@/services/shopping/units';
import type { MealPlan, Recipe } from '@/types';

const AT = '2026-02-01T10:00:00.000Z';

function recipeWith(
  id: string,
  ingredients: Recipe['ingredients'],
  servings = 2,
): Recipe {
  return defineRecipe({
    id,
    title: `Fixture ${id}`,
    description: 'Fixture recipe for aggregation tests.',
    preparationTimeMinutes: 5,
    cookingTimeMinutes: 10,
    difficulty: 'easy',
    servings,
    mealPrepSuitable: true,
    budgetTier: 'budget',
    cuisine: 'test',
    primaryIngredient: 'test',
    cookingMethod: 'test',
    tags: ['simple'],
    mealTypes: ['dinner'],
    ingredients,
    instructions: steps(['One', 'Two', 'Three', 'Four']),
  });
}

function plan(...entries: Array<[string, number]>): MealPlan {
  return {
    items: entries.map(([recipeId, servings]) => ({
      recipeId,
      servings,
      addedAt: AT,
      source: 'test',
    })),
    version: 1,
    updatedAt: AT,
  };
}

describe('unit normalisation', () => {
  it('adds compatible mass units', () => {
    expect(mergeQuantities([{ quantity: 200, unit: 'g' }, { quantity: 150, unit: 'g' }])).toEqual([
      { amount: 350, unit: 'g' },
    ]);
    expect(mergeQuantities([{ quantity: 500, unit: 'g' }, { quantity: 0.5, unit: 'kg' }])).toEqual([
      { amount: 1, unit: 'kg' },
    ]);
  });

  it('adds compatible volume units and promotes to litres', () => {
    expect(mergeQuantities([{ quantity: 300, unit: 'ml' }, { quantity: 200, unit: 'ml' }])).toEqual([
      { amount: 500, unit: 'ml' },
    ]);
    expect(mergeQuantities([{ quantity: 800, unit: 'ml' }, { quantity: 0.5, unit: 'l' }])).toEqual([
      { amount: 1.3, unit: 'l' },
    ]);
    expect(mergeQuantities([{ quantity: 2, unit: 'tbsp' }, { quantity: 1, unit: 'tbsp' }])).toEqual([
      { amount: 45, unit: 'ml' },
    ]);
  });

  it('sums countable units without inventing conversions', () => {
    expect(mergeQuantities([{ quantity: 2, unit: 'clove' }, { quantity: 1, unit: 'clove' }])).toEqual([
      { amount: 3, unit: 'clove' },
    ]);
  });

  it('keeps incompatible units as separate lines', () => {
    const merged = mergeQuantities([
      { quantity: 2, unit: 'clove' },
      { quantity: 20, unit: 'g' },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged).toEqual(
      expect.arrayContaining([
        { amount: 20, unit: 'g' },
        { amount: 2, unit: 'clove' },
      ]),
    );
  });

  it('formats quantities for humans', () => {
    expect(formatQuantity(1, 'unit')).toBe('1');
    expect(formatQuantity(450, 'g')).toBe('450 g');
    expect(formatQuantity(3, 'clove')).toBe('3 cloves');
    expect(formatQuantity(1, 'clove')).toBe('1 clove');
    expect(formatQuantity(1.5, 'kg')).toBe('1.5 kg');
  });
});

describe('buildShoppingList', () => {
  it('merges the same ingredient across recipes', () => {
    const a = recipeWith('a', [ing('long-grain-rice', 200, 'g'), ing('garlic', 2, 'clove')]);
    const b = recipeWith('b', [ing('long-grain-rice', 150, 'g'), ing('garlic', 1, 'clove')]);
    const c = recipeWith('c', [ing('long-grain-rice', 100, 'g'), ing('garlic', 3, 'clove')]);
    const list = buildShoppingList({
      plan: plan(['a', 2], ['b', 2], ['c', 2]),
      recipesById: { a, b, c },
    });
    const rice = list.items.find((item) => item.ingredientId === 'long-grain-rice');
    const garlic = list.items.find((item) => item.ingredientId === 'garlic');
    expect(rice?.quantityLabel).toBe('450 g');
    expect(garlic?.quantityLabel).toBe('6 cloves');
    expect(garlic?.recipeIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('scales by the servings chosen in the plan', () => {
    const a = recipeWith('a', [ing('chicken-breast', 200, 'g')], 2);
    const doubled = buildShoppingList({ plan: plan(['a', 4]), recipesById: { a } });
    expect(doubled.items[0].quantityLabel).toBe('400 g');
    const halved = buildShoppingList({ plan: plan(['a', 1]), recipesById: { a } });
    expect(halved.items[0].quantityLabel).toBe('100 g');
  });

  it('recalculates when a recipe is removed — no stale ingredients', () => {
    const a = recipeWith('a', [ing('chicken-breast', 200, 'g'), ing('honey', 2, 'tbsp')]);
    const b = recipeWith('b', [ing('chicken-breast', 300, 'g')]);
    const before = buildShoppingList({ plan: plan(['a', 2], ['b', 2]), recipesById: { a, b } });
    expect(before.items.find((item) => item.ingredientId === 'chicken-breast')?.quantityLabel).toBe(
      '500 g',
    );
    expect(before.items.some((item) => item.ingredientId === 'honey')).toBe(true);

    const after = buildShoppingList({ plan: plan(['b', 2]), recipesById: { a, b } });
    expect(after.items).toHaveLength(1);
    expect(after.items[0].quantityLabel).toBe('300 g');
  });

  it('ignores zero, negative and unknown quantities', () => {
    const a = recipeWith('a', [
      ing('chicken-breast', 0, 'g'),
      ing('garlic', -2, 'clove'),
      ing('onion', 1, 'unit'),
    ]);
    const list = buildShoppingList({ plan: plan(['a', 2]), recipesById: { a } });
    expect(list.items).toHaveLength(1);
    expect(list.items[0].ingredientId).toBe('onion');
  });

  it('ignores plan entries pointing at recipes that no longer exist', () => {
    const a = recipeWith('a', [ing('onion', 1, 'unit')]);
    const list = buildShoppingList({ plan: plan(['a', 2], ['missing', 2]), recipesById: { a } });
    expect(list.items).toHaveLength(1);
    expect(list.recipeCount).toBe(1);
  });

  it('keeps manual items separate from generated ones', () => {
    const a = recipeWith('a', [ing('onion', 1, 'unit')]);
    const list = buildShoppingList({
      plan: plan(['a', 2]),
      recipesById: { a },
      manualItems: [
        { id: 'm1', name: 'Kitchen roll', quantityLabel: '1 pack', category: 'other', createdAt: AT },
      ],
    });
    const manual = list.items.find((item) => item.manual);
    expect(manual?.name).toBe('Kitchen roll');
    expect(manual?.quantityLabel).toBe('1 pack');
    expect(list.generatedCount).toBe(1);
    expect(list.totalCount).toBe(2);
  });

  it('preserves checked state by ingredient identity', () => {
    const a = recipeWith('a', [ing('garlic', 2, 'clove'), ing('onion', 1, 'unit')]);
    const list = buildShoppingList({
      plan: plan(['a', 2]),
      recipesById: { a },
      checked: { garlic: true, onion: false, 'removed-item': true },
    });
    expect(list.items.find((item) => item.ingredientId === 'garlic')?.checked).toBe(true);
    expect(list.checkedCount).toBe(1);
    const pruned = pruneChecked({ garlic: true, 'removed-item': true }, list.items);
    expect(pruned).toEqual({ garlic: true });
  });

  it('groups by shopping category in display order', () => {
    const a = recipeWith('a', [ing('chicken-breast', 200, 'g'), ing('garlic', 2, 'clove')]);
    const list = buildShoppingList({ plan: plan(['a', 2]), recipesById: { a } });
    expect(list.sections[0].category).toBe('fruit-veg');
    expect(list.sections[1].category).toBe('meat-fish');
  });

  it('marks an ingredient optional only when every recipe marks it optional', () => {
    const a = recipeWith('a', [ing('capers', 1, 'tbsp', undefined, true)]);
    const b = recipeWith('b', [ing('capers', 1, 'tbsp')]);
    const allOptional = buildShoppingList({ plan: plan(['a', 2]), recipesById: { a } });
    expect(allOptional.items[0].optional).toBe(true);
    const mixed = buildShoppingList({ plan: plan(['a', 2], ['b', 2]), recipesById: { a, b } });
    expect(mixed.items[0].optional).toBe(false);
  });
});

describe('real catalogue aggregation', () => {
  it('counts unique ingredients for a real plan', () => {
    // Two real recipes that both use garlic: the plan must merge them into one line.
    const pair = RECIPE_CATALOGUE.filter((recipe) =>
      recipe.ingredients.some((ingredient) => ingredient.ingredientId === 'garlic'),
    ).slice(0, 2);
    expect(pair).toHaveLength(2);
    const planReal = plan(
      [pair[0].id, pair[0].servings],
      [pair[1].id, pair[1].servings],
    );
    const list = buildShoppingList({ plan: planReal });
    const garlic = list.items.find((item) => item.ingredientId === 'garlic');
    expect(garlic?.recipeTitles).toHaveLength(2);
    expect(garlic?.quantityLabel.length).toBeGreaterThan(0);
    expect(list.recipeCount).toBe(2);
    expect(countPlanIngredients(planReal)).toBe(list.generatedCount);
  });

  it('every generated line has a resolvable icon source and category', () => {
    const all = Object.keys(RECIPE_BY_ID);
    const list = buildShoppingList({
      plan: plan(...all.map((id): [string, number] => [id, RECIPE_BY_ID[id].servings])),
    });
    for (const item of list.items) {
      expect(INGREDIENT_MAP[item.ingredientId ?? '']).toBeDefined();
      expect(item.category).toBeTruthy();
      expect(item.quantityLabel.length).toBeGreaterThan(0);
    }
    expect(list.items.length).toBeGreaterThan(60);
    expect(RECIPE_CATALOGUE.length).toBeGreaterThanOrEqual(40);
  });
});

describe('spoon-aware quantities', () => {
  it('keeps dry spices in teaspoons and tablespoons', () => {
    expect(mergeQuantities([{ quantity: 2, unit: 'tsp' }], { volumeMode: 'spoon' })).toEqual([
      { amount: 2, unit: 'tsp' },
    ]);
    expect(
      mergeQuantities([{ quantity: 1, unit: 'tbsp' }, { quantity: 2, unit: 'tsp' }], {
        volumeMode: 'spoon',
      }),
    ).toEqual([{ amount: 1.67, unit: 'tbsp' }]);
  });

  it('still converts liquid sauces to millilitres', () => {
    expect(mergeQuantities([{ quantity: 2, unit: 'tbsp' }])).toEqual([{ amount: 30, unit: 'ml' }]);
  });

  it('applies the right mode by ingredient aisle in a real list', () => {
    const a = recipeWith('spoon', [
      ing('curry-powder', 2, 'tsp'),
      ing('soy-sauce', 2, 'tbsp'),
      ing('honey', 1, 'tbsp'),
    ]);
    const list = buildShoppingList({ plan: plan(['spoon', 2]), recipesById: { spoon: a } });
    const label = (id: string) => list.items.find((item) => item.ingredientId === id)?.quantityLabel;
    expect(label('curry-powder')).toBe('2 tsp');
    expect(label('soy-sauce')).toBe('30 ml');
    expect(label('honey')).toBe('15 ml');
  });
});
