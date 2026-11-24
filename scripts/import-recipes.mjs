#!/usr/bin/env node
/**
 * Builds the bundled recipe catalogue from two real, openly accessible sources:
 *
 *   1. TheMealDB  — https://www.themealdb.com (free API, real home-cooking
 *      recipes with real photography; used under their free-API terms).
 *   2. Wikibooks Cookbook — https://en.wikibooks.org/wiki/Cookbook:Table_of_Contents
 *      (community-written recipes, CC BY-SA; every page we import carries its
 *      author/licence credit into `recipe.source`).
 *
 * Nothing in the output is invented: titles, ingredients, measures, steps and
 * photographs all come from those pages. Times, difficulty, tags and meal types
 * are derived from the recipe text (see `deriveMeta`) because neither API
 * publishes them consistently.
 *
 * Usage:
 *   node scripts/import-recipes.mjs             # use cache when present
 *   node scripts/import-recipes.mjs --refresh   # refetch every remote page
 *   node scripts/import-recipes.mjs --limit=1000
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, '.cache', 'import');
const IMAGES = path.join(ROOT, 'assets', 'recipes');
const RECIPE_OUT = path.join(ROOT, 'src', 'data', 'recipes', 'imported.json');
const INGREDIENT_OUT = path.join(ROOT, 'src', 'data', 'ingredients.imported.json');

const REFRESH = process.argv.includes('--refresh');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) ?? '').split('=')[1]) || 1000;
const IMAGE_WIDTH = 720;
const IMAGE_QUALITY = 72;

const UA = 'ania-recipe-import/1.0 (personal cooking app; contact: local)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(IMAGES, { recursive: true });

/* ------------------------------------------------------------------ */
/* http                                                               */
/* ------------------------------------------------------------------ */

async function http(url, { json = true, binary = false, tries = 5 } = {}) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      const headers = { 'User-Agent': UA, Accept: '*/*' };
      // Wikimedia's media CDN is friendlier when the request looks like a
      // reader following a link from the wiki page.
      if (/wikimedia/.test(url)) headers.Referer = 'https://en.wikibooks.org/';
      // Fandom's media CDN answers 403 unless the request looks like the wiki
      // page loading its own image.
      if (/nocookie\.net|wikia/.test(url)) {
        headers['User-Agent'] =
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
        headers.Referer = 'https://recipes.fandom.com/';
        headers.Accept = 'image/avif,image/webp,image/apng,*/*';
      }
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
      if (res.status === 429) {
        // Wikimedia asks clients to back off rather than hammer the endpoint;
        // honour Retry-After when it is present (it can be minutes).
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 20000 * (attempt + 1);
        console.warn(`rate limited — waiting ${Math.round(wait / 1000)}s`);
        await sleep(Math.min(wait, 60000));
        throw new Error('HTTP 429');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (binary) return Buffer.from(await res.arrayBuffer());
      const text = await res.text();
      return json ? JSON.parse(text) : text;
    } catch (error) {
      if (attempt === tries - 1) throw error;
      await sleep(400 * (attempt + 1) ** 2);
    }
  }
  throw new Error(`unreachable ${url}`);
}

async function cached(name, producer) {
  const file = path.join(CACHE, `${name}.json`);
  if (!REFRESH && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const data = await producer();
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}

/* ------------------------------------------------------------------ */
/* ingredient registry (read from the hand-maintained TS file)         */
/* ------------------------------------------------------------------ */

function loadRegistry() {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'data', 'ingredients.ts'), 'utf8');
  const rows = [];
  const rowRe = /\[\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'(?:,\s*'([^']+)')?(?:,\s*(true|false))?\s*\]/g;
  let match;
  while ((match = rowRe.exec(source))) {
    rows.push({
      id: match[1],
      name: match[2],
      category: match[3],
      family: match[4],
      origin: match[5],
      icon: match[6],
      pantryStaple: match[7] === 'true' ? true : undefined,
    });
  }
  const aliasSrc = source.slice(source.indexOf('const ALIAS_MAP'));
  const aliases = {};
  const aliasRe = /'([^']+)':\s*'([^']+)'/g;
  while ((match = aliasRe.exec(aliasSrc))) aliases[match[1]] = match[2];
  return { rows, aliases };
}

/* ------------------------------------------------------------------ */
/* text helpers                                                       */
/* ------------------------------------------------------------------ */

const UNITS = {
  g: ['g', 'gr', 'gram', 'grams', 'gm', 'gms'],
  kg: ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'],
  ml: ['ml', 'mls', 'millilitre', 'millilitres', 'milliliter', 'milliliters'],
  l: ['l', 'lt', 'ltr', 'litre', 'litres', 'liter', 'liters'],
  tsp: ['tsp', 'tsps', 'teaspoon', 'teaspoons', 't'],
  tbsp: ['tbsp', 'tbsps', 'tablespoon', 'tablespoons', 'tbs', 'tbl'],
  cup: ['cup', 'cups', 'c'],
  piece: ['piece', 'pieces', 'pc', 'pcs', 'unit', 'units', 'x'],
  clove: ['clove', 'cloves'],
  slice: ['slice', 'slices'],
  head: ['head', 'heads'],
  bunch: ['bunch', 'bunches'],
  sprig: ['sprig', 'sprigs'],
  handful: ['handful', 'handfuls'],
  pinch: ['pinch', 'pinches', 'dash', 'dashes'],
  can: ['can', 'cans', 'tin', 'tins', 'jar', 'jars', 'packet', 'packets', 'pack', 'packs', 'sachet', 'sachets', 'bottle', 'bottles', 'tub', 'tubs', 'bag', 'bags', 'box', 'boxes'],
};

const UNIT_LOOKUP = Object.entries(UNITS).reduce((acc, [unit, words]) => {
  for (const word of words) acc[word] = unit;
  return acc;
}, {});

const FRACTIONS = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1 / 6, '⅚': 5 / 6 };

function toNumber(raw) {
  if (raw == null) return null;
  const text = String(raw).trim().replace(/[½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚]/g, (c) => ` ${FRACTIONS[c]} `);
  const mixed = text.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  const decimal = text.match(/-?\d+(?:[.,]\d+)?/);
  if (!decimal) return null;
  const value = Number(decimal[0].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/** "200g" | "1/2 cup" | "2 cloves" | "" → { quantity, unit, note } */
function parseMeasure(raw) {
  const text = String(raw ?? '').trim().toLowerCase();
  if (!text || /^(to taste|as needed|as required|for serving|for garnish|optional)$/.test(text)) {
    return { quantity: 1, unit: 'pinch', note: text && !/^to taste$/.test(text) ? raw.trim() : undefined };
  }
  const cleaned = text
    .replace(/[()]/g, ' ')
    .replace(/(\d)\s*-\s*(\d)/g, '$1')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  const quantity = toNumber(cleaned);
  if (quantity == null) {
    const wordOnly = cleaned.match(/^(?:a|an|some)\s+(.*)$/);
    if (wordOnly) return { quantity: 1, unit: 'unit', note: wordOnly[1] };
    return { quantity: 1, unit: 'unit', note: String(raw).trim() || undefined };
  }

  const rest = cleaned.replace(/^[\d\s./½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚,-]+/, '').trim();
  const [firstWord] = rest.split(' ');
  let unit = UNIT_LOOKUP[firstWord];

  if (unit === 'g' && rest.startsWith('oz')) unit = undefined;
  const isImperial = /^(oz|ounce|ounces|lb|lbs|pound|pounds)\b/.test(rest);
  if (isImperial) {
    const grams = /^(oz|ounce|ounces)\b/.test(rest) ? quantity * 28.35 : quantity * 453.6;
    return { quantity: Math.round(grams), unit: 'g', note: String(raw).trim() };
  }

  if (!unit) {
    // "2 eggs" / "3 carrots": no unit word, the ingredient itself is the unit.
    return { quantity, unit: 'unit', note: rest || undefined };
  }
  const note = rest.split(' ').slice(1).join(' ').trim();
  return { quantity, unit, note: note || undefined };
}

const DROP_WORDS = new Set([
  'fresh', 'freshly', 'dried', 'chopped', 'finely', 'roughly', 'sliced', 'diced', 'minced', 'ground',
  'large', 'small', 'medium', 'whole', 'boneless', 'skinless', 'free', 'range', 'optional', 'extra',
  'virgin', 'plus', 'more', 'for', 'serving', 'garnish', 'of', 'the', 'a', 'an', 'some', 'to', 'taste',
  'canned', 'tinned', 'packet', 'package', 'jar', 'can', 'tin', 'bunch', 'clove', 'cloves', 'cup',
  'cups', 'tablespoon', 'tablespoons', 'teaspoon', 'teaspoons', 'pinch', 'pinches', 'slice', 'slices',
  'head', 'heads', 'sprig', 'sprigs', 'handful', 'grams', 'gram', 'ml', 'liter', 'litre', 'kg',
  'ea', 'each', 'well', 'cold', 'warm', 'hot', 'thinly', 'coarsely', 'lightly', 'thickly',
]);

/** Keeps generated ingredient names short enough to sit on a shopping line. */
const NAME_STOP_WORDS = new Set([
  'cut', 'into', 'and', 'or', 'for', 'to', 'the', 'with', 'plus', 'as', 'needed', 'taste',
  'pieces', 'piece', 'according', 'package', 'directions', 'such', 'that', 'more', 'about',
]);

function trimName(name) {
  const words = name.split(' ').filter(Boolean);
  while (words.length && NAME_STOP_WORDS.has(words[words.length - 1])) words.pop();
  return words.slice(0, 4).join(' ');
}

function singular(word) {
  if (word.length <= 3) return word;
  if (/(oes|ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2);
  if (/ies$/.test(word)) return `${word.slice(0, -3)}y`;
  if (/ss$|us$|is$/.test(word)) return word;
  if (/s$/.test(word)) return word.slice(0, -1);
  return word;
}

function cleanName(raw) {
  const words = String(raw ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !DROP_WORDS.has(word))
    .map(singular);
  return trimName(words.join(' '));
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function titleCase(text) {
  const small = new Set(['and', 'or', 'with', 'of', 'in', 'on', 'the', 'a', 'an', 'to', 'for', 'de', 'al', 'a la']);
  return String(text)
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => (index > 0 && small.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

/* ------------------------------------------------------------------ */
/* ingredient registry growth                                         */
/* ------------------------------------------------------------------ */

/**
 * Names that look like an animal product but are not one. Checked first so
 * "coconut milk" is never classed as dairy (it would hide vegan recipes).
 */
const PLANT_EXCEPTIONS = [
  /coconut (milk|cream|yogurt|yoghurt)/,
  /(almond|oat|soy|soya|rice|cashew|hemp|pea) (milk|cream|yogurt|yoghurt)/,
  /(peanut|almond|cashew|hazelnut|sunflower|sesame|apple|cocoa) butter/,
  /egg ?plant|aubergine/,
  /vegan|plant[- ]based|dairy[- ]free/,
  /butter (bean|beans|nut|nuts)/,
];

const CATEGORY_RULES = [
  [/\b(beef|steak|mince|lamb|pork|chicken|turkey|duck|bacon|ham|sausage|chorizo|prosciutto|veal|ribs|brisket|gammon|salami|pepperoni|lard|suet|tallow|gelatin|gelatine|oxtail|venison|rabbit|liver|kidney|pancetta|guanciale|mortadella|meatball|kofta|kebab|burger|nugget|hot dog|bratwurst|pastrami|ham hock|meat)\b/i, 'meat-fish', 'meat', 'meat'],
  [/\b(fish|salmon|tuna|cod|haddock|prawn|prawns|shrimp|anchov(y|ies)|sardine|mackerel|seafood|crab|lobster|mussel|clam|squid|octopus|trout|sea bass|kipper|scallop|oyster|herring|tilapia|hake|halibut|plaice|pollock|snapper|swordfish|bonito|surimi|fish sauce|oyster sauce|worcestershire)\b/i, 'meat-fish', 'fish', 'fish'],
  [/\b(milk|butter|cheese|cream|yogurt|yoghurt|parmesan|mozzarella|cheddar|feta|halloumi|mascarpone|ricotta|ghee|buttermilk|creme fraiche|crème fraîche|brie|camembert|gorgonzola|pecorino|gruyere|gruyère|provolone|emmental|cream cheese)\b/i, 'dairy-eggs', 'dairy', 'dairy'],
  [/\begg(s)?\b/i, 'dairy-eggs', 'egg', 'egg'],
  [/\bhoney\b/i, 'storecupboard', 'pantry', 'honey'],
  [/flour|sugar|baking powder|baking soda|bicarbonate|yeast|cocoa|cornflour|cornstarch|vanilla|gelatin|icing|marzipan|chocolate|nutmeg|allspice/i, 'baking', 'pantry', 'none'],
  [/rice|pasta|spaghetti|noodle|macaroni|penne|couscous|quinoa|barley|lentil|bean|chickpea|oat|semolina|polenta|breadcrumb|panko|noodle/i, 'storecupboard', 'grain', 'none'],
  [/bread|bun|baguette|tortilla|pita|pitta|wrap|naan|brioche|bagel|croissant/i, 'bread-bakery', 'bakery', 'none'],
  [/salt|pepper|paprika|cumin|coriander seed|turmeric|cinnamon|oregano|thyme|basil|parsley|rosemary|sage|bay leaf|chilli|chili|curry powder|garam masala|spice|herb|clove|cardamom|fennel|dill|mint|ginger powder|za'atar|sumac|saffron|nutmeg/i, 'spices-herbs', 'spice', 'none'],
  [/sauce|oil|vinegar|ketchup|mustard|mayonnaise|mayo|stock|bouillon|paste|syrup|jam|chutney|dressing|soy|fish sauce|worcestershire|tabasco|hot sauce|sriracha|miso|tahini|harissa|gochujang|pesto/i, 'sauces-condiments', 'sauce', 'none'],
  [/onion|garlic|tomato|potato|carrot|pepper|broccoli|spinach|lettuce|cabbage|mushroom|zucchini|courgette|aubergine|eggplant|cucumber|lemon|lime|apple|banana|berry|orange|mango|avocado|celery|leek|herb|pea|bean sprout|corn|pumpkin|squash|sweet potato|chilli|radish|beet|fennel|ginger|shallot|coconut|date|raisin|fruit|veg|sprout|cauliflower|asparagus|kale|chard|watercress|spring onion/i, 'fruit-veg', 'vegetable', 'none'],
  [/coconut milk|soy sauce|fish sauce|curry paste|noodle|tortilla|rice paper|wasabi|nori|miso|kimchi|sriracha|tahini|gochujang/i, 'world-foods', 'sauce', 'none'],
];

function guessIngredient(name) {
  if (PLANT_EXCEPTIONS.some((pattern) => pattern.test(name))) {
    return { category: 'fruit-veg', family: 'other', origin: 'none' };
  }
  for (const [pattern, category, family, origin] of CATEGORY_RULES) {
    if (pattern.test(name)) return { category, family, origin };
  }
  return { category: 'other', family: 'other', origin: 'none' };
}

const PANTRY = new Set(['salt', 'pepper', 'black pepper', 'white pepper', 'oil', 'olive oil', 'vegetable oil', 'water', 'sugar', 'flour', 'butter', 'garlic', 'onion', 'salt and pepper']);

function createIngredientIndex(registry) {
  const byKey = new Map();
  const byId = new Map();
  const extras = [];

  const add = (entry) => {
    byId.set(entry.id, entry);
    const key = cleanName(entry.name);
    if (key && !byKey.has(key)) byKey.set(key, entry.id);
    const idKey = cleanName(entry.id.replace(/-/g, ' '));
    if (idKey && !byKey.has(idKey)) byKey.set(idKey, entry.id);
  };

  for (const row of registry.rows) add(row);

  const resolve = (rawName) => {
    const key = cleanName(rawName);
    if (!key) return 'other';
    if (byKey.has(key)) return byKey.get(key);

    const aliasId = registry.aliases[key];
    if (aliasId && byId.has(aliasId)) return aliasId;

    const short = key.split(' ').slice(-1)[0];
    if (short && short.length > 2 && byKey.has(short)) return byKey.get(short);

    const id = slugify(key) || 'other';
    if (byId.has(id)) return id;
    const guess = guessIngredient(key);
    const entry = {
      id,
      name: titleCase(key),
      category: guess.category,
      family: guess.family,
      origin: guess.origin,
      pantryStaple: PANTRY.has(key) || undefined,
    };
    extras.push(entry);
    add(entry);
    return id;
  };

  return { resolve, extras, byId };
}

/* ------------------------------------------------------------------ */
/* TheMealDB                                                          */
/* ------------------------------------------------------------------ */

const MEALDB = 'https://www.themealdb.com/api/json/v1/1/';

async function mealdbIds() {
  return cached('mealdb-ids', async () => {
    const ids = new Set();
    const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
    for (const letter of letters) {
      await sleep(160);
      const json = await http(`${MEALDB}search.php?f=${letter}`);
      for (const meal of json.meals ?? []) ids.add(meal.idMeal);
      process.stdout.write(`\rthemealdb search ${letter}: ${ids.size}`);
    }
    const areas = (await http(`${MEALDB}list.php?a=list`)).meals ?? [];
    for (const area of areas) {
      await sleep(160);
      const json = await http(`${MEALDB}filter.php?a=${encodeURIComponent(area.strArea)}`);
      for (const meal of json.meals ?? []) ids.add(meal.idMeal);
    }
    process.stdout.write('\n');
    return [...ids];
  });
}

async function mealdbMeal(id) {
  return cached(`mealdb-${id}`, async () => {
    await sleep(140);
    const json = await http(`${MEALDB}lookup.php?i=${id}`);
    return json.meals?.[0] ?? null;
  });
}

async function fetchThemealdb() {
  const ids = await mealdbIds();
  const meals = [];
  for (let i = 0; i < ids.length; i += 1) {
    const meal = await mealdbMeal(ids[i]);
    if (meal && meal.strMeal && meal.strInstructions) meals.push(meal);
    if (i % 25 === 0) process.stdout.write(`\rthemealdb details ${i + 1}/${ids.length}`);
  }
  process.stdout.write(`\rthemealdb details ${meals.length} meals\n`);
  return meals;
}

/* ------------------------------------------------------------------ */
/* Wikibooks Cookbook                                                 */
/* ------------------------------------------------------------------ */

const WIKI = 'https://en.wikibooks.org/w/api.php';

function wikiUrl(params) {
  return `${WIKI}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
}

async function cookbookTitles() {
  return cached('cookbook-titles', async () => {
    const titles = [];
    let cont = {};
    for (let page = 0; page < 10; page += 1) {
      const params = {
        action: 'query',
        list: 'categorymembers',
        cmtitle: 'Category:Recipes',
        cmtype: 'page',
        cmlimit: '500',
        ...cont,
      };
      const data = await http(wikiUrl(params), { json: true, tries: 6 });
      for (const member of data.query?.categorymembers ?? []) titles.push(member.title);
      if (!data.continue) break;
      cont = data.continue;
      await sleep(1500);
    }
    return titles;
  });
}

async function cookbookPages(titles, offset = 0) {
  const pages = {};
  for (let i = 0; i < titles.length; i += 25) {
    const batch = titles.slice(i, i + 25);
    const key = `cookbook-pages-${offset + i}`;
    const file = path.join(CACHE, `${key}.json`);
    let data;
    if (!REFRESH && fs.existsSync(file)) {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } else {
      const params = {
        action: 'query',
        prop: 'revisions',
        rvslots: 'main',
        rvprop: 'content',
        redirects: '1',
        titles: batch.join('|'),
      };
      data = await http(wikiUrl(params), { json: true, tries: 6 });
      fs.writeFileSync(file, JSON.stringify(data));
      await sleep(2000);
    }
    for (const page of data.query?.pages ?? []) {
      if (page.missing) continue;
      const content = page.revisions?.[0]?.slots?.main?.content;
      if (content) pages[page.title] = content;
    }
    process.stdout.write(`\rwikibooks text ${Math.min(i + 25, titles.length)}/${titles.length}`);
  }
  process.stdout.write('\n');
  return pages;
}

async function cookbookImageInfo(files) {
  const cacheFile = path.join(CACHE, 'cookbook-imageinfo.json');
  if (!REFRESH && fs.existsSync(cacheFile)) {
    const cachedInfo = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (files.every((file) => cachedInfo[file])) return cachedInfo;
  }
  const info = {};
  for (let i = 0; i < files.length; i += 40) {
    const batch = files.slice(i, i + 40);
    const params = {
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '760',
      titles: batch.map((file) => `File:${file}`).join('|'),
    };
    const data = await http(wikiUrl(params), { json: true, tries: 6 });
    for (const page of data.query?.pages ?? []) {
      const image = page.imageinfo?.[0];
      if (!image) continue;
      const meta = image.extmetadata ?? {};
      info[page.title.replace(/^File:/, '')] = {
        url: image.thumburl || image.url,
        license: meta.LicenseShortName?.value ?? 'CC',
        artist: (meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() || undefined,
      };
    }
    await sleep(2000);
  }
  fs.writeFileSync(cacheFile, JSON.stringify(info));
  return info;
}

/* ------------------------------------------------------------------ */
/* Fandom Recipes Wiki (CC BY-SA, its own media CDN)                    */
/* ------------------------------------------------------------------ */

const FANDOM = 'https://recipes.fandom.com/api.php';

function fandomUrl(params) {
  return `${FANDOM}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
}

/** The searches that surface modern, batch-friendly cooking rather than
 * 1970s casseroles: each one is a real query against the wiki. */
const FANDOM_QUERIES = [
  'meal prep',
  'meal prep chicken',
  'batch cooking',
  'sheet pan dinner',
  'air fryer chicken',
  'air fryer salmon',
  'buddha bowl',
  'grain bowl',
  'burrito bowl',
  'protein bowl',
  'overnight oats',
  'high protein',
  'slow cooker chicken',
  'instant pot chicken',
  'one pot pasta',
  'stir fry',
  'lunch box',
  'quinoa salad',
  'chicken rice bowl',
  'make ahead breakfast',
  'chicken breast meal prep',
  'egg muffins',
  'protein pancakes',
  'smoothie bowl',
  'zucchini noodles',
  'cauliflower rice',
  'turkey meatballs',
  'sheet pan chicken and vegetables',
  'freezer meals',
  'chicken salad',
  'tuna salad',
  'pasta salad',
  'rice cooker',
  'teriyaki chicken',
  'korean beef',
  'poke bowl',
  'salmon rice bowl',
  'vegetarian meal prep',
];

async function fandomTitles() {
  return cached('fandom-titles', async () => {
    const titles = [];
    const seen = new Set();
    for (const term of FANDOM_QUERIES) {
      for (let offset = 0; offset < 200; offset += 50) {
        const data = await http(
          fandomUrl({ action: 'query', list: 'search', srsearch: term, srlimit: '50', sroffset: String(offset), srnamespace: '0' }),
          { json: true, tries: 5 },
        );
        const hits = data.query?.search ?? [];
        for (const hit of hits) {
          if (!seen.has(hit.title)) {
            seen.add(hit.title);
            titles.push(hit.title);
          }
        }
        if (hits.length < 50) break;
        await sleep(700);
      }
      process.stdout.write(`\rfandom search ${term}: ${titles.length}`);
      await sleep(700);
    }
    process.stdout.write('\n');
    return titles;
  });
}

async function fandomPages(titles, offset = 0) {
  const pages = {};
  for (let i = 0; i < titles.length; i += 20) {
    const batch = titles.slice(i, i + 20);
    const key = `fandom-pages-${offset + i}`;
    const file = path.join(CACHE, `${key}.json`);
    let data;
    if (!REFRESH && fs.existsSync(file)) {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } else {
      data = await http(
        fandomUrl({ action: 'query', prop: 'revisions', rvslots: 'main', rvprop: 'content', redirects: '1', titles: batch.join('|') }),
        { json: true, tries: 5 },
      );
      fs.writeFileSync(file, JSON.stringify(data));
      await sleep(900);
    }
    for (const page of data.query?.pages ?? []) {
      if (page.missing) continue;
      const content = page.revisions?.[0]?.slots?.main?.content;
      if (content) pages[page.title] = content;
    }
    process.stdout.write(`\rfandom text ${Math.min(i + 20, titles.length)}/${titles.length}`);
  }
  process.stdout.write('\n');
  return pages;
}

async function fandomImageInfo(files) {
  const cacheFile = path.join(CACHE, 'fandom-imageinfo.json');
  if (!REFRESH && fs.existsSync(cacheFile)) {
    const cachedInfo = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (files.every((file) => cachedInfo[file])) return cachedInfo;
  }
  const info = {};
  for (let i = 0; i < files.length; i += 40) {
    const batch = files.slice(i, i + 40);
    const data = await http(
      fandomUrl({
        action: 'query',
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
        iiurlwidth: '760',
        titles: batch.map((file) => `File:${file}`).join('|'),
      }),
      { json: true, tries: 5 },
    );
    for (const page of data.query?.pages ?? []) {
      const image = page.imageinfo?.[0];
      if (!image) continue;
      const meta = image.extmetadata ?? {};
      info[page.title.replace(/^File:/, '')] = {
        url: image.thumburl || image.url,
        license: meta.LicenseShortName?.value ?? 'CC BY-SA',
        artist: (meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() || undefined,
      };
    }
    await sleep(800);
  }
  fs.writeFileSync(cacheFile, JSON.stringify(info));
  return info;
}

/* ---- wikitext parsing -------------------------------------------- */

function stripTemplates(text) {
  let out = text;
  // {{convert|8|oz|g|abbr=on}} → "8 oz"
  out = out.replace(/\{\{convert\|([^{}]*)\}\}/gi, (_m, args) => {
    const parts = String(args).split('|').map((part) => part.trim());
    const [amount, unit] = parts;
    return unit ? `${amount} ${unit}` : amount;
  });
  // Collapse remaining templates (keeps nested text lossless enough).
  for (let i = 0; i < 4; i += 1) out = out.replace(/\{\{[^{}]*\}\}/g, '');
  return out;
}

function stripWiki(text) {
  let out = String(text ?? '');
  out = out.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, ' ');
  out = out.replace(/<ref[^>]*\/>/gi, ' ');
  out = stripTemplates(out);
  out = out.replace(/<gallery[\s\S]*?<\/gallery>/gi, ' ');
  out = out.replace(/<\/?[a-z][^>]*>/gi, ' ');
  out = out.replace(/\[\[(?:File|Image):[^\]|]*\|([^\]]*)\]\]/gi, '$1');
  out = out.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, ' ');
  out = out.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1');
  out = out.replace(/\[\[([^\]]*)\]\]/g, '$1');
  out = out.replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, '$1');
  out = out.replace(/'''?/g, '');
  out = out.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  out = out.replace(/\s+/g, ' ');
  return out.trim();
}

function splitSections(wikitext) {
  const sections = [];
  const lines = wikitext.split('\n');
  let current = { heading: '', lines: [] };
  for (const line of lines) {
    const heading = line.match(/^==+\s*(.+?)\s*==+\s*$/);
    if (heading) {
      sections.push(current);
      current = { heading: heading[1], lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections;
}

function parseCookbook(wikitext) {
  const sections = splitSections(wikitext);
  const summary = wikitext.match(/\{\{recipesummary\|([\s\S]*?)\}\}/i)?.[1] ?? '';
  const summaryField = (key) => summary.match(new RegExp(`\\|\\s*${key}\\s*=\\s*([^|\\n]*)`, 'i'))?.[1]?.trim();

  const ingredientSection = sections.find((section) => /ingredient/i.test(section.heading));
  const ingredients = (ingredientSection?.lines ?? [])
    .filter((line) => /^\s*\*/.test(line))
    .map((line) => stripWiki(line.replace(/^\s*\*+\s*/, '')))
    .filter((line) => line && line.length > 1 && !/^\[\[Category:/.test(line));

  const methodSection =
    sections.find((section) => /procedure\s*\(brief\)/i.test(section.heading)) ??
    sections.find((section) => /^(procedure|method|directions|instructions|steps)/i.test(section.heading.trim()) && !/detailed/i.test(section.heading)) ??
    sections.find((section) => /procedure|method|directions/i.test(section.heading));

  const steps = (methodSection?.lines ?? [])
    .filter((line) => /^\s*#/.test(line))
    .map((line) => stripWiki(line.replace(/^\s*#+\s*/, '')))
    .filter((line) => line && line.length > 8);

  const intro = sections[0]?.lines
    .filter(
      (line) =>
        !/^\s*[|{]/.test(line) &&
        !/^\[\[Category:/.test(line) &&
        !/^__/.test(line) &&
        // Fandom pages often open with a bare [[File:…|right|300px|link=]] line.
        !/\[\[(?:Image|File):/i.test(line),
    )
    .map((line) => stripWiki(line))
    .filter((text) => text && !/^(right|left|center|thumb|frame|\d+px|link=|alt=)(\||$)/i.test(text))
    .filter((text) => !/\|\s*(?:\d+px|link=|alt=|thumb)\b/i.test(text))
    .join(' ');

  const categories = [...wikitext.matchAll(/\[\[Category:([^\]|]+)/g)].map((m) => m[1]);
  const nutritionBlock = wikitext.match(/\{\{Nutrition Summary\|([\s\S]*?)\}\}/i)?.[1] ?? '';
  const nutritionField = (key) => nutritionBlock.match(new RegExp(`\\|\\s*${key}\\s*=\\s*([^|\\n]*)`, 'i'))?.[1]?.trim();

  const image =
    summary.match(/\|\s*image\s*=\s*(?:\[\[)?(?:Image|File):([^|\]\n]+)/i)?.[1]?.trim() ??
    wikitext.match(/\[\[(?:Image|File):([^|\]\n]+)/i)?.[1]?.trim();

  return {
    ingredients,
    steps,
    intro,
    categories,
    image,
    servings: toNumber(summaryField('servings')),
    time: summaryField('time'),
    difficulty: toNumber(summaryField('difficulty')),
    category: summaryField('category'),
    nutrition: nutritionBlock
      ? {
          calories: toNumber(nutritionField('Cals')),
          fat: toNumber(nutritionField('TotalFat')),
          carbs: toNumber(nutritionField('Carbs')),
          protein: toNumber(nutritionField('Protein')),
        }
      : null,
  };
}

/* ------------------------------------------------------------------ */
/* derivation                                                         */
/* ------------------------------------------------------------------ */

const METHOD_WORDS = [
  [/roast|oven|bake|baking/i, 'roast'],
  [/grill|barbecue|bbq/i, 'grill'],
  [/steam/i, 'steam'],
  [/slow cook|crock|slow-cook/i, 'slow-cook'],
  [/stir[- ]?fry|wok/i, 'stir-fry'],
  [/deep[- ]?fry/i, 'deep-fry'],
  [/pan[- ]?fry|fry|fried|skillet/i, 'pan-fry'],
  [/boil|simmer|poach/i, 'simmer'],
  [/no[- ]?cook|chill|refrigerate/i, 'no-cook'],
];

function durationFromText(text) {
  let minutes = 0;
  const re = /(\d+)(?:\s*(?:–|-|to)\s*(\d+))?\s*(minutes?|mins?|hours?|hrs?)/gi;
  let match;
  while ((match = re.exec(text))) {
    const amount = Math.max(Number(match[1]), Number(match[2] ?? 0));
    const unit = /^h/i.test(match[3]) ? 60 : 1;
    minutes = Math.max(minutes, amount * unit);
  }
  return minutes;
}

function deriveMeta({ title, instructions, ingredientCount, categories = [], area, category }) {
  const text = instructions.join(' ');
  const stepCount = instructions.length;
  const explicitMinutes = durationFromText(text);
  const cookingTime = Math.min(180, Math.max(10, explicitMinutes || Math.round(12 + ingredientCount * 1.6)));
  const prepTime = Math.min(30, Math.max(8, Math.round(4 + ingredientCount * 0.9)));

  const difficulty = stepCount <= 6 && ingredientCount <= 10 ? 'easy' : stepCount <= 11 ? 'medium' : 'hard';
  const method = METHOD_WORDS.find(([pattern]) => pattern.test(text))?.[1] ?? 'simmer';

  const haystack = `${title} ${categories.join(' ')} ${category ?? ''}`.toLowerCase();
  // The source's own category is the most reliable signal: a side dish or a
  // dessert should never be offered as tonight's dinner.
  let mealTypes = [];
  const categoryText = `${category ?? ''} ${categories.join(' ')}`.toLowerCase();
  if (/breakfast|brunch/.test(categoryText)) mealTypes = ['breakfast', 'snack'];
  else if (/dessert|cake|cookie|biscuit|pudding|sweet|confection|ice cream|pastry|brownie|tart/.test(categoryText)) mealTypes = ['snack'];
  else if (/starter|appetis|appetiz|\bside\b|side dish/.test(categoryText)) mealTypes = ['lunch'];
  if (mealTypes.length) {
    return {
      preparationTimeMinutes: prepTime,
      cookingTimeMinutes: cookingTime,
      totalTimeMinutes: prepTime + cookingTime,
      difficulty,
      cookingMethod: method,
      mealTypes,
      area: area ? String(area) : undefined,
    };
  }
  if (/breakfast|brunch|pancake|porridge|oat|toast|waffle|muffin|omelette|frittata|smoothie/.test(haystack)) mealTypes.push('breakfast');
  if (/dessert|cake|cookie|biscuit|pudding|pie|tart|brownie|sweet|ice cream|fudge|custard|trifle/.test(haystack)) mealTypes.push('snack');
  if (/salad|sandwich|wrap|soup|starter|side|appetiser|appetizer/.test(haystack)) mealTypes.push('lunch');
  if (mealTypes.length === 0) mealTypes.push('dinner', 'lunch');
  if (mealTypes.includes('breakfast') && !mealTypes.includes('lunch')) mealTypes.push('snack');

  return {
    preparationTimeMinutes: prepTime,
    cookingTimeMinutes: cookingTime,
    totalTimeMinutes: prepTime + cookingTime,
    difficulty,
    cookingMethod: method,
    mealTypes: [...new Set(mealTypes)],
    area: area ? String(area) : undefined,
  };
}

function parseSteps(rawSteps) {
  const steps = rawSteps
    .map((step) => step.replace(/^step\s*\d+\s*[:.)-]?\s*/i, '').replace(/^\d+\s*[:.)-]\s*/, '').trim())
    .filter((step) => step.length > 7)
    .slice(0, 18);

  // Imported prose often packs a whole method into two paragraphs. Splitting on
  // sentence boundaries keeps the words intact while giving each instruction
  // its own numbered line, so the step list stays usable.
  let guard = 0;
  while (steps.length < 4 && guard < 12) {
    guard += 1;
    let longest = -1;
    let splitAt = -1;
    steps.forEach((text, index) => {
      const sentences = text.match(/[^.!?]+[.!?]+\)?\s+/g);
      if (!sentences || sentences.length < 2) return;
      if (text.length > longest) {
        longest = text.length;
        splitAt = index;
      }
    });
    if (splitAt === -1) break;
    const sentences = steps[splitAt].match(/[^.!?]+[.!?]+\)?\s+|.+$/g) ?? [];
    const mid = Math.ceil(sentences.length / 2);
    const first = sentences.slice(0, mid).join('').trim();
    const second = sentences.slice(mid).join('').trim();
    if (!first || !second) break;
    steps.splice(splitAt, 1, first, second);
  }

  return steps
    .slice(0, 18)
    .map((text, index) => ({ step: index + 1, text: text.length > 480 ? `${text.slice(0, 477)}...` : text }));
}

const BUDGET_HIGHER = new Set(['beef', 'lamb', 'salmon', 'prawn', 'duck', 'steak', 'veal', 'scallop', 'crab', 'lobster', 'ricotta', 'pine-nut', 'saffron']);
const BUDGET_LOW = new Set(['pasta', 'rice', 'lentil', 'bean', 'chickpea', 'potato', 'onion', 'cabbage', 'carrot', 'egg', 'flour', 'oat', 'bread', 'tomato', 'tinned-tomato', 'courgette', 'mushroom']);

function deriveTags({ recipe, origins, ingredientIds }) {
  const tags = new Set();
  if (recipe.totalTimeMinutes <= 30) tags.add('under-30');
  if (recipe.totalTimeMinutes <= 20) tags.add('quick');
  if (recipe.ingredients.length <= 8 && recipe.instructions.length <= 6) tags.add('simple');
  if (recipe.instructions.length <= 5) tags.add('low-effort');
  if (['roast', 'slow-cook', 'simmer'].includes(recipe.cookingMethod)) tags.add('one-pan');
  const titleText = String(recipe.title).toLowerCase();
  // "Meal prep" should mean a dish you can portion out for the week, not every
  // recipe that happens to serve four.
  const prepWords = /meal[- ]prep|batch|make[- ]ahead|freezer|lunch ?box|bento/.test(titleText);
  const portionable =
    /bowl|salad|soup|stew|curry|bake|tray ?bake|casserole|chilli|chili|pasta|pie|rice|roast|skillet|sheet ?pan|loaf|muffin|oats|gratin|pilaf|tagine|stir[- ]?fry|noodle/.test(
      titleText,
    );
  if (prepWords || (recipe.servings >= 4 && portionable)) tags.add('meal-prep');
  if (/air[- ]?fryer/.test(titleText)) {
    tags.add('quick');
    tags.add('low-effort');
  }
  if (/stew|pie|curry|roast|soup|bake|mac|lasagne|risotto|dumpling|pudding|braise/i.test(recipe.title)) tags.add('comfort');
  if (origins.has('meat') || origins.has('fish') || origins.has('egg') || origins.has('dairy')) tags.add('high-protein');
  if (ingredientIds.some((id) => /tofu|bean|lentil|chickpea|yogurt|cheese|egg/.test(id)) && !origins.has('meat')) tags.add('high-protein');
  if (recipe.budgetTier === 'budget') tags.add('budget');
  if (recipe.dietaryClassification.includes('vegetarian')) tags.add('veggie');
  if (recipe.dietaryClassification.includes('vegan')) tags.add('plant-based');
  for (const mealType of recipe.mealTypes) {
    if (mealType === 'breakfast') tags.add('breakfast');
    if (mealType === 'lunch') tags.add('lunch');
    if (mealType === 'dinner') tags.add('dinner');
  }
  return [...tags];
}

/* ------------------------------------------------------------------ */
/* build                                                              */
/* ------------------------------------------------------------------ */

async function saveImage(job) {
  const file = path.join(IMAGES, `${job.id}.jpg`);
  if (!REFRESH && fs.existsSync(file) && fs.statSync(file).size > 4000) return 'skipped';
  const buffer = await http(job.url, { binary: true, tries: 6 });
  await sharp(buffer)
    .rotate()
    .resize({ width: IMAGE_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: IMAGE_QUALITY, progressive: true, mozjpeg: true })
    .toFile(file);
  return 'saved';
}

/**
 * Wikimedia only serves originals from a CDN that rate-limits us, while its
 * thumbnail service does not. Rewrite an original-file URL into a 800px thumb.
 */
function wikimediaThumbUrl(url) {
  if (/\/thumb\//.test(url)) return url.replace(/\?.*$/, '');
  const clean = url.replace(/\?.*$/, '');
  const match = clean.match(
    /^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/(.+)$/,
  );
  if (!match) return url;
  const [, folder, sub, name] = match;
  return `https://thumb.wikimedia.org/wikipedia/commons/thumb/${folder}/${sub}/${name}/800px-${name}`;
}

/** Slow, polite pass for the Wikimedia CDN, which throttles bursts hard. */
async function downloadPendingImages() {
  const manifest = JSON.parse(fs.readFileSync(path.join(CACHE, 'pending-images.json'), 'utf8'));
  const missing = manifest.filter((job) => {
    const file = path.join(IMAGES, `${job.id}.jpg`);
    return !fs.existsSync(file) || fs.statSync(file).size < 4000;
  });
  // Ask Wikimedia for a thumbnail that definitely exists for each file: it only
  // returns one when the width fits inside the original, and its CDN blocks
  // fetching the original file directly.
  const fileNameOf = (url) =>
    decodeURIComponent(url.split('?')[0].split('/').pop())
      .replace(/^\d+px-/, '')
      .replace(/_/g, ' ');
  const blocked = missing.filter((job) => /wikimedia/.test(job.url));
  if (blocked.length) {
    const names = [...new Set(blocked.map((job) => fileNameOf(job.url)))];
    const thumbs = {};
    for (let i = 0; i < names.length; i += 40) {
      const batch = names.slice(i, i + 40);
      const params = {
        action: 'query',
        prop: 'imageinfo',
        iiprop: 'url',
        iiurlwidth: '480',
        titles: batch.map((name) => `File:${name}`).join('|'),
      };
      const data = await http(wikiUrl(params), { json: true, tries: 6 });
      for (const page of data.query?.pages ?? []) {
        const info = page.imageinfo?.[0];
        if (info?.thumburl) thumbs[page.title.replace(/^File:/, '')] = info.thumburl;
      }
      await sleep(2000);
    }
    for (const job of blocked) {
      const name = fileNameOf(job.url);
      if (thumbs[name]) job.url = thumbs[name];
      else job.url = '';
    }
  }

  console.log(`pending images: ${missing.length}`);
  let saved = 0;
  for (const job of missing) {
    if (!job.url) continue;
    const target = job;
    try {
      await saveImage(target);
      saved += 1;
      if (saved % 10 === 0) process.stdout.write(`\rimages ${saved}/${missing.length}`);
    } catch (error) {
      console.warn(`\nimage failed ${job.id}: ${error.message}`);
    }
    await sleep(2500);
  }
  process.stdout.write(`\npending images saved: ${saved}/${missing.length}\n`);
}

/**
 * Shared builder for both MediaWiki sources (Wikibooks Cookbook and Fandom's
 * Recipes Wiki): same section layout, different wording and credit.
 */
function makeWikiRecipe({ title, parsed, info, index, source, descriptionFallback }) {
  const slug = slugify(title);
  if (!slug) return null;

  const ingredientIds = [];
  const ingredientEntries = [];
  for (const line of parsed.ingredients.slice(0, 20)) {
    // "2 cups plain flour" → quantity 2, unit cup, name "plain flour".
    const words = stripWiki(line).replace(/^[-,;\s]+/, '').replace(/\s+/g, ' ').trim().split(' ');
    let cursor = 0;
    let numberText = '';
    while (cursor < words.length && /^[\d½¼¾⅓⅔⅛⅜⅝⅞.,/]+$/.test(words[cursor])) {
      numberText += ` ${words[cursor]}`;
      cursor += 1;
    }
    const unitWord = (words[cursor] ?? '').toLowerCase().replace(/[.,]$/, '');
    const unit = numberText ? UNIT_LOOKUP[unitWord] : undefined;
    if (unit) cursor += 1;
    const name = words
      .slice(cursor)
      .join(' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/^[-,;\s]+/, '')
      .trim();
    if (!name || name.length < 2) continue;
    const parsedMeasure = numberText
      ? { quantity: toNumber(numberText) ?? 1, unit: unit ?? 'unit', note: undefined }
      : parseMeasure('');
    const ingredientId = index.resolve(name);
    ingredientIds.push(ingredientId);
    const entry = { ingredientId, quantity: parsedMeasure.quantity, unit: parsedMeasure.unit };
    if (parsedMeasure.note) entry.preparation = titleCase(parsedMeasure.note).slice(0, 60);
    ingredientEntries.push(entry);
  }
  if (ingredientEntries.length < 4) return null;

  const instructions = parseSteps(parsed.steps);
  if (instructions.length < 3) return null;

  const meta = deriveMeta({
    title,
    instructions: instructions.map((step) => step.text),
    ingredientCount: ingredientEntries.length,
    categories: parsed.categories,
    category: parsed.category,
  });

  const origins = new Set(ingredientIds.map((id) => index.byId.get(id)?.origin ?? 'none'));
  const classification = origins.has('meat')
    ? ['carnivore']
    : origins.has('fish')
      ? ['pescatarian', 'carnivore']
      : origins.has('dairy') || origins.has('egg') || origins.has('honey')
        ? ['vegetarian', 'pescatarian', 'carnivore']
        : ['vegan', 'vegetarian', 'pescatarian', 'carnivore'];

  const primary = ingredientIds[0] ?? 'other';
  const budgetTier = BUDGET_HIGHER.has(primary)
    ? 'higher'
    : BUDGET_LOW.has(primary) || classification.includes('vegan')
      ? 'budget'
      : 'moderate';
  const cuisine =
    parsed.categories.find((category) => /cuisine of/i.test(category))?.replace(/cuisine of the /i, '') ??
    meta.area ??
    'World';

  const nutrition =
    parsed.nutrition && parsed.nutrition.calories && parsed.nutrition.calories > 20
      ? {
          calories: Math.round(parsed.nutrition.calories),
          proteinGrams: Math.round(parsed.nutrition.protein ?? 0),
          carbsGrams: Math.round(parsed.nutrition.carbs ?? 0),
          fatGrams: Math.round(parsed.nutrition.fat ?? 0),
          isEstimate: true,
        }
      : undefined;

  const recipe = {
    id: slug,
    slug,
    title,
    description: (() => {
      const intro = parsed.intro?.trim() ?? '';
      if (intro.length > 30) return intro.slice(0, 200);
      const names = ingredientEntries
        .slice(0, 3)
        .map((entry) => cleanName(index.byId.get(entry.ingredientId)?.name ?? ''))
        .filter(Boolean);
      const base = descriptionFallback.replace(/\.$/, '');
      return `${base}${names.length ? `, made with ${names.join(', ')}` : ''}.`.slice(0, 200);
    })(),
    imageUrl: '',
    galleryImages: [],
    imageKey: slug,
    preparationTimeMinutes: meta.preparationTimeMinutes,
    cookingTimeMinutes: meta.cookingTimeMinutes,
    totalTimeMinutes: meta.totalTimeMinutes,
    difficulty: parsed.difficulty
      ? parsed.difficulty <= 2
        ? 'easy'
        : 'medium'
      : meta.difficulty,
    servings: Math.min(12, Math.max(1, Math.round(parsed.servings ?? 4))),
    ingredients: ingredientEntries,
    instructions,
    tags: [],
    dietaryClassification: classification,
    mealTypes: meta.mealTypes,
    mealPrepSuitable: meta.mealTypes.includes('dinner') && (parsed.servings ?? 4) >= 4,
    nutrition,
    budgetTier,
    cuisine: titleCase(String(cuisine)),
    primaryIngredient: primary,
    cookingMethod: meta.cookingMethod,
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
    source: {
      name: source.name,
      url: source.url,
      license: info.license ?? source.license,
      author: info.artist,
    },
  };
  recipe.tags = deriveTags({ recipe, origins, ingredientIds });
  return recipe;
}

async function main() {
  if (process.argv.includes('--images-only')) {
    await downloadPendingImages();
    return;
  }
  const registry = loadRegistry();
  const index = createIngredientIndex(registry);
  const usedTitles = new Set();
  const recipes = [];
  const imagesToFetch = [];

  const addRecipe = (recipe, imageUrl, imageHeaders) => {
    if (recipes.some((existing) => existing.id === recipe.id)) return;
    recipes.push(recipe);
    imagesToFetch.push({ id: recipe.id, url: imageUrl, headers: imageHeaders });
  };

  /* ---- TheMealDB ---- */
  const meals = await fetchThemealdb();
  for (const meal of meals) {
    const rawIngredients = [];
    for (let i = 1; i <= 20; i += 1) {
      const name = String(meal[`strIngredient${i}`] ?? '').trim();
      const measure = String(meal[`strMeasure${i}`] ?? '').trim();
      if (name) rawIngredients.push({ name, measure });
    }
    if (rawIngredients.length < 3) continue;

    const mealSteps = String(meal.strInstructions)
      .replace(/\r/g, '')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 3);
    const instructions = parseSteps(mealSteps.length >= 3 ? mealSteps : mealSteps.join(' ').split(/(?<=[.!?])\s+/));
    if (instructions.length < 2) continue;

    const title = String(meal.strMeal).trim();
    const slug = slugify(title);
    if (!slug || usedTitles.has(cleanName(title))) continue;

    const ingredientIds = [];
    const ingredientEntries = rawIngredients.map(({ name, measure }) => {
      const ingredientId = index.resolve(name);
      ingredientIds.push(ingredientId);
      const parsed = parseMeasure(measure);
      const entry = { ingredientId, quantity: parsed.quantity, unit: parsed.unit };
      if (parsed.note) entry.preparation = titleCase(parsed.note).slice(0, 60);
      return entry;
    });

    const meta = deriveMeta({
      title,
      instructions: instructions.map((step) => step.text),
      ingredientCount: ingredientEntries.length,
      area: meal.strArea,
      category: meal.strCategory,
    });

    const primary = ingredientIds[0] ?? 'other';
    const origins = new Set(ingredientIds.map((id) => index.byId.get(id)?.origin ?? 'none'));
    const classification = origins.has('meat')
      ? ['carnivore']
      : origins.has('fish')
        ? ['pescatarian', 'carnivore']
        : origins.has('dairy') || origins.has('egg') || origins.has('honey')
          ? ['vegetarian', 'pescatarian', 'carnivore']
          : ['vegan', 'vegetarian', 'pescatarian', 'carnivore'];

    const budgetTier = BUDGET_HIGHER.has(primary) || ingredientEntries.length > 14 ? 'higher' : BUDGET_LOW.has(primary) || classification.includes('vegan') ? 'budget' : 'moderate';

    const description = `${titleCase(String(meal.strCategory ?? 'comfort'))} favourite from ${
      meal.strArea ? String(meal.strArea) : 'the kitchen'
    }, made with ${rawIngredients
      .slice(0, 3)
      .map((item) => cleanName(item.name))
      .filter(Boolean)
      .join(', ')}.`;

    const recipe = {
      id: slug,
      slug,
      title,
      description: description.slice(0, 180),
      imageUrl: '',
      galleryImages: [],
      imageKey: slug,
      preparationTimeMinutes: meta.preparationTimeMinutes,
      cookingTimeMinutes: meta.cookingTimeMinutes,
      totalTimeMinutes: meta.totalTimeMinutes,
      difficulty: meta.difficulty,
      servings: 4,
      ingredients: ingredientEntries,
      instructions,
      tags: [],
      dietaryClassification: classification,
      mealTypes: meta.mealTypes,
      mealPrepSuitable: meta.mealTypes.includes('dinner'),
      budgetTier,
      cuisine: meal.strArea ? String(meal.strArea) : 'World',
      primaryIngredient: primary,
      cookingMethod: meta.cookingMethod,
      createdAt: '2026-11-20T00:00:00.000Z',
      updatedAt: '2026-11-20T00:00:00.000Z',
      source: {
        name: 'TheMealDB',
        url: `https://www.themealdb.com/meal/${meal.idMeal}`,
        license: 'TheMealDB free API (personal, non-commercial use)',
      },
    };
    recipe.tags = deriveTags({ recipe, origins, ingredientIds });
    usedTitles.add(cleanName(title));
    addRecipe(recipe, `${meal.strMealThumb}`, null);
    if (recipes.length >= LIMIT) break;
  }
  console.log(`themealdb recipes: ${recipes.length}`);

  /* ---- Wikibooks Cookbook ---- */
  if (recipes.length < LIMIT) {
    const allTitles = (await cookbookTitles()).filter((title) => /^Cookbook:/.test(title));
    // Deterministic shuffle so the sample is not just "A…C".
    const shuffled = allTitles
      .map((title, i) => ({ title, key: (i * 2654435761) % 4294967296 }))
      .sort((a, b) => a.key - b.key)
      .map((entry) => entry.title);

    const candidates = [];
    const batchSize = 50;
    for (let i = 0; i < shuffled.length && candidates.length < 600; i += batchSize) {
      const batch = shuffled.slice(i, i + batchSize);
      const pages = await cookbookPages(batch, i);
      for (const [pageTitle, wikitext] of Object.entries(pages)) {
        if (candidates.length >= 600) break;
        const title = pageTitle.replace(/^Cookbook:/, '').trim();
        if (!title || /recipes$|technique|table of|ingredient|equipment/i.test(title)) continue;
        const parsed = parseCookbook(wikitext);
        if (!parsed.image) continue;
        if (parsed.ingredients.length < 4 || parsed.steps.length < 3) continue;
        if (parsed.categories.some((category) => /beverage|drink|cocktail/i.test(category))) continue;
        if (usedTitles.has(cleanName(title))) continue;
        if (candidates.some((candidate) => cleanName(candidate.title) === cleanName(title))) continue;
        candidates.push({ title, parsed });
      }
      console.log(`wikibooks candidates: ${candidates.length}`);
    }

    // Offline mode trusts the last manifest (no Wikimedia calls) so the
    // catalogue can be rebuilt while their CDN is rate-limiting us.
    const offline = process.argv.includes('--offline');
    const manifestPath = path.join(CACHE, 'pending-images.json');
    const manifest = offline && fs.existsSync(manifestPath)
      ? new Map(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).map((job) => [job.id, job.url]))
      : null;
    const fileInfo = offline
      ? {}
      : await cookbookImageInfo([...new Set(candidates.map((candidate) => candidate.parsed.image))]);

    for (const candidate of candidates) {
      if (recipes.length >= LIMIT) break;
      const info = offline
        ? { url: manifest?.get(slugify(candidate.title)), license: 'CC BY-SA', artist: undefined }
        : fileInfo[candidate.parsed.image];
      if (!info?.url) continue;

      const { title, parsed } = candidate;
      const slug = slugify(title);
      if (!slug) continue;

      const ingredientIds = [];
      const ingredientEntries = [];
      for (const line of parsed.ingredients.slice(0, 20)) {
        // "2 cups plain flour" → quantity 2, unit cup, name "plain flour".
        const words = stripWiki(line).replace(/^[-,;\s]+/, '').replace(/\s+/g, ' ').trim().split(' ');
        let cursor = 0;
        let numberText = '';
        while (cursor < words.length && /^[\d½¼¾⅓⅔⅛⅜⅝⅞.,/]+$/.test(words[cursor])) {
          numberText += ` ${words[cursor]}`;
          cursor += 1;
        }
        const unitWord = (words[cursor] ?? '').toLowerCase().replace(/[.,]$/, '');
        let unit = numberText ? UNIT_LOOKUP[unitWord] : undefined;
        if (unit) cursor += 1;
        const name = words
          .slice(cursor)
          .join(' ')
          .replace(/\([^)]*\)/g, ' ')
          .replace(/^[-,;\s]+/, '')
          .trim();
        if (!name || name.length < 2) continue;
        const parsedMeasure = numberText
          ? { quantity: toNumber(numberText) ?? 1, unit: unit ?? 'unit', note: undefined }
          : parseMeasure('');
        const ingredientId = index.resolve(name);
        ingredientIds.push(ingredientId);
        const entry = { ingredientId, quantity: parsedMeasure.quantity, unit: parsedMeasure.unit };
        if (parsedMeasure.note) entry.preparation = titleCase(parsedMeasure.note).slice(0, 60);
        ingredientEntries.push(entry);
      }
      if (ingredientEntries.length < 4) continue;

      const instructions = parseSteps(parsed.steps);
      if (instructions.length < 3) continue;

      const meta = deriveMeta({
        title,
        instructions: instructions.map((step) => step.text),
        ingredientCount: ingredientEntries.length,
        categories: parsed.categories,
        category: parsed.category,
      });

      const origins = new Set(ingredientIds.map((id) => index.byId.get(id)?.origin ?? 'none'));
      const classification = origins.has('meat')
        ? ['carnivore']
        : origins.has('fish')
          ? ['pescatarian', 'carnivore']
          : origins.has('dairy') || origins.has('egg') || origins.has('honey')
            ? ['vegetarian', 'pescatarian', 'carnivore']
            : ['vegan', 'vegetarian', 'pescatarian', 'carnivore'];

      const primary = ingredientIds[0] ?? 'other';
      const budgetTier = BUDGET_HIGHER.has(primary) ? 'higher' : BUDGET_LOW.has(primary) || classification.includes('vegan') ? 'budget' : 'moderate';
      const cuisine = parsed.categories.find((category) => /cuisine of/i.test(category))?.replace(/cuisine of the /i, '') ?? meta.area ?? 'World';

      const nutrition =
        parsed.nutrition && parsed.nutrition.calories && parsed.nutrition.calories > 20
          ? {
              calories: Math.round(parsed.nutrition.calories),
              proteinGrams: Math.round(parsed.nutrition.protein ?? 0),
              carbsGrams: Math.round(parsed.nutrition.carbs ?? 0),
              fatGrams: Math.round(parsed.nutrition.fat ?? 0),
              isEstimate: true,
            }
          : undefined;

      const recipe = {
        id: slug,
        slug,
        title,
        description: (parsed.intro || `${titleCase(String(parsed.category ?? 'Home'))} from the Wikibooks Cookbook.`).slice(0, 200),
        imageUrl: '',
        galleryImages: [],
        imageKey: slug,
        preparationTimeMinutes: meta.preparationTimeMinutes,
        cookingTimeMinutes: meta.cookingTimeMinutes,
        totalTimeMinutes: meta.totalTimeMinutes,
        difficulty: parsed.difficulty ? (parsed.difficulty <= 1 ? 'easy' : parsed.difficulty === 2 ? 'easy' : 'medium') : meta.difficulty,
        servings: Math.min(12, Math.max(1, Math.round(parsed.servings ?? 4))),
        ingredients: ingredientEntries,
        instructions,
        tags: [],
        dietaryClassification: classification,
        mealTypes: meta.mealTypes,
        mealPrepSuitable: meta.mealTypes.includes('dinner') && (parsed.servings ?? 4) >= 4,
        nutrition,
        budgetTier,
        cuisine: titleCase(String(cuisine)),
        primaryIngredient: primary,
        cookingMethod: meta.cookingMethod,
        createdAt: '2026-11-20T00:00:00.000Z',
        updatedAt: '2026-11-20T00:00:00.000Z',
        source: {
          name: 'Wikibooks Cookbook',
          url: `https://en.wikibooks.org/wiki/Cookbook:${encodeURIComponent(title.replace(/ /g, '_'))}`,
          license: info.license ?? 'CC BY-SA',
          author: info.artist,
        },
      };
      recipe.tags = deriveTags({ recipe, origins, ingredientIds });
      usedTitles.add(cleanName(title));
      addRecipe(recipe, info.url, null);
    }
  }
  console.log(`wikibooks recipes: ${recipes.length}`);

  /* ---- Fandom Recipes Wiki ---- */
  if (recipes.length < LIMIT) {
    const titles = await fandomTitles();
    const candidates = [];
    for (let i = 0; i < titles.length && candidates.length < 420; i += 100) {
      const pages = await fandomPages(titles.slice(i, i + 100), i);
      for (const [pageTitle, wikitext] of Object.entries(pages)) {
        if (candidates.length >= 420) break;
        const title = pageTitle.trim();
        if (!title || usedTitles.has(cleanName(title))) continue;
        if (/^(category|template|file|user|help|project|mediawiki):/i.test(title)) continue;
        const parsed = parseCookbook(wikitext);
        if (!parsed.image) continue;
        if (parsed.ingredients.length < 5 || parsed.steps.length < 3) continue;
        if (candidates.some((candidate) => cleanName(candidate.title) === cleanName(title))) continue;
        candidates.push({ title, parsed });
      }
      console.log(`fandom candidates: ${candidates.length}`);
    }

    const fandomOffline = process.argv.includes('--offline');
    const fandomFileInfo = fandomOffline
      ? {}
      : await fandomImageInfo([...new Set(candidates.map((candidate) => candidate.parsed.image))]);
    const manifestPath = path.join(CACHE, 'pending-images.json');
    const manifest = fandomOffline && fs.existsSync(manifestPath)
      ? new Map(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).map((job) => [job.id, job.url]))
      : null;

    for (const candidate of candidates) {
      if (recipes.length >= LIMIT) break;
      const info = fandomOffline
        ? { url: manifest?.get(slugify(candidate.title)), license: 'CC BY-SA', artist: undefined }
        : fandomFileInfo[candidate.parsed.image];
      if (!info?.url) continue;

      const recipe = makeWikiRecipe({
        title: candidate.title,
        parsed: candidate.parsed,
        info,
        index,
        source: {
          name: 'Recipes Wiki',
          url: `https://recipes.fandom.com/wiki/${encodeURIComponent(candidate.title.replace(/ /g, '_'))}`,
          license: 'CC BY-SA',
        },
        descriptionFallback: candidate.parsed.category
          ? `${titleCase(String(candidate.parsed.category))} from the community Recipes Wiki.`
          : 'A community recipe from the Recipes Wiki.',
      });
      if (!recipe) continue;
      usedTitles.add(cleanName(candidate.title));
      addRecipe(recipe, info.url, null);
    }
  }
  console.log(`fandom recipes: ${recipes.length}`);

  fs.writeFileSync(path.join(CACHE, 'pending-images.json'), JSON.stringify(imagesToFetch));
  if (process.argv.includes('--manifest-only')) {
    console.log(`manifest written: ${imagesToFetch.length} images`);
    return;
  }
  if (process.argv.includes('--no-images')) {
    writeCatalogue(recipes, index);
    return;
  }

  /* ---- images ---- */
  let downloaded = 0;
  // Wikimedia's upload CDN throttles bursts, so its images crawl; TheMealDB's
  // CDN happily takes several at once.
  const queue = imagesToFetch.filter((job) => !/wikimedia|wikipedia/.test(job.url));
  const wikiQueue = imagesToFetch.filter((job) => /wikimedia|wikipedia/.test(job.url));
  const drain = async (pool, concurrency) => {
    const workers = Array.from({ length: concurrency }, async () => {
      while (pool.length) {
        const job = pool.shift();
      if (!job) return;
      const file = path.join(IMAGES, `${job.id}.jpg`);
      if (!REFRESH && fs.existsSync(file) && fs.statSync(file).size > 4000) continue;
      try {
        const buffer = await http(job.url, { binary: true, tries: 6 });
        await sharp(buffer)
          .rotate()
          .resize({ width: IMAGE_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: IMAGE_QUALITY, progressive: true, mozjpeg: true })
          .toFile(file);
        downloaded += 1;
        if (downloaded % 40 === 0) process.stdout.write(`\rimages ${downloaded}/${imagesToFetch.length}`);
        } catch (error) {
          console.warn(`\nimage failed ${job.id}: ${error.message}`);
          addRecipeFailure(job.id);
        }
      }
    });
    await Promise.all(workers);
  };
  await drain(queue, 8);
  if (!process.argv.includes('--no-wiki-images')) await drain(wikiQueue, 3);
  process.stdout.write(`\nimages downloaded: ${downloaded}\n`);

  writeCatalogue(recipes, index);
}

/** Keeps only recipes whose photograph actually landed on disk, then writes. */
function writeCatalogue(recipes, index) {
  const finalRecipes = recipes.filter(
    (recipe) =>
      fs.existsSync(path.join(IMAGES, `${recipe.id}.jpg`)) &&
      recipe.ingredients.length >= 4 &&
      recipe.instructions.length >= 4,
  );
  finalRecipes.sort((a, b) => a.title.localeCompare(b.title));

  const extras = index.extras;
  if (!extras.some((entry) => entry.id === 'other')) {
    extras.push({ id: 'other', name: 'Other', category: 'other', family: 'other', origin: 'none' });
  }
  fs.writeFileSync(RECIPE_OUT, `${JSON.stringify(finalRecipes, null, 1)}\n`);
  fs.writeFileSync(
    INGREDIENT_OUT,
    `${JSON.stringify(
      extras.map((entry) => [entry.id, entry.name, entry.category, entry.family, entry.origin, entry.icon, entry.pantryStaple]),
      null,
    )}\n`,
  );

  const bySource = finalRecipes.reduce((acc, recipe) => {
    acc[recipe.source.name] = (acc[recipe.source.name] ?? 0) + 1;
    return acc;
  }, {});
  console.log('recipes written:', finalRecipes.length, bySource);
  console.log('new ingredient rows:', extras.length);
}

const failed = new Set();
function addRecipeFailure(id) {
  failed.add(id);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
