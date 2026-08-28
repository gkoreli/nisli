/**
 * The shell: app root carrying the context axes, primary navigation, and the
 * router outlet (which is itself the `main` landmark). The settings row is the
 * app's own UI for the axes, kept in the header so every page can be seen in
 * every context without leaving it.
 *
 * Nothing in this file writes an attribute. Composition is typed components
 * only; the attributes they resolve to are the compiled output.
 */

import { component, computed, each, html, type ReadonlySignal, type Signal, type TemplateResult } from '@nisli/core';
import { VOCABULARY } from '@nisli/intent';
import { AppRouter, hrefs } from './router.js';
import { density, input, theme } from './state.js';
import { Button, Link, Region, Row, Stack, Text, Wrap } from './ui/primitives/index.js';

const densities = computed(() => [...VOCABULARY.density]);
const inputs = computed(() => [...VOCABULARY.input]);
const themes = computed(() => [...VOCABULARY.theme]);

function axis<T extends string>(label: string, values: ReadonlySignal<T[]>, current: Signal<T>): TemplateResult {
  return html`${Row({
    align: 'center',
    children: html`
      ${Text({ as: 'label', children: label })}
      ${each(values, (value) => value, (value) => html`${Button({
        role: computed(() => (current.value === value.value ? 'primary' : 'quiet')),
        onClick: () => (current.value = value.value),
        children: value,
      })}`)}
    `,
  })}`;
}

export const Shell = component('rb-shell', (_props, host) => {
  host.style.display = 'contents';
  return html`${Region({
    density,
    input,
    theme,
    children: Stack({
      children: html`
        ${Stack({
          role: 'banner',
          children: html`
            ${Row({
              role: 'navigation',
              label: 'Primary',
              children: html`
                ${Link({ href: hrefs.recipes(), as: 'nav', children: 'Recipes' })}
                ${Link({ href: hrefs.shopping(), as: 'nav', children: 'Shopping' })}
              `,
            })}
            ${Wrap({
              role: 'group',
              label: 'Appearance',
              children: html`${axis('Density', densities, density)}${axis('Input', inputs, input)}${axis('Theme', themes, theme)}`,
            })}
          `,
        })}
        ${AppRouter({})}
      `,
    }),
  })}`;
});
