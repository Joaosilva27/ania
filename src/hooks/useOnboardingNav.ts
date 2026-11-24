import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { canAdvanceFrom, nextStep, ONBOARDING_ROUTE, previousStep } from '@/services/onboarding';
import { setOnboardingStep } from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import type { OnboardingStep } from '@/types';

export function useOnboardingNav(step: OnboardingStep) {
  const router = useRouter();
  const data = useUserStore((state) => state.data);
  const mutate = useUserStore((state) => state.mutate);

  const draft = {
    preferences: data?.preferences ?? {
      primaryGoal: null,
      obstacles: [],
      interests: [],
      dietaryPattern: 'none' as const,
      statements: null,
      updatedAt: '',
    },
    selectedRecipeIds: data?.onboarding.initialRecipeIds ?? [],
    displayName: data?.profile.displayName ?? '',
  };

  const canContinue = canAdvanceFrom(step, draft);

  const goNext = useCallback(() => {
    // The name step also serves people who already finished setup, so it returns
    // them to the app instead of restarting the questions.
    if (step === 'name' && data?.onboarding.completed) {
      router.replace('/(tabs)/home');
      return;
    }
    const target = nextStep(step);
    mutate((current) => setOnboardingStep(current, target));
    if (target === 'complete') {
      router.replace('/(tabs)/home');
      return;
    }
    router.push(ONBOARDING_ROUTE[target] as never);
  }, [data?.onboarding.completed, mutate, router, step]);

  const goBack = useCallback(() => {
    const target = previousStep(step);
    if (!target) {
      router.replace('/auth/welcome');
      return;
    }
    mutate((current) => setOnboardingStep(current, target));
    router.replace(ONBOARDING_ROUTE[target] as never);
  }, [mutate, router, step]);

  return { canContinue, goNext, goBack, draft, data };
}
