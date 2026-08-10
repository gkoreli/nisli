/**
 * projection.test.ts — children() content projection (ADR 0025 item 1).
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { component, html, children, onMount, flushEffects, signal, type TemplateResult } from './index.js';

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

describe('children() — dedicated pre-onMount sweep phase (ADR 0030.2 §3)', () => {
  it('projects late parser children when children() is called AFTER onMount registration', async () => {
    const tag = `x-slot-${uid++}`;
    const mountRan = vi.fn();
    component(tag, () => {
      // Pre-0030.2 this ordering was the documented trap (0025 batch-3B gap a):
      // the sweep was scheduled from children()'s own onMount, so registering
      // another onMount FIRST changed classification. The sweep scheduling now
      // lives in component.ts's dedicated phase — ordering must not matter.
      onMount(mountRan);
      const slot = children('DEFAULT');
      return html`<div data-slot="root">${slot}</div>`;
    });

    document.body.innerHTML = `<${tag}>Late</${tag}>`;
    flushEffects();
    await Promise.resolve();

    expect(mountRan).toHaveBeenCalledTimes(1);
    expect(root(document.body).textContent).toBe('Late');
  });

  it('onMount host-appends classify as projected content (the universal late-children rule)', async () => {
    const tag = `x-slot-${uid++}`;
    component(tag, (_props, host) => {
      const slot = children('DEFAULT');
      onMount(() => {
        const late = document.createElement('i');
        late.textContent = 'FROM-MOUNT';
        host.appendChild(late);
      });
      return html`<div data-slot="root">${slot}</div>`;
    });

    document.body.innerHTML = `<${tag}></${tag}>`;
    flushEffects();
    await Promise.resolve();

    // The appended node was swept INTO the slot — the rule is universal now:
    // anything appearing after the pre-onMount snapshot is projected content
    // (§8: such components "reclassify under the now-universal rule").
    const host = document.body.querySelector(tag)!;
    expect(root(document.body).textContent).toBe('FROM-MOUNT');
    expect(host.children).toHaveLength(1); // only the rendered root remains direct
  });

  it('a mount-phase failure does not let the queued sweep eat the error fallback', async () => {
    const tag = `x-slot-${uid++}`;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    component(tag, () => {
      const slot = children('DEFAULT');
      onMount(() => { throw new Error('mount boom'); });
      return html`<div data-slot="root">${slot}</div>`;
    });

    document.body.innerHTML = `<${tag}></${tag}>`;
    const host = document.body.querySelector(tag)! as HTMLElement;
    expect(host.getAttribute('data-nisli-error')).toBe('N402');
    expect(host.innerHTML).toContain('Error in');

    // Let the (already-scheduled) sweep microtask run: the disposal guard must
    // keep it from misreading the error fallback as late projected content.
    await Promise.resolve();
    await Promise.resolve();
    expect(host.innerHTML).toContain('Error in');
    errorSpy.mockRestore();
  });
});

describe('children() — true reconnect', () => {
  it('restores projected light DOM before setup runs again', async () => {
    const tag = defineSlot('DEFAULT');
    const el = document.createElement(tag);
    el.append('Persistent');
    document.body.appendChild(el);
    flushEffects();
    expect(root(el).textContent).toBe('Persistent');

    document.body.removeChild(el);
    await Promise.resolve();
    document.body.appendChild(el);
    flushEffects();

    expect(el.querySelectorAll('[data-slot="root"]')).toHaveLength(1);
    expect(root(el).textContent).toBe('Persistent');
  });
});
