import type { OnboardingState, OnboardingStep, UserPreferences } from '@/types';
import { INITIAL_PLAN_SIZE } from './recommendations';

export const ONBOARDING_STEPS: OnboardingStep[] = [
  'name',
  'goals',
  'obstacles',
  'statements',
  'preferences',
  'dietary',
  'supermarkets',
  'recipe-discovery',
  'initial-plan',
  'shopping-preview',
];

export const ONBOARDING_ROUTE: Record<OnboardingStep, string> = {
  name: '/onboarding/name',
  goals: '/onboarding/goals',
  obstacles: '/onboarding/obstacles',
  statements: '/onboarding/statements',
  preferences: '/onboarding/preferences',
  dietary: '/onboarding/dietary',
  supermarkets: '/onboarding/supermarkets',
  'recipe-discovery': '/onboarding/recipe-discovery',
  'initial-plan': '/onboarding/initial-plan',
  'shopping-preview': '/onboarding/shopping-preview',
  complete: '/(tabs)/home',
};

export const ONBOARDING_STEP_INDEX: Partial<Record<OnboardingStep, number>> =
  ONBOARDING_STEPS.reduce((acc, step, index) => {
    acc[step] = index;
    return acc;
  }, {} as Partial<Record<OnboardingStep, number>>);

export function nextStep(step: OnboardingStep): OnboardingStep {
  const index = ONBOARDING_STEP_INDEX[step];
  if (index === undefined) return 'goals';
  return ONBOARDING_STEPS[index + 1] ?? 'complete';
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
  const index = ONBOARDING_STEP_INDEX[step];
  if (index === undefined || index === 0) return null;
  return ONBOARDING_STEPS[index - 1] ?? null;
}

/** Where a returning user should land. */
export function resumeStep(onboarding: OnboardingState): OnboardingStep {
  if (onboarding.completed) return 'complete';
  return ONBOARDING_STEP_INDEX[onboarding.currentStep] === undefined
    ? 'goals'
    : onboarding.currentStep;
}

export function progressFor(step: OnboardingStep): { index: number; total: number } {
  const index = ONBOARDING_STEP_INDEX[step] ?? 0;
  return { index: index + 1, total: ONBOARDING_STEPS.length };
}

export interface OnboardingDraft {
  preferences: UserPreferences;
  selectedRecipeIds: string[];
  /** Only the name step cares; optional so data-only callers stay simple. */
  displayName?: string;
}

/** Gate for the Continue button on each step. */
export function canAdvanceFrom(step: OnboardingStep, draft: OnboardingDraft): boolean {
  const { preferences, selectedRecipeIds } = draft;
  switch (step) {
    case 'name':
      return (draft.displayName ?? '').trim().length > 0;
    case 'goals':
      return Boolean(preferences.primaryGoal);
    case 'obstacles':
      return preferences.obstacles.length > 0;
    case 'statements':
      return Boolean(
        preferences.statements && Object.values(preferences.statements).length >= 5,
      );
    case 'preferences':
      return preferences.interests.length > 0;
    case 'dietary':
      return Boolean(preferences.dietaryPattern);
    case 'supermarkets':
      return (preferences.supermarkets ?? []).length > 0;
    case 'recipe-discovery':
      return selectedRecipeIds.length === INITIAL_PLAN_SIZE;
    case 'initial-plan':
      return selectedRecipeIds.length === INITIAL_PLAN_SIZE;
    case 'shopping-preview':
      return true;
    default:
      return false;
  }
}

/** All steps before `step` are valid — used to block deep links into later steps. */
export function isStepReachable(step: OnboardingStep, draft: OnboardingDraft): boolean {
  const target = ONBOARDING_STEP_INDEX[step];
  if (target === undefined) return false;
  for (let index = 0; index < target; index += 1) {
    if (!canAdvanceFrom(ONBOARDING_STEPS[index], draft)) return false;
  }
  return true;
}

export const ONBOARDING_TITLES: Record<OnboardingStep, { title: string; subtitle?: string }> = {
  name: {
    title: "First things first — what's your name?",
    subtitle: 'So the app can say hi properly.',
  },
  goals: { title: 'What are you trying to achieve?' },
  obstacles: { title: 'What prevents you from doing that?', subtitle: 'Choose everything that sounds familiar.' },
  statements: { title: 'Which statements do you relate to?' },
  preferences: { title: 'What do you like?', subtitle: 'Let us know to personalize your experience.' },
  dietary: { title: 'Any dietary requirements?' },
  supermarkets: {
    title: 'Where do you shop?',
    subtitle: 'Pick every shop you use — we price each dish at the cheapest one.',
  },
  'recipe-discovery': {
    title: "Let's find your first three meals.",
    subtitle: 'Swipe through delicious recipes picked just for you.',
  },
  'initial-plan': { title: 'Your first meal plan is ready!' },
  'shopping-preview': {
    title: 'Your shopping list is ready!',
    subtitle: 'Your ingredients, organized and ready to shop.',
  },
  complete: { title: 'All set!' },
};
