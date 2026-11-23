# ania — budget cooking, sorted

A premium mobile cooking and meal-planning app built with Expo + React Native + TypeScript.
Discover affordable recipes, swipe your first three meals, get an automatic shopping list, and
keep the whole week in sync.

Phase 1 is a complete vertical slice: authentication shell, onboarding, a **44-recipe original
catalogue**, a real ranking engine, Tinder-style swiping, a normalising grocery engine, meal-plan
management and persistent shopping state.

---

## 1. What's in the app

| Area | What it does |
| --- | --- |
| **Welcome / auth** | Editorial welcome screen, Google sign-in (Firebase), session restore, clear error + loading states |
| **Onboarding** | Goals → obstacles → 5 swipeable statements → interests → dietary → 3-recipe swipe selection → plan confirmation → generated shopping list |
| **Home** | Time-aware greeting, interest filter chips, personalised recommendation carousel, live meal-plan summary |
| **Discover** | Full-screen Tinder-style recipe deck with X / + / details, card stack, spring animations |
| **Recipe detail** | Hero photo, stats, per-serving scaling, icon ingredient list, numbered method, add-to-plan, favourites |
| **Plan** | All planned recipes, serving steppers, remove with confirmation, shopping-list shortcut |
| **Shopping list** | Auto-combined, category grouped, collapsible, checkable, provenance per ingredient, manual items, share, clear-checked |
| **Profile / settings** | Real account data, editable goal/diet/interests, diet-conflict warnings, privacy note, sign out |
| **Persistence** | Local cache + Firestore sync, onboarding resume, offline reads, pending-sync indicator |

Every button on screen is wired to a real state transition. There are no placeholder screens.

---

## 2. Stack

- **Expo SDK 53**, React Native 0.79, React 19, TypeScript **strict**
- **Expo Router** (file-based routes, groups, typed guards)
- **React Native Reanimated 3** + **Gesture Handler** for the swipe decks (UI-thread animations)
- **Zustand** for client state, **TanStack Query** configured at the root for future server data
- **expo-image** (disk/memory caching, blurhash placeholder), **expo-font** with DM Sans + DM Serif Display
- **Firebase Auth** (Google) + **Cloud Firestore**, with security rules in `firestore.rules`
- **Jest + ts-jest** for the pure business logic (57 tests)

---

## 3. Quick start

```bash
# 1. install
npm install

# 2. (optional) configure Firebase + Google — see section 5/6
cp .env.example .env

# 3. run
npm run start          # Expo dev server (scan QR with a development build)
npm run android        # Android
npm run ios            # iOS (macOS only)
npm run web            # browser (handy for layout checks; see limitations)
```

> **No Firebase configured?** The app runs in a clearly labelled **local preview mode**: it creates
> a device-only profile (`preview@ania.local`) so you can exercise the entire product flow. This is
> never presented as Google sign-in and never enabled as a production bypass — the moment
> `EXPO_PUBLIC_FIREBASE_*` values exist, Google auth becomes the only path.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run start` | Start the Expo dev server |
| `npm run android` / `npm run ios` | Launch on a device/emulator |
| `npm run web` | Run the web build (Metro + react-native-web) |
| `npm run typecheck` | `tsc --noEmit` over app + src (strict) |
| `npm run typecheck:test` | Type-check the test project |
| `npm test` | Jest suite for aggregation, dietary, recommendations, onboarding |
| `npm run seed` | Seed Firestore with recipes + ingredients (idempotent) |
| `npm run seed:dry` | Validate the catalogue and print a sample payload, no writes |
| `npm run images:fetch` | Download recipe photography listed in `assets/image-sources.json` |
| `npm run images:build` | Regenerate `src/assets/recipeImages.ts` from `assets/recipes/` |
| `npm run icons` | Regenerate icon / adaptive icon / splash PNGs |
| `npm run verify:icons` | Fail if any MaterialCommunityIcons name is not in the glyphmap |
| `npx expo prebuild` | Generate native `ios/` + `android/` projects for a development build |

(The machine this project was assembled on has no global Node install; a portable toolchain lives in
`.tools/node-v22.11.0-win-x64`, which is git-ignored. On any normal machine use your own Node 20+.)

---

## 4. Architecture

```
app/                          # Expo Router routes only
  _layout.tsx                 # providers, fonts, splash, route guard
  index.tsx                   # auth/onboarding resolver
  auth/                       # welcome, sign-in, how-it-works
  onboarding/                 # the 8 onboarding steps
  (tabs)/                     # home, discover, plan, profile
  recipe/[id].tsx             # recipe detail
  shopping-list.tsx
  settings.tsx

src/
  types/                      # Recipe, UserData, taxonomy unions
  theme/                      # colour, type, spacing, radius, shadows, motion tokens
  data/
    ingredients.ts            # canonical ingredient registry (origin, category, icon)
    taxonomy.ts               # goals, obstacles, interests, statements, diet options
    builders.ts               # defineRecipe() derives time + dietary classification
    recipes/                  # 44 recipes across 6 files
  services/
    dietary.ts                # classification + hard filters from ingredient origins
    recommendations/          # filter → score → rank → diversify → feedback
    shopping/                 # unit normalisation + grocery aggregation
    recipes/servings.ts       # quantity scaling
    userData.ts               # pure, testable state transitions
    onboarding.ts             # step order, gates, resume logic
    persistence/              # local cache + cloud write-through
    firebase/                 # config, client, auth, Firestore
  store/                      # zustand: auth + user document
  hooks/                      # google sign-in, onboarding nav, plan actions, shopping list
  components/                 # ui, recipes, swipe, shopping, onboarding
__tests__/                    # business-logic tests
scripts/                      # seeding, image fetch, icon generation, icon verification
```

Design principle: **screens render, services decide**. Everything the tests cover is pure TypeScript
with no React Native imports, so the rules that matter can be verified in milliseconds.

---

## 5. Firebase setup

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method → Google → Enable**, and add your support email.
3. **Project settings → Your apps → Web** (`</>`) and copy the config into `.env`:

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

4. Create Firestore (production mode, region close to you).
5. Deploy the rules:

```bash
npm install -g firebase-tools        # or: npx firebase-tools
firebase login
firebase init firestore --project your-project   # keep firestore.rules, skip index creation
firebase deploy --only firestore:rules --project your-project
```

6. Seed the public catalogue (needs a service account: **Project settings → Service accounts →
   Generate new private key**) and keep it out of git:

```bash
FIREBASE_SERVICE_ACCOUNT=./service-account.json npm run seed
```

The app itself does **not** require seeding: it ships the same catalogue in the bundle and only
reads `recipes/*` once you wire that in for later phases.

### Data model

```
users/{uid}                   profile · preferences · onboarding · plan · shopping · favorites · feedback
users/{uid}/feedback/{rid}    swipe history (also mirrored in the document for offline reads)
users/{uid}/favorites/{rid}   saved recipes
recipes/{recipeId}            public catalogue (read-only for clients)
ingredients/{id}              public taxonomy (read-only for clients)
```

The client always writes the user document locally first and then writes through to Firestore with
`merge: true`; a failed cloud write is surfaced as “Saved on this device, syncing when online”.

---

## 6. Google Sign-In (iOS + Android) — required for real auth

Native Google sign-in does **not** work in Expo Go. You need a development build:

```bash
npx expo prebuild
npx expo run:android      # or: eas build --profile development
npx expo run:ios
```

In **Google Cloud console → APIs & Services → Credentials**, create three OAuth client IDs:

| Platform | Type | Notes |
| --- | --- | --- |
| Web | Web application | Used as the `id_token` audience; put it in `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` |
| iOS | iOS | Bundle ID `com.ania.app`; put it in `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` |
| Android | Android | Package `com.ania.app` + your debug/release **SHA-1**; put it in `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` |

Then:

1. In Firebase → **Authentication → Settings → Authorized domains**, add `localhost` and your
   production domain.
2. In the Google **web** client, add authorised redirect URIs matching what
   `expo-auth-session` produces, e.g. `http://localhost:8081/--/auth` for web dev and
   `https://auth.expo.io/@your-username/ania` if you use the Expo proxy. Print the exact value at
   runtime with `AuthSession.makeRedirectUri({ scheme: 'ania', path: 'auth' })`.
3. Native uses the **ID-token** flow (`AuthSession.useAuthRequest` + `GoogleAuthProvider.credential`);
   web uses Firebase’s popup. Both end in the same `users/{uid}` document.
4. `app.json` already declares `"scheme": "ania"`; keep it in sync with the redirect URI.

If credentials are absent, the welcome screen shows a preview-mode banner instead of a broken button.

---

## 7. The two engines

### Grocery aggregation (`src/services/shopping`)

- Ingredients are identified by **canonical ids**, never by string comparison.
- Quantities are normalised by dimension: mass → `g` (shown as `kg` from 1000), volume → `ml`
  (shown as `l` from 1000; `1 tsp = 5 ml`, `1 tbsp = 15 ml`, `1 cup = 240 ml`), counts summed per
  unit label (`cloves`, `cans`, …).
- **Incompatible units are never force-converted.** 2 cloves + 20 g garlic stays as two lines under
  one ingredient.
- Serving changes and recipe removals recompute from the current plan; checked state is keyed by
  ingredient id and survives recalculation, disappearing only when nothing needs it any more.
- Manual items live in their own namespace and are never merged into generated quantities.

### Recommendations (`src/services/recommendations`)

1. **Hard filter first:** dietary pattern (derived from each ingredient’s `origin`: meat, fish, dairy,
   egg, honey), invalid/incomplete recipes, recipes already planned, and rejections inside a
   14-day cooldown. Unknown ingredients are excluded from restrictive diets until reviewed.
2. **Score 0–100:** interests 35 · primary goal 20 · obstacles 15 · statements 10 · budget 10,
   plus learned tag affinity loaded from swipe history (±8) and practical adjustments
   (time pressure, difficulty, meal-prep suitability).
3. **Diversify:** greedy pass that penalises repeats of the same protein, cuisine or cooking method.
4. **Learn:** accept/reject events update `feedback`; tags are re-weighted on the next ranking.

It is deterministic and explainable — not machine learning, and the code says so.

---

## 8. Tests

```bash
npm test
```

57 assertions across four suites:

- **shopping** — merging across recipes, `g`+`kg`, `ml`+`l`, tbsp→ml, incompatible units, serving
  scaling, removals, zero/negative quantities, missing recipes, manual items, checked-state
  preservation, category order, optional-only aggregation, whole-catalogue integrity.
- **dietary** — meat/fish/dairy/egg/honey classification, vegetarian & vegan & pescatarian filters,
  unrestricted + carnivore behaviour, unknown ingredients, plan conflicts, catalogue consistency.
- **recommendations** — interest/goal/obstacle/difficulty weighting, time penalties, diet hard
  filters, plan exclusion, rejection cooldown expiry, ranking stability, diversity, learned affinity,
  and the spec’s worked example.
- **onboarding** — step order & resume, per-step gates, backward navigation, statement storage,
  exactly-three selection, plan/shopping persistence, stale-check pruning, catalogue validation.

`npm run typecheck` is strict and currently clean.

---

## 9. Known limitations (honest list)

- **No live OAuth credentials were available in this environment**, so the Google flow is
  implemented but was **not exercised against a real Firebase project**. Preview mode is what ran.
  Sign-in must be verified on a development build after you add your own credentials.
- **Nutrition values are editorial estimates** and labelled as such in the UI.
- **No prices are invented.** Recipes carry a reviewed qualitative `budgetTier`
  (`budget` / `moderate` / `higher`) and a future-ready pricing interface, but no supermarket
  figures are displayed.
- **Photography is AI-generated for this project** (44 unique dish images + welcome hero), bundled
  locally so there are no broken or hotlinked URLs. Treat them as placeholders to be replaced with a
  real shoot before launch.
- **The web build is a verification surface**, not a ship target: native modules (haptics, share
  sheet, OAuth redirect) behave differently there.
- **Carnivore** is treated as a meat-inclusive preference, not a medical restriction (stated in the
  UI).
- Firestore `recipes/*` is not read by the client in Phase 1; the bundled catalogue is the source of
  truth and the seed script exists for Phase 2.
- `npm run lint` is not configured/run yet; typecheck + tests are the enforced gates.

---

## 10. Where Phase 2 plugs in

- **Budget intelligence:** `Recipe.budgetTier` + a future `prices/{ingredientId}` collection; the
  shopping engine already keeps per-ingredient quantities to cost against.
- **Pantry:** mark ingredient ids as owned and filter/prioritise in `rankRecipes`.
- **7-day calendar:** the plan is already `items[{ recipeId, servings, addedAt }]`; add a `slot`.
- **Nutrition targets:** `RecipeNutrition` exists per recipe; scale by servings.
- **Region/currency:** `Recipe.currency` and a locale layer in `src/services/shopping/units.ts`.
