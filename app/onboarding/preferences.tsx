import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PrimaryButton } from '@/components/ui/Button';
import { INTERESTS } from '@/data/taxonomy';
import { useOnboardingNav } from '@/hooks/useOnboardingNav';
import { toggleInterest } from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import { colors, gradients, radius, shadows, spacing, type } from '@/theme';

/** Each tile gets its own candy wrapper so the grid reads like a sticker sheet. */
const TINTS = [
  { bg: colors.primarySoft, ink: colors.primaryDeep },
  { bg: colors.lavenderSoft, ink: colors.lavenderDeep },
  { bg: colors.mintSoft, ink: colors.mintDeep },
  { bg: colors.butterSoft, ink: colors.butterDeep },
  { bg: colors.accentSoft, ink: colors.accentDeep },
  { bg: colors.surfaceTint, ink: colors.primaryDeep },
  { bg: colors.surfaceMuted, ink: colors.inkSoft },
] as const;

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
        {INTERESTS.map((interest, index) => {
          const selected = Boolean(preferences?.interests.includes(interest.id));
          const tint = TINTS[index % TINTS.length];
          return (
            <Pressable
              key={interest.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={interest.label}
              onPress={() => mutate((data) => toggleInterest(data, interest.id))}
              style={({ pressed }) => [
                styles.tileShell,
                {
                  borderColor: selected ? colors.primaryDeep : colors.white,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
                selected ? shadows.soft : null,
              ]}
            >
              <LinearGradient
                colors={selected ? gradients.button : [tint.bg, tint.bg]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tile}
              >
                <View style={styles.tileTop}>
                  <View
                    style={[
                      styles.tileIcon,
                      { backgroundColor: selected ? 'rgba(255,255,255,0.28)' : colors.white },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={interest.icon as never}
                      size={20}
                      color={selected ? colors.white : tint.ink}
                    />
                  </View>
                  {selected ? (
                    <View style={styles.check}>
                      <MaterialCommunityIcons name="heart" size={14} color={colors.primaryDeep} />
                    </View>
                  ) : null}
                </View>
                <Text
                  style={[
                    type.cardTitle,
                    { color: selected ? colors.white : colors.ink, marginTop: spacing.sm },
                  ]}
                >
                  {interest.label}
                </Text>
              </LinearGradient>
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
  tileShell: {
    width: '47.5%',
    borderRadius: radius.lg,
    borderWidth: 2.5,
    overflow: 'hidden',
  },
  tile: {
    minHeight: 112,
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
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { color: colors.muted, marginTop: spacing.md },
});
