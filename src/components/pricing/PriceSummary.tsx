import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TagBadge } from '@/components/ui/Chip';
import { PRICES_META, formatEuro, type PriceResult } from '@/services/pricing';
import { colors, radius, spacing, type } from '@/theme';

/**
 * One line: "≈ 12,40 € · cheapest at Lidl", plus the per-shop breakdown.
 * Shared by the recipe page, the plan and the shopping list so the number and
 * its caveat are identical everywhere.
 */
export function PriceSummary({
  result,
  label,
  perServing,
  compact = false,
}: {
  result: PriceResult;
  label: string;
  perServing?: boolean;
  compact?: boolean;
}) {
  if (!result.best) {
    return (
      <View style={[styles.card, compact && styles.compactCard]}>
        <MaterialCommunityIcons name="store-outline" size={18} color={colors.muted} />
        <Text style={[type.caption, { color: colors.muted, flex: 1 }]}>
          Pick your supermarkets in your profile to see prices.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.headline}>
        <View style={[styles.dot, { backgroundColor: result.best.accent }]} />
        <View style={{ flex: 1 }}>
          <Text style={[type.label, { color: colors.ink }]}>
            {label} {formatEuro(result.best.total)}
          </Text>
          <Text style={[type.caption, { color: colors.muted }]}>
            cheapest at {result.best.name}
            {perServing && result.perServing ? ` · ${formatEuro(result.perServing)} per serving` : ''}
          </Text>
        </View>
      </View>

      {result.quotes.length > 1 ? (
        <View style={styles.quoteRow}>
          {result.quotes.map((quote) => (
            <TagBadge
              key={quote.store}
              label={`${quote.name} ${formatEuro(quote.total)}`}
              tone={quote.store === result.best?.store ? 'primary' : 'neutral'}
            />
          ))}
        </View>
      ) : null}

      <Text style={[type.noteTiny, styles.note]}>{PRICES_META.note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  compactCard: { padding: spacing.sm + 2, gap: spacing.xs },
  headline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  quoteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  note: { color: colors.muted, opacity: 0.9 },
});
