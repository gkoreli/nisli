/**
 * template-audit.test.ts — First-parse static template audit (ADR 0030.2 T4).
 * Requires DOM — uses happy-dom via vitest environment.
 *
 * The audit is asynchronous only for N101 (whenDefined race with a
 * microtask + macrotask grace); everything else emits synchronously at the
 * first parse (= first mount). Tests await a real-timer grace where needed
 * and assert on message content so late timers from earlier tests cannot
 * cross-contaminate.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { html, type TemplateResult } from './template.js';
import {
  setTemplateAuditEnabled,
  isTemplateAuditEnabled,
  diag,
} from './template-audit.js';

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  document.body.innerHTML = '';
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  setTemplateAuditEnabled(true);
});

function mount(result: TemplateResult): HTMLElement {
  const host = document.createElement('div');
  result.mount(host);
  return host;
}

/** All warn messages captured so far, flattened to strings. */
function warnings(): string[] {
  return warnSpy.mock.calls.map(call => call.map(String).join(' '));
}

function warningsWith(fragment: string): string[] {
  return warnings().filter(w => w.includes(fragment));
}

/** One macrotask+ of real time — beyond the N101 grace window. */
const settle = () => new Promise<void>(resolve => setTimeout(resolve, 20));

describe('audit gating and dedup', () => {
  it('is enabled by default and toggleable via the exported setter', () => {
    expect(isTemplateAuditEnabled()).toBe(true);
    setTemplateAuditEnabled(false);
    expect(isTemplateAuditEnabled()).toBe(false);
  });

  it('diag() is silent when the audit is disabled', () => {
    diag('N999', 'should appear');
    expect(warningsWith('N999')).toHaveLength(1);
    setTemplateAuditEnabled(false);
    diag('N998', 'should NOT appear');
    expect(warningsWith('N998')).toHaveLength(0);
  });

  it('runs ONCE per callsite — repeated mounts do not re-warn', () => {
    const make = () => html`<button @not-an-event-dedup=${() => {}}>x</button>`;
    mount(make());
    mount(make());
    mount(make());
    expect(warningsWith('not-an-event-dedup')).toHaveLength(1);
  });

  it('emits nothing when disabled before first parse', async () => {
    setTemplateAuditEnabled(false);
    mount(html`<n101-disabled-tag @clik-disabled=${() => {}}></n101-disabled-tag>`);
    await settle();
    expect(warningsWith('n101-disabled-tag')).toHaveLength(0);
    expect(warningsWith('clik-disabled')).toHaveLength(0);
  });
});

describe('N101 — undefined dash-tags (whenDefined race)', () => {
  it('warns for a dash-tag that never gets defined, naming tag and callsite', async () => {
    mount(html`<n101-never-defined></n101-never-defined>`);
    await settle();
    const hits = warningsWith('n101-never-defined');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('N101');
    expect(hits[0]).toContain('at '); // callsite frame captured at the html`` call
  });

  it('does not warn when the tag is defined within the grace window', async () => {
    mount(html`<n101-defined-late></n101-defined-late>`);
    // Defined AFTER the parse, same task — whenDefined wins the race.
    customElements.define('n101-defined-late', class extends HTMLElement {});
    await settle();
    expect(warningsWith('n101-defined-late')).toHaveLength(0);
  });

  it('does not warn for already-defined tags', async () => {
    customElements.define('n101-predefined', class extends HTMLElement {});
    mount(html`<n101-predefined></n101-predefined>`);
    await settle();
    expect(warningsWith('n101-predefined')).toHaveLength(0);
  });

  it('suppression escape: allow-undefined directive silences N101 for named tags only', async () => {
    mount(html`<!-- nisli-audit allow-undefined: n101-lazy-island -->
      <n101-lazy-island></n101-lazy-island>
      <n101-not-allowed></n101-not-allowed>`);
    await settle();
    expect(warningsWith('n101-lazy-island')).toHaveLength(0);
    expect(warningsWith('n101-not-allowed')).toHaveLength(1);
  });

  it('suppression escape: off directive disables the whole audit for the template', async () => {
    mount(html`<!-- nisli-audit off --><n101-fully-off @clik-off=${() => {}}></n101-fully-off>`);
    await settle();
    expect(warningsWith('n101-fully-off')).toHaveLength(0);
    expect(warningsWith('clik-off')).toHaveLength(0);
  });
});

describe('N102/N103 — event names and modifiers', () => {
  it('warns N102 for unknown event names', () => {
    mount(html`<button @clik=${() => {}}>typo</button>`);
    const hits = warningsWith('N102');
    expect(hits.some(w => w.includes('@clik'))).toBe(true);
  });

  it('accepts native events, focusin/focusout, and allowlisted component events', () => {
    mount(html`<div
      @click=${() => {}}
      @focusin=${() => {}}
      @focusout=${() => {}}
      @ui-open-change=${() => {}}
      @nisli-error=${() => {}}
    ></div>`);
    expect(warningsWith('N102')).toHaveLength(0);
  });

  it('warns N103 for unknown modifiers, accepts the known set', () => {
    mount(html`<button @click.stpo=${() => {}} @keydown.enter.prevent=${() => {}}>m</button>`);
    const hits = warningsWith('N103');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('.stpo');
  });
});

describe('N104 — attribute audit only with a declared-attrs truth source', () => {
  it('warns for an undeclared attribute on a component with observedAttributes', () => {
    customElements.define(
      'n104-declared',
      class extends HTMLElement {
        static get observedAttributes(): string[] {
          return ['checked', 'class-name'];
        }
      },
    );
    mount(html`<n104-declared chekced="true" checked="true"></n104-declared>`);
    const hits = warningsWith('N104');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain('chekced');
    expect(hits[0]).toContain('n104-declared');
  });

  it('never flags declared attrs, globals, data-*/aria-*, or directive positions', () => {
    customElements.define(
      'n104-clean',
      class extends HTMLElement {
        static get observedAttributes(): string[] {
          return ['variant'];
        }
      },
    );
    mount(html`<n104-clean
      variant="ghost"
      id="a"
      class="c"
      style="color:red"
      title="t"
      role="button"
      tabindex="0"
      name="n"
      data-x="1"
      aria-label="l"
      class:active=${true}
      @click=${() => {}}
    ></n104-clean>`);
    expect(warningsWith('N104')).toHaveLength(0);
  });

  it('does NO attribute audit for components without declared attrs (no truth source pre-schema)', () => {
    customElements.define('n104-undeclared', class extends HTMLElement {});
    mount(html`<n104-undeclared anything-goes="1" varian="oops"></n104-undeclared>`);
    expect(warningsWith('N104')).toHaveLength(0);
  });

  it('does NO attribute audit for plain HTML elements', () => {
    mount(html`<div totally-made-up-attr="1"></div>`);
    expect(warningsWith('N104')).toHaveLength(0);
  });
});
