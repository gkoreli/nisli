/**
 * hydrate-frame.test.ts — WWW-10 hydration failure path (rev's required
 * regression). A rejected loader must leave the static baseline intact and the
 * frame un-poisoned; a subsequent successful delivery must then hydrate.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hydrateFrame } from './hydrate-frame.js';
import dropdownExample from '../hydrate-examples/dropdown-menu.js';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function makeFrame(): HTMLElement {
  const frame = document.createElement('div');
  frame.setAttribute('data-preview', 'dropdown-menu');
  frame.innerHTML = '<button id="static-baseline">Open menu</button>'; // the SSG frame
  document.body.appendChild(frame);
  return frame;
}

describe('hydrateFrame failure path', () => {
  it('leaves the static baseline intact on load failure, then retries successfully', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const frame = makeFrame();

    // 1. A rejected loader (chunk/network/deploy-cache failure).
    await hydrateFrame(frame, () => Promise.reject(new Error('chunk load failed')));

    expect(frame.hasAttribute('data-hydrated'), 'must not claim live on failure').toBe(false);
    expect(frame.hasAttribute('data-hydrating'), 'lock must be released → retryable').toBe(false);
    expect(frame.querySelector('#static-baseline'), 'static baseline survives').not.toBeNull();

    // 2. A subsequent successful delivery hydrates (proves the frame wasn't poisoned).
    await hydrateFrame(frame, () => Promise.resolve({ default: dropdownExample }));

    expect(frame.hasAttribute('data-hydrated'), 'now live after retry').toBe(true);
    expect(frame.querySelector('#static-baseline'), 'baseline replaced by live mount').toBeNull();
    expect(frame.querySelector('ui-dropdown-menu'), 'live component mounted').not.toBeNull();
  });

  it('is idempotent: a re-entry while hydrating does not double-mount', async () => {
    const frame = makeFrame();
    let resolveLoad!: (mod: { default: () => ReturnType<typeof dropdownExample> }) => void;
    const load = () => new Promise<{ default: () => ReturnType<typeof dropdownExample> }>((r) => (resolveLoad = r));

    const first = hydrateFrame(frame, load); // takes the lock, awaits the load
    expect(frame.hasAttribute('data-hydrating')).toBe(true);
    // A second fire while in flight must no-op (the lock guards it).
    await hydrateFrame(frame, () => Promise.resolve({ default: dropdownExample }));

    resolveLoad({ default: dropdownExample });
    await first;

    expect(frame.querySelectorAll('ui-dropdown-menu').length, 'exactly one mount').toBe(1);
  });
});
