import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { PrimaryButton } from '@/components/ui/Button';
import { useOnboardingNav } from '@/hooks/useOnboardingNav';
import { setDisplayName } from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import { colors, radius, spacing, type } from '@/theme';

/** First thing a new person sees: their own name, so the app can greet them. */
export default function NameScreen() {
  const mutate = useUserStore((state) => state.mutate);
  const displayName = useUserStore((state) => state.data?.profile.displayName ?? '');
  const { canContinue, goNext, goBack } = useOnboardingNav('name');

  return (
    <OnboardingScaffold
      step="name"
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
      <View style={styles.field}>
        <MaterialCommunityIcons
          name="account-heart-outline"
          size={20}
          color={colors.primaryDeep}
        />
        <TextInput
          value={displayName}
          onChangeText={(text) => mutate((data) => setDisplayName(data, text))}
          onSubmitEditing={() => {
            if (canContinue) goNext();
          }}
          placeholder="Your name"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Your name"
          autoFocus
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={30}
          returnKeyType="done"
          selectionColor={colors.primary}
          style={[type.body, styles.input, WEB_NO_OUTLINE]}
        />
      </View>
      <Text style={[type.caption, styles.hint]}>
        Used for greetings and your profile only — nothing is shared.
      </Text>
    </OnboardingScaffold>
  );
}

/** The browser's default focus ring fights the pastel field. */
const WEB_NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as never) : undefined;

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  input: { flex: 1, color: colors.ink, paddingVertical: 6 },
  hint: { color: colors.muted, marginTop: spacing.xs },
});
