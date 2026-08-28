/**
 * The seed corpus. Deliberately uneven: short and long titles, one-word and
 * many-word ingredient names, a step that is a single sentence and a step that
 * is a paragraph — because a layout that "just works" has to work on the data
 * an author did not pick for the screenshot.
 */

export type Unit = 'g' | 'kg' | 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup' | 'piece' | 'pinch' | 'clove';

export interface Ingredient {
  readonly name: string;
  readonly quantity: number;
  readonly unit: Unit;
}

export interface Recipe {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly tags: readonly string[];
  readonly minutes: number;
  readonly servings: number;
  readonly ingredients: readonly Ingredient[];
  readonly steps: readonly string[];
}

export const RECIPES: readonly Recipe[] = [
  {
    id: 'shakshuka',
    title: 'Shakshuka',
    summary: 'Eggs poached in a spiced tomato and pepper sauce. One pan, thirty minutes.',
    tags: ['breakfast', 'vegetarian', 'one-pan'],
    minutes: 30,
    servings: 2,
    ingredients: [
      { name: 'olive oil', quantity: 2, unit: 'tbsp' },
      { name: 'onion', quantity: 1, unit: 'piece' },
      { name: 'red pepper', quantity: 1, unit: 'piece' },
      { name: 'garlic', quantity: 3, unit: 'clove' },
      { name: 'ground cumin', quantity: 1, unit: 'tsp' },
      { name: 'smoked paprika', quantity: 1, unit: 'tsp' },
      { name: 'chopped tomatoes', quantity: 400, unit: 'g' },
      { name: 'eggs', quantity: 4, unit: 'piece' },
      { name: 'feta', quantity: 60, unit: 'g' },
    ],
    steps: [
      'Warm the oil in a wide pan over medium heat. Soften the onion and pepper for eight minutes, until sweet.',
      'Add the garlic, cumin and paprika and cook for one minute more.',
      'Pour in the tomatoes, season, and simmer for ten minutes until thick enough that a spoon dragged through leaves a trail.',
      'Make four wells. Crack an egg into each, cover, and cook until the whites are set and the yolks are still soft — about six minutes.',
      'Crumble the feta over the top and serve from the pan with bread.',
    ],
  },
  {
    id: 'dal',
    title: 'Red lentil dal with tempered spices',
    summary: 'A weeknight dal that rewards a spoonful of hot spiced butter at the end.',
    tags: ['dinner', 'vegan', 'cheap'],
    minutes: 40,
    servings: 4,
    ingredients: [
      { name: 'red lentils', quantity: 300, unit: 'g' },
      { name: 'turmeric', quantity: 1, unit: 'tsp' },
      { name: 'water', quantity: 1, unit: 'l' },
      { name: 'coconut oil', quantity: 2, unit: 'tbsp' },
      { name: 'cumin seeds', quantity: 1, unit: 'tsp' },
      { name: 'black mustard seeds', quantity: 1, unit: 'tsp' },
      { name: 'dried red chillies', quantity: 2, unit: 'piece' },
      { name: 'garlic', quantity: 4, unit: 'clove' },
      { name: 'salt', quantity: 1, unit: 'tsp' },
    ],
    steps: [
      'Rinse the lentils until the water runs clear. Simmer with the turmeric and water for twenty-five minutes, skimming any foam, until they fall apart.',
      'Beat the dal with a whisk to smooth it. Season with salt.',
      'For the tempering, heat the oil until it shimmers. Add the cumin and mustard seeds and wait for them to crackle, then the chillies and sliced garlic until golden.',
      'Pour the sizzling spices over the dal and stir once so the streaks stay visible.',
    ],
  },
  {
    id: 'carbonara',
    title: 'Carbonara',
    summary: 'Guanciale, egg, pecorino, pepper. No cream, and the heat of the pasta does the cooking.',
    tags: ['dinner', 'pasta', 'quick'],
    minutes: 20,
    servings: 2,
    ingredients: [
      { name: 'spaghetti', quantity: 200, unit: 'g' },
      { name: 'guanciale', quantity: 100, unit: 'g' },
      { name: 'egg yolks', quantity: 3, unit: 'piece' },
      { name: 'whole egg', quantity: 1, unit: 'piece' },
      { name: 'pecorino romano', quantity: 50, unit: 'g' },
      { name: 'black pepper', quantity: 1, unit: 'tsp' },
    ],
    steps: [
      'Cook the pasta in well-salted water.',
      'Meanwhile render the guanciale in a cold pan brought slowly up to medium, until the fat is glassy and the edges are crisp. Turn the heat off.',
      'Whisk the yolks, egg, cheese and pepper into a paste.',
      'Lift the pasta straight into the guanciale pan with a little of its water. Off the heat, add the egg mixture and toss hard until it turns glossy. If it looks tight, add water a spoon at a time.',
    ],
  },
  {
    id: 'granola',
    title: 'Maple pecan granola with a very long name that does not fit on a small screen',
    summary: 'Big clusters, low sugar. Bakes low and slow and keeps for a fortnight.',
    tags: ['breakfast', 'batch'],
    minutes: 50,
    servings: 12,
    ingredients: [
      { name: 'rolled oats', quantity: 400, unit: 'g' },
      { name: 'pecans', quantity: 150, unit: 'g' },
      { name: 'pumpkin seeds', quantity: 80, unit: 'g' },
      { name: 'maple syrup', quantity: 120, unit: 'ml' },
      { name: 'coconut oil', quantity: 80, unit: 'ml' },
      { name: 'egg white', quantity: 1, unit: 'piece' },
      { name: 'salt', quantity: 1, unit: 'pinch' },
    ],
    steps: [
      'Heat the oven low. Mix everything dry in a big bowl.',
      'Warm the syrup and oil together, whisk in the egg white, and pour over the oats. The egg white is what makes clusters.',
      'Press into an even layer on a lined tray and bake for forty minutes without stirring.',
      'Cool completely on the tray before breaking into pieces.',
    ],
  },
  {
    id: 'pho',
    title: 'Chicken phở',
    summary: 'A clear, charred-aromatic broth built over an afternoon. Worth every minute.',
    tags: ['dinner', 'soup', 'weekend'],
    minutes: 180,
    servings: 6,
    ingredients: [
      { name: 'whole chicken', quantity: 1.5, unit: 'kg' },
      { name: 'onions', quantity: 2, unit: 'piece' },
      { name: 'ginger', quantity: 80, unit: 'g' },
      { name: 'star anise', quantity: 3, unit: 'piece' },
      { name: 'cinnamon stick', quantity: 1, unit: 'piece' },
      { name: 'coriander seeds', quantity: 1, unit: 'tbsp' },
      { name: 'fish sauce', quantity: 3, unit: 'tbsp' },
      { name: 'rock sugar', quantity: 20, unit: 'g' },
      { name: 'flat rice noodles', quantity: 500, unit: 'g' },
      { name: 'spring onions', quantity: 4, unit: 'piece' },
      { name: 'Thai basil', quantity: 1, unit: 'piece' },
      { name: 'lime', quantity: 2, unit: 'piece' },
    ],
    steps: [
      'Char the onions and ginger directly over a flame until blackened in places. Toast the spices in a dry pan.',
      'Cover the chicken with cold water, bring to a bare simmer and skim. Add the aromatics and keep it at a lazy bubble for ninety minutes.',
      'Lift out the chicken and shred the meat. Strain the broth and season with fish sauce and sugar until it tastes slightly too salty on its own.',
      'Soak the noodles, divide between bowls with the chicken, and ladle the broth over boiling hot. Finish at the table with herbs and lime.',
    ],
  },
  {
    id: 'toast',
    title: 'Toast',
    summary: 'Bread, heat, butter.',
    tags: ['breakfast', 'quick'],
    minutes: 5,
    servings: 1,
    ingredients: [
      { name: 'bread', quantity: 2, unit: 'piece' },
      { name: 'butter', quantity: 20, unit: 'g' },
    ],
    steps: ['Toast the bread.', 'Butter it while hot.'],
  },
];

export function findRecipe(id: string): Recipe | undefined {
  return RECIPES.find((recipe) => recipe.id === id);
}

export const ALL_TAGS: readonly string[] = [...new Set(RECIPES.flatMap((recipe) => recipe.tags))].sort();
