import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PrimaryButton } from '@/components/ui/Button';
import { Heart } from '@/components/cute/Decor';
import { PRICE_NOTE, SUPERMARKETS } from '@/data/supermarkets';
import { useOnboardingNav } from '@/hooks/useOnboardingNav';
import { toggleSupermarket } from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import { colors, radius, spacing, type } from '@/theme';

export default function SupermarketsScreen() {
  const mutate = useUserStore((state) => state.mutate);
  // Select the stored array itself: returning a fresh `[]` fallback from a
  // selector makes React think the snapshot changed on every render.
  const selected = useUserStore((state) => state.data?.preferences.supermarkets) ?? [];
  const { canContinue, goNext, goBack } = useOnboardingNav('supermarkets');

  return (
    <OnboardingScaffold
      step="supermarkets"
      onBack={goBack}
      footer={
        <PrimaryButton
          label="Continue"
          icon="arrow-right"
          onPress={goNext}
          disabled={!canContinue}
        />
      }
    >
      {SUPERMARKETS.map((market) => {
        const active = selected.includes(market.id);
        return (
          <Pressable
            key={market.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={market.name}
            onPress={() => mutate((data) => toggleSupermarket(data, market.id))}
            style={({ pressed }) => [
              styles.row,
              active && { borderColor: market.accent, backgroundColor: market.tint },
              { opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: market.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={[type.bodyMedium, { color: colors.ink }]}>{market.name}</Text>
              <Text style={[type.caption, { color: colors.muted, marginTop: 1 }]}>{market.note}</Text>
            </View>
            {active ? (
              <Heart size={18} filled color={market.accent} />
            ) : (
              <MaterialCommunityIcons name="plus" size={18} color={colors.borderStrong} />
            )}
          </Pressable>
        );
      })}

      <Text style={[type.noteTiny, styles.note]}>
        {selected.length
          ? 'We compare these shops on every recipe and always quote the cheapest.'
          : 'Choose at least one shop to see prices.'}
      </Text>
      <Text style={[type.noteTiny, styles.note]}>{PRICE_NOTE}</Text>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  dot: { width: 12, height: 12, borderRadius: radius.pill },
  note: { color: colors.muted, marginTop: spacing.xs },
});
