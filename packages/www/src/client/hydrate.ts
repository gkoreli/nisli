/**
 * client/hydrate.ts — WWW-10 preview hydration runtime (the site's only client
 * bundle). Strict progressive enhancement: the SSG static preview frame is the
 * baseline; this upgrades it to a LIVE nisli component when it scrolls into view.
 * Scope is the [data-preview] frame on /ui pages and nothing else.
 *
 * import.meta.glob gives Vite an auto-generated, per-file lazy map — so each
 * component's example is its own code-split chunk, loaded only when needed.
 */
import { html, type TemplateResult } from '@nisli/core';

type ExampleModule = { default: () => TemplateResult };

const examples = import.meta.glob<ExampleModule>('../hydrate-examples/*.ts');

function hydrate(frame: Element): void {
  if (frame.hasAttribute('data-hydrated')) return; // idempotent — never mount twice
  const name = frame.getAttribute('data-preview');
  if (!name) return;
  const load = examples[`../hydrate-examples/${name}.ts`];
  if (!load) return; // no interactive example for this component — leave the static frame
  // Mark synchronously so a repeat intersection (or re-observe) can't double-mount
  // and leave a duplicate portaled overlay behind.
  frame.setAttribute('data-hydrated', 'true');
  void load().then((mod) => {
    frame.replaceChildren();
    html`${mod.default()}`.mount(frame as HTMLElement);
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        observer.unobserve(entry.target);
        hydrate(entry.target);
      }
    }
  },
  { rootMargin: '128px' },
);

for (const frame of document.querySelectorAll('[data-preview]')) observer.observe(frame);
