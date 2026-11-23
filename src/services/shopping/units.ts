import type { Unit } from '@/types';

export type Dimension = 'mass' | 'volume' | 'count';

const MASS_FACTORS: Partial<Record<Unit, number>> = { g: 1, kg: 1000 };
const VOLUME_FACTORS: Partial<Record<Unit, number>> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 15,
  // Conventional metric cup used in this app's recipes.
  cup: 240,
};

export const COUNT_UNITS: Unit[] = [
  'unit',
  'piece',
  'clove',
  'slice',
  'head',
  'bunch',
  'sprig',
  'handful',
  'pinch',
  'can',
];

export function dimensionOf(unit: Unit): Dimension | null {
  if (MASS_FACTORS[unit]) return 'mass';
  if (VOLUME_FACTORS[unit]) return 'volume';
  if (COUNT_UNITS.includes(unit)) return 'count';
  return null;
}

/** Convert a quantity into the dimension's base unit: g, ml or count. */
export function toBase(unit: Unit, quantity: number): { dimension: Dimension; value: number } | null {
  const dimension = dimensionOf(unit);
  if (!dimension) return null;
  if (dimension === 'mass') {
    return { dimension, value: quantity * (MASS_FACTORS[unit] ?? 1) };
  }
  if (dimension === 'volume') {
    return { dimension, value: quantity * (VOLUME_FACTORS[unit] ?? 1) };
  }
  return { dimension, value: quantity };
}

export function roundQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** 450 -> "450", 1.5 -> "1.5", 0.25 -> "0.25" */
export function formatNumber(value: number): string {
  const rounded = roundQuantity(value);
  if (Number.isInteger(rounded)) return String(rounded);
  return String(parseFloat(rounded.toFixed(2)));
}

const UNIT_LABELS: Record<Unit, { one: string; many: string; short: string }> = {
  g: { one: 'g', many: 'g', short: 'g' },
  kg: { one: 'kg', many: 'kg', short: 'kg' },
  ml: { one: 'ml', many: 'ml', short: 'ml' },
  l: { one: 'l', many: 'l', short: 'l' },
  tsp: { one: 'tsp', many: 'tsp', short: 'tsp' },
  tbsp: { one: 'tbsp', many: 'tbsp', short: 'tbsp' },
  cup: { one: 'cup', many: 'cups', short: 'cups' },
  unit: { one: '', many: '', short: '' },
  piece: { one: 'piece', many: 'pieces', short: 'pcs' },
  clove: { one: 'clove', many: 'cloves', short: 'cloves' },
  slice: { one: 'slice', many: 'slices', short: 'slices' },
  head: { one: 'head', many: 'heads', short: 'heads' },
  bunch: { one: 'bunch', many: 'bunches', short: 'bunches' },
  sprig: { one: 'sprig', many: 'sprigs', short: 'sprigs' },
  handful: { one: 'handful', many: 'handfuls', short: 'handfuls' },
  pinch: { one: 'pinch', many: 'pinches', short: 'pinches' },
  can: { one: 'can', many: 'cans', short: 'cans' },
};

export function unitLabel(unit: Unit, amount: number): string {
  const labels = UNIT_LABELS[unit];
  if (!labels) return unit;
  return Math.abs(amount) === 1 ? labels.one : labels.many;
}

/** "450 g", "3 cloves", "3" */
export function formatQuantity(amount: number, unit: Unit): string {
  const label = unitLabel(unit, amount);
  const number = formatNumber(amount);
  if (unit === 'unit') return number;
  return `${number} ${label}`.trim();
}

export interface RawQuantity {
  quantity: number;
  unit: Unit;
}

export interface MergedQuantity {
  amount: number;
  unit: Unit;
}

/**
 * Merge quantities that share a dimension.
 *
 * mass     -> grams, shown as kg from 1000 g
 * volume   -> millilitres, shown as litres from 1000 ml
 * count    -> summed per unit label (cloves stay cloves)
 *
 * Incompatible measurements are never force-converted: they stay as separate
 * lines under the same ingredient.
 */
export interface MergeOptions {
  /**
   * 'ml' converts teaspoons/tablespoons to millilitres (sauces, stocks).
   * 'spoon' keeps them as spoons (spices, baking), which reads correctly.
   */
  volumeMode?: 'ml' | 'spoon';
}

const SPOON_UNITS: Unit[] = ['tsp', 'tbsp', 'cup'];

function toTeaspoons(unit: Unit, quantity: number): number {
  if (unit === 'tbsp') return quantity * 3;
  if (unit === 'cup') return quantity * 48;
  return quantity;
}

export function mergeQuantities(
  entries: RawQuantity[],
  options: MergeOptions = {},
): MergedQuantity[] {
  const spoonMode = options.volumeMode === 'spoon';
  let massTotal = 0;
  let massSeen = false;
  let volumeTotal = 0;
  let volumeSeen = false;
  let spoonsInTeaspoons = 0;
  let spoonSeen = false;
  const counts = new Map<Unit, number>();

  for (const entry of entries) {
    if (!Number.isFinite(entry.quantity) || entry.quantity <= 0) continue;
    const base = toBase(entry.unit, entry.quantity);
    if (!base) continue;
    if (base.dimension === 'mass') {
      massTotal += base.value;
      massSeen = true;
    } else if (base.dimension === 'volume' && spoonMode && SPOON_UNITS.includes(entry.unit)) {
      spoonsInTeaspoons += toTeaspoons(entry.unit, entry.quantity);
      spoonSeen = true;
    } else if (base.dimension === 'volume') {
      volumeTotal += base.value;
      volumeSeen = true;
    } else {
      counts.set(entry.unit, (counts.get(entry.unit) ?? 0) + entry.quantity);
    }
  }

  const merged: MergedQuantity[] = [];
  if (massSeen && massTotal > 0) {
    merged.push(
      massTotal >= 1000
        ? { amount: roundQuantity(massTotal / 1000), unit: 'kg' }
        : { amount: roundQuantity(massTotal), unit: 'g' },
    );
  }
  if (volumeSeen && volumeTotal > 0) {
    merged.push(
      volumeTotal >= 1000
        ? { amount: roundQuantity(volumeTotal / 1000), unit: 'l' }
        : { amount: roundQuantity(volumeTotal), unit: 'ml' },
    );
  }
  if (spoonSeen && spoonsInTeaspoons > 0) {
    merged.push(
      spoonsInTeaspoons >= 3
        ? { amount: roundQuantity(spoonsInTeaspoons / 3), unit: 'tbsp' }
        : { amount: roundQuantity(spoonsInTeaspoons), unit: 'tsp' },
    );
  }
  counts.forEach((amount, unit) => {
    if (amount > 0) merged.push({ amount: roundQuantity(amount), unit });
  });

  return merged;
}
