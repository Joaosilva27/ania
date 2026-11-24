import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, TextButton } from '@/components/ui/Button';
import { FilterChip, SelectableCard } from '@/components/ui/Chip';
import { Banner, ScreenContainer } from '@/components/ui/Screen';
import { getRecipesByIds } from '@/data/recipes';
import { PRICE_NOTE, SUPERMARKETS } from '@/data/supermarkets';
import { DIETARY_OPTIONS, GOALS, INTERESTS } from '@/data/taxonomy';
import { confirmAction } from '@/lib/dialogs';
import { isRecipeAllowedForDiet } from '@/services/dietary';
import {
  removeRecipeFromPlan,
  setDietaryPattern,
  setPrimaryGoal,
  toggleInterest,
  toggleSupermarket,
} from '@/services/userData';
import { useAuthStore } from '@/store/authStore';
import { useUserStore } from '@/store/userStore';
import { colors, radius, spacing, type } from '@/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const data = useUserStore((state) => state.data);
  const mutate = useUserStore((state) => state.mutate);
  const flush = useUserStore((state) => state.flush);
  const signOut = useAuthStore((state) => state.signOut);
  const previewMode = useAuthStore((state) => state.previewMode);

  const conflicts = useMemo(() => {
    if (!data) return [];
    return getRecipesByIds(data.plan.items.map((item) => item.recipeId)).filter(
      (recipe) => !isRecipeAllowedForDiet(recipe, data.preferences.dietaryPattern),
    );
  }, [data]);

  if (!data) return null;
  const { preferences } = data;

  const removeConflicts = () => {
    void confirmAction({
      title: 'Remove conflicting recipes?',
      message: `This removes ${conflicts.length} ${
        conflicts.length === 1 ? 'recipe' : 'recipes'
      } from your plan and updates your shopping list.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Keep them',
      destructive: true,
    }).then((confirmed) => {
      if (!confirmed) return;
      mutate((current) => {
        let next = current;
        for (const recipe of conflicts) next = removeRecipeFromPlan(next, recipe.id);
        return next;
      });
    });
  };

  const done = async () => {
    await flush();
    router.back();
  };

  return (
    <ScreenContainer scroll contentStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xxl }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[type.noteSmall, { color: colors.primaryDeep }]}>make it yours</Text>
          <Text style={[type.screenTitle, { color: colors.ink, marginTop: -2 }]}>Settings</Text>
        </View>
        <TextButton label="Done" onPress={() => void done()} />
      </View>

      {previewMode || data.profile.isPreview ? (
        <View style={{ marginBottom: spacing.md }}>
          <Banner
            tone="warning"
            icon="flask-outline"
            message="Preview mode: changes are saved to this device only until Firebase credentials are added."
          />
        </View>
      ) : null}

      <Text style={[type.label, styles.sectionLabel]}>Primary goal</Text>
      <View style={{ gap: spacing.xs }}>
        {GOALS.map((goal) => (
          <SelectableCard
            key={goal.id}
            title={goal.label}
            description={goal.description}
            icon={goal.icon as never}
            selected={preferences.primaryGoal === goal.id}
            onPress={() => mutate((current) => setPrimaryGoal(current, goal.id))}
          />
        ))}
      </View>

      <Text style={[type.label, styles.sectionLabel]}>Food interests</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
        {INTERESTS.map((interest) => (
          <FilterChip
            key={interest.id}
            label={interest.label}
            active={preferences.interests.includes(interest.id)}
            onPress={() => mutate((current) => toggleInterest(current, interest.id))}
          />
        ))}
      </ScrollView>

      <Text style={[type.label, styles.sectionLabel]}>Supermarkets</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
        {SUPERMARKETS.map((market) => (
          <FilterChip
            key={market.id}
            label={market.name}
            active={(preferences.supermarkets ?? []).includes(market.id)}
            onPress={() => mutate((current) => toggleSupermarket(current, market.id))}
          />
        ))}
      </ScrollView>
      <Text style={[type.caption, { color: colors.muted, marginTop: 4 }]}>
        Prices compare only these shops. {PRICE_NOTE}
      </Text>

      <Text style={[type.label, styles.sectionLabel]}>Dietary requirement</Text>
      <View style={{ gap: spacing.xs }}>
        {DIETARY_OPTIONS.map((option) => (
          <SelectableCard
            key={option.id}
            title={option.label}
            description={option.description}
            icon={option.icon as never}
            selected={preferences.dietaryPattern === option.id}
            onPress={() => mutate((current) => setDietaryPattern(current, option.id))}
          />
        ))}
      </View>

      {conflicts.length ? (
        <View style={styles.conflictCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <MaterialCommunityIcons name="alert-outline" size={18} color={colors.danger} />
            <Text style={[type.cardTitle, { color: colors.ink }]}>
              {conflicts.length} {conflicts.length === 1 ? 'recipe' : 'recipes'} conflict
            </Text>
          </View>
          <Text style={[type.caption, { color: colors.inkSoft, marginTop: 4 }]}>
            {conflicts.map((recipe) => recipe.title).join(', ')} no longer{' '}
            {conflicts.length === 1 ? 'fits' : 'fit'} your diet. We never remove recipes without
            asking.
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            <PrimaryButton
              label="Remove conflicting recipes"
              variant="danger"
              onPress={removeConflicts}
            />
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.xl, gap: spacing.xs }}>
        <PrimaryButton label="Save & go back" onPress={() => void done()} />
        <PrimaryButton
          label="Sign out"
          variant="ghost"
          icon="logout"
          onPress={() =>
            void confirmAction({
              title: 'Sign out?',
              message: 'Your plan stays saved for the next time you sign in.',
              confirmLabel: 'Sign out',
              destructive: true,
            }).then((confirmed) => {
              if (confirmed) void signOut();
            })
          }
        />
      </View>

      <View style={styles.privacy}>
        <Text style={[type.label, { color: colors.ink }]}>Data & privacy</Text>
        <Text style={[type.caption, { color: colors.muted, marginTop: 4 }]}>
          We store your account details (name, email, photo) plus your preferences, plan and
          shopping checks so they sync across devices. Recipes are public content and read-only.
          Nothing is sold or shared with advertisers. Deleting your account removes your profile
          document and all of its sub-collections.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  sectionLabel: { color: colors.muted, marginTop: spacing.lg, marginBottom: spacing.xs },
  conflictCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  privacy: {
    marginTop: spacing.xl,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
