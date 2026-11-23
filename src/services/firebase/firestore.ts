import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import type { UserData, UserProfile } from '@/types';
import { SCHEMA_VERSION } from '@/types';
import { getFirebaseServices } from './client';

/**
 * Firestore layout (see README + firestore.rules):
 *
 *   users/{uid}                  -> profile, preferences, onboarding, plan, shopping
 *   users/{uid}/feedback/{rid}   -> swipe history
 *   users/{uid}/favorites/{rid}  -> saved recipes
 *   recipes/{recipeId}           -> public catalogue (read-only for clients)
 *   ingredients/{ingredientId}   -> public taxonomy (read-only for clients)
 */
export async function loadUserDataFromFirestore(uid: string): Promise<UserData | null> {
  const services = getFirebaseServices();
  if (!services) return null;
  try {
    const snapshot = await getDoc(doc(services.db, 'users', uid));
    if (!snapshot.exists()) return null;
    const payload = snapshot.data() as Partial<UserData> & { schemaVersion?: number };
    if (!payload || !payload.profile) return null;
    if ((payload.schemaVersion ?? 0) > SCHEMA_VERSION) return null;
    return {
      ...(payload as UserData),
      schemaVersion: SCHEMA_VERSION,
    };
  } catch (error) {
    console.warn('[firestore] loadUserData failed', error);
    return null;
  }
}

export async function saveUserDataToFirestore(data: UserData): Promise<void> {
  const services = getFirebaseServices();
  if (!services) return;
  const { profile, preferences, onboarding, plan, shopping, feedback, favorites } = data;
  await setDoc(
    doc(services.db, 'users', profile.uid),
    {
      profile,
      preferences,
      onboarding,
      plan,
      shopping,
      feedback,
      favorites,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function upsertProfile(profile: UserProfile): Promise<void> {
  const services = getFirebaseServices();
  if (!services) return;
  await setDoc(
    doc(services.db, 'users', profile.uid),
    { profile, schemaVersion: SCHEMA_VERSION },
    { merge: true },
  );
}
