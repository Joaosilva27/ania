import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import { firebaseConfig, isFirebaseConfigured } from './config';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let cached: FirebaseServices | null = null;

/**
 * Lazily initialises Firebase exactly once. Returns null when the project has
 * no credentials, which is what drives preview mode.
 */
export function getFirebaseServices(): FirebaseServices | null {
  if (!isFirebaseConfigured) return null;
  if (cached) return cached;

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  let auth: Auth;
  try {
    const getReactNativePersistence = (
      firebaseAuth as unknown as {
        getReactNativePersistence?: (storage: unknown) => unknown;
      }
    ).getReactNativePersistence;
    if (Platform.OS !== 'web' && getReactNativePersistence) {
      auth = firebaseAuth.initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage) as never,
      });
    } else {
      auth = firebaseAuth.getAuth(app);
    }
  } catch {
    auth = firebaseAuth.getAuth(app);
  }

  cached = { app, auth, db: getFirestore(app) };
  return cached;
}
