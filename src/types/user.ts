import type {
  DietaryPattern,
  GoalId,
  InterestId,
  ObstacleId,
  StatementResponses,
} from './recipe';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string;
  /** True only for the local preview identity (Firebase not configured). */
  isPreview: boolean;
}

export type SupermarketId = 'pingo-doce' | 'continente' | 'mercadona' | 'lidl' | 'auchan';

export interface UserPreferences {
  primaryGoal: GoalId | null;
  obstacles: ObstacleId[];
  interests: InterestId[];
  dietaryPattern: DietaryPattern;
  statements: StatementResponses | null;
  /** Shops the person actually uses; prices are compared only between these. */
  supermarkets?: SupermarketId[];
  updatedAt: string;
}

export type OnboardingStep =
  | 'name'
  | 'goals'
  | 'obstacles'
  | 'statements'
  | 'preferences'
  | 'dietary'
  | 'supermarkets'
  | 'recipe-discovery'
  | 'initial-plan'
  | 'shopping-preview'
  | 'complete';

export interface OnboardingState {
  currentStep: OnboardingStep;
  completed: boolean;
  initialRecipeIds: string[];
  startedAt: string;
  completedAt: string | null;
}

export interface MealPlanItem {
  recipeId: string;
  /** Servings the user cooks for (scales the shopping list). */
  servings: number;
  addedAt: string;
  /** 'onboarding' | 'recommendation' | 'discover' | 'recipe-detail' */
  source: string;
}

export interface MealPlan {
  items: MealPlanItem[];
  version: number;
  updatedAt: string;
}

export interface ManualShoppingItem {
  id: string;
  name: string;
  quantityLabel?: string;
  category: import('./recipe').ShoppingCategory;
  createdAt: string;
}

export interface ShoppingState {
  /** ingredientId -> checked. Keyed by stable identity so recalculation is safe. */
  checked: Record<string, boolean>;
  /** Manually typed items, kept entirely separate from generated ones. */
  manualItems: ManualShoppingItem[];
  updatedAt: string;
}

export interface RecipeFeedbackEntry {
  recipeId: string;
  status: 'accepted' | 'rejected';
  at: string;
  context: string;
}

export type SyncState = 'idle' | 'saving' | 'pending' | 'error';

export interface UserData {
  profile: UserProfile;
  preferences: UserPreferences;
  onboarding: OnboardingState;
  plan: MealPlan;
  shopping: ShoppingState;
  feedback: Record<string, RecipeFeedbackEntry>;
  favorites: Record<string, string>;
  schemaVersion: number;
}

export const SCHEMA_VERSION = 1;
