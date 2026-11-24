import { INGREDIENT_MAP } from '@/data/ingredients';
import { SUPERMARKET_BY_ID } from '@/data/supermarkets';
import { searchTermFor } from '@/data/ingredient-terms.pt';
import { RECIPE_BY_ID } from '@/data/recipes';
import type { MealPlanItem, Recipe, ShoppingCategory, SupermarketId, Unit } from '@/types';
import { gramsFor } from '@/services/pricing';
import { dimensionOf } from '@/services/shopping/units';
import { scaledIngredients } from '@/services/recipes/servings';

/**
 * Live supermarket pricing.
 *
 * The app cannot read a supermarket catalogue itself (CORS, bot protection, no
 * place for secrets), so the numbers come from the small `price-service/` in this
 * repository, which reads the shops' own public catalogues server-side. This
 * module builds the basket, asks that service for the current shelf price of each
 * ingredient, and adds up what you would actually pay: whole packs, because a
 * shop sells packs, not grams.
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
  url: string;
}

export interface LiveLine {
  ingredientId: string;
  name: string;
  /** Packs you must buy at this shop. */
  packs: number;
  cost: number;
  product: LiveProduct;
}

export interface LiveStoreQuote {
  store: SupermarketId;
  name: string;
  accent: string;
  total: number;
  lines: LiveLine[];
  /** Lines this shop could not price. */
  missing: number;
  /** True when the shop could not price every line, so its total is not comparable. */
  partial: boolean;
}

export interface UnavailableStore {
  store: SupermarketId;
  name: string;
  reason: string;
}

export interface LivePriceResult {
  quotes: LiveStoreQuote[];
  best: LiveStoreQuote | null;
  perServing: number | null;
  /** Shops that publish no readable online catalogue, with the reason. */
  unavailable: UnavailableStore[];
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
      return recipe ? { recipe, servings: item.servings } : null;
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
      const grams = gramsFor(quantity, ingredient.unit, category);
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
  return [...merged.values()];
}

interface ServiceStore {
  id: string;
  name: string;
  live: boolean;
  error?: string;
  items?: Record<string, LiveProduct & { missing?: boolean; error?: string }>;
}

interface ServiceResponse {
  fetchedAt: string;
  stores: Record<string, ServiceStore>;
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
  const pricedByStore = new Map<SupermarketId, Map<string, LiveLine>>();

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
      if (!product || product.missing || product.error || !(product.price > 0)) {
        continue;
      }
      // Buy whole packs: a shop sells a 500 g bag, not 237 g of rice. The service
      // already priced the packs it chose; fall back to our own maths if not.
      let packs: number | null = product.packs ?? null;
      if (!packs) {
        if (line.count && product.packUnits) {
          packs = Math.ceil(line.count / product.packUnits);
        } else if (product.packGrams && line.grams > 0) {
          packs = Math.ceil(line.grams / product.packGrams);
        }
      }
      if (!packs || packs <= 0) continue;
      const cost = product.cost ?? roundMoney(packs * product.price);
      priced.set(line.ingredientId, {
        ingredientId: line.ingredientId,
        name: line.name,
        packs,
        cost,
        product: {
          id: product.id,
          name: product.name,
          brand: product.brand,
          price: product.price,
          packGrams: product.packGrams,
          packUnits: product.packUnits,
          packLabel: product.packLabel,
          perKg: product.perKg,
          perUnit: product.perUnit,
          packs: product.packs ?? null,
          cost: product.cost ?? null,
          url: product.url,
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
    pricedByStore.set(storeId, priced);
  }

  // Compare every shop on the same ingredients: the ones they all price. Totals
  // over different baskets would be a lie even when each number is real.
  const live = [...pricedByStore.entries()];
  const common = live.length
    ? [...live[0][1].keys()].filter((id) => live.every(([, priced]) => priced.has(id)))
    : [];
  const usable = common.length >= Math.min(4, lines.length) ? live : [];

  const quotes: LiveStoreQuote[] = usable.map(([storeId, priced]) => {
    const market = SUPERMARKET_BY_ID[storeId];
    const storeLines = common.map((id) => priced.get(id)!).sort((a, b) => b.cost - a.cost);
    return {
      store: storeId,
      name: market?.name ?? storeId,
      accent: market?.accent ?? '#000',
      total: roundMoney(storeLines.reduce((sum, line) => sum + line.cost, 0)),
      lines: storeLines,
      missing: lines.length - common.length,
      partial: false,
    };
  });

  quotes.sort((a, b) => a.total - b.total);
  const best = quotes[0] ?? null;
  const pricedLines = common.length;
  return {
    quotes,
    best,
    perServing:
      options.servings && options.servings > 0 && best
        ? roundMoney(best.total / options.servings)
        : null,
    unavailable,
    readAt: payload.fetchedAt ?? new Date().toISOString(),
    totalLines: lines.length,
    pricedLines,
  };
}

export const EMPTY_RESULT: LivePriceResult = {
  quotes: [],
  best: null,
  perServing: null,
  unavailable: [],
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
