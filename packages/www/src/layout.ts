/**
 * layout.ts — the site chrome around a page's content.
 * Composes the nav + <main> + footer as nisli template fragments, so the whole
 * shell is dogfood rendered by @nisli/ssg. The outer HTML document (doctype,
 * <head>, theme boot script) is added by shell.ts.
 */
import { html, type TemplateResult } from '@nisli/core';
import { SiteNav } from './components/site-nav.js';
import { SiteFooter } from './components/site-footer.js';

export interface LayoutOptions {
  /** Current route path, so the nav can highlight the active link. */
  current?: string;
}

export function layout(content: TemplateResult, { current }: LayoutOptions = {}): TemplateResult {
  return html`${SiteNav({ current })}
    <main class="min-h-[calc(100vh-3.5rem-1px)]">${content}</main>
    ${SiteFooter()}`;
}
