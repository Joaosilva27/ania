import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, 'assets', 'image-sources.json');
const DEST = path.join(ROOT, 'assets', 'recipes');

async function main() {
  const raw = await fs.readFile(MANIFEST, 'utf8');
  const sources = JSON.parse(raw);
  await fs.mkdir(DEST, { recursive: true });

  let downloaded = 0;
  let skipped = 0;
  const failures = [];

  for (const [key, url] of Object.entries(sources)) {
    const file = key.startsWith('brand-')
      ? path.join(ROOT, 'assets', `${key}.jpg`)
      : path.join(DEST, `${key}.jpg`);
    try {
      const stat = await fs.stat(file);
      if (stat.size > 5000) {
        skipped += 1;
        continue;
      }
    } catch {
      /* not downloaded yet */
    }
    try {
      const response = await fetch(String(url));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 5000) throw new Error(`suspiciously small (${buffer.length} bytes)`);
      await fs.writeFile(file, buffer);
      downloaded += 1;
      console.log(`ok   ${key} (${Math.round(buffer.length / 1024)} KB)`);
    } catch (error) {
      failures.push(`${key}: ${error.message}`);
      console.error(`fail ${key} -> ${error.message}`);
    }
  }

  console.log(`\ndownloaded ${downloaded}, already present ${skipped}, failed ${failures.length}`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
