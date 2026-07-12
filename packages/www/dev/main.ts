/** Browser entry for the Vite + Nisli HMR development server. */
import './styles.css';
import { html } from '@nisli/core';
import { AppRouter } from '../src/app-router.js';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app development mount point.');

// Mount the application router outlet — it renders the current match reactively
// and progressively enhances same-origin anchor navigation (ADR 0026). The
// factory returns a component descriptor, so wrap it in html`` to get a mount.
html`${AppRouter({})}`.mount(app);

// Progressive enhancement, delegated so it survives client route changes and
// re-rendered content (mirrors the inline scripts in the production shell).
document.addEventListener('click', (event) => {
  const target = event.target as Element | null;

  const toggle = target?.closest('#theme-toggle');
  if (toggle) {
    const dark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.theme = dark ? 'dark' : 'light';
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
    return;
  }

  const copy = target?.closest<HTMLElement>('[data-copy]');
  if (copy) {
    const code = copy.closest('[data-code-block]')?.querySelector('code')?.textContent ?? '';
    void navigator.clipboard?.writeText(code).then(() => {
      const idle = copy.querySelector<HTMLElement>('[data-copy-idle]');
      const done = copy.querySelector<HTMLElement>('[data-copy-done]');
      if (idle && done) {
        idle.hidden = true;
        done.hidden = false;
        setTimeout(() => {
          idle.hidden = false;
          done.hidden = true;
        }, 1200);
      }
    });
  }
});
