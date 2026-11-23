import type {
  DietaryPattern,
  GoalId,
  InterestId,
  ObstacleId,
  StatementKey,
} from '@/types';

export interface OptionMeta<T extends string> {
  id: T;
  label: string;
  description?: string;
  icon: string;
  /** Tags the recommendation engine rewards for this option. */
  boostTags: string[];
}

export const GOALS: OptionMeta<GoalId>[] = [
  {
    id: 'meal-prep',
    label: 'Meal prep for the week',
    description: 'Spend less time deciding what to cook.',
    icon: 'calendar-check-outline',
    boostTags: ['meal-prep', 'leftovers', 'batch'],
  },
  {
    id: 'simple-recipes',
    label: 'Find super simple recipes',
    description: 'Few ingredients, clear steps, no stress.',
    icon: 'lightning-bolt-outline',
    boostTags: ['simple', 'under-30', 'one-pan'],
  },
  {
    id: 'eat-healthier',
    label: 'Eat healthier',
    description: 'Balanced plates you actually enjoy.',
    icon: 'leaf',
    boostTags: ['veggie', 'high-protein', 'healthy'],
  },
  {
    id: 'spend-less',
    label: 'Spend less on groceries',
    description: 'Big flavour from inexpensive basics.',
    icon: 'piggy-bank-outline',
    boostTags: ['budget'],
  },
  {
    id: 'more-variety',
    label: 'Get more variety in my meals',
    description: 'Break out of the same five dinners.',
    icon: 'shuffle-variant',
    boostTags: ['variety'],
  },
];

export const OBSTACLES: OptionMeta<ObstacleId>[] = [
  { id: 'lack-of-time', label: 'Lack of time', icon: 'clock-outline', boostTags: ['under-30'] },
  {
    id: 'too-tired',
    label: 'Too tired after work',
    icon: 'power-sleep',
    boostTags: ['one-pan', 'low-effort', 'under-30'],
  },
  {
    id: 'cooking-difficult',
    label: 'I find cooking difficult',
    icon: 'chef-hat',
    boostTags: ['simple', 'easy'],
  },
  {
    id: 'lack-inspiration',
    label: 'I struggle for inspiration',
    icon: 'lightbulb-outline',
    boostTags: ['variety', 'comfort'],
  },
  {
    id: 'cant-find-recipes',
    label: "I can't find the right recipes",
    icon: 'magnify',
    boostTags: ['high-protein', 'budget'],
  },
];

export const INTERESTS: OptionMeta<InterestId>[] = [
  { id: 'packed-lunches', label: 'Packed lunches', icon: 'briefcase-outline', boostTags: ['packed-lunches', 'meal-prep', 'leftovers'] },
  { id: 'high-protein', label: 'High protein', icon: 'arm-flex-outline', boostTags: ['high-protein'] },
  { id: 'veggie', label: 'Veggie recipes', icon: 'sprout', boostTags: ['veggie'] },
  { id: 'family-friendly', label: 'Family friendly', icon: 'account-group-outline', boostTags: ['family-friendly'] },
  { id: 'quick-healthy-dinner', label: 'Quick healthy dinner', icon: 'fire', boostTags: ['under-30', 'healthy', 'dinner'] },
  { id: 'healthy-breakfasts', label: 'Healthy breakfasts', icon: 'food-apple-outline', boostTags: ['breakfast'] },
  { id: 'comfort', label: 'Comfort recipes', icon: 'heart-outline', boostTags: ['comfort'] },
];

export const DIETARY_OPTIONS: Array<{
  id: DietaryPattern;
  label: string;
  description: string;
  icon: string;
}> = [
  { id: 'none', label: 'None', description: 'No restrictions — show me everything.', icon: 'silverware-fork-knife' },
  { id: 'vegetarian', label: 'Veggie', description: 'No meat or fish; dairy and eggs are fine.', icon: 'sprout' },
  { id: 'vegan', label: 'Vegan', description: 'No animal-derived ingredients at all.', icon: 'leaf' },
  { id: 'pescatarian', label: 'Pescatarian', description: 'Fish and seafood yes, other meat no.', icon: 'fish' },
  { id: 'carnivore', label: 'Carnivore', description: 'Meat-inclusive preference — not a medical diet.', icon: 'food-drumstick' },
];

export interface StatementDefinition {
  key: StatementKey;
  text: string;
  /** Tags rewarded when the user agrees. */
  yesTags: string[];
}

export const STATEMENTS: StatementDefinition[] = [
  {
    key: 'budget_concern',
    text: 'I spend too much money on my dinners.',
    yesTags: ['budget'],
  },
  {
    key: 'recipe_search_frustration',
    text: 'I waste time looking for the perfect recipe online.',
    yesTags: ['simple', 'under-30'],
  },
  {
    key: 'processed_food_concern',
    text: 'I want to cut down on processed food.',
    yesTags: ['fresh', 'veggie'],
  },
  {
    key: 'last_minute_shopping',
    text: 'I buy my ingredients last minute.',
    yesTags: ['pantry-friendly', 'meal-prep'],
  },
  {
    key: 'healthy_weekly_meals',
    text: 'I want to eat healthy delicious food throughout the week.',
    yesTags: ['healthy', 'high-protein', 'veggie'],
  },
];

export const GOAL_LABELS: Record<string, string> = GOALS.reduce((acc, item) => {
  acc[item.id] = item.label;
  return acc;
}, {} as Record<string, string>);

export const INTEREST_LABELS: Record<string, string> = INTERESTS.reduce((acc, item) => {
  acc[item.id] = item.label;
  return acc;
}, {} as Record<string, string>);

export const OBSTACLE_LABELS: Record<string, string> = OBSTACLES.reduce((acc, item) => {
  acc[item.id] = item.label;
  return acc;
}, {} as Record<string, string>);

export const DIETARY_LABELS: Record<string, string> = DIETARY_OPTIONS.reduce((acc, item) => {
  acc[item.id] = item.label;
  return acc;
}, {} as Record<string, string>);

export const TAG_LABELS: Record<string, string> = {
  budget: 'Budget-friendly',
  'high-protein': 'High protein',
  'under-30': 'Under 30 min',
  'one-pan': 'One pan',
  'meal-prep': 'Great for meal prep',
  leftovers: 'Good leftovers',
  simple: 'Simple',
  easy: 'Easy',
  healthy: 'Healthy',
  veggie: 'Veggie',
  comfort: 'Comfort',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  fresh: 'Fresh ingredients',
  variety: 'Something different',
  'family-friendly': 'Family friendly',
  'packed-lunches': 'Packed lunch',
  'low-effort': 'Low effort',
  'pantry-friendly': 'Pantry-friendly',
  quick: 'Quick',
};
