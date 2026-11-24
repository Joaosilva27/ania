import { searchTermFor } from '@/data/ingredient-terms.pt';
import {
  fetchLivePrices,
  formatEuro,
  readTime,
  type BasketLine,
} from '@/services/pricing/live';

const line = (over: Partial<BasketLine>): BasketLine => ({
  ingredientId: 'onion',
  name: 'Onion',
  category: 'fruit-veg',
  grams: 0,
  count: null,
  unit: null,
  ...over,
});

const serviceAnswer = (items: Record<string, unknown>) => ({
  fetchedAt: '2026-11-24T10:32:00.000Z',
  stores: {
    continente: { id: 'continente', name: 'Continente', live: true, items },
    mercadona: {
      id: 'mercadona',
      name: 'Mercadona',
      live: false,
      error: 'Mercadona publishes no online catalogue in Portugal',
      items: {},
    },
  },
});

const product = (over: Record<string, unknown> = {}) => ({
  id: '1',
  name: 'Cebola Embalada',
  brand: null,
  price: 2.49,
  packGrams: 2000,
  packUnits: null,
  packLabel: '2 kg',
  perKg: 1.25,
  perUnit: null,
  url: 'https://example.test/cebola',
  ...over,
});

describe('live pricing', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('charges whole packs, because a shop sells packs and not grams', async () => {
    // 3 kg of onions in 2 kg bags = two bags, not 1.5 bags.
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => serviceAnswer({ onion: product() }),
    }) as unknown as typeof fetch;

    const result = await fetchLivePrices(
      [line({ grams: 3000, count: 25, unit: 'unit' })],
      ['continente', 'mercadona'],
      { servings: 2 },
    );

    expect(result.best?.store).toBe('continente');
    expect(result.best?.lines[0].packs).toBe(2);
    expect(result.best?.total).toBe(4.98);
    expect(result.perServing).toBe(2.49);
    expect(result.pricedLines).toBe(1);
  });

  it('prices counted ingredients by the pack of items', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        serviceAnswer({
          eggs: product({
            name: 'Ovos M/L Classe A',
            price: 2.39,
            packGrams: null,
            packUnits: 12,
            packLabel: '12 un',
            perKg: null,
            perUnit: 0.199,
          }),
        }),
    }) as unknown as typeof fetch;

    const result = await fetchLivePrices(
      [line({ ingredientId: 'eggs', name: 'Eggs', category: 'dairy-eggs', count: 14, unit: 'unit' })],
      ['continente'],
    );

    // 14 eggs from boxes of 12 = two boxes.
    expect(result.best?.lines[0].packs).toBe(2);
    expect(result.best?.total).toBe(4.78);
  });

  it('names the chains with no online price instead of inventing one', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => serviceAnswer({ onion: product() }),
    }) as unknown as typeof fetch;

    const result = await fetchLivePrices([line({ grams: 500 })], ['continente', 'mercadona']);

    expect(result.quotes.map((quote) => quote.store)).toEqual(['continente']);
    expect(result.unavailable).toEqual([
      expect.objectContaining({
        store: 'mercadona',
        reason: expect.stringContaining('no online catalogue'),
      }),
    ]);
  });

  it('leaves an ingredient unpriced when the shop does not list it', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => serviceAnswer({ onion: { ...product(), missing: true } }),
    }) as unknown as typeof fetch;

    const result = await fetchLivePrices([line({ grams: 500 })], ['continente']);

    expect(result.best).toBeNull();
    expect(result.unavailable).toHaveLength(1);
  });

  it('reports a service failure rather than showing a stale price', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 }) as unknown as typeof fetch;
    await expect(fetchLivePrices([line({ grams: 500 })], ['continente'])).rejects.toThrow('502');
  });
});

describe('ingredient terms', () => {
  it('uses the curated Portuguese term', () => {
    expect(searchTermFor('onion', 'Brown onion')).toBe('cebola');
    expect(searchTermFor('tomatoes', 'Tomatoes')).toBe('tomate');
    expect(searchTermFor('eggs', 'Eggs')).toBe('ovos');
  });

  it('translates the long tail word by word', () => {
    expect(searchTermFor('red-lentils-extra', 'Red lentils')).toContain('lentilhas');
    expect(searchTermFor('spring-greens-extra', 'Spring greens')).toContain('couve');
  });

  it('keeps a name the shops will still match', () => {
    expect(searchTermFor('sriracha-extra', 'Sriracha')).toBe('sriracha');
  });
});

describe('formatting', () => {
  it('writes euros the Portuguese way', () => {
    expect(formatEuro(4.5)).toBe('4,50 €');
  });

  it('shows the reading time as HH:MM', () => {
    expect(readTime('2026-11-24T10:32:00')).toBe('10:32');
    expect(readTime('not a date')).toBe('');
  });
});
