// Live price API for ania.
//
//   GET  /health
//   POST /prices   { "stores": ["continente","lidl"], "terms": [{"id":"onion","q":"cebola"}] }
//   GET  /prices?stores=continente&terms=onion:cebola,garlic:alho
//
// Answers with the product each shop lists for a term: pack size, pack price and
// €/kg, plus when it was read. Everything is cached for six hours so a screen
// full of recipes costs one lookup per ingredient, not one per render.
import { createServer } from 'node:http';
import { cacheGet, cacheSet } from './lib.mjs';
import { STORES, STORE_BY_ID, bestMatch, normaliseProducts } from './stores.mjs';

// Bumped whenever matching changes, so an old cached pick is never served as if
// it were today's answer.
const CACHE_VERSION = 6;

// Ignore a generic PORT=0 exported by some shells; this service owns PRICE_PORT.
const PORT = Number(process.env.PRICE_PORT ?? 8788) || 8788;
const HOST = process.env.HOST ?? '127.0.0.1';
const VERSION = '1.0.0';

const inflight = new Map();

async function lookup(store, term, need = {}) {
  const grams = Number(need.grams) > 0 ? Math.round(Number(need.grams)) : 0;
  const count = Number(need.count) > 0 ? Math.round(Number(need.count) * 100) / 100 : 0;
  const key = `live_v${CACHE_VERSION}_${store.id}_${term}_${grams}_${count}`;
  const cached = await cacheGet(key);
  if (cached) return { ...cached, cached: true };

  const pendingKey = `${store.id}:${term}:${grams}:${count}`;
  if (inflight.has(pendingKey)) return inflight.get(pendingKey);

  const task = (async () => {
    const products = normaliseProducts(await store.search(term));
    const match = bestMatch(term, products, { grams, count });
    const value = match
      ? { ...match, term, need: { grams, count }, store: store.id, fetchedAt: new Date().toISOString() }
      : { term, need: { grams, count }, store: store.id, missing: true, fetchedAt: new Date().toISOString() };
    await cacheSet(key, value);
    return value;
  })();

  inflight.set(pendingKey, task);
  try {
    return await task;
  } finally {
    inflight.delete(pendingKey);
  }
}

/** Run at most `limit` lookups at once, keeping the input order. */
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function priceStore(store, terms) {
  const started = Date.now();
  if (!store.search) {
    return {
      id: store.id,
      name: store.name,
      live: false,
      error: store.note,
      items: {},
    };
  }
  const items = {};
  const errors = [];
  let throttled = false;
  // Lidl gets one request at a time (its gateway counts them); the others are
  // happy with a few in flight, which turns a two-minute basket into seconds.
  const concurrency = store.id === 'lidl' ? 1 : store.id === 'pingo-doce' ? 2 : 4;
  const gap = store.id === 'lidl' ? 2500 : 250;
  await mapLimit(terms, concurrency, async (term) => {
    if (throttled) {
      items[term.id] = {
        term: term.q,
        store: store.id,
        error: 'throttled',
        fetchedAt: new Date().toISOString(),
      };
      return;
    }
    try {
      items[term.id] = await lookup(store, term.q, term);
    } catch (error) {
      errors.push(`${term.q}: ${error.message}`);
      if (/throttl/i.test(error.message)) throttled = true;
      items[term.id] = { term: term.q, store: store.id, error: error.message, fetchedAt: new Date().toISOString() };
    }
    await new Promise((resolve) => setTimeout(resolve, gap));
  });
  return {
    id: store.id,
    name: store.name,
    live: true,
    note: store.note,
    ms: Date.now() - started,
    // One clear sentence beats the same failure repeated per ingredient.
    error: errors.length
      ? [...new Set(errors.map((line) => line.replace(/^[^:]+:\s*/, '')))].slice(0, 2).join('; ')
      : undefined,
    items,
  };
}

function normaliseRequest(payload) {
  const stores = (payload.stores ?? []).filter((id) => STORE_BY_ID[id]);
  const terms = (payload.terms ?? [])
    .map((term) => (typeof term === 'string' ? { id: term, q: term } : term))
    .filter((term) => term && term.id && term.q)
    .map((term) => ({
      id: String(term.id),
      q: String(term.q).slice(0, 60),
      grams: Number(term.grams) > 0 ? Number(term.grams) : 0,
      count: Number(term.count) > 0 ? Number(term.count) : 0,
    }));
  return { stores, terms };
}

async function handlePrices(payload) {
  const { stores, terms } = normaliseRequest(payload);
  if (!terms.length) return { error: 'no terms' };
  const results = await Promise.all(stores.map((id) => priceStore(STORE_BY_ID[id], terms)));
  return {
    version: VERSION,
    fetchedAt: new Date().toISOString(),
    stores: Object.fromEntries(results.map((result) => [result.id, result])),
    available: STORES.filter((store) => store.search).map((store) => store.id),
  };
}

function send(response, status, body) {
  const json = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  });
  response.end(json);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (request.method === 'OPTIONS') {
    send(response, 204, {});
    return;
  }
  try {
    if (url.pathname === '/health') {
      send(response, 200, {
        ok: true,
        version: VERSION,
        stores: STORES.map((store) => ({ id: store.id, name: store.name, live: Boolean(store.search), note: store.note })),
      });
      return;
    }
    if (url.pathname === '/prices' && request.method === 'GET') {
      const stores = (url.searchParams.get('stores') ?? '').split(',').filter(Boolean);
      const raw = url.searchParams.get('terms') ?? '';
      const terms = raw
        .split(',')
        .filter(Boolean)
        .map((pair) => {
          const [id, ...rest] = pair.split(':');
          return { id, q: rest.join(':') || id };
        });
      send(response, 200, await handlePrices({ stores, terms }));
      return;
    }
    if (url.pathname === '/prices' && request.method === 'POST') {
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 64_000) throw new Error('body too large');
      }
      send(response, 200, await handlePrices(JSON.parse(body || '{}')));
      return;
    }
    send(response, 404, { error: 'not found' });
  } catch (error) {
    send(response, 500, { error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ania live prices on http://${HOST}:${PORT}`);
  for (const store of STORES) console.log(`  ${store.id.padEnd(11)} ${store.search ? 'live' : 'unavailable'} — ${store.note}`);
});
