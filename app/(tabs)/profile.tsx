import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/Chip';
import { Banner, ScreenContainer, SectionHeading } from '@/components/ui/Screen';
import { DIETARY_LABELS, GOAL_LABELS, INTEREST_LABELS } from '@/data/taxonomy';
import { confirmAction } from '@/lib/dialogs';
import { useAuthStore } from '@/store/authStore';
import { useUserStore } from '@/store/userStore';
import { colors, gradients, radius, spacing, type } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const data = useUserStore((state) => state.data);
  const signOut = useAuthStore((state) => state.signOut);
  const previewMode = useAuthStore((state) => state.previewMode);

  if (!data) return null;

  const { profile, preferences, plan, favorites } = data;
  const initial = (profile.displayName || 'You')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const confirmSignOut = () => {
    void confirmAction({
      title: 'Sign out?',
      message: 'Your plan stays saved to your account and returns when you sign back in.',
      confirmLabel: 'Sign out',
      destructive: true,
    }).then((confirmed) => {
      if (confirmed) void signOut();
    });
  };

  return (
    <ScreenContainer scroll bottomSpace={104} contentStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xxl }}>
      <View style={styles.header}>
        {profile.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={[type.sectionTitle, { color: colors.primaryInk }]}>{initial || 'A'}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[type.scriptSmall, { color: colors.primaryDeep }]}>hi again, lovely</Text>
          <Text style={[type.screenTitle, { color: colors.ink, marginTop: -2 }]} numberOfLines={1}>
            {profile.displayName}
          </Text>
          <Text style={[type.caption, { color: colors.muted }]} numberOfLines={1}>
            {profile.email}
          </Text>
        </View>
      </View>

      {previewMode || profile.isPreview ? (
        <View style={{ marginTop: spacing.md }}>
          <Banner
            tone="warning"
            icon="flask-outline"
            message="Local preview profile. Firebase isn't configured, so this account exists only on this device."
          />
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <Stat
          label="Recipes planned"
          value={String(plan.items.length)}
          icon="silverware-fork-knife"
          tone={gradients.candy}
          ink={colors.primaryInk}
        />
        <Stat
          label="Favourites"
          value={String(Object.keys(favorites).length)}
          icon="heart"
          tone={gradients.hero}
          ink={colors.primaryInk}
        />
        <Stat
          label="Interests"
          value={String(preferences.interests.length)}
          icon="flower"
          tone={gradients.lavender}
          ink={colors.lavenderInk}
        />
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <SectionHeading title="Your preferences" />
        <View style={styles.card}>
          <Row icon="target" label="Primary goal" value={preferences.primaryGoal ? GOAL_LABELS[preferences.primaryGoal] : 'Not set'} />
          <Row icon="sprout" label="Diet" value={DIETARY_LABELS[preferences.dietaryPattern]} />
          <Row
            icon="clock-outline"
            label="Obstacles"
            value={preferences.obstacles.length ? `${preferences.obstacles.length} selected` : 'None yet'}
          />
        </View>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Text style={[type.label, { color: colors.muted, marginBottom: spacing.xs }]}>
          Food interests
        </Text>
        {preferences.interests.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
            {preferences.interests.map((interest) => (
              <FilterChip
                key={interest}
                label={INTEREST_LABELS[interest] ?? interest}
                active
                onPress={() => router.push('/settings')}
              />
            ))}
          </ScrollView>
        ) : (
          <Text style={[type.caption, { color: colors.muted }]}>No interests selected yet.</Text>
        )}
      </View>

      <View style={{ gap: spacing.xs, marginTop: spacing.xl }}>
        <PrimaryButton label="Edit preferences" icon="tune-variant" onPress={() => router.push('/settings')} />
        <PrimaryButton
          label="Open shopping list"
          variant="secondary"
          icon="basket-outline"
          onPress={() => router.push('/shopping-list')}
        />
        <PrimaryButton label="Sign out" variant="ghost" icon="logout" onPress={confirmSignOut} />
      </View>

      <View style={styles.privacy}>
        <Text style={[type.label, { color: colors.ink }]}>Privacy</Text>
        <Text style={[type.caption, { color: colors.muted, marginTop: 4 }]}>
          Ania stores your name, email, profile photo, food preferences, meal plan and shopping list
          so your account works across devices. Recipe data and your shopping state are never shared
          with advertisers. You can ask for your account to be deleted at any time.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Read the privacy note in settings"
          onPress={() => router.push('/settings')}
          style={{ marginTop: spacing.xs }}
        >
          <Text style={[type.caption, { color: colors.primaryDeep, textDecorationLine: 'underline' }]}>
            Manage preferences and privacy
          </Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
  ink,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  tone: readonly [string, string];
  ink: string;
}) {
  return (
    <LinearGradient
      colors={tone}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.stat}
    >
      <MaterialCommunityIcons name={icon} size={16} color={ink} />
      <Text style={[type.sectionTitle, { color: ink }]}>{value}</Text>
      <Text style={[type.caption, { color: ink, opacity: 0.8, textAlign: 'center' }]}>{label}</Text>
    </LinearGradient>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon} size={17} color={colors.primaryDeep} />
      <Text style={[type.body, { color: colors.inkSoft, flex: 1 }]}>{label}</Text>
      <Text style={[type.label, { color: colors.ink }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  statsRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 2.5,
    borderColor: colors.white,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  privacy: {
    marginTop: spacing.xl,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
