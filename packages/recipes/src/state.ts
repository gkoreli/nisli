/**
 * Application state. Signals only; nothing here knows about the DOM.
 *
 * The three context axes live here as application settings, because in a real
 * product they ARE settings: a user picks dark, a dense list, a touch device is
 * detected. The shell writes them onto the app root and the theme resolves
 * everything else.
 */

import { computed, signal, type ReadonlySignal } from '@nisli/core';
import type { Density, InputMode, ThemeName } from '@nisli/intent';
import { RECIPES, type Recipe } from './data/recipes.js';

/* ── context axes ─────────────────────────────────────────────────────────── */

export const density = signal<Density>('comfortable');
export const input = signal<InputMode>(
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'touch' : 'pointer',
);
export const theme = signal<ThemeName>(
  typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
);

/* ── the book ─────────────────────────────────────────────────────────────── */

export const query = signal('');
export const tag = signal<string | null>(null);

export const visibleRecipes: ReadonlySignal<readonly Recipe[]> = computed(() => {
  const needle = query.value.trim().toLowerCase();
  const wanted = tag.value;
  return RECIPES.filter((recipe) => {
    if (wanted && !recipe.tags.includes(wanted)) return false;
    if (!needle) return true;
    return (
      recipe.title.toLowerCase().includes(needle) ||
      recipe.ingredients.some((ingredient) => ingredient.name.toLowerCase().includes(needle))
    );
  });
});

/* ── the shopping list ────────────────────────────────────────────────────── */

export interface ShoppingLine {
  readonly key: string;
  readonly name: string;
  readonly unit: string;
  readonly quantity: number;
  /** Which recipes contributed. */
  readonly from: readonly string[];
}

/** Recipe ids currently on the list. Quantities aggregate from the corpus. */
export const shoppingRecipeIds = signal<readonly string[]>([]);
export const checked = signal<ReadonlySet<string>>(new Set());

export function addToShopping(id: string): void {
  if (!shoppingRecipeIds.value.includes(id)) shoppingRecipeIds.value = [...shoppingRecipeIds.value, id];
}

export function removeFromShopping(id: string): void {
  shoppingRecipeIds.value = shoppingRecipeIds.value.filter((existing) => existing !== id);
}

export function toggleChecked(key: string): void {
  const next = new Set(checked.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  checked.value = next;
}

export const shoppingLines: ReadonlySignal<readonly ShoppingLine[]> = computed(() => {
  const lines = new Map<string, ShoppingLine>();
  for (const id of shoppingRecipeIds.value) {
    const recipe = RECIPES.find((candidate) => candidate.id === id);
    if (!recipe) continue;
    for (const ingredient of recipe.ingredients) {
      const key = `${ingredient.name}|${ingredient.unit}`;
      const existing = lines.get(key);
      lines.set(key, {
        key,
        name: ingredient.name,
        unit: ingredient.unit,
        quantity: (existing?.quantity ?? 0) + ingredient.quantity,
        from: [...(existing?.from ?? []), recipe.title],
      });
    }
  }
  return [...lines.values()].sort((a, b) => a.name.localeCompare(b.name));
});
