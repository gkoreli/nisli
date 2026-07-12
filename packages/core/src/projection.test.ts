/**
 * projection.test.ts — children() content projection (ADR 0025 item 1).
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { component, html, children, flushEffects, signal, type TemplateResult } from './index.js';

let uid = 0;

/** Define a fresh slot component with an optional string fallback. */
function defineSlot(fallback?: string): string {
  const tag = `x-slot-${uid++}`;
  component(tag, () => html`<div data-slot="root">${children(fallback)}</div>`);
  return tag;
}

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  template.mount(container);
  flushEffects();
  return container;
}

const root = (c: ParentNode) => c.querySelector('[data-slot="root"]') as HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('children() — fallback semantics', () => {
  it('renders the fallback when the host has no children', () => {
    const tag = defineSlot('DEFAULT');
    document.body.innerHTML = `<${tag}></${tag}>`;
    flushEffects();
    expect(root(document.body).textContent).toBe('DEFAULT');
  });

  it('renders light-DOM children (present at connect) instead of the fallback', () => {
    const tag = defineSlot('DEFAULT');
    const el = document.createElement(tag);
    el.append('Hello'); // present BEFORE connect → captured synchronously
    document.body.appendChild(el);
    flushEffects();
    expect(root(document.body).textContent).toBe('Hello');
  });

  it('treats whitespace-only light DOM as empty (fallback shows)', () => {
    const tag = defineSlot('DEFAULT');
    const el = document.createElement(tag);
    el.append('   \n  ');
    document.body.appendChild(el);
    flushEffects();
    expect(root(document.body).textContent).toBe('DEFAULT');
  });

  it('sweeps LATE parser children in and replaces the fallback', async () => {
    const tag = defineSlot('DEFAULT');
    // innerHTML: happy-dom connects the element before parsing its children,
    // so "Late" arrives after mount and the microtask sweep must project it.
    document.body.innerHTML = `<${tag}>Late</${tag}>`;
    flushEffects();
    await Promise.resolve();
    expect(root(document.body).textContent).toBe('Late');
  });

  it('renders nothing when empty and no fallback is given', () => {
    const tag = defineSlot();
    document.body.innerHTML = `<${tag}></${tag}>`;
    flushEffects();
    expect(root(document.body).textContent).toBe('');
  });
});

describe('children() — factory children prop', () => {
  it('renders a factory string child (replaces fallback)', () => {
    const tag = `x-slot-${uid++}`;
    const Slot = component<{ children?: string | TemplateResult }>(
      tag,
      () => html`<div data-slot="root">${children('DEFAULT')}</div>`,
    );
    const c = mount(html`${Slot({ children: 'FromProp' })}`);
    expect(root(c).textContent).toBe('FromProp');
  });

  it('renders a factory template child', () => {
    const tag = `x-slot-${uid++}`;
    const Slot = component<{ children?: string | TemplateResult }>(
      tag,
      () => html`<div data-slot="root">${children('DEFAULT')}</div>`,
    );
    const c = mount(html`${Slot({ children: html`<span>tpl</span>` })}`);
    expect(root(c).querySelector('span')?.textContent).toBe('tpl');
    expect(root(c).textContent).not.toContain('DEFAULT');
  });

  it('re-shows a TemplateResult fallback after children are removed (empty→filled→empty)', () => {
    const tag = `x-slot-${uid++}`;
    const kids = signal<TemplateResult | undefined>(undefined);
    const Slot = component<{ children?: TemplateResult }>(
      tag,
      () => html`<div data-slot="root">${children(html`<i>fb</i>`)}</div>`,
    );
    const c = mount(html`${Slot({ children: kids })}`);
    // empty → fallback
    expect(root(c).querySelector('i')?.textContent).toBe('fb');

    // filled → children replace the fallback
    kids.value = html`<b>real</b>`;
    flushEffects();
    expect(root(c).querySelector('b')?.textContent).toBe('real');
    expect(root(c).querySelector('i')).toBeNull();

    // empty again → the same fallback re-mounts (must NOT crash)
    kids.value = undefined;
    flushEffects();
    expect(root(c).querySelector('i')?.textContent).toBe('fb');
  });
});
