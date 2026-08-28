/**
 * Cook mode — one step at a time, and the page declares `touch` and
 * `comfortable` for itself: hands are wet, the phone is on the counter. The
 * context axes nest, so this page overrides the app's settings for its own
 * subtree and nothing else changes.
 */

import { component, computed, html, signal, when } from '@nisli/core';
import { findRecipe } from '../data/recipes.js';
import { hrefs } from '../router.js';
import { Button, Link, Region, Row, Stack, Surface, Text } from '../ui/primitives/index.js';

export const CookPage = component<{ id: string }>('rb-cook-page', (props, host) => {
  host.style.display = 'contents';
  const recipe = computed(() => findRecipe(props.id.value));
  const index = signal(0);
  const count = computed(() => recipe.value?.steps.length ?? 0);
  const step = computed(() => recipe.value?.steps[index.value] ?? '');
  const first = computed(() => index.value === 0);
  const last = computed(() => index.value >= count.value - 1);

  return html`${Region({
    density: 'comfortable',
    input: 'touch',
    children: Stack({
      children: html`
        ${Row({
          align: 'between',
          children: html`
            ${Link({ href: computed(() => hrefs.recipe(props.id.value)), as: 'nav', children: '← Recipe' })}
            ${Text({ as: 'meta', children: computed(() => `Step ${index.value + 1} of ${count.value}`) })}
          `,
        })}
        ${when(
          computed(() => recipe.value !== undefined),
          () => html`
            ${Text({ as: 'title', children: computed(() => recipe.value?.title) })}
            ${Surface({ children: Text({ as: 'display', children: step }) })}
            ${Row({
              align: 'between',
              children: html`
                ${Button({ role: 'quiet', disabled: first, onClick: () => (index.value = Math.max(0, index.value - 1)), children: 'Back' })}
                ${when(
                  last,
                  () => html`${Link({ href: computed(() => hrefs.recipe(props.id.value)), as: 'primary', children: 'Done' })}`,
                  () => html`${Button({ role: 'primary', onClick: () => (index.value = Math.min(count.value - 1, index.value + 1)), children: 'Next' })}`,
                )}
              `,
            })}
          `,
          () => html`${Text({ as: 'title', children: 'No such recipe' })}`,
        )}
      `,
    }),
  })}`;
});
