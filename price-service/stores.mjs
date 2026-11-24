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

/**
 * Continente (Salesforce Commerce Cloud): tiles carry a JSON impression blob.
 *
 * Fresh produce is often loose — the tile has a price and a fresh-produce
 * category but no pack size. That price is per kilo (peppers at 3,49 €/kg, a
 * cucumber at 1,99 €/kg), so it is billed by weight instead of pretending you
 * must buy a whole kilo.
 */
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
    const fresh = /frutas e legumes|legumes|talho|peixaria/i.test(meta.category ?? '');
    const soldByKg = fresh && !packMatch;
    const packGrams = soldByKg ? 1000 : parsePackGrams(packMatch ? packMatch[1] : '') ?? parsePackGrams(meta.name);
    let perKg = parseUnitPrice(unitLabel);
    if (soldByKg) perKg = parseUnitPrice(unitLabel) ?? meta.price;
    else if (perKg == null && packGrams) perKg = (meta.price / packGrams) * 1000;

    products.push({
      id: String(meta.id ?? ''),
      name: meta.name,
      brand: meta.brand ?? null,
      price: meta.price,
      packGrams: packGrams ?? null,
      packLabel: soldByKg ? 'por kg' : packMatch ? packMatch[1].trim() : null,
      perKg: perKg == null ? null : round(perKg),
      packUnits: parsePackUnits(packMatch ? packMatch[1] : '') ?? parsePackUnits(meta.name),
      soldByKg,
      available: true,
      url: hrefMatch ? hrefMatch[1] : url,
    });
  }
  return products;
}

/** Pingo Doce: its catalogue is client-rendered, so we read it through the
 *  public cesta.pt catalogue server (MCP over HTTP, no key, Portuguese prices).
 *
 *  cesta prints loose produce as "0.15 Kg · 1,59€" with no €/kg field: the price
 *  is per kilo and 0.15 kg is the reference piece. Packaged goods always carry a
 *  €/kg field next to a real pack price. */
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
    const sizeGrams = parsePackGrams(sizeField) ?? parsePackGrams(slug);
    // No €/kg line and a weight: loose produce, priced by the kilo.
    const soldByKg = !unitField && sizeGrams != null && !/embalad|pacote|saco/i.test(name);
    const packGrams = soldByKg ? 1000 : sizeGrams;
    let perKg = soldByKg ? price : parseUnitPrice(unitField);
    if (perKg == null && packGrams) perKg = (price / packGrams) * 1000;
    products.push({
      id: pid,
      name,
      brand: null,
      price,
      packGrams: packGrams ?? null,
      packLabel: soldByKg ? 'por kg' : sizeField || null,
      perKg: perKg == null ? null : round(perKg),
      packUnits: parsePackUnits(sizeField) ?? parsePackUnits(name),
      soldByKg,
      available: true,
      url,
    });
  }
  return products;
}

/** Lidl Portugal: the shop's own search API returns JSON.
 *
 *  Its gateway answers HTTP 401 once it has seen a few requests from one IP; that
 *  is a rate limit, not an auth error. We wait briefly, and if it still says no
 *  the shop is reported as temporarily unread rather than given a guessed price.
 *
 *  lidl.pt's HTML search is not a substitute: it is client-rendered and, for most
 *  groceries, serves merchandising instead of the product asked for. This JSON
 *  endpoint is the only place Lidl publishes a shelf price for its food. */
async function lidl(term) {
  const url = `https://www.lidl.pt/q/api/search?q=${encodeURIComponent(term)}&assortment=PT&locale=pt_PT&version=2.1.0&fetchsize=10`;
  let body = '';
  let lastStatus = 0;
  // Short waits: when Lidl is blocking, it blocks for a long time, and a basket
  // cannot sit waiting for it.
  const waits = [0, 1200];
  for (const wait of waits) {
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait + Math.random() * 400));
    const response = await fetchText(url, { timeout: 8000, headers: { accept: 'application/json' }, attempts: 1 });
    lastStatus = response.status;
    if (response.ok) {
      body = response.body;
      break;
    }
    if (response.status !== 401 && response.status !== 403 && response.status !== 429) break;
  }
  if (!body) {
    if (lastStatus === 401 || lastStatus === 403 || lastStatus === 429) {
      throw new Error('Lidl is rate-limiting requests from this connection — try again in a few minutes');
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
        id: String(data.productId ?? data.erpNumber ?? ''),
        name: fullTitle || data.fullTitle || data.title || '',
        brand: data.brand?.name && data.brand.name !== '-' ? data.brand.name : null,
        price,
        packGrams: packGrams ?? null,
        packLabel: packaging || null,
        perKg: perKg == null ? null : round(perKg),
        packUnits: parsePackUnits(packaging) ?? parsePackUnits(fullTitle),
        soldByKg: false,
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
 *  in the HTML. That is what we read. Loose produce carries a `-kg` slug and is
 *  sold by weight. */
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
      block.match(/productUrl(?:&quot;|\\?\"):(?:&quot;|\\?\")([^"&\\]+)/)?.[1] ?? '',
    );
    const unitRaw = block.match(/auc-measures--price-per-unit"[^>]*>([^<]+)</)?.[1] ?? '';
    const slug = productUrl.split('/').filter(Boolean).slice(-2)[0] ?? '';
    const name = decodeEntities(meta.name);
    const unitPerKg = parseUnitPrice(decodeEntities(unitRaw));
    // "LIMA KG" is sold by the kilo; "CEBOLA AUCHAN 2 KG" is a 2 kg bag whose
    // price is twice its €/kg, so it stays a pack.
    const declaredKg = /\bKG$/i.test(name.trim());
    const soldByKg = declaredKg && (unitPerKg == null || price <= unitPerKg * 1.05);
    const packGrams = soldByKg ? 1000 : parsePackGrams(name) ?? parsePackGrams(slug);
    const perKg = unitPerKg ?? (packGrams ? (price / packGrams) * 1000 : null);

    products.push({
      id,
      name,
      brand: meta.brand ? decodeEntities(meta.brand) : null,
      price,
      packGrams: packGrams ?? null,
      packLabel: soldByKg ? 'por kg' : packGrams ? `${packGrams >= 1000 ? packGrams / 1000 : packGrams}${packGrams >= 1000 ? ' kg' : ' g'}` : null,
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
 * Words that mean the shelf product is a different thing from the ingredient.
 * Keys are the head word the shopper searched for (singular).
 */
const NOT_WHAT_YOU_MEAN = {
  leite: ['achocolatado', 'chocolate', 'condensado', 'evaporado', 'po', 'batido', 'fermentado', 'kefir', 'iogurte', 'bebida', 'sobremesa', 'gelado', 'creme', 'nata', 'manteiga', 'arroz', 'amendoa', 'aveia', 'soja', 'coco'],
  tomate: ['frito', 'polpa', 'pelado', 'concentrado', 'seco', 'seca', 'desidratado', 'desidratada', 'ketchup', 'molho', 'sopa', 'sumo', 'passa', 'conserva', 'esmagado', 'triturado', 'pedaco', 'inteiro', 'cubo', 'cherry', 'mini'],
  frango: ['fiambre', 'nugget', 'hamburguer', 'salsicha', 'caldo', 'panado', 'empanado', 'folhado', 'rissol', 'croquete', 'sopa', 'pate', 'assado', 'grelhado', 'estrogonofe', 'strogonoff', 'marinado', 'cordon', 'bleu', 'almondega', 'bife', 'tira'],
  batata: ['frito', 'palha', 'chip', 'doce', 'pure', 'floco', 'congelada', 'assada', 'cozida', 'salada', 'rolo', 'rissol'],
  arroz: ['bebida', 'bolacha', 'farinha', 'puff', 'tortilha', 'tortita', 'papa', 'doce', 'preparado', 'sopa', 'bolo', 'snack', 'salgado', 'pipoca'],
  cebola: ['frito', 'desidratado', 'po', 'molho', 'sopa', 'conserva', 'pickle', 'picado', 'laminado'],
  alho: ['picado', 'moido', 'po', 'granulado', 'pasta', 'molho', 'sopa', 'frances', 'cortado', 'laminado', 'frasco', 'pao', 'baguete'],
  gengibre: ['moido', 'frasco', 'po', 'seco', 'desidratado', 'cristalizado', 'pasta', 'conserva'],
  pimento: ['assado', 'conserva', 'frasco', 'snack', 'frito'],
  azeite: ['bagaco', 'spray', 'sabao', 'corporal', 'atum', 'sardinha'],
  manteiga: ['amendoim', 'cacau', 'caju', 'semente', 'corporal', 'vegetal'],
  farinha: ['amendoa', 'bebe', 'milho', 'batata', 'aveia', 'arroz', 'coco', 'preparado', 'bolo'],
  ovo: ['chocolate', 'pascoa', 'codorniz', 'mole', 'aveiro', 'pastel', 'folhado', 'recheado', 'batido', 'pudim', 'pasteurizado', 'liquido', 'clara', 'gema', 'salada', 'rissol', 'bolo', 'doce', 'queque', 'tarte', 'producao'],
  queijo: ['creme', 'fresco', 'ralado', 'fatiado', 'amanteigado'],
  iogurte: ['bebivel', 'gelado', 'sobremesa'],
  nata: ['vegetal', 'batido', 'chantilly', 'spray'],
  atum: ['pate', 'salada', 'molho'],
  coentro: ['moido', 'moida', 'saqueta', 'frasco', 'desidratado', 'seco', 'pasta', 'molho', 'semente'],
  salsa: ['moido', 'moida', 'saqueta', 'frasco', 'desidratado', 'seco', 'pasta', 'molho', 'semente'],
  manjericao: ['moido', 'saqueta', 'frasco', 'desidratado', 'seco', 'pasta', 'molho'],
  hortela: ['moido', 'saqueta', 'frasco', 'desidratado', 'seco', 'pasta', 'molho', 'cha'],
  tomilho: ['moido', 'saqueta', 'frasco', 'desidratado', 'seco', 'pasta', 'molho'],
  pepino: ['vinagre', 'conserva', 'rodela', 'palito', 'pickle', 'snack', 'mocktail'],
  cenoura: ['ripado', 'ralado', 'conserva', 'molho', 'sopa'],
  couve: ['roxa', 'bruxelas', 'lombarda', 'flor', 'kale', 'migas', 'semente'],
  acucar: ['baunilhado', 'coco', 'light', 'zero', 'stick', 'bolacha'],
  vaca: ['queijo', 'leite', 'hamburguer', 'almondega', 'kebab', 'bolinha', 'tira', 'cao', 'gato', 'noodle', 'ramen', 'sopa', 'caldo', 'preparado'],
  bife: ['porco', 'frango', 'peru', 'panado', 'caldo', 'molho', 'cordon', 'kebab', 'atum', 'soja', 'seitan', 'tofu', 'vegetal', 'cacao'],
  bovino: ['porco', 'frango', 'peru', 'hamburguer', 'almondega', 'kebab', 'preparado', 'tira'],
  pescada: ['panado', 'frito', 'fritar', 'douradinho', 'nugget', 'rissol', 'mimo'],
  camarao: ['rissol', 'rissoi', 'noodle', 'acorda', 'sopa', 'molho', 'patanisca', 'snack'],
  cebolinho: ['queijo', 'creme', 'rolo', 'manteiga', 'pao', 'batata', 'snack', 'sopa', 'molho', 'frasco', 'saqueta', 'desidratado', 'arroz', 'frango', 'carne', 'peixe', 'massa', 'refeicao', 'prato'],
  oleo: ['atum', 'sardinha', 'cavala', 'peixe', 'conserva', 'corporal', 'massagem', 'motor', 'essencial', 'limpeza', 'sabao'],
  malagueta: ['queijo', 'recheado', 'conserva', 'frasco', 'molho', 'seco', 'desidratado', 'pasta', 'snack'],
  caril: ['noodle', 'massa', 'sopa', 'refeicao', 'preparado', 'batata', 'mistura', 'express'],
  limao: ['detergente', 'loica', 'vinagre', 'gelatina', 'ice', 'tea', 'nectar', 'sumo', 'bebida', 'refrigerante', 'bolacha', 'iogurte', 'gelado', 'mousse', 'creme', 'batido', 'smoothie', 'limpeza'],
};

/**
 * Preparation words. A fresh ingredient is never the prepared version, but a
 * query that asks for the preparation ("cominhos moídos", "tomate pelado") keeps
 * it. Frozen plain produce and fish are not in this list on purpose: frozen
 * prawns are prawns.
 */
const PREPARED = new Set([
  'frito', 'frita', 'fritar', 'panado', 'panada', 'empanado', 'empanada',
  'rissol', 'rissoi', 'croquete', 'hamburguer', 'hamburguere', 'almondega', 'bolinha',
  'kebab', 'temperado', 'temperada', 'marinado', 'marinada', 'recheado', 'recheada',
  'preparado', 'preparada', 'molho', 'sopa', 'caldo', 'conserva', 'pickle',
  'snack', 'sobremesa', 'gelado', 'desidratado', 'desidratada',
  'picado', 'picada', 'ripado', 'ripada', 'ralado', 'ralada', 'tira',
  'nugget', 'salsicha', 'fiambre', 'bebida', 'sumo', 'batido', 'iogurte',
  'bolacha', 'biscoito', 'semente', 'acorda', 'patanisca', 'empadao', 'pizza', 'lasanha', 'cubo',
]);

function phraseInOrder(words, wanted) {
  let from = 0;
  for (const token of wanted) {
    const at = words.indexOf(token, from);
    if (at < 0) return false;
    from = at + 1;
  }
  return true;
}

/**
 * Pick the product that actually is what was asked for.
 *
 * Every word of the query must appear in the product name, in order; the head
 * word has to lead the name (a phrase) or sit in the first few words (a single
 * distinctive word can follow a brand); and a word that makes it a different
 * product — prepared, a different cut, a different flour — disqualifies it.
 * Among what is left, the cheapest thing that covers the amount needed wins,
 * because that is what you would pay.
 */
export function bestMatch(term, products, need = {}) {
  const wanted = tokens(term);
  if (!wanted.length) return null;
  const head = wanted[0];
  const banned = new Set(NOT_WHAT_YOU_MEAN[head] ?? []);
  const grams = Number(need.grams) > 0 ? Number(need.grams) : 0;
  const count = Number(need.count) > 0 ? Number(need.count) : 0;
  // A phrase has to lead the name; a single distinctive word may follow a brand.
  const headLimit = wanted.length > 1 ? 0 : 2;
  const isBanned = (word) => banned.has(word) || banned.has(`${word}s`);

  const candidates = [];
  for (const product of products) {
    if (product.available === false || !(product.price > 0)) continue;
    const words = tokens(`${product.name} ${product.brand ?? ''}`);
    if (!words.length) continue;
    const set = new Set(words);
    if (!wanted.every((token) => set.has(token))) continue;
    if (!phraseInOrder(words, wanted)) continue;
    const headIndex = words.indexOf(head);
    if (headIndex < 0 || headIndex > headLimit) continue;
    if (words.some((word) => isBanned(word) && !wanted.includes(word))) continue;
    const extra = words.filter((word) => !wanted.includes(word));
    if (extra.some((word) => PREPARED.has(word))) continue;
    candidates.push({ product, extra: extra.length });
  }

  // What each product would actually cost for the amount the recipe needs: whole
  // packs for packaged goods, exact weight for loose produce, and one pack when
  // the shop lists no size at all.
  const costed = candidates.map((entry) => {
    const product = entry.product;
    const loose = Boolean(product.soldByKg) && product.perKg > 0 && grams > 0;
    let packs = null;
    let billedGrams = null;
    let cost = null;
    if (loose) {
      billedGrams = grams;
      // A gram of salt is a fraction of a cent; the smallest real purchase is
      // one cent, not a free product.
      cost = Math.max(round((product.perKg * grams) / 1000, 4), 0.01);
    } else {
      if (count && product.packUnits) packs = Math.ceil(count / product.packUnits);
      else if (grams && product.packGrams) packs = Math.ceil(grams / product.packGrams);
      cost = packs ? round(packs * product.price) : round(product.price);
    }
    return { ...entry, packs, cost, billedGrams, loose };
  });

  if (!costed.length) return null;
  // Weight-billed lines can be fractions of a cent (1 g of salt); keep enough
  // precision that they do not round away to a free product.
  costed.forEach((entry) => {
    if (entry.loose && entry.cost != null) entry.cost = round(entry.cost, 4);
  });
  costed.sort(
    (a, b) =>
      a.cost - b.cost ||
      (a.product.perKg || Infinity) - (b.product.perKg || Infinity) ||
      a.extra - b.extra,
  );

  const top = costed[0];
  const perUnit = top.product.packUnits ? round(top.product.price / top.product.packUnits, 3) : null;
  return {
    id: top.product.id,
    name: top.product.name,
    brand: top.product.brand,
    price: round(top.product.price),
    packGrams: top.product.packGrams,
    packUnits: top.product.packUnits ?? null,
    packLabel: top.product.packLabel,
    soldByKg: Boolean(top.product.soldByKg),
    perKg: top.product.perKg > 0 ? round(top.product.perKg) : null,
    perUnit,
    packs: top.packs ?? null,
    grams: top.billedGrams,
    cost: top.cost ?? null,
    url: top.product.url,
  };
}

/** Fill in the pack weight a shop implies but does not print (price / € per kg). */
export function normaliseProducts(products) {
  return products.map((product) => {
    if (product.soldByKg || product.packGrams || !(product.perKg > 0) || !(product.price > 0)) return product;
    return { ...product, packGrams: Math.round((product.price / product.perKg) * 1000) };
  });
}
