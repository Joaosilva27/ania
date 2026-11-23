import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { signInWithGoogleIdToken, signInWithGooglePopup } from '@/services/firebase/auth';
import { googleClientIds, isFirebaseConfigured, isGoogleConfigured } from '@/services/firebase/config';
import { useAuthStore } from '@/store/authStore';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

/**
 * Google sign-in for both native (expo-auth-session + Firebase credential) and
 * web (Firebase popup). Falls back to the local preview identity only when no
 * Firebase project has been configured.
 */
export function useGoogleSignIn() {
  const completeGoogleSignIn = useAuthStore((state) => state.completeGoogleSignIn);
  const signInPreview = useAuthStore((state) => state.signInPreview);
  const setError = useAuthStore((state) => state.setError);
  const storeError = useAuthStore((state) => state.error);
  const [busy, setBusy] = useState(false);

  const redirectUri = useMemo(
    () => AuthSession.makeRedirectUri({ scheme: 'ania', path: 'auth' }),
    [],
  );
  const nonce = useMemo(() => {
    try {
      return Crypto.randomUUID();
    } catch {
      return `nonce-${Date.now()}`;
    }
  }, []);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: googleClientIds.web || 'google-client-not-configured',
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.IdToken,
      redirectUri,
      extraParams: { nonce, prompt: 'select_account' },
      usePKCE: false,
    },
    discovery,
  );

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params.id_token || response.params.idToken;
      if (!idToken) {
        setError('Google did not return an ID token. Check the OAuth client configuration.');
        return;
      }
      setBusy(true);
      signInWithGoogleIdToken(idToken)
        .then((profile) => completeGoogleSignIn(profile))
        .catch((error: unknown) => {
          console.warn('[auth] credential exchange failed', error);
          setError(
            'Google sign-in could not be completed. Check that this app is authorized in Firebase.',
          );
        })
        .finally(() => setBusy(false));
    } else if (response.type === 'error') {
      setError(response.error?.message ?? 'Google sign-in was interrupted.');
    }
  }, [response, completeGoogleSignIn, setError]);

  const signIn = useCallback(async () => {
    setError(null);

    if (!isFirebaseConfigured) {
      // Explicit local preview: no Firebase project, no cloud session.
      await signInPreview();
      return;
    }

    if (!isGoogleConfigured) {
      setError('Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to your .env to enable Google sign-in.');
      return;
    }

    try {
      if (Platform.OS === 'web') {
        setBusy(true);
        const profile = await signInWithGooglePopup();
        await completeGoogleSignIn(profile);
      } else {
        if (!request) {
          setError('Preparing Google sign-in… please try again in a moment.');
          return;
        }
        setBusy(true);
        const result = await promptAsync();
        if (result.type === 'dismiss' || result.type === 'cancel') {
          setBusy(false);
        }
      }
    } catch (error) {
      console.warn('[auth] google sign-in failed', error);
      const message = error instanceof Error ? error.message : 'Google sign-in failed.';
      setError(message);
      setBusy(false);
    }
  }, [completeGoogleSignIn, promptAsync, request, setError, signInPreview]);

  return {
    signIn,
    busy,
    error: storeError,
    /** Firebase credentials absent: the app is a local-only preview. */
    previewMode: !isFirebaseConfigured,
    ready: Boolean(request) || Platform.OS === 'web' || !isFirebaseConfigured,
  };
}
