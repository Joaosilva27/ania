import type {
  AnimalOrigin,
  IngredientDefinition,
  IngredientFamily,
  ShoppingCategory,
} from '@/types';

/**
 * Canonical ingredient registry.
 *
 * Every recipe references these ids, so two different recipes that both use
 * garlic share one shopping-list line. `origin` is what the dietary engine
 * reads; `icon` is the specific layer of the IngredientIcon system.
 *
 * Tuple layout: [id, name, category, family, origin, icon?, pantryStaple?]
 */
type Row = [string, string, ShoppingCategory, IngredientFamily, AnimalOrigin, string?, boolean?];

const ROWS: Row[] = [
  // ---------------------------------------------------------------- meat & fish
  ['chicken-breast', 'Chicken breast', 'meat-fish', 'meat', 'meat', 'food-drumstick'],
  ['chicken-thigh', 'Chicken thighs', 'meat-fish', 'meat', 'meat', 'food-drumstick'],
  ['chicken-mince', 'Chicken mince', 'meat-fish', 'meat', 'meat', 'food-drumstick'],
  ['beef-mince', 'Beef mince', 'meat-fish', 'meat', 'meat', 'food-steak'],
  ['beef-strips', 'Beef stir-fry strips', 'meat-fish', 'meat', 'meat', 'food-steak'],
  ['streaky-bacon', 'Streaky bacon', 'meat-fish', 'meat', 'meat', 'food-drumstick'],
  ['chorizo', 'Chorizo', 'meat-fish', 'meat', 'meat'],
  ['pork-sausages', 'Pork sausages', 'meat-fish', 'meat', 'meat'],
  ['salmon-fillet', 'Salmon fillets', 'meat-fish', 'fish', 'fish', 'fish'],
  ['white-fish', 'White fish fillets', 'meat-fish', 'fish', 'fish', 'fish'],
  ['king-prawns', 'King prawns', 'meat-fish', 'fish', 'fish', 'fish'],
  ['tinned-tuna', 'Tinned tuna', 'meat-fish', 'fish', 'fish', 'fish', true],
  ['smoked-salmon', 'Smoked salmon', 'meat-fish', 'fish', 'fish', 'fish'],

  // ---------------------------------------------------------------- fruit & veg
  ['onion', 'Brown onion', 'fruit-veg', 'vegetable', 'none'],
  ['red-onion', 'Red onion', 'fruit-veg', 'vegetable', 'none'],
  ['garlic', 'Garlic', 'fruit-veg', 'vegetable', 'none'],
  ['ginger', 'Fresh ginger', 'fruit-veg', 'vegetable', 'none'],
  ['carrot', 'Carrot', 'fruit-veg', 'vegetable', 'none', 'carrot'],
  ['broccoli', 'Broccoli', 'fruit-veg', 'vegetable', 'none', 'leaf'],
  ['courgette', 'Courgette', 'fruit-veg', 'vegetable', 'none'],
  ['red-pepper', 'Red pepper', 'fruit-veg', 'vegetable', 'none'],
  ['yellow-pepper', 'Yellow pepper', 'fruit-veg', 'vegetable', 'none'],
  ['tomatoes', 'Tomatoes', 'fruit-veg', 'vegetable', 'none'],
  ['cherry-tomatoes', 'Cherry tomatoes', 'fruit-veg', 'vegetable', 'none'],
  ['spinach', 'Baby spinach', 'fruit-veg', 'vegetable', 'none', 'leaf'],
  ['kale', 'Kale', 'fruit-veg', 'vegetable', 'none', 'leaf'],
  ['lettuce', 'Little gem lettuce', 'fruit-veg', 'vegetable', 'none', 'leaf'],
  ['cucumber', 'Cucumber', 'fruit-veg', 'vegetable', 'none'],
  ['avocado', 'Avocado', 'fruit-veg', 'fruit', 'none'],
  ['lemon', 'Lemon', 'fruit-veg', 'fruit', 'none'],
  ['lime', 'Lime', 'fruit-veg', 'fruit', 'none'],
  ['potatoes', 'Potatoes', 'fruit-veg', 'vegetable', 'none'],
  ['sweet-potato', 'Sweet potato', 'fruit-veg', 'vegetable', 'none'],
  ['mushrooms', 'Chestnut mushrooms', 'fruit-veg', 'vegetable', 'none', 'mushroom'],
  ['spring-onions', 'Spring onions', 'fruit-veg', 'vegetable', 'none'],
  ['red-chilli', 'Red chilli', 'fruit-veg', 'vegetable', 'none', 'chili-mild'],
  ['coriander', 'Fresh coriander', 'fruit-veg', 'vegetable', 'none', 'leaf'],
  ['parsley', 'Fresh parsley', 'fruit-veg', 'vegetable', 'none', 'leaf'],
  ['basil', 'Fresh basil', 'fruit-veg', 'vegetable', 'none', 'leaf'],
  ['thyme', 'Fresh thyme', 'fruit-veg', 'vegetable', 'none', 'leaf'],
  ['green-beans', 'Green beans', 'fruit-veg', 'vegetable', 'none'],
  ['red-cabbage', 'Red cabbage', 'fruit-veg', 'vegetable', 'none'],
  ['spring-greens', 'Spring greens', 'fruit-veg', 'vegetable', 'none', 'leaf'],
  ['banana', 'Banana', 'fruit-veg', 'fruit', 'none'],
  ['apple', 'Apple', 'fruit-veg', 'fruit', 'none', 'food-apple'],
  ['mixed-berries', 'Mixed berries', 'fruit-veg', 'fruit', 'none', 'fruit-cherries'],
  ['frozen-berries', 'Frozen berries', 'frozen', 'frozen', 'none', 'snowflake'],
  ['frozen-peas', 'Frozen peas', 'frozen', 'frozen', 'none', 'snowflake'],
  ['frozen-sweetcorn', 'Frozen sweetcorn', 'frozen', 'frozen', 'none', 'corn'],

  // ---------------------------------------------------------------- dairy & eggs
  ['eggs', 'Eggs', 'dairy-eggs', 'egg', 'egg', 'egg'],
  ['milk', 'Milk', 'dairy-eggs', 'dairy', 'dairy'],
  ['butter', 'Butter', 'dairy-eggs', 'dairy', 'dairy'],
  ['double-cream', 'Double cream', 'dairy-eggs', 'dairy', 'dairy'],
  ['creme-fraiche', 'Crème fraîche', 'dairy-eggs', 'dairy', 'dairy'],
  ['greek-yogurt', 'Greek yogurt', 'dairy-eggs', 'dairy', 'dairy'],
  ['cheddar', 'Cheddar', 'dairy-eggs', 'dairy', 'dairy', 'cheese'],
  ['parmesan', 'Parmesan', 'dairy-eggs', 'dairy', 'dairy', 'cheese'],
  ['mozzarella', 'Mozzarella', 'dairy-eggs', 'dairy', 'dairy', 'cheese'],
  ['feta', 'Feta', 'dairy-eggs', 'dairy', 'dairy', 'cheese'],
  ['halloumi', 'Halloumi', 'dairy-eggs', 'dairy', 'dairy', 'cheese'],
  ['cream-cheese', 'Cream cheese', 'dairy-eggs', 'dairy', 'dairy', 'cheese'],
  ['oat-milk', 'Oat milk', 'dairy-eggs', 'dairy', 'none'],

  // ---------------------------------------------------------------- spices & herbs
  ['salt', 'Salt', 'spices-herbs', 'spice', 'none', undefined, true],
  ['black-pepper', 'Black pepper', 'spices-herbs', 'spice', 'none', undefined, true],
  ['smoked-paprika', 'Smoked paprika', 'spices-herbs', 'spice', 'none', undefined, true],
  ['ground-cumin', 'Ground cumin', 'spices-herbs', 'spice', 'none', undefined, true],
  ['ground-coriander', 'Ground coriander', 'spices-herbs', 'spice', 'none', undefined, true],
  ['turmeric', 'Ground turmeric', 'spices-herbs', 'spice', 'none', undefined, true],
  ['curry-powder', 'Curry powder', 'spices-herbs', 'spice', 'none', undefined, true],
  ['chilli-flakes', 'Chilli flakes', 'spices-herbs', 'spice', 'none', undefined, true],
  ['dried-oregano', 'Dried oregano', 'spices-herbs', 'spice', 'none', undefined, true],
  ['ground-cinnamon', 'Ground cinnamon', 'spices-herbs', 'spice', 'none', undefined, true],
  ['garam-masala', 'Garam masala', 'spices-herbs', 'spice', 'none', undefined, true],
  ['bay-leaves', 'Bay leaves', 'spices-herbs', 'spice', 'none', undefined, true],

  // ---------------------------------------------------------------- baking
  ['plain-flour', 'Plain flour', 'baking', 'pantry', 'none', undefined, true],
  ['baking-powder', 'Baking powder', 'baking', 'pantry', 'none', undefined, true],
  ['caster-sugar', 'Caster sugar', 'baking', 'pantry', 'none', undefined, true],
  ['brown-sugar', 'Light brown sugar', 'baking', 'pantry', 'none', undefined, true],
  ['cornflour', 'Cornflour', 'baking', 'pantry', 'none', undefined, true],

  // ---------------------------------------------------------------- sauces & condiments
  ['olive-oil', 'Olive oil', 'sauces-condiments', 'sauce', 'none', undefined, true],
  ['sesame-oil', 'Sesame oil', 'sauces-condiments', 'sauce', 'none', undefined, true],
  ['soy-sauce', 'Soy sauce', 'sauces-condiments', 'sauce', 'none', undefined, true],
  ['honey', 'Honey', 'sauces-condiments', 'sauce', 'honey', undefined, true],
  ['maple-syrup', 'Maple syrup', 'sauces-condiments', 'sauce', 'none', undefined, true],
  ['mayonnaise', 'Mayonnaise', 'sauces-condiments', 'sauce', 'egg', undefined, true],
  ['dijon-mustard', 'Dijon mustard', 'sauces-condiments', 'sauce', 'none', undefined, true],
  ['ketchup', 'Ketchup', 'sauces-condiments', 'sauce', 'none', undefined, true],
  ['sriracha', 'Sriracha', 'sauces-condiments', 'sauce', 'none', undefined, true],
  ['basil-pesto', 'Basil pesto', 'sauces-condiments', 'sauce', 'dairy', undefined, true],
  ['peanut-butter', 'Peanut butter', 'sauces-condiments', 'sauce', 'none', undefined, true],
  ['tahini', 'Tahini', 'sauces-condiments', 'sauce', 'none', undefined, true],
  ['balsamic-vinegar', 'Balsamic vinegar', 'sauces-condiments', 'sauce', 'none', undefined, true],
  ['tomato-puree', 'Tomato purée', 'sauces-condiments', 'sauce', 'none', undefined, true],
  ['sweet-chilli-sauce', 'Sweet chilli sauce', 'sauces-condiments', 'sauce', 'none', undefined, true],

  // ---------------------------------------------------------------- storecupboard
  ['long-grain-rice', 'Long-grain rice', 'storecupboard', 'grain', 'none', 'rice', true],
  ['basmati-rice', 'Basmati rice', 'storecupboard', 'grain', 'none', 'rice', true],
  ['brown-rice', 'Brown rice', 'storecupboard', 'grain', 'none', 'rice', true],
  ['egg-noodles', 'Egg noodles', 'storecupboard', 'grain', 'egg', 'noodles'],
  ['rice-noodles', 'Rice noodles', 'world-foods', 'grain', 'none', 'noodles'],
  ['pasta', 'Pasta', 'storecupboard', 'grain', 'none', 'pasta', true],
  ['orzo', 'Orzo', 'storecupboard', 'grain', 'none', 'pasta', true],
  ['spaghetti', 'Spaghetti', 'storecupboard', 'grain', 'none', 'pasta', true],
  ['couscous', 'Couscous', 'storecupboard', 'grain', 'none', 'barley', true],
  ['quinoa', 'Quinoa', 'storecupboard', 'grain', 'none', 'barley', true],
  ['rolled-oats', 'Rolled oats', 'storecupboard', 'grain', 'none', 'barley', true],
  ['tinned-chickpeas', 'Tinned chickpeas', 'storecupboard', 'pantry', 'none', 'package-variant', true],
  ['tinned-black-beans', 'Tinned black beans', 'storecupboard', 'pantry', 'none', 'package-variant', true],
  ['tinned-kidney-beans', 'Tinned kidney beans', 'storecupboard', 'pantry', 'none', 'package-variant', true],
  ['coconut-milk', 'Tinned coconut milk', 'storecupboard', 'pantry', 'none', 'package-variant', true],
  ['tinned-tomatoes', 'Tinned chopped tomatoes', 'storecupboard', 'pantry', 'none', 'package-variant', true],
  ['passata', 'Tomato passata', 'storecupboard', 'pantry', 'none', 'package-variant', true],
  ['red-lentils', 'Red lentils', 'storecupboard', 'pantry', 'none', 'barley', true],
  ['vegetable-stock', 'Vegetable stock', 'storecupboard', 'pantry', 'none', 'package-variant', true],
  ['peanuts', 'Roasted peanuts', 'storecupboard', 'pantry', 'none', 'peanut', true],
  ['sesame-seeds', 'Sesame seeds', 'storecupboard', 'pantry', 'none', undefined, true],
  ['pine-nuts', 'Pine nuts', 'storecupboard', 'pantry', 'none', undefined, true],
  ['flaked-almonds', 'Flaked almonds', 'storecupboard', 'pantry', 'none', undefined, true],
  ['olives', 'Black olives', 'storecupboard', 'pantry', 'none', undefined, true],
  ['capers', 'Capers', 'storecupboard', 'pantry', 'none', undefined, true],
  ['sun-dried-tomatoes', 'Sun-dried tomatoes', 'storecupboard', 'pantry', 'none', undefined, true],
  ['tinned-cannellini-beans', 'Tinned cannellini beans', 'storecupboard', 'pantry', 'none', 'package-variant', true],
  ['firm-tofu', 'Firm tofu', 'storecupboard', 'pantry', 'none', 'cube-outline'],
  ['chia-seeds', 'Chia seeds', 'storecupboard', 'pantry', 'none', undefined, true],
  ['pumpkin-seeds', 'Pumpkin seeds', 'storecupboard', 'pantry', 'none', undefined, true],

  // ---------------------------------------------------------------- world foods
  ['tortilla-wraps', 'Tortilla wraps', 'world-foods', 'bakery', 'none', 'bread-slice'],
  ['pitta-breads', 'Pitta breads', 'world-foods', 'bakery', 'none', 'bread-slice'],
  ['panko', 'Panko breadcrumbs', 'world-foods', 'bakery', 'none', 'bread-slice'],
  ['curry-paste', 'Thai red curry paste', 'world-foods', 'sauce', 'none', undefined, true],
  ['mango-chutney', 'Mango chutney', 'world-foods', 'sauce', 'none', undefined, true],

  // ---------------------------------------------------------------- bread & bakery
  ['sourdough', 'Sourdough bread', 'bread-bakery', 'bakery', 'none', 'bread-slice'],
  ['burger-buns', 'Burger buns', 'bread-bakery', 'bakery', 'none', 'bread-slice'],
];

type RegistryRow = Row;

export const INGREDIENTS: IngredientDefinition[] = ROWS.map(
  (row: RegistryRow): IngredientDefinition => {
    const [id, name, category, family, origin, icon, pantryStaple] = row;
    const definition: IngredientDefinition = {
      id,
      name,
      category,
      family,
      origin,
      pantryStaple: Boolean(pantryStaple),
      aliases: [],
      allergens: [],
    };
    if (icon) definition.icon = icon;
    return definition;
  },
);

const ALLERGEN_BY_INGREDIENT: Record<string, string[]> = {
  milk: ['milk'],
  butter: ['milk'],
  'double-cream': ['milk'],
  'creme-fraiche': ['milk'],
  'greek-yogurt': ['milk'],
  cheddar: ['milk'],
  parmesan: ['milk'],
  mozzarella: ['milk'],
  feta: ['milk'],
  halloumi: ['milk'],
  eggs: ['egg'],
  mayonnaise: ['egg'],
  'egg-noodles': ['egg', 'gluten'],
  pasta: ['gluten'],
  spaghetti: ['gluten'],
  orzo: ['gluten'],
  couscous: ['gluten'],
  panko: ['gluten'],
  sourdough: ['gluten'],
  'tortilla-wraps': ['gluten'],
  'pitta-breads': ['gluten'],
  peanuts: ['peanut'],
  'peanut-butter': ['peanut'],
  'flaked-almonds': ['nuts'],
  'pine-nuts': ['nuts'],
  'sesame-seeds': ['sesame'],
  'sesame-oil': ['sesame'],
  'soy-sauce': ['soya', 'gluten'],
  tahini: ['sesame'],
  'king-prawns': ['crustacean'],
  'salmon-fillet': ['fish'],
  'white-fish': ['fish'],
  'tinned-tuna': ['fish'],
  'smoked-salmon': ['fish'],
  'curry-paste': ['fish'],
};

for (const definition of INGREDIENTS) {
  const allergens = ALLERGEN_BY_INGREDIENT[definition.id];
  if (allergens) definition.allergens = allergens;
}

const ALIAS_MAP: Record<string, string> = {
  'chicken breasts': 'chicken-breast',
  'boneless chicken breast': 'chicken-breast',
  'chicken breast fillets': 'chicken-breast',
  'chicken thighs': 'chicken-thigh',
  'brown onions': 'onion',
  onions: 'onion',
  'garlic cloves': 'garlic',
  'fresh garlic': 'garlic',
  'tomato': 'tomatoes',
  'chopped tomatoes': 'tinned-tomatoes',
  'canned tomatoes': 'tinned-tomatoes',
  'coconut milk': 'coconut-milk',
  'olive oil': 'olive-oil',
  'soy': 'soy-sauce',
  'light soy sauce': 'soy-sauce',
  'spring onion': 'spring-onions',
  'bell pepper': 'red-pepper',
  'chilli': 'red-chilli',
  'coriander leaves': 'coriander',
  'greek yoghurt': 'greek-yogurt',
  'silken tofu': 'firm-tofu',
  tofu: 'firm-tofu',
  'cannellini beans': 'tinned-cannellini-beans',
  'white beans': 'tinned-cannellini-beans',
  'yoghurt': 'greek-yogurt',
};

export const INGREDIENT_MAP: Record<string, IngredientDefinition> = INGREDIENTS.reduce(
  (acc, definition) => {
    acc[definition.id] = definition;
    return acc;
  },
  {} as Record<string, IngredientDefinition>,
);

/** Resolve a raw shopping string onto a canonical ingredient id, when possible. */
export function resolveIngredientId(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (INGREDIENT_MAP[key]) return key;
  if (ALIAS_MAP[key]) return ALIAS_MAP[key];
  const withoutSuffix = key.replace(/\s*\(.*\)\s*$/, '').replace(/s$/, '');
  if (INGREDIENT_MAP[withoutSuffix]) return withoutSuffix;
  const match = INGREDIENTS.find((item) =>
    item.aliases.some((alias) => alias.toLowerCase() === key),
  );
  return match ? match.id : null;
}

export const INGREDIENT_IDS: string[] = INGREDIENTS.map((item) => item.id);
