import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  addRecipeToPlan,
  recordFeedback,
  removeRecipeFromPlan,
  toggleFavorite,
  updatePlanServings,
} from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import type { Recipe, UserData } from '@/types';

/** Stable identity: a fresh object here would make the store snapshot unstable. */
const EMPTY_FAVORITES: UserData['favorites'] = {};

/** Shared plan/favourite actions so every screen updates the same state. */
export function useRecipeActions() {
  const router = useRouter();
  const mutate = useUserStore((state) => state.mutate);
  const plan = useUserStore((state) => state.data?.plan);
  const favorites = useUserStore((state) => state.data?.favorites);

  const inPlan = useCallback(
    (recipeId: string) => Boolean(plan?.items.some((item) => item.recipeId === recipeId)),
    [plan],
  );

  const addToPlan = useCallback(
    (recipe: Recipe, source = 'recommendation') => {
      mutate((current) => {
        if (current.plan.items.some((item) => item.recipeId === recipe.id)) return current;
        return recordFeedback(
          addRecipeToPlan(current, recipe.id, source, recipe.servings),
          recipe.id,
          'accepted',
          source,
        );
      });
    },
    [mutate],
  );

  const removeFromPlan = useCallback(
    (recipeId: string) => mutate((current) => removeRecipeFromPlan(current, recipeId)),
    [mutate],
  );

  const setServings = useCallback(
    (recipeId: string, servings: number) =>
      mutate((current) => updatePlanServings(current, recipeId, servings)),
    [mutate],
  );

  const toggleFavoriteRecipe = useCallback(
    (recipeId: string) => mutate((current) => toggleFavorite(current, recipeId)),
    [mutate],
  );

  const openRecipe = useCallback(
    (recipeId: string) => router.push(`/recipe/${recipeId}`),
    [router],
  );

  return {
    inPlan,
    addToPlan,
    removeFromPlan,
    setServings,
    toggleFavoriteRecipe,
    openRecipe,
    favorites: favorites ?? EMPTY_FAVORITES,
  };
}
