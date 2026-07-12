/**
 * el.test.ts — el() dynamic-tag element factory (ADR 0025 item 11).
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { el, html } from './template.js';
import { component } from './component.js';
import { signal, flushEffects } from './signal.js';
import { ref } from './ref.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(tr: { mount(h: HTMLElement): void }): HTMLElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  tr.mount(host);
  return host;
}

describe('el() — dynamic tag names', () => {
  it('renders an element whose tag is chosen at runtime', () => {
    for (const tag of ['h1', 'h3', 'section', 'ui-thing']) {
      document.body.innerHTML = '';
      const host = mount(el(tag, {}, 'hi'));
      expect(host.firstElementChild!.tagName.toLowerCase()).toBe(tag);
      expect(host.firstElementChild!.textContent).toBe('hi');
    }
  });

  it('binds static + reactive attributes with html boolean/null semantics', () => {
    const cls = signal('a');
    const hidden = signal<boolean>(false);
    const host = mount(el('div', { id: 'x', class: cls, hidden, 'data-n': 3 }));
    const node = host.firstElementChild as HTMLElement;
    expect(node.getAttribute('id')).toBe('x');
    expect(node.getAttribute('class')).toBe('a');
    expect(node.getAttribute('data-n')).toBe('3');
    expect(node.hasAttribute('hidden')).toBe(false); // false → absent

    cls.value = 'b';
    hidden.value = true;
    flushEffects();
    expect(node.getAttribute('class')).toBe('b'); // reactive
    expect(node.hasAttribute('hidden')).toBe(true); // true → present empty
  });

  it('assigns a ref and forwards event handlers', () => {
    const r = ref<HTMLButtonElement>();
    const onClick = vi.fn();
    const host = mount(el('button', { ref: r, on: { click: onClick } }, 'go'));
    expect(r.current).toBe(host.firstElementChild);
    (host.firstElementChild as HTMLElement).click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('mounts the full html text-slot range as children (string/number/template/factory/signal/array)', () => {
    const Factory = component<{ label?: string }>('el-child-factory', (props) =>
      html`<em data-slot="fac">${props.label}</em>`,
    );
    const reactive = signal<string>('R');
    const host = mount(
      el('div', {}, ['a ', 1, html`<span data-slot="tpl">T</span>`, Factory({ label: 'F' }), reactive]),
    );
    const node = host.firstElementChild!;
    expect(node.textContent).toContain('a 1');
    expect(node.querySelector('[data-slot="tpl"]')!.textContent).toBe('T');
    expect(node.querySelector('[data-slot="fac"]')!.textContent).toBe('F');
    expect(node.textContent).toContain('R');

    reactive.value = 'R2';
    flushEffects();
    expect(node.textContent).toContain('R2'); // reactive text child updates
  });

  it('composes inside an html`` slot — the parser never sees a dynamic tag', () => {
    const tag = 'h2';
    const host = document.createElement('div');
    document.body.appendChild(host);
    html`<div data-slot="wrap">${el(tag, { class: 'title' }, 'Heading')}</div>`.mount(host);
    const wrap = host.querySelector('[data-slot="wrap"]')!;
    expect(wrap.querySelector('h2')!.textContent).toBe('Heading');
    expect(wrap.querySelector('h2')!.getAttribute('class')).toBe('title');
  });

  it('a framework component tag via el() receives values as ATTRIBUTES (attr fallback), not typed props', () => {
    // el() is the "author plain HTML programmatically" primitive: a component
    // reached this way resolves values through its attribute fallbacks, exactly
    // as if it were written as plain HTML — never via _setProp.
    component('el-attr-probe', (_props, host) =>
      html`<span data-slot="probe">${host.getAttribute('variant') ?? 'none'}</span>`,
    );
    const host = mount(el('el-attr-probe', { variant: 'secondary', disabled: true }));
    const probe = host.querySelector('el-attr-probe') as HTMLElement;
    expect(probe.getAttribute('variant')).toBe('secondary'); // plain-HTML attribute
    expect(probe.hasAttribute('disabled')).toBe(true); // boolean true → present
    expect(probe.querySelector('[data-slot="probe"]')!.textContent).toBe('secondary');
  });

  it('dispose() removes the node, stops reactive attrs, and unbinds ref/handlers', () => {
    const cls = signal('a');
    const r = ref<HTMLElement>();
    const tr = el('div', { class: cls, ref: r });
    const host = mount(tr);
    const node = host.firstElementChild as HTMLElement;

    tr.dispose();
    expect(host.contains(node)).toBe(false); // removed
    expect(r.current).toBeNull(); // ref unbound
    cls.value = 'b';
    flushEffects();
    expect(node.getAttribute('class')).toBe('a'); // effect stopped
  });

  it('dispose() actually removes event listeners (UI-33-R: installed safeHandler, not the original)', () => {
    // rev's repro: on:{click} → dispose() → a later click must NOT fire the
    // handler. bindEvent installs a wrapped safeHandler; disposal must remove
    // THAT, not the caller's original handler (identities differ → no-op).
    const onClick = vi.fn();
    const r = ref<HTMLButtonElement>();
    const tr = el('button', { ref: r, on: { click: onClick } });
    mount(tr);
    const node = r.current!;

    node.click();
    expect(onClick).toHaveBeenCalledTimes(1); // live before dispose

    tr.dispose();
    node.click(); // node is detached, but the listener must be gone
    expect(onClick).toHaveBeenCalledTimes(1); // no post-dispose call
  });

  it('the www AutoPreview case collapses to el(primaryTag(name))', () => {
    const host = mount(el('ui-button'));
    expect(host.firstElementChild!.tagName.toLowerCase()).toBe('ui-button');
  });

  it('html`` shares the fixed event-disposal path (@event listener removed on dispose)', () => {
    // The same bindEvent EventBinding.dispose that fixes el() also fixes the
    // latent html leak: an @event listener must be gone after dispose().
    const onClick = vi.fn();
    const tr = html`<button @click=${onClick}>x</button>`;
    const host = document.createElement('div');
    document.body.appendChild(host);
    tr.mount(host);
    const btn = host.querySelector('button')!;

    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    tr.dispose();
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(1); // removed via the shared EventBinding.dispose
  });
});
