import AsyncStorage from '@react-native-async-storage/async-storage';
import { Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';
import {
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ONBOARDING_ROUTE } from '@/services/onboarding';
import { useAuthStore } from '@/store/authStore';
import { useUserStore } from '@/store/userStore';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

function RouteGuard() {
  const status = useAuthStore((state) => state.status);
  const data = useUserStore((state) => state.data);
  const segments = useSegments();
  const router = useRouter();
  const navigating = useRef(false);

  useEffect(() => {
    if (status === 'loading') return;
    const root = segments[0] ?? '';
    const inAuth = root === 'auth';
    const inOnboarding = root === 'onboarding';
    const isDetailRoute = root === 'recipe' || root === 'settings' || root === 'shopping-list';

    const go = (href: string) => {
      if (navigating.current) return;
      navigating.current = true;
      router.replace(href as never);
      setTimeout(() => {
        navigating.current = false;
      }, 400);
    };

    if (status === 'signedOut') {
      if (!inAuth) go('/auth/welcome');
      return;
    }

    const completed = data?.onboarding.completed ?? false;
    const step = data?.onboarding.currentStep ?? 'goals';

    if (!completed) {
      if (!inOnboarding && !isDetailRoute) {
        go(ONBOARDING_ROUTE[step] ?? ONBOARDING_ROUTE.goals);
      }
      return;
    }

    if (inAuth || inOnboarding) {
      go('/(tabs)/home');
    }
  }, [status, segments, router, data?.onboarding.completed, data?.onboarding.currentStep]);

  return null;
}

function Bootstrap() {
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const status = useAuthStore((state) => state.status);
  const flush = useUserStore((state) => state.flush);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void bootstrap().finally(() => setReady(true));
  }, [bootstrap]);

  useEffect(() => {
    if (!ready || status === 'loading') return;
    SplashScreen.hideAsync().catch(() => undefined);
  }, [ready, status]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        void flush();
      }
    });
    return () => subscription.remove();
  }, [flush]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Caveat_600SemiBold,
    Caveat_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return <View style={styles.loading} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <Bootstrap />
          <RouteGuard />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" options={{ animation: 'fade' }} />
            <Stack.Screen name="auth" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="recipe/[id]" />
            <Stack.Screen name="shopping-list" />
            <Stack.Screen name="settings" />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, backgroundColor: colors.background },
});
