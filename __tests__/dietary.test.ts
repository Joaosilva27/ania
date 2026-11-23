import { defineRecipe, ing, steps } from '@/data/builders';
import { RECIPE_CATALOGUE, RECIPE_BY_ID } from '@/data/recipes';
import {
  classifyIngredients,
  filterRecipesByDiet,
  findDietConflicts,
  hasUnclassifiedIngredients,
  isRecipeAllowedForDiet,
} from '@/services/dietary';
import type { DietaryPattern, Recipe } from '@/types';

function fixture(id: string, ingredients: Recipe['ingredients']): Recipe {
  return defineRecipe({
    id,
    title: id,
    description: 'fixture',
    preparationTimeMinutes: 5,
    cookingTimeMinutes: 5,
    difficulty: 'easy',
    servings: 2,
    mealPrepSuitable: false,
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

describe('dietary classification from ingredients', () => {
  it('classifies meat recipes as carnivore only', () => {
    const recipe = fixture('meat', [ing('chicken-breast', 200, 'g')]);
    expect(classifyIngredients(recipe.ingredients)).toEqual(['carnivore']);
  });

  it('classifies fish as pescatarian but not vegetarian', () => {
    const recipe = fixture('fish', [ing('salmon-fillet', 2, 'unit'), ing('lemon', 1, 'unit')]);
    expect(recipe.dietaryClassification).toEqual(['pescatarian', 'carnivore']);
    expect(isRecipeAllowedForDiet(recipe, 'vegetarian')).toBe(false);
    expect(isRecipeAllowedForDiet(recipe, 'pescatarian')).toBe(true);
  });

  it('treats dairy, egg and honey as animal produce but still vegetarian', () => {
    const recipe = fixture('dairy', [ing('butter', 20, 'g'), ing('eggs', 2, 'unit')]);
    expect(recipe.dietaryClassification).toContain('vegetarian');
    expect(recipe.dietaryClassification).not.toContain('vegan');
    const honey = fixture('honey', [ing('honey', 1, 'tbsp')]);
    expect(isRecipeAllowedForDiet(honey, 'vegan')).toBe(false);
    expect(isRecipeAllowedForDiet(honey, 'vegetarian')).toBe(true);
  });

  it('allows plant-only recipes for every restriction', () => {
    const recipe = fixture('plants', [ing('tinned-chickpeas', 1, 'can'), ing('garlic', 2, 'clove')]);
    (['vegan', 'vegetarian', 'pescatarian', 'carnivore', 'none'] as DietaryPattern[]).forEach(
      (diet) => {
        expect(isRecipeAllowedForDiet(recipe, diet)).toBe(true);
      },
    );
  });

  it('never lets a chicken dish through a vegetarian filter', () => {
    const chicken = RECIPE_BY_ID['honey-garlic-chicken-broccoli-rice'];
    expect(isRecipeAllowedForDiet(chicken, 'vegetarian')).toBe(false);
    expect(filterRecipesByDiet(RECIPE_CATALOGUE, 'vegetarian')).not.toContainEqual(chicken);
  });

  it('excludes recipes with unclassified ingredients from restricted diets', () => {
    const mystery = fixture('mystery', [ing('mystery-ingredient', 1, 'unit')]);
    expect(hasUnclassifiedIngredients(mystery.ingredients)).toBe(true);
    expect(isRecipeAllowedForDiet(mystery, 'vegetarian')).toBe(false);
    expect(isRecipeAllowedForDiet(mystery, 'none')).toBe(true);
  });

  it('reports conflicts in a plan without mutating it', () => {
    const conflicts = findDietConflicts(
      [RECIPE_BY_ID['creamy-butter-chicken'], RECIPE_BY_ID['lentil-bolognese']],
      'vegan',
    );
    expect(conflicts.map((recipe) => recipe.id)).toEqual(['creamy-butter-chicken']);
  });
});

describe('catalogue dietary integrity', () => {
  it('ships enough recipes for every dietary pattern', () => {
    const vegan = filterRecipesByDiet(RECIPE_CATALOGUE, 'vegan');
    const vegetarian = filterRecipesByDiet(RECIPE_CATALOGUE, 'vegetarian');
    const pescatarian = filterRecipesByDiet(RECIPE_CATALOGUE, 'pescatarian');
    expect(vegan.length).toBeGreaterThanOrEqual(6);
    expect(vegetarian.length).toBeGreaterThanOrEqual(12);
    expect(pescatarian.length).toBeGreaterThan(vegetarian.length);
    expect(filterRecipesByDiet(RECIPE_CATALOGUE, 'none')).toHaveLength(RECIPE_CATALOGUE.length);
  });

  it('has no vegan recipe containing animal-derived ingredients', () => {
    const bannedOrigins = new Set(['meat', 'fish', 'dairy', 'egg', 'honey']);
    const { INGREDIENT_MAP } = jest.requireActual('@/data/ingredients');
    for (const recipe of RECIPE_CATALOGUE) {
      if (!recipe.dietaryClassification.includes('vegan')) continue;
      for (const ingredient of recipe.ingredients) {
        const definition = INGREDIENT_MAP[ingredient.ingredientId];
        expect(bannedOrigins.has(definition.origin)).toBe(false);
      }
    }
  });

  it('has no vegetarian recipe containing meat or fish', () => {
    const { INGREDIENT_MAP } = jest.requireActual('@/data/ingredients');
    for (const recipe of RECIPE_CATALOGUE) {
      if (!recipe.dietaryClassification.includes('vegetarian')) continue;
      for (const ingredient of recipe.ingredients) {
        const origin = INGREDIENT_MAP[ingredient.ingredientId].origin;
        expect(origin === 'meat' || origin === 'fish').toBe(false);
      }
    }
  });

  it('keeps the declared classification in sync with the ingredients', () => {
    for (const recipe of RECIPE_CATALOGUE) {
      expect(recipe.dietaryClassification).toEqual(classifyIngredients(recipe.ingredients));
    }
  });
});
