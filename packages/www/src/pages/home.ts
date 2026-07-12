/**
 * pages/home.ts — the home page content (framework-led).
 * Returns the page's sections only; the site chrome (top bar, <main>, footer)
 * is supplied by SiteShell in app-router.ts (WWW-12). Sections are per-topic
 * modules under src/sections/ — edit a section file, not this composition.
 */
import { html, type TemplateResult } from '@nisli/core';
import { hero } from '../sections/hero.js';
import { gallery } from '../sections/gallery.js';
import { install } from '../sections/install.js';
import { framework } from '../sections/framework.js';

export function homePage(): TemplateResult {
  // Framework-first: hero → framework primitives → @nisli/ui second beat → install.
  return html`${hero()} ${framework()} ${gallery()} ${install()}`;
}
