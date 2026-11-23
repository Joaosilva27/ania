import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PrimaryButton } from '@/components/ui/Button';
import { INTERESTS } from '@/data/taxonomy';
import { useOnboardingNav } from '@/hooks/useOnboardingNav';
import { toggleInterest } from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import { colors, radius, spacing, type } from '@/theme';

export default function PreferencesScreen() {
  const mutate = useUserStore((state) => state.mutate);
  const preferences = useUserStore((state) => state.data?.preferences);
  const { canContinue, goNext, goBack } = useOnboardingNav('preferences');

  return (
    <OnboardingScaffold
      step="preferences"
      onBack={goBack}
      footer={<PrimaryButton label="Continue" onPress={goNext} disabled={!canContinue} icon="arrow-right" />}
    >
      <View style={styles.grid}>
        {INTERESTS.map((interest) => {
          const selected = Boolean(preferences?.interests.includes(interest.id));
          return (
            <Pressable
              key={interest.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={interest.label}
              onPress={() => mutate((data) => toggleInterest(data, interest.id))}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: selected ? colors.ink : colors.surface,
                  borderColor: selected ? colors.ink : colors.border,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <View style={styles.tileTop}>
                <View style={[styles.tileIcon, { backgroundColor: selected ? 'rgba(250,248,242,0.14)' : colors.surfaceMuted }]}>
                  <MaterialCommunityIcons
                    name={interest.icon as never}
                    size={20}
                    color={selected ? colors.sage : colors.greenDeep}
                  />
                </View>
                {selected ? (
                  <View style={styles.check}>
                    <MaterialCommunityIcons name="check" size={13} color={colors.greenInk} />
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  type.cardTitle,
                  { color: selected ? colors.background : colors.ink, marginTop: spacing.sm },
                ]}
              >
                {interest.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[type.caption, styles.hint]}>
        Choose as many as you like. You can change these later in your profile.
      </Text>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '47.5%',
    minHeight: 112,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { color: colors.muted, marginTop: spacing.md },
});
