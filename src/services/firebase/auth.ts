import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import type { UserProfile } from '@/types';
import { getFirebaseServices } from './client';

export function toProfile(user: User): UserProfile {
  const now = new Date().toISOString();
  return {
    uid: user.uid,
    displayName: user.displayName?.trim() || 'Cook',
    email: user.email ?? '',
    avatarUrl: user.photoURL ?? null,
    createdAt: user.metadata?.creationTime
      ? new Date(user.metadata.creationTime).toISOString()
      : now,
    lastLoginAt: now,
    isPreview: false,
  };
}

/** Native (Expo) flow: exchange an OAuth id_token for a Firebase session. */
export async function signInWithGoogleIdToken(idToken: string): Promise<UserProfile> {
  const services = getFirebaseServices();
  if (!services) throw new Error('Firebase is not configured.');
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(services.auth, credential);
  return toProfile(result.user);
}

/** Web flow: popup-based Google sign-in. */
export async function signInWithGooglePopup(): Promise<UserProfile> {
  const services = getFirebaseServices();
  if (!services) throw new Error('Firebase is not configured.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(services.auth, provider);
  return toProfile(result.user);
}

export function subscribeToAuthState(
  callback: (profile: UserProfile | null) => void,
): () => void {
  const services = getFirebaseServices();
  if (!services) return () => undefined;
  return onAuthStateChanged(services.auth, (user) => {
    callback(user ? toProfile(user) : null);
  });
}

export async function signOutOfFirebase(): Promise<void> {
  const services = getFirebaseServices();
  if (!services) return;
  await signOut(services.auth);
}
