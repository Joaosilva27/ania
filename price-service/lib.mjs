// Shared helpers for the live price service: HTTP with a browser-ish client,
// HTML text extraction, pack-size parsing and a small disk-backed cache.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const CACHE_DIR = path.resolve('.cache/live');
export const TTL_MS = 6 * 60 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** One request, retried briefly when a shop throttles us (401/403/429/5xx). */
export async function fetchText(url, { timeout = 20000, headers = {}, attempts = 3 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'user-agent': UA,
          accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
          'accept-language': 'pt-PT,pt;q=0.9,en;q=0.6',
          ...headers,
        },
      });
      const body = await response.text();
      if (response.ok) return { ok: true, status: response.status, body, url: response.url };
      lastError = new Error(`HTTP ${response.status}`);
      // 401/403 from a shop means "not now" — retrying a burst makes it worse.
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === attempts) return { ok: false, status: response.status, body, url: response.url };
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    } finally {
      clearTimeout(timer);
    }
    await sleep(400 * attempt + Math.random() * 300);
  }
  throw lastError ?? new Error('request failed');
}

// Named entities the shops actually use, including the upper-case forms Auchan
// puts in its analytics payload ("P&Atilde;O").
const NAMED_ENTITIES = {
  quot: '"', apos: "'", amp: '&', lt: '<', gt: '>', nbsp: ' ', euro: '€', hellip: '…',
  aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', auml: 'ä',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  iacute: 'í', igrave: 'ì', icirc: 'î', iuml: 'ï',
  oacute: 'ó', ograve: 'ò', ocirc: 'ô', otilde: 'õ', ouml: 'ö',
  uacute: 'ú', ugrave: 'ù', ucirc: 'û', uuml: 'ü',
  ccedil: 'ç', ntilde: 'ñ', ordf: 'ª', ordm: 'º', deg: '°',
};

export function decodeEntities(value) {
  return value
    .replace(/&([a-zA-Z]+);/g, (entity, name) => NAMED_ENTITIES[name.toLowerCase()] ?? entity)
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}
export function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** "5,10" -> 5.1 ; "1.234,56" -> 1234.56 */
export function parsePrice(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return null;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalised = cleaned;
  if (lastComma > lastDot) {
    normalised = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma && lastComma >= 0) {
    normalised = cleaned.replace(/,/g, '');
  } else {
    normalised = cleaned.replace(/,/g, '.');
  }
  const value = Number(normalised);
  return Number.isFinite(value) ? value : null;
}

const UNIT_GRAMS = { g: 1, gr: 1, gramas: 1, kg: 1000, quilo: 1000, quilos: 1000, mg: 0.001 };

/**
 * Read the size of a pack out of a supermarket label or product name.
 * "6 x 1 lt" -> 6000 g, "Cada emb. 110 g / 114 g" -> 110 g, "1,5 kg" -> 1500 g.
 * Liquids are treated as 1 g/ml, which is exact enough for basket maths.
 */
export function parsePackGrams(text) {
  if (!text) return null;
  const source = String(text).toLowerCase().replace(/\u00a0/g, ' ');
  const size = '(\\d+(?:[.,]\\d+)?)\\s*(kg|g|gr|gramas|quilos?|mg|lt|l|ml|cl)';

  const multi = source.match(new RegExp(`(\\d+)\\s*(?:x|×)\\s*${size}`));
  if (multi) {
    const count = Number(multi[1]);
    const each = toGrams(multi[2], multi[3]);
    if (each) return Math.round(count * each);
  }

  const all = [...source.matchAll(new RegExp(size, 'g'))].map((match) => toGrams(match[1], match[2])).filter(Boolean);
  if (all.length) return Math.round(Math.min(...all));
  return null;
}

function toGrams(value, unit) {
  const amount = parsePrice(value);
  if (!amount) return null;
  if (UNIT_GRAMS[unit]) return amount * UNIT_GRAMS[unit];
  if (unit === 'l' || unit === 'lt') return amount * 1000;
  if (unit === 'ml') return amount;
  if (unit === 'cl') return amount * 10;
  return null;
}

/** €/kg from a supermarket "1 kg = 27,18" / "0,85 €/lt" label. */
export function parseUnitPrice(text) {
  if (!text) return null;
  const source = String(text).replace(/\u00a0/g, ' ');
  const match = source.match(/(\d+(?:[.,]\d+)?)\s*(?:€|eur)?\s*(?:\/|por|por cada)\s*(kg|quilo|lt|l|litro|ml|g|un|unid)/i);
  if (!match) return null;
  const value = parsePrice(match[1]);
  if (!value) return null;
  const unit = match[2].toLowerCase();
  if (unit === 'kg' || unit === 'quilo') return value;
  if (unit === 'g') return value * 1000;
  if (unit === 'lt' || unit === 'l' || unit === 'litro') return value;
  if (unit === 'ml' || unit === 'cl') return value * 1000;
  // "€/un" is a price per item, not per kilo: useless for a weight comparison.
  return null;
}

/** How many items a pack holds: "12 Un", "6 unid", "10 unidades" -> 12, 6, 10. */
export function parsePackUnits(text) {
  if (!text) return null;
  const written = String(text).toLowerCase();
  if (/meia\s*d[uú]zia/.test(written)) return 6;
  if (/\bd[uú]zia\b/.test(written)) return 12;
  const match = String(text).match(/(\d+)\s*(?:un|unid|unidade|unidades)\b/i);
  if (!match) return null;
  const count = Number(match[1]);
  return count > 0 && count < 100 ? count : null;
}

export function normalise(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set(['de', 'da', 'do', 'e', 'com', 'para', 'the', 'and', 'with', 'fresh', 'fresco', 'fresca']);

/**
 * Portuguese plural, reduced to the singular the catalogue also uses:
 * "tortilhas" -> "tortilha", "ovos" -> "ovo", "coentros" -> "coentro".
 * Words that only look plural ("hummus", "gás") are left alone.
 */
export function tokens(value) {
  return normalise(value)
    .split(' ')
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
    .map((token) =>
      token.length > 3 && token.endsWith('s') && !/(ss|us|is)$/.test(token) ? token.slice(0, -1) : token,
    );
}

/** How well a product name answers a query: shared tokens, order independent. */
export function relevance(query, name) {
  const wanted = tokens(query);
  if (!wanted.length) return 0;
  const haystack = ` ${normalise(name)} `;
  let score = 0;
  for (const token of wanted) {
    if (haystack.includes(` ${token} `)) score += 2;
    else if (haystack.includes(token)) score += 1;
  }
  return score / (wanted.length * 2);
}

function cacheFile(key) {
  const safe = key.replace(/[^a-z0-9_-]+/gi, '_').slice(0, 120);
  return path.join(CACHE_DIR, `${safe}.json`);
}

export async function cacheGet(key) {
  try {
    const raw = await readFile(cacheFile(key), 'utf8');
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.at > TTL_MS) return null;
    return parsed.value;
  } catch {
    return null;
  }
}

export async function cacheSet(key, value) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cacheFile(key), JSON.stringify({ at: Date.now(), value }), 'utf8');
  } catch {
    /* cache is best-effort */
  }
}
