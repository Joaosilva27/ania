import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PrimaryButton } from '@/components/ui/Button';
import { SelectableCard } from '@/components/ui/Chip';
import { OBSTACLES } from '@/data/taxonomy';
import { useOnboardingNav } from '@/hooks/useOnboardingNav';
import { toggleObstacle } from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import { colors, spacing, type } from '@/theme';

export default function ObstaclesScreen() {
  const mutate = useUserStore((state) => state.mutate);
  const preferences = useUserStore((state) => state.data?.preferences);
  const { canContinue, goNext, goBack } = useOnboardingNav('obstacles');

  return (
    <OnboardingScaffold
      step="obstacles"
      onBack={goBack}
      footer={<PrimaryButton label="Continue" onPress={goNext} disabled={!canContinue} icon="arrow-right" />}
    >
      <Text style={[type.caption, styles.hint]}>
        Pick as many as apply — these shape the recipes we put in front of you.
      </Text>

      {OBSTACLES.map((obstacle) => (
        <SelectableCard
          key={obstacle.id}
          title={obstacle.label}
          icon={obstacle.icon as never}
          multi
          selected={Boolean(preferences?.obstacles.includes(obstacle.id))}
          onPress={() => mutate((data) => toggleObstacle(data, obstacle.id))}
        />
      ))}
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, marginBottom: spacing.xs },
});
