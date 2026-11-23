/**
 * Fails if any icon name used by the app is missing from the bundled
 * MaterialCommunityIcons glyphmap. Catches silent blank icons that TypeScript
 * cannot see.
 *
 *   npm run verify:icons
 */
import fs from 'node:fs';
import path from 'node:path';
import { CATEGORY_ICONS, FAMILY_ICONS } from '../src/data/ingredientIcons';
import { INGREDIENTS } from '../src/data/ingredients';
import { SHOPPING_CATEGORY_ICONS } from '../src/data/recipes';
import { DIETARY_OPTIONS, GOALS, INTERESTS, OBSTACLES } from '../src/data/taxonomy';

const ROOT = process.cwd();
const glyphPath = path.join(
  ROOT,
  'node_modules',
  '@expo',
  'vector-icons',
  'build',
  'vendor',
  'react-native-vector-icons',
  'glyphmaps',
  'MaterialCommunityIcons.json',
);

const glyphmap = JSON.parse(fs.readFileSync(glyphPath, 'utf8')) as Record<string, number>;
const valid = new Set(Object.keys(glyphmap));

interface Check {
  name: string;
  where: string;
}

const checks: Check[] = [];

for (const ingredient of INGREDIENTS) {
  if (ingredient.icon) checks.push({ name: ingredient.icon, where: `ingredient:${ingredient.id}` });
}
for (const [family, icon] of Object.entries(FAMILY_ICONS)) {
  checks.push({ name: icon, where: `family:${family}` });
}
for (const [category, icon] of Object.entries(CATEGORY_ICONS)) {
  checks.push({ name: icon, where: `category:${category}` });
}
for (const [category, icon] of Object.entries(SHOPPING_CATEGORY_ICONS)) {
  checks.push({ name: icon, where: `section:${category}` });
}
for (const option of [...GOALS, ...OBSTACLES, ...INTERESTS]) {
  checks.push({ name: option.icon, where: `option:${option.id}` });
}
for (const option of DIETARY_OPTIONS) {
  checks.push({ name: option.icon, where: `diet:${option.id}` });
}

// Component-level glyph names written as JSX props.
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.expo', '.tools'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const jsxPattern = /\bname=["']([a-z0-9-]+)["']/g;
for (const file of [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'src'))]) {
  const content = fs.readFileSync(file, 'utf8');
  let match: RegExpExecArray | null;
  while ((match = jsxPattern.exec(content))) {
    const before = content.slice(Math.max(0, match.index - 24), match.index);
    if (/Screen\s*$/.test(before)) continue;
    checks.push({ name: match[1], where: path.relative(ROOT, file) });
  }
}

const missing = checks.filter((check) => !valid.has(check.name));
const uniqueMissing = [...new Map(missing.map((item) => [item.name, item])).values()];

if (uniqueMissing.length) {
  console.error(`${uniqueMissing.length} invalid icon name(s):`);
  for (const item of uniqueMissing) console.error(`  ${item.name}  (${item.where})`);
  process.exit(1);
}

console.log(`All ${new Set(checks.map((check) => check.name)).size} icon names are valid.`);
