import { create } from 'zustand';
import { getRecipeById } from '@/data/recipes';
import { persistUserData } from '@/services/persistence/userRepository';
import type { SyncState, UserData } from '@/types';

type Mutator = (data: UserData) => UserData;

interface UserState {
  data: UserData | null;
  syncState: SyncState;
  hydrated: boolean;
  error: string | null;
  hydrate: (data: UserData | null) => void;
  mutate: (mutator: Mutator) => void;
  flush: () => Promise<void>;
  setError: (error: string | null) => void;
  reset: () => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let queued: UserData | null = null;
let flushing: Promise<void> | null = null;

async function flushQueue(): Promise<void> {
  if (!queued) return;
  const snapshot = queued;
  queued = null;
  try {
    const result = await persistUserData(snapshot);
    if (result === 'pending') {
      useUserStore.setState({ syncState: 'pending' });
    } else if (result === 'error') {
      useUserStore.setState({ syncState: 'error' });
    } else if (useUserStore.getState().syncState !== 'saving') {
      useUserStore.setState({ syncState: 'idle' });
    } else {
      useUserStore.setState({ syncState: 'idle' });
    }
  } catch (error) {
    console.warn('[store] persist failed', error);
    useUserStore.setState({ syncState: 'error', error: 'Could not save your changes.' });
  }
}

function scheduleSave(data: UserData) {
  queued = data;
  useUserStore.setState({ syncState: 'saving' });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushing = flushQueue().finally(() => {
      flushing = null;
    });
  }, 300);
}

export const useUserStore = create<UserState>((set, get) => ({
  data: null,
  syncState: 'idle',
  hydrated: false,
  error: null,

  hydrate: (data) => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    queued = null;
    // The bundled catalogue can change between sessions (imports), so drop plan
    // entries that no longer point at a recipe instead of showing phantom meals.
    const known = data
      ? {
          ...data,
          plan: {
            ...data.plan,
            items: data.plan.items.filter((item) => Boolean(getRecipeById(item.recipeId))),
          },
        }
      : null;
    set({ data: known, hydrated: Boolean(known), syncState: 'idle', error: null });
  },

  mutate: (mutator) => {
    const current = get().data;
    if (!current) return;
    const next = mutator(current);
    if (next === current) return;
    set({ data: next });
    scheduleSave(next);
  },

  flush: async () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (flushing) await flushing;
    await flushQueue();
  },

  setError: (error) => set({ error }),
  reset: () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    queued = null;
    set({ data: null, hydrated: false, syncState: 'idle', error: null });
  },
}));

export function useUserData(): UserData | null {
  return useUserStore((state) => state.data);
}

export function usePreferences() {
  return useUserStore((state) => state.data?.preferences ?? null);
}

export function useMealPlan() {
  return useUserStore((state) => state.data?.plan ?? null);
}
