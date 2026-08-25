/**
 * SPA fixture for view-transition-proof.mjs — the real site as a client app.
 *
 * Mounts the real `AppRouter` (src/app-router.ts, view transitions enabled) so
 * navigation has real URLs, real history entries, and the real route renders.
 * Deliberately imports no CSS: the driver serves dist/assets/site.css, the
 * stylesheet the Tailwind CLI actually ships, rather than recompiling it here.
 */
import { html } from '@nisli/core';
import { AppRouter } from '../src/app-router.ts';

html`${AppRouter({})}`.mount(document.getElementById('app'));
