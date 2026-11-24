#!/usr/bin/env node
/**
 * Builds `src/data/prices.pt.json`: a Portuguese retail price catalogue for the
 * ingredients the recipes actually use, per supermarket.
 *
 * Why a generated catalogue and not a live API: Pingo Doce, Continente,
 * Mercadona, Lidl and Auchan publish no price API, and scraping their shopping
 * sites breaks their terms and their markup monthly. So this script is the
 * single, auditable place where prices live. Edit `CATEGORY_PRICES` or
 * `OVERRIDES`, rerun, and every screen updates.
 *
 * Prices are EUR per kilogram. Volume units are treated at density 1 (1 ml =
 * 1 g), which is right for water, stock and most liquids and within a few
 * percent for oil and dairy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RECIPES = path.join(ROOT, 'src', 'data', 'recipes', 'imported.json');
const INGREDIENTS = path.join(ROOT, 'src', 'data', 'ingredients.imported.json');
const OUT = path.join(ROOT, 'src', 'data', 'prices.pt.json');

const STORES = ['pingo-doce', 'continente', 'mercadona', 'lidl', 'auchan'];

/**
 * €/kg by department per store. Continente is the reference (1.00); the spread
 * reflects how the chains position themselves on each department rather than a
 * single blanket discount, so the cheapest shop genuinely changes per dish.
 */
const CATEGORY_PRICES = {
  'fruit-veg': { 'pingo-doce': 2.80, continente: 2.89, mercadona: 2.74, lidl: 2.71, auchan: 2.85 },
  'meat-fish': { 'pingo-doce': 9.35, continente: 8.90, mercadona: 8.55, lidl: 8.20, auchan: 8.45 },
  'dairy-eggs': { 'pingo-doce': 5.55, continente: 5.40, mercadona: 5.08, lidl: 5.13, auchan: 5.29 },
  'bread-bakery': { 'pingo-doce': 4.45, continente: 4.30, mercadona: 4.12, lidl: 4.04, auchan: 4.13 },
  frozen: { 'pingo-doce': 5.40, continente: 5.20, mercadona: 5.02, lidl: 4.94, auchan: 5.10 },
  'spices-herbs': { 'pingo-doce': 18.40, continente: 17.50, mercadona: 16.80, lidl: 16.20, auchan: 17.00 },
  baking: { 'pingo-doce': 3.22, continente: 3.10, mercadona: 3.04, lidl: 2.96, auchan: 3.02 },
  'sauces-condiments': { 'pingo-doce': 5.82, continente: 5.60, mercadona: 5.38, lidl: 5.21, auchan: 5.46 },
  storecupboard: { 'pingo-doce': 3.43, continente: 3.30, mercadona: 3.18, lidl: 3.09, auchan: 3.21 },
  'world-foods': { 'pingo-doce': 4.78, continente: 4.60, mercadona: 4.42, lidl: 4.28, auchan: 4.49 },
  other: { 'pingo-doce': 4.26, continente: 4.10, mercadona: 3.95, lidl: 3.84, auchan: 3.99 },
};

/** €/kg. Checked by hand against typical shelf prices (Continente, Nov 2026). */
const OVERRIDES = {
  'chicken-breast': 7.49,
  'chicken-thigh': 5.49,
  'chicken-wings': 4.29,
  'whole-chicken': 4.59,
  'beef-mince': 10.99,
  'beef-steak': 13.49,
  'pork-chop': 7.29,
  'pork-belly': 6.49,
  'lamb': 12.99,
  'bacon': 9.90,
  chorizo: 11.50,
  salmon: 14.49,
  'salmon-fillet': 15.90,
  cod: 11.99,
  'cod-fillet': 13.90,
  tuna: 11.50,
  'tinned-tuna': 11.50,
  prawns: 13.49,
  shrimp: 12.90,
  mussels: 3.99,
  eggs: 7.20,
  egg: 7.20,
  milk: 1.02,
  butter: 8.60,
  cream: 4.40,
  'double-cream': 4.80,
  yogurt: 2.55,
  'greek-yogurt': 3.60,
  cheese: 9.10,
  'cheddar-cheese': 10.40,
  parmesan: 18.90,
  mozzarella: 7.80,
  'cream-cheese': 8.20,
  halloumi: 12.90,
  'olive-oil': 9.40,
  'vegetable-oil': 2.30,
  'sunflower-oil': 2.40,
  rice: 2.15,
  'basmati-rice': 2.60,
  pasta: 1.95,
  spaghetti: 1.85,
  noodles: 3.10,
  flour: 1.05,
  'plain-flour': 1.05,
  'self-raising-flour': 1.15,
  'corn-flour': 2.40,
  bread: 3.10,
  'bread-rolls': 3.40,
  tortillas: 4.20,
  potatoes: 1.29,
  'sweet-potato': 1.79,
  onions: 1.29,
  'red-onion': 1.45,
  garlic: 6.90,
  tomatoes: 2.19,
  'cherry-tomatoes': 3.60,
  'tinned-tomatoes': 1.75,
  'tomato-puree': 3.40,
  'tomato-paste': 3.60,
  carrots: 0.99,
  courgette: 1.99,
  aubergine: 2.29,
  broccoli: 2.49,
  spinach: 3.20,
  mushrooms: 4.30,
  peppers: 2.35,
  'bell-pepper': 2.35,
  cucumber: 1.49,
  lettuce: 2.10,
  cabbage: 1.39,
  peas: 2.20,
  'green-beans': 3.10,
  bananas: 1.39,
  apples: 1.99,
  oranges: 1.79,
  lemons: 2.29,
  limes: 3.40,
  strawberries: 4.90,
  blueberries: 9.90,
  avocado: 5.90,
  chickpeas: 2.05,
  'black-beans': 2.25,
  'kidney-beans': 2.15,
  lentils: 2.55,
  'coconut-milk': 3.35,
  sugar: 1.12,
  'brown-sugar': 1.65,
  salt: 0.55,
  'black-pepper': 14.90,
  pepper: 12.40,
  paprika: 17.90,
  cumin: 19.90,
  coriander: 16.50,
  turmeric: 14.20,
  oregano: 28.50,
  thyme: 24.90,
  rosemary: 21.40,
  cinnamon: 14.60,
  honey: 8.40,
  'soy-sauce': 4.10,
  'fish-sauce': 4.60,
  vinegar: 1.70,
  'balsamic-vinegar': 6.40,
  mayonnaise: 3.75,
  mustard: 5.10,
  ketchup: 3.20,
  'peanut-butter': 7.40,
  stock: 7.80,
  'stock-cube': 7.80,
  wine: 5.60,
  'white-wine': 5.20,
  'red-wine': 5.80,
  beer: 2.90,
  chocolate: 11.90,
  cocoa: 12.40,
  vanilla: 42.00,
  'baking-powder': 6.20,
  'bicarbonate-of-soda': 3.80,
  gelatine: 26.00,
  yeast: 9.40,
};

/** Departments we know the registry uses; anything else falls back to `other`. */
function priceFor(category, store) {
  const table = CATEGORY_PRICES[category] ?? CATEGORY_PRICES.other;
  return table[store];
}

const recipes = JSON.parse(fs.readFileSync(RECIPES, 'utf8'));
const registryRows = JSON.parse(fs.readFileSync(INGREDIENTS, 'utf8'));

const categoryById = new Map();
for (const row of registryRows) {
  categoryById.set(row[0], row[2]);
}

const used = new Set();
for (const recipe of recipes) {
  for (const line of recipe.ingredients) used.add(line.ingredientId);
}

const items = {};
let overridden = 0;
for (const id of [...used].sort()) {
  if (id === 'other') continue;
  const category = categoryById.get(id) ?? 'other';
  const base = OVERRIDES[id];
  if (base !== undefined) overridden += 1;
  const perKg = {};
  for (const store of STORES) {
    const fallback = priceFor(category, store);
    // Overrides are reference (Continente) prices; other stores keep their
    // department ratio against Continente so the dish-level comparison is
    // consistent rather than a flat discount.
    const ratio = store === 'continente' ? 1 : fallback / priceFor(category, 'continente');
    perKg[store] = Math.round((base ?? fallback) * ratio * 100) / 100;
  }
  items[id] = { category, perKg };
}

const book = {
  version: '2026-11',
  currency: 'EUR',
  unit: 'kg',
  /** Shown in the app next to every price. */
  note: 'Estimated from our Portuguese price catalogue — not a live retailer feed.',
  stores: STORES,
  items,
};

fs.writeFileSync(OUT, `${JSON.stringify(book, null, 1)}\n`);
console.log(
  `price book written: ${Object.keys(items).length} ingredients (${overridden} hand-checked), ${STORES.length} stores`,
);
