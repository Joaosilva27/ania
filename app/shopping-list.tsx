import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { PriceSummary } from '@/components/pricing/PriceSummary';
import { RecipeImage } from '@/components/recipes/RecipeImage';
import { ShoppingCategoryBlock, ShoppingProgress } from '@/components/shopping/ShoppingList';
import { IconButton, PrimaryButton } from '@/components/ui/Button';
import { EmptyState, ScreenContainer } from '@/components/ui/Screen';
import { RECIPE_BY_ID } from '@/data/recipes';
import { useShoppingList } from '@/hooks/useShoppingList';
import { confirmAction, notify } from '@/lib/dialogs';
import { pricePlan } from '@/services/pricing';
import type { ShoppingList } from '@/services/shopping/aggregate';
import {
  addManualShoppingItem,
  clearChecked,
  removeManualShoppingItem,
  setChecked,
} from '@/services/userData';
import { useUserStore } from '@/store/userStore';
import { colors, radius, spacing, type } from '@/theme';

function listToText(list: ShoppingList): string {
  const lines: string[] = ['My ania shopping list', ''];
  for (const section of list.sections) {
    lines.push(section.label.toUpperCase());
    for (const item of section.items) {
      lines.push(`- [${item.checked ? 'x' : ' '}] ${item.name}${item.quantityLabel ? ` — ${item.quantityLabel}` : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export default function ShoppingListScreen() {
  const router = useRouter();
  const data = useUserStore((state) => state.data);
  const mutate = useUserStore((state) => state.mutate);
  const list = useShoppingList();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');

  if (!data || !list) return null;

  const recipes = data.plan.items.map((item) => RECIPE_BY_ID[item.recipeId]).filter(Boolean);
  const stores = data.preferences.supermarkets ?? [];

  const submitManual = () => {
    if (!name.trim()) return;
    mutate((current) => addManualShoppingItem(current, { name, quantityLabel: quantity }));
    setName('');
    setQuantity('');
    setAdding(false);
  };

  const share = async () => {
    const text = listToText(list);
    try {
      if (Platform.OS === 'web') {
        const nav = globalThis as unknown as { navigator?: { clipboard?: { writeText: (value: string) => Promise<void> } } };
        if (nav.navigator?.clipboard) {
          await nav.navigator.clipboard.writeText(text);
          notify('Copied', 'Your shopping list has been copied to the clipboard.');
        } else {
          notify('Sharing unavailable', 'Clipboard access is not available in this browser.');
        }
        return;
      }
      await Share.share({ message: text });
    } catch (error) {
      console.warn('[shopping] share failed', error);
      notify('Could not share', 'Please try again.');
    }
  };

  const confirmClear = () => {
    if (!list.checkedCount) return;
    void confirmAction({
      title: 'Clear checked items?',
      message: 'This marks everything as not bought again. Your list stays the same.',
      confirmLabel: 'Clear',
      destructive: true,
    }).then((confirmed) => {
      if (confirmed) mutate((current) => clearChecked(current));
    });
  };

  return (
    <ScreenContainer scroll contentStyle={{ paddingTop: spacing.sm, paddingBottom: spacing.xxl }}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          background={colors.surface}
          bordered
          size={20}
        />
        <View style={{ flex: 1 }}>
          <Text style={[type.noteSmall, { color: colors.primaryDeep }]}>one trip, sorted ♡</Text>
          <Text style={[type.screenTitle, { color: colors.ink, marginTop: -2 }]}>Your shopping list</Text>
          <Text style={[type.caption, { color: colors.muted, marginTop: 2 }]}>
            {list.recipeCount} {list.recipeCount === 1 ? 'recipe' : 'recipes'} ·{' '}
            {list.totalCount} items
          </Text>
        </View>
        <IconButton
          icon="share-variant-outline"
          accessibilityLabel="Share shopping list"
          onPress={() => void share()}
          background={colors.surface}
          bordered
        />
      </View>

      <View style={styles.summary}>
        {recipes.length ? (
          <View style={styles.thumbRow}>
            {recipes.slice(0, 4).map((recipe) => (
              <RecipeImage key={recipe.id} recipe={recipe} style={styles.thumb} />
            ))}
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <ShoppingProgress checked={list.checkedCount} total={list.totalCount} />
        </View>
      </View>

      {data.plan.items.length ? (
        <View style={{ marginTop: spacing.sm }}>
          <PriceSummary
            result={pricePlan(data.plan, { stores })}
            label="Basket"
            compact
          />
        </View>
      ) : null}

      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add your own item"
          onPress={() => setAdding((value) => !value)}
          style={styles.toolButton}
        >
          <MaterialCommunityIcons name={adding ? 'close' : 'plus'} size={16} color={colors.primaryInk} />
          <Text style={[type.label, { color: colors.primaryInk }]}>{adding ? 'Cancel' : 'Add item'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear checked items"
          onPress={confirmClear}
          disabled={!list.checkedCount}
          style={[styles.toolButton, { opacity: list.checkedCount ? 1 : 0.4 }]}
        >
          <MaterialCommunityIcons name="checkbox-multiple-blank-outline" size={16} color={colors.inkSoft} />
          <Text style={[type.label, { color: colors.inkSoft }]}>Clear checked</Text>
        </Pressable>
      </View>

      {adding ? (
        <View style={styles.addForm}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Kitchen roll"
            placeholderTextColor={colors.faint}
            style={[type.body, styles.input, { flex: 2 }]}
            accessibilityLabel="New shopping item name"
            returnKeyType="next"
          />
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder="1 pack"
            placeholderTextColor={colors.faint}
            style={[type.body, styles.input, { flex: 1 }]}
            accessibilityLabel="New shopping item quantity"
            returnKeyType="done"
            onSubmitEditing={submitManual}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save item"
            onPress={submitManual}
            style={styles.addButton}
          >
            <MaterialCommunityIcons name="check" size={18} color={colors.white} />
          </Pressable>
        </View>
      ) : null}

      {list.sections.length ? (
        <View style={{ marginTop: spacing.sm }}>
          {list.sections.map((section) => (
            <ShoppingCategoryBlock
              key={section.category}
              section={section}
              onToggleItem={(item) =>
                mutate((current) => setChecked(current, item.ingredientId ?? item.id, !item.checked))
              }
              onRemoveItem={(item) =>
                mutate((current) => removeManualShoppingItem(current, item.id.replace(/^manual:/, '')))
              }
            />
          ))}
        </View>
      ) : (
        <View style={{ marginTop: spacing.lg }}>
          <EmptyState
            icon="basket-off-outline"
            title="Your list is empty"
            message="Add recipes to your plan and the ingredients will appear here automatically."
            actionLabel="Browse recipes"
            onAction={() => router.replace('/(tabs)/discover')}
          />
        </View>
      )}

      {recipes.length ? (
        <View style={{ marginTop: spacing.sm }}>
          <PrimaryButton
            label="Back to meal plan"
            variant="secondary"
            icon="calendar-month-outline"
            onPress={() => router.replace('/(tabs)/plan')}
          />
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  thumbRow: { flexDirection: 'row' },
  thumb: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    marginLeft: -8,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  addForm: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm, alignItems: 'center' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 46,
    color: colors.ink,
  },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
