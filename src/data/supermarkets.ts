/**
 * The Portuguese supermarkets this app prices baskets for.
 *
 * Baskets are compared with live shelf prices read by `price-service/` from each
 * chain's own public catalogue (see `npm run prices:serve`). Mercadona is listed
 * so people can pick it, but it publishes no online catalogue in Portugal: the
 * app names that instead of giving it a guessed price.
 */
import type { SupermarketId } from '@/types';

export interface Supermarket {
  id: SupermarketId;
  name: string;
  /** Brand colour used for the chip and the price accent. */
  accent: string;
  tint: string;
  /** Where their shelves actually are, for the onboarding copy. */
  note: string;
}

export const SUPERMARKETS: Supermarket[] = [
  { id: 'pingo-doce', name: 'Pingo Doce', accent: '#E30613', tint: '#FFE8E9', note: 'Nationwide, strong on fresh produce' },
  { id: 'continente', name: 'Continente', accent: '#C8102E', tint: '#FFEBEE', note: 'Big hypermarkets, wide own-brand range' },
  { id: 'mercadona', name: 'Mercadona', accent: '#4C9B3F', tint: '#EAF6E7', note: 'Compact stores, good ready-to-cook basics' },
  { id: 'lidl', name: 'Lidl', accent: '#0050AA', tint: '#E7F0FB', note: 'Cheap staples and weekly specials' },
  { id: 'auchan', name: 'Auchan', accent: '#C1121F', tint: '#FDECED', note: 'Large stores, competitive own brand' },
];

/** Where prices come from, in one sentence, for settings and onboarding. */
export const PRICE_NOTE =
  'Prices are live shelf prices read from each shop\u2019s public catalogue; totals are whole packs.';

export const SUPERMARKET_BY_ID: Record<SupermarketId, Supermarket> = SUPERMARKETS.reduce(
  (acc, market) => {
    acc[market.id] = market;
    return acc;
  },
  {} as Record<SupermarketId, Supermarket>,
);

export function supermarketsOf(ids: SupermarketId[] | undefined | null): Supermarket[] {
  if (!ids?.length) return [];
  return ids.map((id) => SUPERMARKET_BY_ID[id]).filter(Boolean);
}
