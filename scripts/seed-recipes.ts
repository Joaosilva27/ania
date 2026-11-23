/**
 * Seeds the public catalogue into Firestore.
 *
 *   npm run seed              # writes recipes + ingredients
 *   npm run seed:dry          # prints what would be written
 *
 * Authentication, in order of preference:
 *   1. FIREBASE_SERVICE_ACCOUNT=/absolute/path/to/service-account.json
 *   2. GOOGLE_APPLICATION_CREDENTIALS (application default credentials)
 *
 * The script is idempotent: documents are keyed by their stable ids and written
 * with `set(..., { merge: true })`, so running it twice never duplicates data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { INGREDIENTS } from '../src/data/ingredients';
import { RECIPE_CATALOGUE } from '../src/data/recipes';
import { validateCatalogue } from '../src/services/plan';

const dryRun = process.argv.includes('--dry-run') || process.argv.includes('--dry');

function credential() {
  const file = process.env.FIREBASE_SERVICE_ACCOUNT ?? './service-account.json';
  const resolved = path.resolve(process.cwd(), file);
  if (fs.existsSync(resolved)) {
    const json = JSON.parse(fs.readFileSync(resolved, 'utf8')) as Record<string, string>;
    return cert(json);
  }
  return applicationDefault();
}

async function main() {
  const problems = validateCatalogue();
  if (problems.length) {
    console.error('Catalogue validation failed:');
    problems.forEach((problem) => console.error(` - ${problem}`));
    process.exit(1);
  }

  console.log(
    `Catalogue OK: ${RECIPE_CATALOGUE.length} recipes, ${INGREDIENTS.length} canonical ingredients.`,
  );

  if (dryRun) {
    console.log('Dry run — no Firestore writes performed. Sample payload:');
    console.log(JSON.stringify(RECIPE_CATALOGUE[0], null, 2).slice(0, 800) + '…');
    return;
  }

  if (!getApps().length) {
    initializeApp({ credential: credential() });
  }
  const db = getFirestore();
  const now = new Date();

  let recipes = 0;
  for (const recipe of RECIPE_CATALOGUE) {
    await db
      .collection('recipes')
      .doc(recipe.id)
      .set({ ...recipe, seededAt: now.toISOString() }, { merge: true });
    recipes += 1;
  }

  let ingredients = 0;
  for (const ingredient of INGREDIENTS) {
    await db
      .collection('ingredients')
      .doc(ingredient.id)
      .set({ ...ingredient, seededAt: now.toISOString() }, { merge: true });
    ingredients += 1;
  }

  console.log(`Seeded ${recipes} recipes and ${ingredients} ingredients.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
