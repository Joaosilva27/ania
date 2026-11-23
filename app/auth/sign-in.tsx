import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, TextButton } from '@/components/ui/Button';
import { Banner, ErrorState, ScreenContainer } from '@/components/ui/Screen';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';
import { colors, radius, spacing, type } from '@/theme';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, busy, error, previewMode } = useGoogleSignIn();

  return (
    <ScreenContainer
      edges={['top', 'bottom']}
      footer={
        <View style={{ gap: spacing.xs }}>
          <PrimaryButton
            label="Continue with Google"
            icon="google"
            onPress={() => void signIn()}
            loading={busy}
          />
          <TextButton label="Explore how it works" onPress={() => router.push('/auth/how-it-works')} />
        </View>
      }
    >
      <View style={styles.headerRow}>
        <TextButton label="Back" onPress={() => router.replace('/auth/welcome')} color={colors.muted} />
      </View>

      <View style={styles.body}>
        <View style={styles.badge}>
          <MaterialCommunityIcons name="silverware-fork-knife" size={26} color={colors.greenInk} />
        </View>
        <Text style={[type.onboardingTitle, styles.title]}>Welcome to ania</Text>
        <Text style={[type.body, styles.subtitle]}>
          Sign in to keep your meal plan, favourites and shopping list in sync.
        </Text>

        {error ? (
          <View style={styles.block}>
            <ErrorState message={error} actionLabel="Retry" onAction={() => void signIn()} />
          </View>
        ) : null}

        {previewMode ? (
          <View style={styles.block}>
            <Banner
              tone="warning"
              icon="flask-outline"
              message="Firebase is not configured. Continuing creates a local preview profile on this device only — this is not a real Google sign-in."
            />
          </View>
        ) : null}

        <View style={styles.points}>
          {[
            { icon: 'account-lock-outline' as const, text: 'Your data stays in your own account.' },
            { icon: 'wifi-off' as const, text: 'Your plan and shopping list work offline.' },
            { icon: 'credit-card-off-outline' as const, text: 'No subscription, ever.' },
          ].map((point) => (
            <View key={point.text} style={styles.point}>
              <MaterialCommunityIcons name={point.icon} size={17} color={colors.greenDeep} />
              <Text style={[type.caption, { color: colors.inkSoft, flex: 1 }]}>{point.text}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  body: { flex: 1, justifyContent: 'center', gap: spacing.sm, paddingBottom: spacing.xxl },
  badge: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { color: colors.ink },
  subtitle: { color: colors.inkSoft, marginBottom: spacing.md },
  block: { marginBottom: spacing.xs },
  points: { gap: spacing.sm, marginTop: spacing.md },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
