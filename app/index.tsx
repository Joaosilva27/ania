import { Redirect } from 'expo-router';
import React from 'react';
import { LoadingState, ScreenContainer } from '@/components/ui/Screen';
import { ONBOARDING_ROUTE } from '@/services/onboarding';
import { useAuthStore } from '@/store/authStore';
import { useUserStore } from '@/store/userStore';

export default function IndexScreen() {
  const status = useAuthStore((state) => state.status);
  const data = useUserStore((state) => state.data);

  if (status === 'loading' || (status === 'signedIn' && !data)) {
    return (
      <ScreenContainer>
        <LoadingState label="Setting the table…" />
      </ScreenContainer>
    );
  }

  if (status === 'signedOut') {
    return <Redirect href="/auth/welcome" />;
  }

  if (!data?.onboarding.completed) {
    return <Redirect href={(ONBOARDING_ROUTE[data?.onboarding.currentStep ?? 'name']) as never} />;
  }

  // Finished setup but still no name (fresh profile, or an old demo profile that
  // only had the placeholder): ask for it before showing the app.
  if (!data.profile.displayName.trim()) {
    return <Redirect href="/onboarding/name" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
