// Store adapters. Each one reads a Portuguese supermarket's own public
// catalogue, server-side, and returns the products it really lists right now.
//
// These are read-only lookups of pages a shopper can open in a browser. Prices
// are the shelf price in EUR, promotions included, exactly as printed.
import {
  decodeEntities,
  fetchText,
  normalise,
  parsePackGrams,
  parsePackUnits,
  parsePrice,
  parseUnitPrice,
  stripTags,
  tokens,
} from './lib.mjs';

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** Continente (Salesforce Commerce Cloud): tiles carry a JSON impression blob. */
async function continente(term) {
  const url = `https://www.continente.pt/pesquisa/?q=${encodeURIComponent(term)}&sz=12`;
  const { ok, status, body } = await fetchText(url, { timeout: 25000 });
  if (!ok) throw new Error(`continente responded ${status}`);

  const parts = body.split('data-product-tile-impression=');
  parts.shift();
  const products = [];
  for (const part of parts) {
    const quote = part[0];
    if (quote !== "'" && quote !== '"') continue;
    const end = part.indexOf(quote, 1);
    if (end < 0) continue;
    let meta;
    try {
      meta = JSON.parse(decodeEntities(part.slice(1, end)));
    } catch {
      continue;
    }
    if (!meta?.name || !(meta.price > 0)) continue;
    const block = part.slice(end + 1, end + 9000);
    const text = stripTags(block);
    const unitMatch = block.match(/(\d+[.,]\d+)\s*(?:&euro;|€)\s*\/\s*(kg|lt|l|un)/i);
    // "emb. 1 Kg", "emb. 6 x 1 lt", "emb. 500 g" — keep the unit, not just the number.
    const packMatch = text.match(/emb\.?\s*((?:\d+\s*x\s*)?[\d.,]+\s*(?:kg|g|gr|l|lt|ml|cl|un|unid)\b)/i);
    const hrefMatch = block.match(/href="(https:\/\/www\.continente\.pt\/[^"]+\.html)"/);
    const unitLabel = unitMatch ? `${unitMatch[1]} €/${unitMatch[2]}` : '';
    const packGrams = parsePackGrams(packMatch ? packMatch[1] : '') ?? parsePackGrams(meta.name);
    let perKg = parseUnitPrice(unitLabel);
    if (perKg == null && packGrams) perKg = (meta.price / packGrams) * 1000;

    products.push({
      id: String(meta.id ?? ''),
      name: meta.name,
      brand: meta.brand ?? null,
      price: meta.price,
      packGrams: packGrams ?? null,
      packLabel: packMatch ? packMatch[1].trim() : null,
      perKg: perKg == null ? null : round(perKg),
      packUnits: parsePackUnits(packMatch ? packMatch[1] : '') ?? parsePackUnits(meta.name),
      available: true,
      url: hrefMatch ? hrefMatch[1] : url,
    });
  }
  return products;
}

/** Pingo Doce: its catalogue is client-rendered, so we read it through the
 *  public cesta.pt catalogue server (MCP over HTTP, no key, Portuguese prices). */
async function pingodoce(term) {
  const endpoint = 'https://cesta.pt/mcp';
  const post = async (payload) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000),
    });
    const raw = await response.text();
    const data = raw
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');
    const text = data || raw;
    if (!response.ok) throw new Error(`pingodoce responded ${response.status}`);
    return JSON.parse(text);
  };

  await post({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'ania', version: '1.0.0' },
    },
  });
  const answer = await post({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'search_products', arguments: { query: term, stores: ['pingodoce'], limit: 20 } },
  });
  const text = answer?.result?.content?.[0]?.text;
  if (typeof text !== 'string') throw new Error('pingodoce returned no catalogue');

  // Each hit is a bullet "Store · Name · Size · Price · Unit · pid N" followed
  // by the product URL on the next line.
  const lines = text.split(/\r?\n/);
  const products = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith('- ')) continue;
    const fields = line.slice(2).split(' · ').map((field) => field.trim());
    if (fields.length < 4) continue;
    const [store, name] = fields;
    if (normalise(store) !== 'pingo doce') continue;
    const priceIndex = fields.findIndex((field) => /^\d+[.,]\d{2}€/.test(field));
    if (priceIndex < 0) continue;
    const price = parsePrice(fields[priceIndex]);
    if (!(price > 0)) continue;
    const unitField = fields.find((field) => /€\s*\/\s*(kg|lt|l|un)/i.test(field)) ?? '';
    const pid = fields.find((field) => /^pid\s+\d+$/i.test(field))?.replace(/\D+/g, '') ?? '';
    const sizeField = priceIndex >= 3 ? fields[2] : '';
    const url = lines.slice(index + 1).find((next) => next.trim().startsWith('http'))?.trim() ?? '';
    const slug = url.split('/').pop() ?? '';
    const packGrams = parsePackGrams(sizeField) ?? parsePackGrams(slug) ?? parsePackGrams(name);
    let perKg = parseUnitPrice(unitField);
    if (perKg == null && packGrams) perKg = (price / packGrams) * 1000;
    products.push({
      id: pid,
      name,
      brand: null,
      price,
      packGrams: packGrams ?? null,
      packLabel: sizeField || null,
      perKg: perKg == null ? null : round(perKg),
      packUnits: parsePackUnits(sizeField) ?? parsePackUnits(name),
      available: true,
      url,
    });
  }
  return products;
}

/** Lidl Portugal: the shop's own search API returns JSON.
 *
 *  Lidl answers HTTP 401 once its gateway decides we are asking too often; it is
 *  a rate limit, not an auth error. We wait it out with a growing backoff and, if
 *  it still says no, report the shop as temporarily unavailable instead of
 *  inventing a price. */
async function lidl(term) {
  const url = `https://www.lidl.pt/q/api/search?q=${encodeURIComponent(term)}&assortment=PT&locale=pt_PT&version=2.1.0&fetchsize=10`;
  let body = '';
  let lastStatus = 0;
  const waits = [0, 2500, 6000, 12000];
  for (const wait of waits) {
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait + Math.random() * 700));
    const response = await fetchText(url, { timeout: 20000, headers: { accept: 'application/json' }, attempts: 1 });
    lastStatus = response.status;
    if (response.ok) {
      body = response.body;
      break;
    }
    if (response.status !== 401 && response.status !== 403 && response.status !== 429) break;
  }
  if (!body) {
    if (lastStatus === 401 || lastStatus === 403 || lastStatus === 429) {
      throw new Error('lidl is throttling requests right now — try again in a few minutes');
    }
    throw new Error(`lidl responded ${lastStatus}`);
  }

  const payload = JSON.parse(body);
  return (payload.items ?? [])
    .map((item) => item.gridbox?.data)
    .filter(Boolean)
    .map((data) => {
      const price = data.price?.price ?? data.regionsPrices?.['1']?.currentPrice?.price ?? null;
      const packaging =
        data.price?.packaging?.text ?? data.regionsPrices?.['1']?.currentPrice?.price?.packaging?.text ?? '';
      const unitLabel =
        data.price?.basePrice?.text ?? data.regionsPrices?.['1']?.currentPrice?.price?.basePrice?.text ?? '';
      const fullTitle = data.keyfacts?.fullTitle ?? '';
      const packGrams = parsePackGrams(packaging) ?? parsePackGrams(fullTitle);
      let perKg = parseUnitPrice(unitLabel);
      if (perKg == null && price && packGrams) perKg = (price / packGrams) * 1000;
      return {
        id: String(data.productId ?? data.id ?? ''),
        name: fullTitle || data.fullTitle || data.title || '',
        brand: data.brand?.name ?? null,
        price,
        packGrams: packGrams ?? null,
        packLabel: packaging || null,
        perKg: perKg == null ? null : round(perKg),
        packUnits: parsePackUnits(packaging) ?? parsePackUnits(fullTitle),
        available: price != null && data.preventSelling !== true,
        url: data.canonicalUrl ? `https://www.lidl.pt${data.canonicalUrl}` : 'https://www.lidl.pt',
      };
    })
    .filter((product) => product.price > 0 && product.name);
}

/** Auchan Portugal (Salesforce Commerce Cloud, server-rendered tiles).
 *
 *  The visible price is injected by JavaScript, but every tile still ships a
 *  complete `data-gtm` analytics payload — name, id, brand and the shelf price —
 *  in the HTML. That is what we read. */
async function auchan(term) {
  const url = `https://www.auchan.pt/pt/pesquisa?q=${encodeURIComponent(term)}`;
  const { ok, status, body } = await fetchText(url, { timeout: 25000 });
  if (!ok) throw new Error(`auchan responded ${status}`);

  const products = [];
  const seen = new Set();
  for (const raw of body.split('data-gtm="').slice(1)) {
    const end = raw.indexOf('"');
    if (end < 0) continue;
    let meta;
    try {
      meta = JSON.parse(decodeEntities(raw.slice(0, end)));
    } catch {
      continue;
    }
    const price = parsePrice(meta.price);
    if (!(price > 0) || !meta.name) continue;
    const id = String(meta.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const block = body.slice(Math.max(0, body.indexOf(`data-pid="${id}"`)), body.indexOf(`data-pid="${id}"`) + 9000);
    const productUrl = decodeEntities(
      block.match(/productUrl(?:&quot;|\\?"):(?:&quot;|\\?")([^"&\\]+)/)?.[1] ?? '',
    );
    const unitRaw = block.match(/auc-measures--price-per-unit"[^>]*>([^<]+)</)?.[1] ?? '';
    const slug = productUrl.split('/').filter(Boolean).slice(-2)[0] ?? '';
    let packGrams = parsePackGrams(slug) ?? parsePackGrams(meta.name);
    let perKg = parseUnitPrice(decodeEntities(unitRaw));
    // Loose produce is sold by the kilo: "CEBOLA KG" costs that much per kg.
    const soldByKg = /(?:^|-)kg(?:$|[-/])/i.test(slug) || /\bKG$/i.test(meta.name.trim());
    if (soldByKg && !packGrams) packGrams = 1000;
    if (perKg == null && packGrams) perKg = (price / packGrams) * 1000;

    products.push({
      id,
      name: decodeEntities(meta.name),
      brand: meta.brand ? decodeEntities(meta.brand) : null,
      price,
      packGrams: packGrams ?? null,
      packLabel: packGrams ? `${packGrams >= 1000 ? packGrams / 1000 : packGrams}${packGrams >= 1000 ? ' kg' : ' g'}` : null,
      soldByKg,
      perKg: perKg == null ? null : round(perKg),
      packUnits: parsePackUnits(meta.name),
      available: true,
      url: productUrl ? `https://www.auchan.pt${productUrl}` : url,
    });
  }
  return products;
}

export const STORES = [
  {
    id: 'pingo-doce',
    name: 'Pingo Doce',
    search: pingodoce,
    note: 'Live shelf prices from pingodoce.pt (public catalogue)',
  },
  {
    id: 'continente',
    name: 'Continente',
    search: continente,
    note: 'Live shelf prices from continente.pt',
  },
  {
    id: 'lidl',
    name: 'Lidl',
    search: lidl,
    note: 'Live in-store prices from the lidl.pt search API',
  },
  {
    id: 'auchan',
    name: 'Auchan',
    search: auchan,
    note: 'Live shelf prices from auchan.pt',
  },
  {
    id: 'mercadona',
    name: 'Mercadona',
    search: null,
    // Mercadona's own answer, checked on the site: "Atualmente não dispomos de
    // um serviço de compra online". No shop, no public price list — so no honest
    // live price exists to read, and this app says so instead of guessing one.
    note: 'Mercadona publishes no online catalogue in Portugal, so there is no live price to read',
  },
];

export const STORE_BY_ID = Object.fromEntries(STORES.map((store) => [store.id, store]));

/**
 * Products that answer a word but are a different thing on the shelf.
 * "Leite" must not become chocolate milk, "tomate" must not become tomato
 * purée, "frango" must not become sliced chicken ham.
 */
const NOT_WHAT_YOU_MEAN = {
  leite: ['achocolatado', 'chocolate', 'condensado', 'evaporado', 'po', 'batido', 'fermentado', 'kefir', 'iogurte', 'bebida', 'sobremesa', 'gelado', 'creme', 'natas', 'manteiga'],
  tomate: ['frito', 'polpa', 'pelado', 'concentrado', 'seco', 'desidratado', 'ketchup', 'molho', 'sopa', 'sumo', 'passa', 'conserva', 'esmagado', 'triturado', 'pedacos', 'inteiro', 'cubo', 'seca', 'desidratada'],
  frango: ['fiambre', 'nuggets', 'hamburguer', 'salsicha', 'caldo', 'panado', 'empanado', 'folhado', 'rissol', 'croquete', 'sopa', 'pate', 'assado', 'grelhado', 'estrogonofe', 'strogonoff', 'marinado', 'cordon', 'bleu', 'almondega', 'almondegas'],
  batata: ['frita', 'fritas', 'palha', 'chips', 'doce', 'pure', 'flocos', 'congelada', 'assada', 'cozida', 'salada'],
  arroz: ['bebida', 'bolacha', 'farinha', 'puff', 'tortilha', 'papas', 'doce', 'preparado', 'sopa'],
  cebola: ['frita', 'desidratada', 'po', 'molho', 'sopa', 'conserva', 'pickle', 'picada', 'picado', 'laminada', 'laminado'],
  alho: ['po', 'granulado', 'seco', 'pasta', 'molho', 'sopa', 'frances', 'francês', 'cortado', 'moido', 'frasco'],
  gengibre: ['moido', 'frasco', 'po', 'seco', 'cristalizado', 'pasta'],
  pimento: ['assado', 'assada', 'conserva', 'frasco'],
  azeite: ['bagaco', 'spray', 'sabao', 'corporal', 'atum', 'sardinha'],
  manteiga: ['amendoim', 'cacau', 'caju', 'sementes', 'corporal', 'vegetal'],
  farinha: ['amendoa', 'bebe', 'milho', 'batata', 'aveia', 'arroz', 'coco', 'preparado', 'bolo'],
  ovos: [
    'chocolate', 'pascoa', 'codorniz', 'moles', 'aveiro', 'pastel', 'folhado', 'recheado', 'batido',
    'pudim', 'pasteurizado', 'pasteurizados', 'liquido', 'claras', 'gemas',
  ],
  queijo: ['creme', 'fresco', 'ralado', 'fatiado', 'amanteigado'],
  iogurte: ['bebivel', 'gelado', 'sobremesa'],
  nata: ['vegetal', 'batido', 'chantilly', 'spray'],
  atum: ['patê', 'pate', 'salada', 'molho'],
};

const PROCESSED = new Set([
  'frito', 'frita', 'fritos', 'fritas', 'congelado', 'congelada', 'congelados', 'congeladas',
  'po', 'desidratado', 'desidratada', 'concentrado', 'concentrada', 'molho', 'sopa', 'caldo',
  'batido', 'achocolatado', 'recheado', 'panado', 'empanado', 'seco', 'seca', 'conserva',
  'snack', 'bolacha', 'sobremesa', 'gelado', 'preparado', 'temperado', 'marinado',
  'assado', 'assada', 'assados', 'assadas', 'cozido', 'cozida', 'cozidos', 'cozidas',
  'grelhado', 'grelhada', 'grelhados', 'grelhadas', 'estrogonofe', 'strogonoff',
  'pedacos', 'cubo', 'cubos', 'moles', 'desfiado', 'desfiada', 'fumado', 'fumada',
]);

/**
 * Pick the product that actually is what was asked for.
 *
 * Every word of the query must appear in the product name, the name must not
 * contain a word that makes it a different product, and among the rest the one
 * with the fewest extra words wins (a plain "Tomate" beats "Tomate Coração de
 * Boi Extra"), then the cheaper one per kilo.
 */
export function bestMatch(term, products, need = {}) {
  const wanted = tokens(term);
  if (!wanted.length) return null;
  const banned = new Set(NOT_WHAT_YOU_MEAN[wanted[0]] ?? []);
  const grams = Number(need.grams) > 0 ? Number(need.grams) : 0;
  const count = Number(need.count) > 0 ? Number(need.count) : 0;

  const candidates = products
    .filter((product) => product.available !== false && (product.perKg > 0 || product.packUnits > 0))
    .map((product) => {
      const words = tokens(`${product.name} ${product.brand ?? ''}`);
      const set = new Set(words);
      if (!wanted.every((token) => set.has(token))) return null;
      if (words.some((word) => banned.has(word))) return null;
      const extra = words.filter((word) => !wanted.includes(word));
      // The head noun has to lead the name: "Atum em Azeite" is tuna, "Polpa de
      // Tomate com Cebola e Alho" is tomato purée, "Massa Ninho de Ovos" is pasta.
      if (words[0] !== wanted[0]) return null;
      // A query never means the processed version: no roasted peppers for
      // "red pepper", no ground ginger in a jar for "ginger".
      if (extra.some((word) => PROCESSED.has(word))) return null;
      return { product, extra: extra.length, score: 1 / (1 + extra.length) };
    })
    .filter(Boolean);

  // What each product would actually cost for the amount the recipe needs: whole
  // packs, so an 8 L milk carton is not "cheap" for 200 ml.
  const costed = candidates.map((entry) => {
    const product = entry.product;
    let packs = null;
    if (count && product.packUnits) packs = Math.ceil(count / product.packUnits);
    else if (grams && product.packGrams) packs = Math.ceil(grams / product.packGrams);
    return { ...entry, packs, cost: packs ? round(packs * product.price) : null };
  });

  const affordable = costed.filter((entry) => entry.cost != null);
  if (affordable.length) {
    affordable.sort(
      (a, b) => a.cost - b.cost || (a.product.perKg || Infinity) - (b.product.perKg || Infinity) || b.score - a.score,
    );
  }

  // No quantity to cost against (or no pack information): fall back to the
  // cheapest qualifying product, by kilo and then by item.
  let pool = affordable;
  if (!pool.length) {
    const weighed = costed.filter((entry) => entry.product.perKg > 0);
    pool = weighed.length ? weighed : costed.filter((entry) => entry.product.packUnits > 0);
    if (!pool.length) return null;
    pool.sort((a, b) =>
      weighed.length
        ? a.product.perKg - b.product.perKg || b.score - a.score
        : a.product.price / a.product.packUnits - b.product.price / b.product.packUnits || b.score - a.score,
    );
  }

  const top = pool[0];
  const perUnit = top.product.packUnits ? round(top.product.price / top.product.packUnits, 3) : null;
  return {
    id: top.product.id,
    name: top.product.name,
    brand: top.product.brand,
    price: round(top.product.price),
    packGrams: top.product.packGrams,
    packUnits: top.product.packUnits ?? null,
    packLabel: top.product.packLabel,
    perKg: top.product.perKg > 0 ? round(top.product.perKg) : null,
    perUnit,
    packs: top.packs ?? null,
    cost: top.cost ?? null,
    url: top.product.url,
  };
}

/** Fill in the pack weight a shop implies but does not print (price / € per kg). */
export function normaliseProducts(products) {
  return products.map((product) => {
    if (product.packGrams || !(product.perKg > 0) || !(product.price > 0)) return product;
    return { ...product, packGrams: Math.round((product.price / product.perKg) * 1000) };
  });
}
