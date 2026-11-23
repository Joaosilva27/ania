import { Stack } from 'expo-router';
import React from 'react';
import { colors } from '@/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="how-it-works" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
