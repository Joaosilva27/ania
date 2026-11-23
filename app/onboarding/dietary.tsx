import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PrimaryButton } from '@/components/ui/Button';
import { SelectableCard } from '@/components/ui/Chip';
import { DIETARY_OPTIONS } from '@/data/taxonomy';
import { useOnboardingNav } from '@/hooks/useOnboardingNav';
import { dietConfidenceNote } from '@/services/dietary';
import { setDietaryPattern } from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import { colors, radius, spacing, type } from '@/theme';

export default function DietaryScreen() {
  const mutate = useUserStore((state) => state.mutate);
  const preferences = useUserStore((state) => state.data?.preferences);
  const { canContinue, goNext, goBack } = useOnboardingNav('dietary');
  const selected = preferences?.dietaryPattern ?? 'none';

  return (
    <OnboardingScaffold
      step="dietary"
      onBack={goBack}
      footer={<PrimaryButton label="Continue" onPress={goNext} disabled={!canContinue} icon="arrow-right" />}
    >
      <Text style={[type.caption, styles.hint]}>
        Pick the one that best describes how you eat. Dietary rules are applied before anything
        else, so a high-protein preference never overrides a veggie choice.
      </Text>

      {DIETARY_OPTIONS.map((option) => (
        <SelectableCard
          key={option.id}
          title={option.label}
          description={option.description}
          icon={option.icon as never}
          selected={selected === option.id}
          onPress={() => mutate((data) => setDietaryPattern(data, option.id))}
        />
      ))}

      <View style={styles.note}>
        <Text style={[type.caption, { color: colors.inkSoft }]}>{dietConfidenceNote(selected)}</Text>
      </View>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, marginBottom: spacing.xs },
  note: {
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
