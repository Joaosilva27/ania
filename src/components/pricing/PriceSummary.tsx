import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { TagBadge } from '@/components/ui/Chip';
import { PRICE_API_URL, formatEuro, readTime, type LivePriceResult } from '@/services/pricing/live';
import { colors, radius, spacing, type } from '@/theme';

/**
 * The basket price card.
 *
 * Every number here is a shelf price read from the shop today, and the basket is
 * whole packs (what you actually pay at the till), not grams multiplied by a rate.
 * If a chain publishes no online catalogue it is named, with the reason, instead
 * of being given a made-up price.
 */
export function PriceSummary({
  result,
  label,
  perServing = false,
  compact = false,
  loading = false,
  error = null,
  onRetry,
}: {
  result: LivePriceResult | null;
  label: string;
  perServing?: boolean;
  compact?: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  const [openStore, setOpenStore] = useState<string | null>(null);

  if (loading && !result?.best) {
    return (
      <View style={[styles.card, compact && styles.compactCard, styles.loadingRow]}>
        <ActivityIndicator size="small" color={colors.primaryDeep} />
        <Text style={[type.caption, { color: colors.muted, flex: 1 }]}>
          Reading today&apos;s shelf prices…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.card, compact && styles.compactCard]}>
        <View style={styles.headline}>
          <MaterialCommunityIcons name="wifi-off" size={18} color={colors.danger} />
          <Text style={[type.caption, { color: colors.inkSoft, flex: 1 }]}>
            Live prices are unavailable right now.
          </Text>
        </View>
        <Text style={[type.noteTiny, { color: colors.muted }]}>{error}</Text>
        <Text style={[type.noteTiny, { color: colors.faint }]}>
          Start the price service with `npm run prices:serve` ({PRICE_API_URL}).
        </Text>
        {onRetry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try reading the prices again"
            onPress={onRetry}
            style={styles.retry}
          >
            <MaterialCommunityIcons name="refresh" size={14} color={colors.primaryInk} />
            <Text style={[type.caption, { color: colors.primaryInk }]}>Try again</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (!result?.best) {
    if (result?.quotes?.length) {
      return (
        <View style={[styles.card, compact && styles.compactCard]}>
          <View style={styles.headline}>
            <MaterialCommunityIcons name="basket-off-outline" size={18} color={colors.muted} />
            <Text style={[type.caption, { color: colors.inkSoft, flex: 1 }]}>
              No shop listed every ingredient, so there is no honest total to compare.
            </Text>
          </View>
          <View style={styles.quoteRow}>
            {result.quotes.map((quote) => (
              <TagBadge
                key={quote.store}
                label={`${quote.name} ${quote.lines.length}/${result.totalLines}`}
                tone="neutral"
              />
            ))}
          </View>
          <Text style={[type.noteTiny, { color: colors.muted }]}>
            Live shelf prices · read {readTime(result.readAt)}
          </Text>
          {result.unavailable.length ? (
            <Text style={[type.noteTiny, { color: colors.faint }]}>
              Not compared: {result.unavailable.map((store) => `${store.name} — ${store.reason}`).join('; ')}
            </Text>
          ) : null}
        </View>
      );
    }
    return (
      <View style={[styles.card, compact && styles.compactCard]}>
        <View style={styles.headline}>
          <MaterialCommunityIcons name="store-outline" size={18} color={colors.muted} />
          <Text style={[type.caption, { color: colors.muted, flex: 1 }]}>
            Pick the supermarkets you shop at in your profile to see live prices.
          </Text>
        </View>
      </View>
    );
  }

  const openQuote = result.quotes.find((quote) => quote.store === openStore) ?? null;

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
            {perServing && result.perServing
              ? ` · ${formatEuro(result.perServing)} per serving`
              : ''}
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

      <Text style={[type.noteTiny, { color: colors.muted }]}>
        Live shelf prices · compared on {result.pricedLines}/{result.totalLines} ingredients · read{' '}
        {readTime(result.readAt)} · whole packs
      </Text>

      {result.quotes.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            openQuote ? 'Hide the products in this basket' : 'Show the products in this basket'
          }
          onPress={() => setOpenStore(openQuote ? null : result.best!.store)}
          style={styles.linesToggle}
        >
          <MaterialCommunityIcons
            name={openQuote ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={colors.primaryInk}
          />
          <Text style={[type.caption, { color: colors.primaryInk }]}>
            {openQuote
              ? `Hide what ${openQuote.name} sells`
              : `See what ${result.best.name} actually sells`}
          </Text>
        </Pressable>
      ) : null}

      {openQuote ? (
        <View style={styles.lineList}>
          {openQuote.lines.map((line) => (
            <Pressable
              key={line.ingredientId}
              accessibilityRole="link"
              accessibilityLabel={`Open ${line.product.name} at ${openQuote.name}`}
              onPress={() => {
                if (line.product.url) void Linking.openURL(line.product.url);
              }}
              style={styles.lineRow}
            >
              <View style={{ flex: 1 }}>
                <Text style={[type.caption, { color: colors.ink }]} numberOfLines={2}>
                  {line.product.name}
                </Text>
                <Text style={[type.noteTiny, { color: colors.muted }]}>
                  {line.packs} × {formatEuro(line.product.price)}
                  {line.product.packLabel ? ` · ${line.product.packLabel}` : ''}
                </Text>
              </View>
              <Text style={[type.caption, { color: colors.inkSoft }]}>{formatEuro(line.cost)}</Text>
            </Pressable>
          ))}
          {openQuote.missing ? (
            <Text style={[type.noteTiny, { color: colors.muted, marginTop: 2 }]}>
              {openQuote.missing} ingredient{openQuote.missing === 1 ? '' : 's'} not listed
              online at {openQuote.name}.
            </Text>
          ) : null}
        </View>
      ) : null}

      {result.unavailable.length ? (
        <Text style={[type.noteTiny, { color: colors.faint }]}>
          Not compared: {result.unavailable.map((store) => `${store.name} — ${store.reason}`).join('; ')}
        </Text>
      ) : null}
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
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
  quoteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  linesToggle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lineList: {
    gap: 6,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
});
