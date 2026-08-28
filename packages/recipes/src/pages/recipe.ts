import { component, computed, each, html, when } from '@nisli/core';
import { findRecipe } from '../data/recipes.js';
import { hrefs } from '../router.js';
import { addToShopping, removeFromShopping, shoppingRecipeIds } from '../state.js';
import { Grid, Link, Row, Stack, Surface, Text } from '../ui/primitives/index.js';
import type { ActionGroupSpec } from '../ui/patterns/overflow-menu.js';
import { Toolbar } from '../ui/patterns/toolbar.js';

export const RecipePage = component<{ id: string }>('rb-recipe-page', (props, host) => {
  host.style.display = 'contents';
  const recipe = computed(() => findRecipe(props.id.value));
  const listed = computed(() => shoppingRecipeIds.value.includes(props.id.value));

  const actions = computed<readonly ActionGroupSpec[]>(() => {
    const id = props.id.value;
    return [
      {
        id: 'secondary',
        priority: 4,
        actions: [
          { id: 'share', label: 'Share', onSelect: () => navigator.share?.({ title: recipe.value?.title, url: location.href }) },
          { id: 'print', label: 'Print', onSelect: () => print() },
        ],
      },
      {
        id: 'shopping',
        priority: 2,
        actions: [
          listed.value
            ? { id: 'unlist', label: 'Remove from shopping', onSelect: () => removeFromShopping(id) }
            : { id: 'list', label: 'Add to shopping', onSelect: () => addToShopping(id) },
        ],
      },
      {
        id: 'cook',
        priority: 1,
        actions: [{ id: 'cook', label: 'Cook', emphasis: 'primary', onSelect: () => location.assign(hrefs.cook(id)) }],
      },
    ];
  });

  const ingredients = computed(() => [...(recipe.value?.ingredients ?? [])]);
  const steps = computed(() => [...(recipe.value?.steps ?? [])]);

  return html`${when(
    computed(() => recipe.value === undefined),
    () => html`${Stack({
      children: html`
        ${Text({ as: 'title', children: 'No such recipe' })}
        ${Link({ href: hrefs.recipes(), as: 'link', children: 'Back to recipes' })}
      `,
    })}`,
    () => html`${Stack({
      children: html`
        ${Link({ href: hrefs.recipes(), as: 'nav', children: '← Recipes' })}
        ${Toolbar({ title: computed(() => recipe.value?.title), actions })}
        ${Text({ as: 'body', children: computed(() => recipe.value?.summary) })}
        ${Text({ as: 'meta', children: computed(() => `${recipe.value?.minutes} min · serves ${recipe.value?.servings} · ${recipe.value?.tags.join(', ')}`) })}

        ${Grid({
          children: html`
            ${Surface({
              layout: 'stack',
              children: html`
                ${Text({ as: 'title', children: 'Ingredients' })}
                ${Stack({
                  role: 'list',
                  children: each(
                    ingredients,
                    (ingredient) => ingredient.name,
                    (ingredient) => html`${Row({
                      role: 'listitem',
                      align: 'between',
                      children: html`
                        ${Text({ as: 'body', children: computed(() => ingredient.value.name) })}
                        ${Text({ as: 'meta', children: computed(() => `${ingredient.value.quantity} ${ingredient.value.unit}`) })}
                      `,
                    })}`,
                  ),
                })}
              `,
            })}
            ${Surface({
              layout: 'stack',
              children: html`
                ${Text({ as: 'title', children: 'Method' })}
                ${Stack({
                  role: 'list',
                  children: each(
                    steps,
                    (_step, index) => String(index),
                    (step, index) => html`${Row({
                      role: 'listitem',
                      children: html`
                        ${Text({ as: 'label', children: computed(() => String(index.value + 1)) })}
                        ${Text({ as: 'body', grow: true, children: step })}
                      `,
                    })}`,
                  ),
                })}
              `,
            })}
          `,
        })}
      `,
    })}`,
  )}`;
});
