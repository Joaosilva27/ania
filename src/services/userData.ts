import { RECIPE_BY_ID } from '@/data/recipes';
import { clampServings } from '@/services/recipes/servings';
import {
  SCHEMA_VERSION,
  type DietaryPattern,
  type InterestId,
  type ManualShoppingItem,
  type GoalId,
  type ObstacleId,
  type OnboardingStep,
  type RecipeFeedbackEntry,
  type ShoppingCategory,
  type StatementResponses,
  type SupermarketId,
  type UserData,
  type UserPreferences,
  type UserProfile,
} from '@/types';

/**
 * Pure state transitions over the user document.
 *
 * Keeping them here (rather than inside components or stores) means the whole
 * persistence contract is unit-testable without React or a network.
 */

export const PREVIEW_UID = 'local-preview-user';

export function defaultPreferences(): UserPreferences {
  return {
    primaryGoal: null,
    obstacles: [],
    interests: [],
    dietaryPattern: 'none',
    statements: null,
    supermarkets: [],
    updatedAt: new Date(0).toISOString(),
  };
}

export function createUserData(profile: UserProfile): UserData {
  const now = new Date().toISOString();
  return {
    profile,
    preferences: defaultPreferences(),
    onboarding: {
      currentStep: 'name',
      completed: false,
      initialRecipeIds: [],
      startedAt: now,
      completedAt: null,
    },
    plan: { items: [], version: 0, updatedAt: now },
    shopping: { checked: {}, manualItems: [], updatedAt: now },
    feedback: {},
    favorites: {},
    schemaVersion: SCHEMA_VERSION,
  };
}

function touch(preferences: UserPreferences): UserPreferences {
  return { ...preferences, updatedAt: new Date().toISOString() };
}

export function setDisplayName(data: UserData, displayName: string): UserData {
  return {
    ...data,
    profile: { ...data.profile, displayName: displayName.slice(0, 30) },
  };
}

export function setPrimaryGoal(data: UserData, goal: GoalId | null): UserData {
  return { ...data, preferences: touch({ ...data.preferences, primaryGoal: goal }) };
}

export function toggleObstacle(data: UserData, obstacle: ObstacleId): UserData {
  const current = data.preferences.obstacles;
  const obstacles = current.includes(obstacle)
    ? current.filter((item) => item !== obstacle)
    : [...current, obstacle];
  return { ...data, preferences: touch({ ...data.preferences, obstacles }) };
}

export function setStatements(data: UserData, statements: StatementResponses): UserData {
  return { ...data, preferences: touch({ ...data.preferences, statements }) };
}

export function toggleInterest(data: UserData, interest: InterestId): UserData {
  const current = data.preferences.interests;
  const interests = current.includes(interest)
    ? current.filter((item) => item !== interest)
    : [...current, interest];
  return { ...data, preferences: touch({ ...data.preferences, interests }) };
}

export function setInterests(data: UserData, interests: InterestId[]): UserData {
  return { ...data, preferences: touch({ ...data.preferences, interests }) };
}

export function setSupermarkets(data: UserData, supermarkets: SupermarketId[]): UserData {
  return { ...data, preferences: touch({ ...data.preferences, supermarkets }) };
}

export function toggleSupermarket(data: UserData, supermarket: SupermarketId): UserData {
  const current = data.preferences.supermarkets ?? [];
  const next = current.includes(supermarket)
    ? current.filter((item) => item !== supermarket)
    : [...current, supermarket];
  return setSupermarkets(data, next);
}

export function setDietaryPattern(data: UserData, pattern: DietaryPattern): UserData {
  return { ...data, preferences: touch({ ...data.preferences, dietaryPattern: pattern }) };
}

export function setOnboardingStep(data: UserData, currentStep: OnboardingStep): UserData {
  return { ...data, onboarding: { ...data.onboarding, currentStep } };
}

export function setInitialRecipeIds(data: UserData, recipeIds: string[]): UserData {
  return { ...data, onboarding: { ...data.onboarding, initialRecipeIds: recipeIds } };
}

export function isRecipeInPlan(data: UserData, recipeId: string): boolean {
  return data.plan.items.some((item) => item.recipeId === recipeId);
}

/** Idempotent: adding the same recipe twice never duplicates it. */
export function addRecipeToPlan(
  data: UserData,
  recipeId: string,
  source = 'recommendation',
  servings?: number,
): UserData {
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe) return data;
  if (isRecipeInPlan(data, recipeId)) return data;
  const now = new Date().toISOString();
  return {
    ...data,
    plan: {
      items: [
        ...data.plan.items,
        {
          recipeId,
          servings: clampServings(servings ?? recipe.servings),
          addedAt: now,
          source,
        },
      ],
      version: data.plan.version + 1,
      updatedAt: now,
    },
  };
}

export function removeRecipeFromPlan(data: UserData, recipeId: string): UserData {
  if (!isRecipeInPlan(data, recipeId)) return data;
  const now = new Date().toISOString();
  const removedIngredients = new Set(
    (RECIPE_BY_ID[recipeId]?.ingredients ?? []).map((item) => item.ingredientId),
  );
  // Preserve checked state only for ingredients still required by the plan.
  const stillRequired = new Set<string>();
  data.plan.items
    .filter((item) => item.recipeId !== recipeId)
    .forEach((item) => {
      const recipe = RECIPE_BY_ID[item.recipeId];
      recipe?.ingredients.forEach((ingredient) => stillRequired.add(ingredient.ingredientId));
    });
  const checked: Record<string, boolean> = {};
  Object.keys(data.shopping.checked).forEach((key) => {
    if (!data.shopping.checked[key]) return;
    if (removedIngredients.has(key) && !stillRequired.has(key)) return;
    checked[key] = true;
  });

  return {
    ...data,
    plan: {
      items: data.plan.items.filter((item) => item.recipeId !== recipeId),
      version: data.plan.version + 1,
      updatedAt: now,
    },
    shopping: { ...data.shopping, checked, updatedAt: now },
  };
}

export function updatePlanServings(data: UserData, recipeId: string, servings: number): UserData {
  const next = clampServings(servings);
  let changed = false;
  const items = data.plan.items.map((item) => {
    if (item.recipeId !== recipeId || item.servings === next) return item;
    changed = true;
    return { ...item, servings: next };
  });
  if (!changed) return data;
  return {
    ...data,
    plan: { ...data.plan, items, version: data.plan.version + 1, updatedAt: new Date().toISOString() },
  };
}

export function setPlanRecipes(
  data: UserData,
  recipeIds: string[],
  source: string,
): UserData {
  let next: UserData = data;
  const unique = Array.from(new Set(recipeIds));
  for (const id of unique) {
    next = addRecipeToPlan(next, id, source);
  }
  return next;
}

export function setChecked(data: UserData, key: string, checked: boolean): UserData {
  const next = { ...data.shopping.checked };
  if (checked) next[key] = true;
  else delete next[key];
  return {
    ...data,
    shopping: { ...data.shopping, checked: next, updatedAt: new Date().toISOString() },
  };
}

export function clearChecked(data: UserData): UserData {
  return {
    ...data,
    shopping: { ...data.shopping, checked: {}, updatedAt: new Date().toISOString() },
  };
}

export function addManualShoppingItem(
  data: UserData,
  input: { name: string; quantityLabel?: string; category?: ShoppingCategory; id?: string },
): UserData {
  const name = input.name.trim();
  if (!name) return data;
  const item: ManualShoppingItem = {
    id: input.id ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    category: input.category ?? 'other',
    createdAt: new Date().toISOString(),
  };
  if (input.quantityLabel?.trim()) item.quantityLabel = input.quantityLabel.trim();
  return {
    ...data,
    shopping: {
      ...data.shopping,
      manualItems: [...data.shopping.manualItems, item],
      updatedAt: new Date().toISOString(),
    },
  };
}

export function removeManualShoppingItem(data: UserData, id: string): UserData {
  const checked = { ...data.shopping.checked };
  delete checked[`manual:${id}`];
  return {
    ...data,
    shopping: {
      ...data.shopping,
      manualItems: data.shopping.manualItems.filter((item) => item.id !== id),
      checked,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function recordFeedback(
  data: UserData,
  recipeId: string,
  status: 'accepted' | 'rejected',
  context: string,
): UserData {
  const entry: RecipeFeedbackEntry = {
    recipeId,
    status,
    at: new Date().toISOString(),
    context,
  };
  return { ...data, feedback: { ...data.feedback, [recipeId]: entry } };
}

export function toggleFavorite(data: UserData, recipeId: string): UserData {
  const favorites = { ...data.favorites };
  if (favorites[recipeId]) delete favorites[recipeId];
  else favorites[recipeId] = new Date().toISOString();
  return { ...data, favorites };
}

export function completeOnboarding(data: UserData, initialRecipeIds: string[]): UserData {
  const now = new Date().toISOString();
  return {
    ...data,
    onboarding: {
      ...data.onboarding,
      currentStep: 'complete',
      completed: true,
      initialRecipeIds,
      completedAt: now,
    },
    plan: { ...data.plan, updatedAt: now },
  };
}

/** Conflicting plan entries after a dietary change — never auto-removed. */
export function planConflictsAfterDietChange(
  data: UserData,
  allowed: (recipeId: string) => boolean,
): string[] {
  return data.plan.items
    .map((item) => item.recipeId)
    .filter((recipeId) => !allowed(recipeId));
}

export function replaceProfile(data: UserData, profile: UserProfile): UserData {
  return { ...data, profile };
}
