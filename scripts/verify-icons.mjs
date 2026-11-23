import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const GLYPHMAP = path.join(
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

async function collectFiles(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.expo', '.tools'].includes(entry.name)) continue;
      await collectFiles(full, out);
    } else if (/\.(tsx?|js)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const glyphs = JSON.parse(await fs.readFile(GLYPHMAP, 'utf8'));
  const valid = new Set(Object.keys(glyphs));
  const files = [
    ...(await collectFiles(path.join(ROOT, 'src'))),
    ...(await collectFiles(path.join(ROOT, 'app'))),
  ];

  const namePattern = /\b(?:name|icon)\s*[:=]\s*\{?\s*["']([a-z0-9-]+)["']/g;
  const found = new Map();
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    let match;
    while ((match = namePattern.exec(content))) {
      const name = match[1];
      const before = content.slice(Math.max(0, match.index - 24), match.index);
      // <Stack.Screen name="..."> / <Tabs.Screen name="..."> are routes, not glyphs.
      if (/Screen\s*$/.test(before)) continue;
      if (!found.has(name)) found.set(name, []);
      found.get(name).push(path.relative(ROOT, file));
    }
  }

  const missing = [...found.entries()].filter(([name]) => !valid.has(name));
  if (!missing.length) {
    console.log(`All ${found.size} icon names exist in MaterialCommunityIcons.`);
    return;
  }
  console.log(`${missing.length} icon names are NOT in the glyphmap:`);
  for (const [name, where] of missing) {
    console.log(`  ${name}  (${[...new Set(where)].join(', ')})`);
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
