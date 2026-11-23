import { create } from 'zustand';
import { isFirebaseConfigured, isPreviewMode } from '@/services/firebase/config';
import { subscribeToAuthState, signOutOfFirebase } from '@/services/firebase/auth';
import {
  clearPreviewSession,
  loadUserData,
  persistUserData,
  readPreviewSession,
  savePreviewSession,
} from '@/services/persistence/userRepository';
import { createUserData, PREVIEW_UID, replaceProfile } from '@/services/userData';
import type { UserData, UserProfile } from '@/types';
import { useUserStore } from './userStore';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  method: 'google' | 'preview' | null;
  /** True when Firebase credentials are absent — the app is a local demo. */
  previewMode: boolean;
  busy: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  signInPreview: (displayName?: string) => Promise<void>;
  completeGoogleSignIn: (profile: UserProfile) => Promise<void>;
  signOut: () => Promise<void>;
  setBusy: (busy: boolean) => void;
  setError: (error: string | null) => void;
}

let unsubscribeAuth: (() => void) | null = null;
let bootstrapPromise: Promise<void> | null = null;

function previewProfile(displayName = 'Alex'): UserProfile {
  const now = new Date().toISOString();
  return {
    uid: PREVIEW_UID,
    displayName,
    email: 'preview@ania.local',
    avatarUrl: null,
    createdAt: now,
    lastLoginAt: now,
    isPreview: true,
  };
}

async function startSession(profile: UserProfile): Promise<UserData> {
  const existing = await loadUserData(profile.uid);
  const base = existing ?? createUserData(profile);
  const merged = replaceProfile(base, {
    ...profile,
    createdAt: base.profile.createdAt || profile.createdAt,
    lastLoginAt: new Date().toISOString(),
  });
  useUserStore.getState().hydrate(merged);
  await persistUserData(merged);
  return merged;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  method: null,
  previewMode: isPreviewMode,
  busy: false,
  error: null,

  bootstrap: async () => {
    if (bootstrapPromise) return bootstrapPromise;
    bootstrapPromise = (async () => {
      set({ status: 'loading', error: null });

      if (!isFirebaseConfigured) {
        const session = await readPreviewSession();
        if (session) {
          await startSession(session);
          set({ status: 'signedIn', method: 'preview', previewMode: true });
        } else {
          set({ status: 'signedOut', previewMode: true });
        }
        return;
      }

      set({ previewMode: false });
      const fallback = setTimeout(() => {
        if (get().status === 'loading') set({ status: 'signedOut' });
      }, 6000);

      unsubscribeAuth?.();
      let sawUser = false;
      unsubscribeAuth = subscribeToAuthState((profile) => {
        if (profile) {
          sawUser = true;
          clearTimeout(fallback);
          void startSession(profile).then(() => {
            set({ status: 'signedIn', method: 'google', error: null });
          });
        } else if (!sawUser) {
          clearTimeout(fallback);
          set({ status: 'signedOut' });
        }
      });
    })();
    try {
      await bootstrapPromise;
    } finally {
      bootstrapPromise = null;
    }
  },

  signInPreview: async (displayName) => {
    set({ busy: true, error: null });
    try {
      const profile = previewProfile(displayName);
      await savePreviewSession(profile);
      await startSession(profile);
      set({ status: 'signedIn', method: 'preview', busy: false });
    } catch (error) {
      console.warn('[auth] preview sign-in failed', error);
      set({ busy: false, error: 'Could not start the preview session. Please try again.' });
    }
  },

  completeGoogleSignIn: async (profile) => {
    set({ busy: true, error: null });
    try {
      await startSession(profile);
      set({ status: 'signedIn', method: 'google', busy: false });
    } catch (error) {
      console.warn('[auth] session start failed', error);
      set({
        busy: false,
        error: 'Signed in with Google, but your profile could not be loaded. Please retry.',
      });
    }
  },

  signOut: async () => {
    set({ busy: true });
    try {
      await useUserStore.getState().flush();
      if (isFirebaseConfigured) await signOutOfFirebase();
      await clearPreviewSession();
      unsubscribeAuth?.();
      unsubscribeAuth = null;
      useUserStore.getState().reset();
      set({ status: 'signedOut', method: null, busy: false, error: null });
    } catch (error) {
      console.warn('[auth] sign out failed', error);
      set({ busy: false, error: 'Could not sign out cleanly. Please try again.' });
    }
  },

  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),
}));

export function useAuth() {
  return useAuthStore();
}
