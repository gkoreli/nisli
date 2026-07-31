/**
 * hydrate-example-acp-transcript.test.ts — the /ui/acp-transcript replay demo.
 *
 * The demo's two claims are behavioral, so they are asserted, not narrated:
 * the SSG render shows the full settled conversation (pre-folded, no timers at
 * render), and clicking Replay streams the same session through the reducer
 * back to the identical settled state.
 *
 * NB: lives in src/ (not src/hydrate-examples/) so it is NOT swept into the
 * `hydrate-examples/*.ts` glob that derives the hydrate set.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from '@nisli/core';
import acpTranscriptExample from './hydrate-examples/acp-transcript.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

function mount(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  acpTranscriptExample().mount(container);
  return container;
}

describe('acp-transcript replay demo', () => {
  it('renders the settled conversation statically — no timers needed', () => {
    const container = mount();

    // The full session is visible pre-hydration.
    expect(container.textContent).toContain('Why is resolve() slow?');
    expect(container.textContent).toContain('suite is green');
    expect(container.querySelectorAll('[data-slot="acp-tool-call"]')).toHaveLength(2);
    expect(container.querySelector('[data-slot="acp-plan"]')).not.toBeNull();
    // Everything is settled: no streaming caret, no spinner.
    expect(container.querySelector('[data-slot="acp-message-caret"]')).toBeNull();
    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  it('replays the session through the reducer back to the settled state', () => {
    vi.useFakeTimers();
    const container = mount();
    const before = container.textContent;

    const button = container.querySelector('button') as HTMLButtonElement;
    button.click();
    flush();

    // Mid-replay: transcript restarted and is visibly in progress.
    expect(container.textContent).not.toContain('suite is green');

    vi.runAllTimers();
    flush();

    // Fully replayed: same settled conversation, tool calls completed again.
    expect(container.textContent).toBe(before);
    const statuses = Array.from(
      container.querySelectorAll('[data-slot="acp-tool-call"]'),
    ).map((el) => el.getAttribute('data-status'));
    expect(statuses).toEqual(['completed', 'completed']);
    expect(container.querySelector('[data-slot="acp-message-caret"]')).toBeNull();
  });

  it('ignores a second click while a replay is running', () => {
    vi.useFakeTimers();
    const container = mount();
    const button = container.querySelector('button') as HTMLButtonElement;

    button.click();
    flush();
    vi.advanceTimersByTime(500);
    flush(); // settle the effects of the advanced timers before capturing
    const during = container.textContent;

    button.click(); // must not reset the in-flight replay
    flush();
    expect(container.textContent).toBe(during);

    vi.runAllTimers();
    flush();
    expect(container.textContent).toContain('suite is green');
  });
});
