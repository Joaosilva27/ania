import {
  canAdvanceFrom,
  isStepReachable,
  nextStep,
  previousStep,
  progressFor,
  resumeStep,
} from '@/services/onboarding';
import {
  addRecipeToPlan,
  completeOnboarding,
  createUserData,
  isRecipeInPlan,
  removeRecipeFromPlan,
  setChecked,
  setDietaryPattern,
  setInitialRecipeIds,
  setOnboardingStep,
  setPrimaryGoal,
  setStatements,
  setInterests,
  toggleObstacle,
  updatePlanServings,
} from '@/services/userData';
import { buildShoppingList } from '@/services/shopping/aggregate';
import { validateCatalogue } from '@/services/plan';
import type { StatementResponses, UserData, UserProfile } from '@/types';

const profile: UserProfile = {
  uid: 'test-user',
  displayName: 'Alex',
  email: 'alex@example.com',
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: '2026-01-01T00:00:00.000Z',
  isPreview: false,
};

const statements: StatementResponses = {
  budget_concern: true,
  recipe_search_frustration: true,
  processed_food_concern: true,
  last_minute_shopping: true,
  healthy_weekly_meals: true,
};

function answeredData(): UserData {
  let data = createUserData(profile);
  data = setPrimaryGoal(data, 'meal-prep');
  data = toggleObstacle(data, 'lack-of-time');
  data = toggleObstacle(data, 'too-tired');
  data = setStatements(data, statements);
  data = setInterests(data, ['high-protein', 'quick-healthy-dinner', 'comfort']);
  data = setDietaryPattern(data, 'none');
  return data;
}

describe('onboarding progression', () => {
  it('starts a new user on the first question', () => {
    const data = createUserData(profile);
    expect(data.onboarding.currentStep).toBe('goals');
    expect(resumeStep(data.onboarding)).toBe('goals');
    expect(progressFor('goals')).toEqual({ index: 1, total: 8 });
  });

  it('walks forward and backward through every step', () => {
    expect(nextStep('goals')).toBe('obstacles');
    expect(nextStep('shopping-preview')).toBe('complete');
    expect(previousStep('obstacles')).toBe('goals');
    expect(previousStep('goals')).toBeNull();
  });

  it('requires a goal before continuing', () => {
    const data = createUserData(profile);
    expect(canAdvanceFrom('goals', { preferences: data.preferences, selectedRecipeIds: [] })).toBe(
      false,
    );
    const withGoal = setPrimaryGoal(data, 'simple-recipes');
    expect(
      canAdvanceFrom('goals', { preferences: withGoal.preferences, selectedRecipeIds: [] }),
    ).toBe(true);
  });

  it('requires at least one obstacle and one interest', () => {
    let data = createUserData(profile);
    expect(
      canAdvanceFrom('obstacles', { preferences: data.preferences, selectedRecipeIds: [] }),
    ).toBe(false);
    data = toggleObstacle(data, 'too-tired');
    expect(
      canAdvanceFrom('obstacles', { preferences: data.preferences, selectedRecipeIds: [] }),
    ).toBe(true);
    expect(
      canAdvanceFrom('preferences', { preferences: data.preferences, selectedRecipeIds: [] }),
    ).toBe(false);
    data = setInterests(data, ['veggie']);
    expect(
      canAdvanceFrom('preferences', { preferences: data.preferences, selectedRecipeIds: [] }),
    ).toBe(true);
  });

  it('keeps selections when going back', () => {
    let data = answeredData();
    data = toggleObstacle(data, 'lack-of-time');
    expect(data.preferences.obstacles).toEqual(['too-tired']);
    data = toggleObstacle(data, 'lack-of-time');
    expect(data.preferences.obstacles.sort()).toEqual(['lack-of-time', 'too-tired']);
    expect(data.preferences.primaryGoal).toBe('meal-prep');
    expect(data.preferences.interests).toHaveLength(3);
  });

  it('records every statement response individually', () => {
    const data = setStatements(createUserData(profile), statements);
    expect(Object.keys(data.preferences.statements ?? {})).toHaveLength(5);
    expect(data.preferences.statements?.budget_concern).toBe(true);
  });

  it('requires exactly three recipes for the initial plan', () => {
    let data = answeredData();
    const two = { preferences: data.preferences, selectedRecipeIds: ['a', 'b'] };
    expect(canAdvanceFrom('recipe-discovery', two)).toBe(false);
    const three = { preferences: data.preferences, selectedRecipeIds: ['a', 'b', 'c'] };
    expect(canAdvanceFrom('recipe-discovery', three)).toBe(true);
  });

  it('blocks deep links into later steps until earlier answers exist', () => {
    const data = createUserData(profile);
    const draft = { preferences: data.preferences, selectedRecipeIds: [] };
    expect(isStepReachable('dietary', draft)).toBe(false);
    expect(isStepReachable('goals', draft)).toBe(true);
    const answered = answeredData();
    expect(
      isStepReachable('dietary', {
        preferences: answered.preferences,
        selectedRecipeIds: [],
      }),
    ).toBe(true);
  });

  it('resumes an interrupted onboarding at the stored step', () => {
    let data = answeredData();
    data = setOnboardingStep(data, 'dietary');
    expect(resumeStep(data.onboarding)).toBe('dietary');
    expect(data.onboarding.completed).toBe(false);
  });

  it('sends a completed user straight to the app', () => {
    let data = answeredData();
    data = setOnboardingStep(data, 'complete');
    data = completeOnboarding(data, ['honey-garlic-chicken-broccoli-rice']);
    expect(resumeStep(data.onboarding)).toBe('complete');
    expect(data.onboarding.completed).toBe(true);
    expect(data.onboarding.completedAt).not.toBeNull();
  });
});

describe('meal plan and shopping behaviour', () => {
  const threeIds = [
    'high-protein-chicken-burrito-bowl',
    'creamy-butter-chicken',
    'quick-beef-stir-fry',
  ];

  it('stores exactly the accepted recipes, without duplicates', () => {
    let data = answeredData();
    for (const id of threeIds) {
      data = addRecipeToPlan(data, id, 'onboarding');
      data = addRecipeToPlan(data, id, 'onboarding');
    }
    expect(data.plan.items).toHaveLength(3);
    expect(isRecipeInPlan(data, threeIds[0])).toBe(true);
    data = setInitialRecipeIds(data, threeIds);
    expect(data.onboarding.initialRecipeIds).toEqual(threeIds);
  });

  it('derives the shopping list from the selected recipes only', () => {
    let data = answeredData();
    for (const id of threeIds) data = addRecipeToPlan(data, id, 'onboarding');
    const list = buildShoppingList({
      plan: data.plan,
      checked: data.shopping.checked,
      manualItems: data.shopping.manualItems,
    });
    expect(list.recipeCount).toBe(3);
    expect(list.generatedCount).toBeGreaterThan(15);
    const garlic = list.items.find((item) => item.ingredientId === 'garlic');
    expect(garlic).toBeDefined();
    expect(garlic?.recipeTitles.length).toBeGreaterThan(1);
  });

  it('preserves checked state when the plan changes, dropping only stale items', () => {
    let data = answeredData();
    for (const id of threeIds) data = addRecipeToPlan(data, id, 'onboarding');
    data = setChecked(data, 'garlic', true);
    data = setChecked(data, 'lime', true);
    expect(data.shopping.checked.garlic).toBe(true);

    data = removeRecipeFromPlan(data, 'creamy-butter-chicken');
    // Garlic is still needed by the burrito bowl, so it stays checked.
    expect(data.shopping.checked.garlic).toBe(true);
    // The whole plan still has lime from the burrito bowl.
    expect(data.shopping.checked.lime).toBe(true);

    data = updatePlanServings(data, 'quick-beef-stir-fry', 4);
    const item = data.plan.items.find((entry) => entry.recipeId === 'quick-beef-stir-fry');
    expect(item?.servings).toBe(4);
  });

  it('clears checked state for ingredients no recipe needs any more', () => {
    let data = answeredData();
    data = addRecipeToPlan(data, 'tuna-pasta-bake', 'onboarding');
    data = setChecked(data, 'tinned-tuna', true);
    data = removeRecipeFromPlan(data, 'tuna-pasta-bake');
    expect(data.shopping.checked['tinned-tuna']).toBeUndefined();
  });

  it('serves the full catalogue without data problems', () => {
    expect(validateCatalogue()).toEqual([]);
  });
});
