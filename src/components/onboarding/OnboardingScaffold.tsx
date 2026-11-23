import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Heart } from '@/components/cute/Decor';
import { IconButton } from '@/components/ui/Button';
import { ScreenContainer } from '@/components/ui/Screen';
import { ONBOARDING_TITLES, progressFor } from '@/services/onboarding';
import { setOnboardingStep } from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import { colors, radius, spacing, type } from '@/theme';
import type { OnboardingStep } from '@/types';

export function OnboardingScaffold({
  step,
  children,
  footer,
  onBack,
  scroll = true,
  headerRight,
}: {
  step: OnboardingStep;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onBack?: () => void;
  scroll?: boolean;
  headerRight?: React.ReactNode;
}) {
  const mutate = useUserStore((state) => state.mutate);
  const { index, total } = progressFor(step);
  const meta = ONBOARDING_TITLES[step];

  // Resume support: landing on a step records it, so closing the app mid-flow
  // returns the user exactly here.
  useEffect(() => {
    mutate((data) =>
      data.onboarding.currentStep === step ? data : setOnboardingStep(data, step),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <ScreenContainer scroll={scroll} footer={footer} edges={['top']}>
      <View style={styles.headerRow}>
        {onBack ? (
          <IconButton
            icon="arrow-left"
            accessibilityLabel="Go back"
            onPress={onBack}
            background={colors.surface}
            bordered
            size={20}
          />
        ) : (
          <View style={{ width: 44 }} />
        )}
        <Text style={[type.noteTiny, styles.stepLabel]}>
          step {index} of {total}
        </Text>
        <View style={styles.headerRight}>{headerRight}</View>
      </View>

      <View style={styles.heartRow}>
        {Array.from({ length: total }).map((_, stepIndex) => (
          <Heart
            key={stepIndex}
            size={14}
            filled={stepIndex < index}
            color={stepIndex < index ? colors.primaryDeep : colors.borderStrong}
          />
        ))}
      </View>

      <Text style={[type.onboardingTitle, styles.title]}>{meta.title}</Text>
      {meta.subtitle ? (
        <Text style={[type.body, styles.subtitle]}>{meta.subtitle}</Text>
      ) : null}

      <View style={styles.content}>{children}</View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  stepLabel: { color: colors.primaryDeep, letterSpacing: 0.2 },
  headerRight: { width: 44, alignItems: 'flex-end' },
  heartRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  title: { color: colors.ink, marginTop: spacing.xl },
  subtitle: { color: colors.muted, marginTop: spacing.xs },
  content: { marginTop: spacing.xl, gap: spacing.sm, flex: 1 },
});
