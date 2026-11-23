import { useMemo } from 'react';
import { buildShoppingList } from '@/services/shopping/aggregate';
import { useUserStore } from '@/store/userStore';

/** The one combined shopping list derived from the live meal plan. */
export function useShoppingList() {
  const data = useUserStore((state) => state.data);
  return useMemo(() => {
    if (!data) return null;
    return buildShoppingList({
      plan: data.plan,
      checked: data.shopping.checked,
      manualItems: data.shopping.manualItems,
    });
  }, [data]);
}
