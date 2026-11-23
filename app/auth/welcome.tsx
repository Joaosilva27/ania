import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND_IMAGES } from '@/assets/brandImages';
import { Heart, ScallopEdge, Sparkle } from '@/components/cute/Decor';
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
          <View style={styles.brandRow}>
            <Text style={styles.wordmark}>ania</Text>
            <MaterialCommunityIcons name="heart" size={15} color="rgba(255,255,255,0.92)" />
          </View>
          <Text style={styles.heroKicker}>Budget cooking, sorted</Text>
        </SafeAreaView>
      </View>

      <View style={styles.sheetWrap}>
        <ScallopEdge color={colors.background} height={16} scallop={22} flip style={styles.lace} />
        <ScrollView
          style={styles.sheet}
          contentContainerStyle={[styles.sheetContent, { paddingBottom: insets.bottom + spacing.xl }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.grabber} />
          <View style={styles.kickerRow}>
            <Sparkle size={13} color={colors.primary} />
            <Text style={[type.scriptSmall, { color: colors.primaryDeep }]}>cooking, but cuter</Text>
            <Sparkle size={13} color={colors.butter} />
          </View>
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
            variant="secondary"
            onPress={() => router.push('/auth/how-it-works')}
          />

          <View style={styles.proofRow}>
            <Heart size={12} color={colors.primary} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: { width: '100%', backgroundColor: colors.surfaceMuted },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(59, 39, 51, 0.26)',
  },
  heroTop: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
    paddingBottom: spacing.xxl,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
  sheetWrap: { flex: 1, marginTop: -16 },
  lace: { zIndex: 2 },
  sheet: {
    flex: 1,
    backgroundColor: colors.background,
    ...shadows.floating,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 2,
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
  legal: { color: colors.muted, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.md },
});
