import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { OnboardingScaffold } from '@/components/onboarding/OnboardingScaffold';
import { RecipeImage } from '@/components/recipes/RecipeImage';
import { ShoppingCategoryBlock, ShoppingProgress } from '@/components/shopping/ShoppingList';
import { PrimaryButton } from '@/components/ui/Button';
import { RECIPE_BY_ID } from '@/data/recipes';
import { notify } from '@/lib/dialogs';
import { buildShoppingList } from '@/services/shopping/aggregate';
import { completeOnboarding, setChecked } from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import { colors, radius, spacing, type } from '@/theme';

export default function ShoppingPreviewScreen() {
  const router = useRouter();
  const data = useUserStore((state) => state.data);
  const mutate = useUserStore((state) => state.mutate);
  const flush = useUserStore((state) => state.flush);
  const [finishing, setFinishing] = useState(false);

  const list = useMemo(() => {
    if (!data) return null;
    return buildShoppingList({
      plan: data.plan,
      checked: data.shopping.checked,
      manualItems: data.shopping.manualItems,
    });
  }, [data]);

  const recipes = (data?.plan.items ?? [])
    .map((item) => RECIPE_BY_ID[item.recipeId])
    .filter(Boolean);

  const finish = async () => {
    if (!data) return;
    setFinishing(true);
    try {
      // Make sure the plan and list are safely stored before onboarding is
      // marked complete — completion is never written optimistically.
      await flush();
      mutate((current) =>
        completeOnboarding(
          current,
          current.onboarding.initialRecipeIds.length
            ? current.onboarding.initialRecipeIds
            : current.plan.items.map((item) => item.recipeId),
        ),
      );
      await flush();
      router.replace('/(tabs)/home');
    } catch (error) {
      console.warn('[onboarding] could not finish', error);
      notify(
        'Almost there',
        'We could not save your plan just now. Please check your connection and try again.',
      );
    } finally {
      setFinishing(false);
    }
  };

  if (!data || !list) {
    return null;
  }

  return (
    <OnboardingScaffold
      step="shopping-preview"
      scroll={false}
      onBack={() => router.replace('/onboarding/initial-plan')}
      footer={
        <PrimaryButton
          label="Let's get cooking!"
          onPress={() => void finish()}
          loading={finishing}
          icon="chef-hat"
        />
      }
    >
      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={{ flex: 1 }}>
            <Text style={[type.cardTitle, { color: colors.ink }]}>
              {list.recipeCount} recipes
            </Text>
            <Text style={[type.caption, { color: colors.muted, marginTop: 2 }]}>
              {list.generatedCount} unique ingredients
            </Text>
          </View>
          <View style={styles.thumbRow}>
            {recipes.slice(0, 3).map((recipe) => (
              <RecipeImage key={recipe.id} recipe={recipe} style={styles.thumb} />
            ))}
          </View>
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <ShoppingProgress checked={list.checkedCount} total={list.totalCount} />
        </View>
      </View>

      <Text style={[type.body, { color: colors.muted, marginVertical: spacing.sm }]}>
        Everything you need for your meals — organised by aisle, and ready to tick off.
      </Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.md }}>
        {list.sections.map((section) => (
          <ShoppingCategoryBlock
            key={section.category}
            section={section}
            onToggleItem={(item) =>
              mutate((current) => setChecked(current, item.ingredientId ?? item.id, !item.checked))
            }
          />
        ))}

        <View style={styles.note}>
          <MaterialCommunityIcons name="information-outline" size={16} color={colors.inkSoft} />
          <Text style={[type.caption, { color: colors.inkSoft, flex: 1 }]}>
            Quantities are added together across recipes, so two meals needing garlic become one
            line. Checked items are remembered, even if you change your plan later.
          </Text>
        </View>
      </ScrollView>
    </OnboardingScaffold>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  thumbRow: { flexDirection: 'row' },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    marginLeft: -10,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
});
