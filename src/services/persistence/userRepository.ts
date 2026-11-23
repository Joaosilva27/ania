import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserData, UserProfile } from '@/types';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { loadUserDataFromFirestore, saveUserDataToFirestore } from '@/services/firebase/firestore';

const USER_CACHE_PREFIX = '@ania/user/';
const SESSION_KEY = '@ania/session';

export type PersistResult = 'saved' | 'pending' | 'error';

function cacheKey(uid: string): string {
  return `${USER_CACHE_PREFIX}${uid}`;
}

export async function readCachedUser(uid: string): Promise<UserData | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserData;
    if (!parsed?.profile) return null;
    return parsed;
  } catch (error) {
    console.warn('[persistence] failed to read cache', error);
    return null;
  }
}

export async function writeCachedUser(data: UserData): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(data.profile.uid), JSON.stringify(data));
  } catch (error) {
    console.warn('[persistence] failed to write cache', error);
  }
}

/**
 * Remote first (when Firebase is configured), then the local cache so a
 * returning user still gets their plan with no connection.
 */
export async function loadUserData(uid: string): Promise<UserData | null> {
  if (isFirebaseConfigured) {
    const remote = await loadUserDataFromFirestore(uid);
    if (remote) {
      await writeCachedUser(remote);
      return remote;
    }
  }
  return readCachedUser(uid);
}

/**
 * Always write locally; then attempt Firestore. A failed cloud write is
 * reported as `pending` so the UI can say "saved on this device, syncing".
 */
export async function persistUserData(data: UserData): Promise<PersistResult> {
  await writeCachedUser(data);
  if (!isFirebaseConfigured || data.profile.isPreview) return 'saved';
  try {
    await saveUserDataToFirestore(data);
    return 'saved';
  } catch (error) {
    console.warn('[persistence] cloud save failed, kept locally', error);
    return 'pending';
  }
}

/* --------------------------- preview session --------------------------- */

export async function savePreviewSession(profile: UserProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn('[persistence] failed to save preview session', error);
  }
}

export async function readPreviewSession(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    return parsed?.uid ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearPreviewSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export async function clearCachedUser(uid: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(cacheKey(uid));
  } catch {
    /* ignore */
  }
}
