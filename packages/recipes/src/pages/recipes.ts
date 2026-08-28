import { component, computed, each, html, when } from '@nisli/core';
import { ALL_TAGS } from '../data/recipes.js';
import { hrefs } from '../router.js';
import { query, tag, visibleRecipes } from '../state.js';
import { Button, Field, Grid, Link, Row, Stack, Surface, Text, Wrap } from '../ui/primitives/index.js';

const tags = computed(() => [...ALL_TAGS]);

export const RecipesPage = component('rb-recipes-page', (_props, host) => {
  host.style.display = 'contents';
  return html`${Stack({
    children: html`
      ${Row({
        align: 'between',
        children: html`
          ${Text({ as: 'display', children: 'Recipes' })}
          ${Link({ href: hrefs.shopping(), as: 'primary', children: 'Shopping list' })}
        `,
      })}

      ${Field({
        label: 'Search',
        type: 'search',
        placeholder: 'Title or ingredient',
        value: query,
        onInput: (value) => (query.value = value),
      })}

      ${Wrap({
        role: 'group',
        label: 'Filter by tag',
        children: html`
          ${Button({
            role: computed(() => (tag.value === null ? 'primary' : 'quiet')),
            onClick: () => (tag.value = null),
            children: 'All',
          })}
          ${each(
            tags,
            (name) => name,
            (name) => html`${Button({
              role: computed(() => (tag.value === name.value ? 'primary' : 'quiet')),
              onClick: () => (tag.value = name.value),
              children: name,
            })}`,
          )}
        `,
      })}

      ${when(
        computed(() => visibleRecipes.value.length === 0),
        () => html`${Surface({ children: Text({ as: 'meta', children: 'Nothing matches. Try fewer words.' }) })}`,
      )}

      ${Grid({
        children: each(
          computed(() => [...visibleRecipes.value]),
          (recipe) => recipe.id,
          (recipe) => html`${Surface({
            layout: 'stack',
            children: html`
              ${Link({ href: computed(() => hrefs.recipe(recipe.value.id)), as: 'title', children: computed(() => recipe.value.title) })}
              ${Text({ as: 'body', grow: true, children: computed(() => recipe.value.summary) })}
              ${Row({
                align: 'between',
                children: html`
                  ${Text({ as: 'meta', grow: true, collapse: 'truncate', priority: 3, children: computed(() => `${recipe.value.minutes} min · serves ${recipe.value.servings}`) })}
                  ${Text({ as: 'meta', collapse: 'hide', priority: 5, children: computed(() => recipe.value.tags.join(' · ')) })}
                `,
              })}
            `,
          })}`,
        ),
      })}
    `,
  })}`;
});
