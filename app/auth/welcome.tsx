import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND_IMAGES } from '@/assets/brandImages';
import { PrimaryButton, TextButton } from '@/components/ui/Button';
import { Banner, ErrorState } from '@/components/ui/Screen';
import { useGoogleSignIn } from '@/hooks/useGoogleSignIn';
import { colors, radius, shadows, spacing, type } from '@/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { signIn, busy, error, previewMode } = useGoogleSignIn();

  const heroHeight = Math.max(320, height * 0.56);

  return (
    <View style={styles.root}>
      <View style={[styles.hero, { height: heroHeight }]}>
        <Image source={BRAND_IMAGES.welcome} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
        <View style={styles.scrim} />
        <SafeAreaView edges={['top']} style={styles.heroTop}>
          <Text style={styles.wordmark}>ania</Text>
          <Text style={styles.heroKicker}>Budget cooking, sorted</Text>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.grabber} />
        <Text style={[type.display, styles.headline]}>
          Good food. Less effort. Better budget.
        </Text>
        <Text style={[type.body, styles.subtitle]}>
          Discover delicious recipes, plan your week, and get everything you need in one shopping
          list.
        </Text>

        {previewMode ? (
          <View style={{ marginBottom: spacing.sm }}>
            <Banner
              tone="warning"
              icon="flask-outline"
              message="Preview mode: Firebase credentials aren't configured, so this session is stored only on this device."
            />
          </View>
        ) : null}

        {error ? (
          <View style={{ marginBottom: spacing.sm }}>
            <ErrorState message={error} actionLabel="Retry" onAction={() => void signIn()} />
          </View>
        ) : null}

        <PrimaryButton
          label="Continue with Google"
          icon="google"
          onPress={() => void signIn()}
          loading={busy}
        />
        <PrimaryButton
          label="Explore how it works"
          variant="ghost"
          onPress={() => router.push('/auth/how-it-works')}
        />

        <View style={styles.proofRow}>
          <MaterialCommunityIcons name="leaf" size={14} color={colors.greenDeep} />
          <Text style={[type.caption, styles.proofText]}>
            44 original recipes · real shopping lists · no subscription
          </Text>
        </View>

        <Text style={[type.caption, styles.legal]}>
          By continuing you agree to our friendly use of your name, email and profile photo to
          create your account.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { width: '100%', backgroundColor: colors.surfaceMuted },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(24, 26, 21, 0.22)',
  },
  heroTop: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
    paddingBottom: spacing.xxl,
  },
  wordmark: {
    fontFamily: type.display.fontFamily,
    fontSize: 34,
    color: colors.white,
    letterSpacing: -0.5,
  },
  heroKicker: {
    fontFamily: type.label.fontFamily,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.92)',
  },
  sheet: {
    flex: 1,
    marginTop: -radius.xl,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadows.floating,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  grabber: {
    width: 42,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headline: { color: colors.ink, marginBottom: spacing.xs },
  subtitle: { color: colors.inkSoft, marginBottom: spacing.md },
  proofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  proofText: { color: colors.muted },
  legal: { color: colors.faint, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.md },
});
