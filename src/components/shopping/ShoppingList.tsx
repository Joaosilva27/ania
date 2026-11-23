import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IngredientIcon } from './IngredientIcon';
import type { ShoppingListItem, ShoppingListSection } from '@/services/shopping/aggregate';
import { colors, radius, spacing, type } from '@/theme';

export function ShoppingProgress({
  checked,
  total,
  label,
}: {
  checked: number;
  total: number;
  label?: string;
}) {
  const ratio = total > 0 ? Math.min(1, checked / total) : 0;
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressHeader}>
        <Text style={[type.bodyMedium, { color: colors.ink }]}>
          {checked} of {total} {label ?? 'ingredients'} checked
        </Text>
        <Text style={[type.caption, { color: colors.muted }]}>{Math.round(ratio * 100)}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
    </View>
  );
}

export function ShoppingItemRow({
  item,
  onToggle,
  onRemove,
}: {
  item: ShoppingListItem;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const [showSources, setShowSources] = useState(false);
  return (
    <View style={styles.itemWrap}>
      <View style={styles.itemRow}>
        <IngredientIcon
          ingredientId={item.ingredientId}
          category={item.category}
          family={item.family}
          icon={item.icon}
          size={38}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.name}. ${item.quantityLabel || 'no quantity'}. Tap for which recipes need it.`}
          onPress={() => setShowSources((value) => !value)}
          style={{ flex: 1 }}
        >
          <Text
            style={[
              type.bodyMedium,
              { color: item.checked ? colors.faint : colors.ink, textDecorationLine: item.checked ? 'line-through' : 'none' },
            ]}
          >
            {item.name}
            {item.optional ? <Text style={[type.caption, { color: colors.faint }]}> (optional)</Text> : null}
          </Text>
          <Text style={[type.caption, { color: colors.muted, marginTop: 1 }]}>
            {item.quantityLabel || (item.manual ? 'Added by you' : '')}
            {item.manual ? ' · manual' : ''}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.checked }}
          accessibilityLabel={`Mark ${item.name} as ${item.checked ? 'not bought' : 'bought'}`}
          onPress={onToggle}
          hitSlop={6}
          style={[
            styles.checkbox,
            {
              backgroundColor: item.checked ? colors.green : 'transparent',
              borderColor: item.checked ? colors.greenDeep : colors.borderStrong,
            },
          ]}
        >
          {item.checked ? <MaterialCommunityIcons name="check" size={15} color={colors.white} /> : null}
        </Pressable>
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${item.name}`}
            onPress={onRemove}
            hitSlop={6}
            style={styles.removeButton}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={17} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {showSources && item.recipeTitles.length ? (
        <View style={styles.sources}>
          <Text style={[type.caption, { color: colors.inkSoft }]}>
            Used in {item.recipeTitles.join(' · ')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function ShoppingCategoryBlock({
  section,
  onToggleItem,
  onRemoveItem,
}: {
  section: ShoppingListSection;
  onToggleItem: (item: ShoppingListItem) => void;
  onRemoveItem?: (item: ShoppingListItem) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const checked = section.items.filter((item) => item.checked).length;

  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${section.label}, ${section.items.length} items`}
        onPress={() => setExpanded((value) => !value)}
        style={styles.sectionHeader}
      >
        <Text style={[type.cardTitle, { color: colors.ink, flex: 1 }]}>{section.label}</Text>
        <Text style={[type.caption, { color: colors.muted, marginRight: spacing.xs }]}>
          {checked}/{section.items.length}
        </Text>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.muted}
        />
      </Pressable>
      {expanded ? (
        <View style={styles.sectionBody}>
          {section.items.map((item) => (
            <ShoppingItemRow
              key={item.id}
              item={item}
              onToggle={() => onToggleItem(item)}
              onRemove={onRemoveItem && item.manual ? () => onRemoveItem(item) : undefined}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  progressWrap: { gap: spacing.xs },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.green, borderRadius: radius.pill },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  sectionBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  itemWrap: { paddingVertical: spacing.xs + 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  sources: {
    marginTop: spacing.xs,
    marginLeft: 50,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.xs + 2,
  },
});
