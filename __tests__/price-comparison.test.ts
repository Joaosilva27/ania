import type { SupermarketId } from '@/types';
import { compareStores, type LiveLine, type StorePricing } from '@/services/pricing/live';
import { gramsFor } from '@/services/pricing/weights';

const line = (id: string, cost: number): LiveLine => ({
  ingredientId: id,
  name: id,
  packs: 1,
  grams: null,
  cost,
  product: {
    id,
    name: id,
    brand: null,
    price: cost,
    packGrams: 500,
    packUnits: null,
    packLabel: '500 g',
    perKg: null,
    perUnit: null,
    packs: 1,
    cost,
    soldByKg: false,
    billedGrams: null,
    url: '',
  },
});

const shop = (store: SupermarketId, priced: Record<string, number>): StorePricing => ({
  store,
  priced: new Map(Object.entries(priced).map(([id, cost]) => [id, line(id, cost)])),
});

const tenLines = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];

describe('compareStores', () => {
  it('totals only the ingredients every compared shop prices', () => {
    // Continente prices the whole basket; Pingo Doce does not stock j at all.
    const continente = shop(
      'continente',
      Object.fromEntries(tenLines.map((id) => [id, id === 'j' ? 100 : 1])),
    );
    const pingo = shop(
      'pingo-doce',
      Object.fromEntries(tenLines.filter((id) => id !== 'j').map((id) => [id, 2])),
    );

    const result = compareStores(10, [continente, pingo]);

    // The shared basket is the nine lines both shops sell: Continente's total
    // must not include the 100 € item Pingo Doce cannot price.
    expect(result.pricedLines).toBe(9);
    const priceOf = Object.fromEntries(result.quotes.map((quote) => [quote.store, quote.total]));
    expect(priceOf.continente).toBe(9);
    expect(priceOf['pingo-doce']).toBe(18);
    expect(result.best?.store).toBe('continente');
    // Every compared quote carries exactly the shared lines, not its own list.
    for (const quote of result.quotes) {
      expect(quote.lines).toHaveLength(9);
      expect(quote.lines.map((entry) => entry.ingredientId)).not.toContain('j');
    }
    expect(result.quotes[0].missing).toBe(1);
  });

  it('refuses to crown a shop that only prices a fraction of the basket', () => {
    // Three 1 € lines cannot beat a shop that prices all ten, even though 3 < 10.
    const complete = shop('continente', Object.fromEntries(tenLines.map((id) => [id, 1])));
    const partial = shop('pingo-doce', { a: 1, b: 1, c: 1 });

    const result = compareStores(10, [complete, partial]);

    expect(result.quotes.map((quote) => quote.store)).toEqual(['continente']);
    expect(result.best?.store).toBe('continente');
    expect(result.best?.total).toBe(10);
    expect(result.notCompared).toEqual([
      expect.objectContaining({
        store: 'pingo-doce',
        priced: 3,
        totalLines: 10,
        reason: expect.stringContaining('3 of 10'),
      }),
    ]);
  });

  it('reports each shop’s own coverage next to its shared-basket total', () => {
    const continente = shop('continente', Object.fromEntries(tenLines.map((id) => [id, 1])));
    const pingo = shop(
      'pingo-doce',
      Object.fromEntries(tenLines.filter((id) => id !== 'e').map((id) => [id, 2])),
    );

    const result = compareStores(10, [continente, pingo]);
    const quotes = Object.fromEntries(result.quotes.map((quote) => [quote.store, quote]));

    expect(quotes.continente.priced).toBe(10);
    expect(quotes['pingo-doce'].priced).toBe(9);
    // Both totals are over the same nine lines.
    expect(quotes.continente.total).toBe(9);
    expect(quotes['pingo-doce'].total).toBe(18);
  });

  it('keeps the cheaper shop on the shared basket as the winner', () => {
    const expensive = shop('continente', Object.fromEntries(tenLines.map((id) => [id, 5])));
    const cheaper = shop('lidl', Object.fromEntries(tenLines.map((id) => [id, 3])));

    const result = compareStores(10, [expensive, cheaper]);

    expect(result.best?.store).toBe('lidl');
    expect(result.quotes.map((quote) => quote.total)).toEqual([30, 50]);
  });

  it('names every shop when nothing can be compared', () => {
    const left = shop('continente', { a: 1 });
    const right = shop('pingo-doce', { b: 1 });

    const result = compareStores(2, [left, right]);

    expect(result.best).toBeNull();
    expect(result.pricedLines).toBe(0);
    expect(result.notCompared.map((store) => store.store).sort()).toEqual(['continente', 'pingo-doce']);
  });

  it('has nothing to compare without shops', () => {
    expect(compareStores(10, [])).toEqual({
      quotes: [],
      best: null,
      pricedLines: 0,
      notCompared: [],
    });
  });
});

describe('gramsFor', () => {
  it('weighs countable produce with the piece, not the department average', () => {
    // Two bunches of spring onions are ~30 g, not 2 × 120 g.
    expect(gramsFor(2, 'unit', 'fruit-veg', 'spring-onions')).toBe(30);
    expect(gramsFor(1, 'unit', 'fruit-veg')).toBe(120);
  });

  it('converts measured units exactly', () => {
    expect(gramsFor(3, 'tbsp', 'sauces-condiments')).toBe(45);
    expect(gramsFor(1, 'kg', 'storecupboard')).toBe(1000);
    expect(gramsFor(2, 'clove', 'fruit-veg')).toBe(8);
  });

  it('ignores quantities that are not a number', () => {
    expect(gramsFor(Number.NaN, 'g', 'other')).toBe(0);
    expect(gramsFor(-3, 'g', 'other')).toBe(0);
  });
});
