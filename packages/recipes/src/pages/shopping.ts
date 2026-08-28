import { component, computed, each, html, when } from '@nisli/core';
import { hrefs } from '../router.js';
import { checked, shoppingLines, shoppingRecipeIds, toggleChecked } from '../state.js';
import { Link, Surface, Text } from '../ui/primitives/index.js';

export const ShoppingPage = component('rb-shopping-page', (_props, host) => {
  host.style.display = 'contents';
  const empty = computed(() => shoppingLines.value.length === 0);
  return html`<div data-layout="stack">
    ${Link({ href: hrefs.recipes(), as: 'nav', children: '← Recipes' })}
    <div data-layout="row" data-align="between">
      ${Text({ as: 'display', children: 'Shopping list' })}
      ${Text({ as: 'meta', children: computed(() => `${shoppingRecipeIds.value.length} recipes`) })}
    </div>
    ${when(
      empty,
      () => html`${Surface({ children: Text({ as: 'body', children: 'Nothing yet. Open a recipe and choose “Add to shopping”.' }) })}`,
      () => html`${Surface({
        flush: true,
        children: html`<table data-appearance="table" data-table>
          <thead>
            <tr>
              <th data-text="label">Got</th>
              <th data-text="label">Ingredient</th>
              <th data-text="label">Amount</th>
              <th data-text="label">For</th>
            </tr>
          </thead>
          <tbody>
            ${each(
              computed(() => [...shoppingLines.value]),
              (line) => line.key,
              (line) => html`<tr>
                <td>
                  <input
                    type="checkbox"
                    data-appearance="field"
                    aria-label=${computed(() => `Got ${line.value.name}`)}
                    .checked=${computed(() => checked.value.has(line.value.key))}
                    @change=${() => toggleChecked(line.value.key)}
                  />
                </td>
                <td>${Text({ as: 'body', children: computed(() => line.value.name) })}</td>
                <td>${Text({ as: 'meta', children: computed(() => `${line.value.quantity} ${line.value.unit}`) })}</td>
                <td>${Text({ as: 'meta', collapse: 'truncate', priority: 5, children: computed(() => line.value.from.join(', ')) })}</td>
              </tr>`,
            )}
          </tbody>
        </table>`,
      })}`,
    )}
  </div>`;
});
