/**
 * hydrate-examples/tabs.ts — the tabs preview (WWW-15).
 *
 * Static in SSG (resting: Account tab active); hydrated, clicking the Password
 * `[role="tab"]` switches the panel (`aria-selected`/`data-state` move, its
 * `[role="tabpanel"]` shows). Per-file for code-splitting + auto-hydration.
 */
import { html, type TemplateResult } from '@nisli/core';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../nisli-ui/ui/tabs.js';

export default function tabsExample(): TemplateResult {
  return html`<div class="w-full max-w-sm">
    ${Tabs({
      defaultValue: 'account',
      children: html`${TabsList({
        children: html`${TabsTrigger({ value: 'account', children: 'Account' })}
        ${TabsTrigger({ value: 'password', children: 'Password' })}`,
      })}
      ${TabsContent({ value: 'account', children: 'Account settings live here.' })}
      ${TabsContent({ value: 'password', children: 'Change your password here.' })}`,
    })}
  </div>`;
}
