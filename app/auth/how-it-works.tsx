import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/ui/Button';
import { ScreenContainer } from '@/components/ui/Screen';
import { colors, radius, spacing, type } from '@/theme';

const STEPS = [
  {
    icon: 'tune-variant' as const,
    title: 'Tell us how you cook',
    body: 'Five quick questions about your goals, your time and what you like eating.',
  },
  {
    icon: 'gesture-swipe' as const,
    title: 'Swipe your meals',
    body: 'Real recipes matched to your diet and budget. Swipe right on the ones you want.',
  },
  {
    icon: 'basket-outline' as const,
    title: 'Shop once, cook all week',
    body: 'Your shopping list builds itself, merges duplicate ingredients and updates as you plan.',
  },
];

export default function HowItWorksScreen() {
  const router = useRouter();
  return (
    <ScreenContainer
      edges={['top', 'bottom']}
      footer={<PrimaryButton label="Got it" onPress={() => router.back()} />}
    >
      <View style={styles.header}>
        <View style={styles.grabber} />
        <Text style={[type.onboardingTitle, { color: colors.ink }]}>How ania works</Text>
        <Text style={[type.body, { color: colors.inkSoft, marginTop: spacing.xs }]}>
          Three steps between you and a week of sorted dinners.
        </Text>
      </View>

      <View style={styles.steps}>
        {STEPS.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.stepIcon}>
              <MaterialCommunityIcons name={step.icon} size={22} color={colors.primaryInk} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.caption, { color: colors.muted }]}>Step {index + 1}</Text>
              <Text style={[type.cardTitle, { color: colors.ink }]}>{step.title}</Text>
              <Text style={[type.body, { color: colors.inkSoft, marginTop: 4 }]}>{step.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.sm },
  grabber: {
    width: 42,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  steps: { gap: spacing.md, marginTop: spacing.xl },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
