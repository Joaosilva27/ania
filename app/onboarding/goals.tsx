import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PrimaryButton } from '@/components/ui/Button';
import { SelectableCard, TagBadge } from '@/components/ui/Chip';
import { GOALS } from '@/data/taxonomy';
import { useOnboardingNav } from '@/hooks/useOnboardingNav';
import { setPrimaryGoal } from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import { colors, radius, spacing, type } from '@/theme';

export default function GoalsScreen() {
  const mutate = useUserStore((state) => state.mutate);
  const preferences = useUserStore((state) => state.data?.preferences);
  const { canContinue, goNext, goBack } = useOnboardingNav('goals');

  return (
    <OnboardingScaffold
      step="goals"
      onBack={goBack}
      footer={
        <PrimaryButton
          label="Continue"
          onPress={goNext}
          disabled={!canContinue}
          icon="arrow-right"
        />
      }
    >
      <Text style={[type.caption, styles.hint]}>Choose the one that matters most right now.</Text>

      {GOALS.map((goal, index) => (
        <View key={goal.id} style={styles.wrap}>
          <SelectableCard
            title={goal.label}
            description={goal.description}
            icon={goal.icon as never}
            selected={preferences?.primaryGoal === goal.id}
            onPress={() => mutate((data) => setPrimaryGoal(data, goal.id))}
          />
          {index === 0 ? (
            <View style={styles.badge}>
              <TagBadge label="Most popular" tone="green" />
            </View>
          ) : null}
        </View>
      ))}
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, marginBottom: spacing.xs },
  wrap: { position: 'relative' },
  badge: { position: 'absolute', right: spacing.md, top: -8, backgroundColor: colors.background, paddingHorizontal: 4, borderRadius: radius.sm },
});
