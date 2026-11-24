import { INGREDIENT_MAP } from '@/data/ingredients';
import { searchTermFor } from '@/data/ingredient-terms.pt';
import { RECIPE_BY_ID } from '@/data/recipes';
import { SUPERMARKET_BY_ID } from '@/data/supermarkets';
import type { MealPlanItem, Recipe, ShoppingCategory, SupermarketId, Unit } from '@/types';
import { scaledIngredients } from '@/services/recipes/servings';
import { dimensionOf } from '@/services/shopping/units';
import { gramsFor } from '@/services/pricing/weights';

/**
 * Live supermarket pricing.
 *
 * The app cannot read a supermarket catalogue itself (CORS, bot protection, no
 * place for secrets), so the numbers come from the small `price-service/` in this
 * repository, which reads the shops' own public catalogues server-side. This
 * module builds the basket, asks that service for the current shelf price of each
 * ingredient, and adds up what you would actually pay: whole packs for packaged
 * goods, the exact weight for loose produce.
 *
 * Nothing here guesses a price. If a shop has no catalogue online (Mercadona in
 * Portugal) or does not list the ingredient, the line is reported as unpriced.
 */

export const PRICE_API_URL = (
  process.env.EXPO_PUBLIC_PRICE_API_URL ?? 'http://127.0.0.1:8788'
).replace(/\/+$/, '');

/** One ingredient in the basket, merged across every recipe that needs it. */
export interface BasketLine {
  ingredientId: string;
  name: string;
  category: ShoppingCategory;
  /** Weight in grams when the recipe measures mass/volume. */
  grams: number;
  /** Pieces when the recipe counts them (eggs, onions, cans). */
  count: number | null;
  unit: Unit | null;
}

export interface LiveProduct {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  packGrams: number | null;
  packUnits: number | null;
  packLabel: string | null;
  perKg: number | null;
  perUnit: number | null;
  /** Packs and pack cost for the quantity asked for, priced by the service. */
  packs: number | null;
  cost: number | null;
  /** Loose produce: charged by the gram, not as a whole kilo. */
  soldByKg: boolean;
  /** Weight actually billed for loose produce. */
  billedGrams: number | null;
  url: string;
}

export interface LiveLine {
  ingredientId: string;
  name: string;
  /** Packs you must buy at this shop (null when billed by weight). */
  packs: number | null;
  /** Grams billed, for loose produce. */
  grams: number | null;
  cost: number;
  product: LiveProduct;
}

export interface LiveStoreQuote {
  store: SupermarketId;
  name: string;
  accent: string;
  total: number;
  lines: LiveLine[];
  /** Ingredients this shop priced on its own, before the shared comparison. */
  priced: number;
  /** Lines this shop could not price. */
  missing: number;
}

export interface UnavailableStore {
  store: SupermarketId;
  name: string;
  reason: string;
}

/** A shop left out of the ranking because it prices too little of the basket. */
export interface NotComparedStore {
  store: SupermarketId;
  name: string;
  priced: number;
  totalLines: number;
  reason: string;
}

export interface LivePriceResult {
  quotes: LiveStoreQuote[];
  best: LiveStoreQuote | null;
  perServing: number | null;
  /** Shops that publish no readable online catalogue, with the reason. */
  unavailable: UnavailableStore[];
  /** Shops that price too few lines for a fair comparison, with the count. */
  notCompared: NotComparedStore[];
  readAt: string;
  totalLines: number;
  pricedLines: number;
}

const roundMoney = (value: number) => Math.round(value * 100) / 100;

/** "4,20 €" — Portuguese formatting without depending on Intl support. */
export function formatEuro(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

export function formatPacks(packs: number): string {
  return `${packs} ${packs === 1 ? 'pack' : 'packs'}`;
}

/** The basket a single recipe needs at the given servings. */
export function basketForRecipe(recipe: Recipe, servings?: number): BasketLine[] {
  return mergeBasket([{ recipe, servings }]);
}

/** The basket a whole meal plan needs. */
export function basketForPlan(items: MealPlanItem[]): BasketLine[] {
  const entries = items
    .map((item) => {
      const recipe = RECIPE_BY_ID[item.recipeId];
      return recipe ? { recipe, servings: item.servings } : undefined;
    })
    .filter((entry): entry is { recipe: Recipe; servings: number } => Boolean(entry));
  return mergeBasket(entries);
}

function mergeBasket(entries: { recipe: Recipe; servings?: number }[]): BasketLine[] {
  const merged = new Map<string, BasketLine>();
  for (const { recipe, servings } of entries) {
    for (const ingredient of scaledIngredients(recipe, servings)) {
      const quantity = ingredient.scaledQuantity;
      if (!quantity || quantity <= 0) continue;
      const category = INGREDIENT_MAP[ingredient.ingredientId]?.category ?? 'other';
      const dimension = dimensionOf(ingredient.unit);
      const grams = gramsFor(quantity, ingredient.unit, category, ingredient.ingredientId);
      const count = dimension === 'count' ? quantity : null;
      const existing = merged.get(ingredient.ingredientId);
      if (existing) {
        existing.grams += grams;
        if (count != null) existing.count = (existing.count ?? 0) + count;
        continue;
      }
      merged.set(ingredient.ingredientId, {
        ingredientId: ingredient.ingredientId,
        name: ingredient.displayName ?? ingredient.ingredientId,
        category,
        grams,
        count,
        unit: dimension === 'count' ? ingredient.unit : null,
      });
    }
  }

  // Two ingredient ids can be the same shelf product ("spring onions" and
  // "scallion" both search "cebolinho"). Buying two bunches is wrong, so their
  // quantities are merged onto the first line.
  const byTerm = new Map<string, BasketLine>();
  for (const line of merged.values()) {
    const term = searchTermFor(line.ingredientId, line.name);
    const existing = byTerm.get(term);
    if (!existing) {
      byTerm.set(term, { ...line });
      continue;
    }
    existing.grams += line.grams;
    if (line.count != null) existing.count = (existing.count ?? 0) + line.count;
  }
  return [...byTerm.values()];
}

interface ServiceStore {
  id: string;
  name: string;
  live: boolean;
  error?: string;
  items?: Record<
    string,
    Partial<LiveProduct> & { grams?: number | null; missing?: boolean; error?: string }
  >;
}

interface ServiceResponse {
  fetchedAt: string;
  stores: Record<string, ServiceStore>;
}

/** One shop's own priced lines, before any comparison. */
export interface StorePricing {
  store: SupermarketId;
  priced: Map<string, LiveLine>;
}

export interface Comparison {
  quotes: LiveStoreQuote[];
  best: LiveStoreQuote | null;
  /** Ingredients present in every compared shop's total. */
  pricedLines: number;
  notCompared: NotComparedStore[];
}

/**
 * Compare shops only on the ingredients they all price.
 *
 * A total over a shorter shopping list is not a cheaper basket, so two totals
 * are only put next to each other on the lines both shops can actually sell.
 * A shop that prices far less of the basket is left out of the ranking instead
 * of winning by omission: coverage must be at least 80% of the best-covered
 * shop (a few exotic items may be missing, half the list may not).
 */
export function compareStores(totalLines: number, entries: StorePricing[]): Comparison {
  const notCompared: NotComparedStore[] = [];
  if (!entries.length) return { quotes: [], best: null, pricedLines: 0, notCompared };

  const coverage = Math.max(...entries.map((entry) => entry.priced.size));
  const minimum = Math.max(1, Math.ceil(coverage * 0.8));

  const comparable: StorePricing[] = [];
  for (const entry of entries) {
    if (entry.priced.size >= minimum) {
      comparable.push(entry);
    } else {
      const market = SUPERMARKET_BY_ID[entry.store];
      notCompared.push({
        store: entry.store,
        name: market?.name ?? entry.store,
        priced: entry.priced.size,
        totalLines,
        reason: `prices ${entry.priced.size} of ${totalLines} ingredients`,
      });
    }
  }

  const common = [...comparable[0].priced.keys()].filter((id) =>
    comparable.every((entry) => entry.priced.has(id)),
  );
  if (!common.length) {
    for (const entry of comparable) {
      const market = SUPERMARKET_BY_ID[entry.store];
      notCompared.push({
        store: entry.store,
        name: market?.name ?? entry.store,
        priced: entry.priced.size,
        totalLines,
        reason: 'no ingredient is priced by every compared shop',
      });
    }
    return { quotes: [], best: null, pricedLines: 0, notCompared };
  }

  const quotes: LiveStoreQuote[] = comparable.map((entry) => {
    const market = SUPERMARKET_BY_ID[entry.store];
    const lines = common
      .map((id) => entry.priced.get(id)!)
      .sort((a, b) => b.cost - a.cost);
    return {
      store: entry.store,
      name: market?.name ?? entry.store,
      accent: market?.accent ?? '#000',
      total: roundMoney(lines.reduce((sum, line) => sum + line.cost, 0)),
      lines,
      priced: entry.priced.size,
      missing: totalLines - common.length,
    };
  });

  quotes.sort((a, b) => a.total - b.total);
  return { quotes, best: quotes[0] ?? null, pricedLines: common.length, notCompared };
}

/** Ask the price service for one shelf price per ingredient, per shop. */
export async function fetchLivePrices(
  lines: BasketLine[],
  stores: SupermarketId[],
  options: { servings?: number; signal?: AbortSignal } = {},
): Promise<LivePriceResult> {
  if (!lines.length || !stores.length) return EMPTY_RESULT;

  const terms = lines.map((line) => ({
    id: line.ingredientId,
    q: searchTermFor(line.ingredientId, line.name),
    // The shop's own answer for this amount: whole packs of what you need.
    grams: Math.round(line.grams),
    count: line.count ?? 0,
  }));

  const response = await fetch(`${PRICE_API_URL}/prices`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stores, terms }),
    signal: options.signal,
  });
  if (!response.ok) throw new Error(`price service responded ${response.status}`);
  const payload = (await response.json()) as ServiceResponse;

  const unavailable: UnavailableStore[] = [];
  const pricing: StorePricing[] = [];

  for (const storeId of stores) {
    const market = SUPERMARKET_BY_ID[storeId];
    const served = payload.stores?.[storeId];
    if (!served || served.live === false) {
      unavailable.push({
        store: storeId,
        name: market?.name ?? storeId,
        reason: served?.error ?? 'No live catalogue available',
      });
      continue;
    }

    const priced = new Map<string, LiveLine>();
    for (const line of lines) {
      const product = served.items?.[line.ingredientId];
      if (!product || product.missing || product.error || !((product.price ?? 0) > 0)) {
        continue;
      }
      const soldByKg = Boolean(product.soldByKg);
      // Buy whole packs: a shop sells a 500 g bag, not 237 g of rice. The service
      // already priced the packs it chose; fall back to our own maths if not.
      let packs: number | null = product.packs ?? null;
      if (!packs && !soldByKg) {
        if (line.count && product.packUnits) {
          packs = Math.ceil(line.count / product.packUnits);
        } else if (product.packGrams && line.grams > 0) {
          packs = Math.ceil(line.grams / product.packGrams);
        }
      }
      const cost = product.cost ?? (packs ? roundMoney(packs * (product.price ?? 0)) : product.price);
      if (!(cost != null && cost > 0)) continue;
      // The service priced it for us but the shop prints no pack count: it is one
      // pack at that price (a punnet of chives, half a dozen eggs).
      if (!soldByKg && (!packs || packs <= 0)) packs = 1;
      priced.set(line.ingredientId, {
        ingredientId: line.ingredientId,
        name: line.name,
        packs: soldByKg ? null : packs,
        grams: soldByKg ? product.grams ?? Math.round(line.grams) : null,
        cost: roundMoney(cost),
        product: {
          id: product.id ?? '',
          name: product.name ?? line.name,
          brand: product.brand ?? null,
          price: product.price ?? 0,
          packGrams: product.packGrams ?? null,
          packUnits: product.packUnits ?? null,
          packLabel: product.packLabel ?? null,
          perKg: product.perKg ?? null,
          perUnit: product.perUnit ?? null,
          packs: product.packs ?? null,
          cost: product.cost ?? null,
          soldByKg,
          billedGrams: product.grams ?? null,
          url: product.url ?? '',
        },
      });
    }

    if (!priced.size) {
      unavailable.push({
        store: storeId,
        name: market?.name ?? storeId,
        reason: served.error ?? 'None of these ingredients are listed online',
      });
      continue;
    }
    pricing.push({ store: storeId, priced });
  }

  const comparison = compareStores(lines.length, pricing);
  return {
    quotes: comparison.quotes,
    best: comparison.best,
    perServing:
      options.servings && options.servings > 0 && comparison.best
        ? roundMoney(comparison.best.total / options.servings)
        : null,
    unavailable,
    notCompared: comparison.notCompared,
    readAt: payload.fetchedAt ?? new Date().toISOString(),
    totalLines: lines.length,
    pricedLines: comparison.pricedLines,
  };
}

export const EMPTY_RESULT: LivePriceResult = {
  quotes: [],
  best: null,
  perServing: null,
  unavailable: [],
  notCompared: [],
  readAt: '',
  totalLines: 0,
  pricedLines: 0,
};

/** "14:32" from an ISO timestamp, in the phone's own time zone. */
export function readTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
