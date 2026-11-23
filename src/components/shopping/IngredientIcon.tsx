import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CATEGORY_ICONS, FAMILY_ICONS } from '@/data/ingredientIcons';
import { INGREDIENT_MAP } from '@/data/ingredients';
import { colors } from '@/theme';
import type { IngredientFamily, ShoppingCategory } from '@/types';

type MciName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Three-layer icon system:
 *   1. ingredient-specific glyph
 *   2. ingredient-family glyph
 *   3. shopping-category glyph
 * so no row can ever render a blank icon.
 */
const FAMILY_TINTS: Record<IngredientFamily, string> = {
  meat: '#F6E4DA',
  fish: '#DDE9EC',
  dairy: '#FBF0DC',
  egg: '#FBF0DC',
  vegetable: '#E4EEDC',
  fruit: '#F7E7D8',
  grain: '#F1EADB',
  spice: '#F3E3D6',
  sauce: '#EFE7DA',
  pantry: '#EDEAE0',
  bakery: '#F4EBDD',
  frozen: '#E3EDF0',
  other: '#EDEAE0',
};

export function IngredientIcon({
  ingredientId,
  category,
  family,
  icon,
  size = 40,
}: {
  ingredientId?: string | null;
  category?: ShoppingCategory;
  family?: IngredientFamily;
  icon?: string;
  size?: number;
}) {
  const definition = ingredientId ? INGREDIENT_MAP[ingredientId] : undefined;
  const resolvedFamily = family ?? definition?.family ?? 'other';
  const specific = (icon ?? definition?.icon) as MciName | undefined;
  const resolvedCategory = category ?? definition?.category ?? 'other';
  const name = (specific ??
    (FAMILY_ICONS[resolvedFamily] as MciName | undefined) ??
    CATEGORY_ICONS[resolvedCategory]) as MciName;
  const tint = FAMILY_TINTS[resolvedFamily] ?? colors.surfaceMuted;

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2.4, backgroundColor: tint },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <MaterialCommunityIcons
        name={name}
        size={Math.round(size * 0.5)}
        color={colors.inkSoft}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
