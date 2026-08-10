/**
 * template.test.ts — Tests for the tagged template engine.
 * Requires DOM — uses happy-dom via vitest environment.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { html, when, raw, __templateParseCount, type TemplateResult } from './template.js';
import { signal, computed, effect, flushEffects, type Signal } from './signal.js';
import { component } from './component.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(result: TemplateResult): HTMLElement {
  const host = document.createElement('div');
  result.mount(host);
  return host;
}

// ── Text bindings ───────────────────────────────────────────────────

describe('text bindings', () => {
  it('renders static text', () => {
    const result = html`<span>Hello World</span>`;
    const host = mount(result);
    expect(host.querySelector('span')?.textContent).toBe('Hello World');
  });

  it('renders dynamic primitive values', () => {
    const result = html`<span>${42}</span>`;
    const host = mount(result);
    expect(host.querySelector('span')?.textContent).toContain('42');
  });

  it('renders signal values', () => {
    const name = signal('Alice');
    const result = html`<span>${name}</span>`;
    const host = mount(result);
    expect(host.textContent).toContain('Alice');
  });

  it('updates text when signal changes', () => {
    const name = signal('Alice');
    const result = html`<span>${name}</span>`;
    const host = mount(result);
    expect(host.textContent).toContain('Alice');

    name.value = 'Bob';
    flushEffects();
    expect(host.textContent).toContain('Bob');
  });

  it('multiple signals in one template update independently', () => {
    const first = signal('John');
    const last = signal('Doe');
    const result = html`<span>${first} ${last}</span>`;
    const host = mount(result);
    expect(host.textContent).toContain('John');
    expect(host.textContent).toContain('Doe');

    first.value = 'Jane';
    flushEffects();
    expect(host.textContent).toContain('Jane');
    expect(host.textContent).toContain('Doe');
  });

  it('renders null/undefined/false as empty', () => {
    const result1 = html`<div>${null}</div>`;
    const host1 = mount(result1);
    expect(host1.querySelector('div')?.childNodes.length).toBeLessThanOrEqual(1);

    const result2 = html`<div>${undefined}</div>`;
    const host2 = mount(result2);
    expect(host2.querySelector('div')?.childNodes.length).toBeLessThanOrEqual(1);

    const result3 = html`<div>${false}</div>`;
    const host3 = mount(result3);
    expect(host3.querySelector('div')?.textContent?.trim()).toBe('');
  });

  it('renders computed values reactively', () => {
    const count = signal(5);
    const doubled = computed(() => count.value * 2);
    const result = html`<span>${doubled}</span>`;
    const host = mount(result);
    expect(host.textContent).toContain('10');

    count.value = 10;
    flushEffects();
    expect(host.textContent).toContain('20');
  });

  it('renders a primitive after an initially undefined reactive slot', () => {
    const value = signal<string | undefined>(undefined);
    const host = mount(html`<span>${value}</span>`);

    expect(host.querySelector('span')?.textContent).toBe('');
    value.value = 'ready';
    flushEffects();
    expect(host.querySelector('span')?.textContent).toBe('ready');
  });

  it('preserves child semantics across reactive type transitions', () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const Child = component<{ label: string }>(`slot-transition-${suffix}`, (props) =>
      html`<strong>${props.label}</strong>`,
    );
    const value = signal<unknown>('one');
    const result = html`<div class="slot">${value}</div>`;
    const host = mount(result);
    document.body.appendChild(host);
    const slot = host.querySelector('.slot')!;
    const initialText = slot.firstChild;

    value.value = 'two';
    flushEffects();
    expect(slot.textContent).toBe('two');
    expect(slot.firstChild).toBe(initialText);

    value.value = null;
    flushEffects();
    expect(slot.textContent).toBe('');

    value.value = html`<em>template</em>`;
    flushEffects();
    expect(slot.querySelector('em')?.textContent).toBe('template');

    value.value = 'after-template';
    flushEffects();
    expect(slot.textContent).toBe('after-template');
    expect(slot.querySelector('em')).toBeNull();
    const demotedText = slot.firstChild;

    value.value = 'after-template-again';
    flushEffects();
    expect(slot.firstChild).toBe(demotedText);

    value.value = Child({ label: 'factory' });
    flushEffects();
    expect(slot.querySelector(`slot-transition-${suffix}`)?.textContent).toBe('factory');

    value.value = 'after-factory';
    flushEffects();
    expect(slot.textContent).toBe('after-factory');
    expect(slot.querySelector(`slot-transition-${suffix}`)).toBeNull();

    value.value = [
      html`<b>array-template</b>`,
      ' + ',
      Child({ label: 'array-factory' }),
    ];
    flushEffects();
    expect(slot.querySelector('b')?.textContent).toBe('array-template');
    expect(slot.querySelector(`slot-transition-${suffix}`)?.textContent).toBe('array-factory');
    expect(slot.textContent).toBe('array-template + array-factory');

    value.value = 'after-array';
    flushEffects();
    expect(slot.textContent).toBe('after-array');
    expect(slot.querySelector('b')).toBeNull();

    value.value = false;
    flushEffects();
    expect(slot.textContent).toBe('');

    value.value = 'done';
    flushEffects();
    expect(slot.textContent).toBe('done');
  });
});

// ── Attribute bindings ──────────────────────────────────────────────

describe('attribute bindings', () => {
  it('sets static attribute values', () => {
    const result = html`<div id="${'myid'}"></div>`;
    const host = mount(result);
    const div = host.querySelector('div');
    expect(div?.getAttribute('id')).toBe('myid');
  });

  it('sets signal attribute values', () => {
    const id = signal('first');
    const result = html`<div id="${id}"></div>`;
    const host = mount(result);
    expect(host.querySelector('div')?.getAttribute('id')).toBe('first');

    id.value = 'second';
    flushEffects();
    expect(host.querySelector('div')?.getAttribute('id')).toBe('second');
  });

  it('removes attribute when value is null/false', () => {
    const hidden = signal<boolean | null>(true);
    const result = html`<div hidden="${hidden}"></div>`;
    const host = mount(result);
    expect(host.querySelector('div')?.hasAttribute('hidden')).toBe(true);

    hidden.value = null;
    flushEffects();
    expect(host.querySelector('div')?.hasAttribute('hidden')).toBe(false);
  });
});

// ── class:name directive ────────────────────────────────────────────

describe('class:name directive', () => {
  it('toggles class based on truthy signal', () => {
    const active = signal(true);
    const result = html`<div class="base" class:active="${active}"></div>`;
    const host = mount(result);
    const div = host.querySelector('div');
    expect(div?.classList.contains('active')).toBe(true);

    active.value = false;
    flushEffects();
    expect(div?.classList.contains('active')).toBe(false);
  });

  it('toggles class based on static value', () => {
    const result = html`<div class:visible="${true}"></div>`;
    const host = mount(result);
    expect(host.querySelector('div')?.classList.contains('visible')).toBe(true);

    const result2 = html`<div class:hidden="${false}"></div>`;
    const host2 = mount(result2);
    expect(host2.querySelector('div')?.classList.contains('hidden')).toBe(false);
  });

  it('survives when reactive class attribute changes (classList vs setAttribute)', () => {
    const type = signal('task');
    const selected = signal(true);
    const result = html`<div class="task-item type-${type}" class:selected="${selected}"></div>`;
    const host = mount(result);
    const div = host.querySelector('div')!;

    expect(div.classList.contains('type-task')).toBe(true);
    expect(div.classList.contains('selected')).toBe(true);

    // Changing the class attribute's signal must NOT wipe class:name classes
    type.value = 'epic';
    flushEffects();
    expect(div.classList.contains('type-epic')).toBe(true);
    expect(div.classList.contains('type-task')).toBe(false);
    expect(div.classList.contains('selected')).toBe(true);
  });

  it('multiple class:name directives survive class attribute signal changes', () => {
    const type = signal('task');
    const selected = signal(true);
    const currentEpic = signal(true);
    const result = html`<div class="item type-${type}" class:selected="${selected}" class:current-epic="${currentEpic}"></div>`;
    const host = mount(result);
    const div = host.querySelector('div')!;

    expect(div.classList.contains('selected')).toBe(true);
    expect(div.classList.contains('current-epic')).toBe(true);

    type.value = 'epic';
    flushEffects();
    expect(div.classList.contains('type-epic')).toBe(true);
    expect(div.classList.contains('selected')).toBe(true);
    expect(div.classList.contains('current-epic')).toBe(true);
  });
});

// ── @event bindings ─────────────────────────────────────────────────

describe('@event bindings', () => {
  it('attaches click handler', () => {
    const handler = vi.fn();
    const result = html`<button @click="${handler}">Click</button>`;
    const host = mount(result);
    const btn = host.querySelector('button');

    btn?.click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handler receives the event object', () => {
    let receivedEvent: Event | null = null;
    const result = html`<button @click="${(e: Event) => { receivedEvent = e; }}">Click</button>`;
    const host = mount(result);
    host.querySelector('button')?.click();
    expect(receivedEvent).toBeInstanceOf(Event);
  });

  it('@click.stop modifier stops propagation', () => {
    const parentHandler = vi.fn();
    const childHandler = vi.fn();

    const result = html`<div @click="${parentHandler}"><button @click.stop="${childHandler}">Click</button></div>`;
    const host = mount(result);
    host.querySelector('button')?.click();

    expect(childHandler).toHaveBeenCalledTimes(1);
    expect(parentHandler).not.toHaveBeenCalled();
  });

  it('handler errors are caught and logged', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = () => { throw new Error('click boom'); };
    const result = html`<button @click="${handler}">Click</button>`;
    const host = mount(result);

    // Should not throw
    expect(() => host.querySelector('button')?.click()).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Event handler error'),
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });

  it('signal in @event handler triggers reactivity', () => {
    const count = signal(0);
    const values: number[] = [];
    effect(() => { values.push(count.value); });

    const result = html`<button @click="${() => { count.value++; }}">+</button>`;
    const host = mount(result);

    host.querySelector('button')?.click();
    flushEffects();
    expect(count.value).toBe(1);
    expect(values).toContain(1);
  });
});

// ── Nested templates ────────────────────────────────────────────────

describe('nested templates', () => {
  it('renders nested html template', () => {
    const inner = html`<span>inner</span>`;
    const outer = html`<div>${inner}</div>`;
    const host = mount(outer);
    expect(host.querySelector('span')?.textContent).toBe('inner');
  });

  it('renders array of templates', () => {
    const items = ['A', 'B', 'C'].map(s => html`<li>${s}</li>`);
    const result = html`<ul>${items}</ul>`;
    const host = mount(result);
    const lis = host.querySelectorAll('li');
    expect(lis).toHaveLength(3);
    expect(lis[0].textContent).toContain('A');
    expect(lis[1].textContent).toContain('B');
    expect(lis[2].textContent).toContain('C');
  });

  it('renders a static array of component factory results', () => {
    const Item = component('template-static-array-item', () => html`<span>Item</span>`);
    const host = mount(html`${[Item({}), Item({})]}`);
    document.body.appendChild(host);

    expect(host.querySelectorAll('template-static-array-item')).toHaveLength(2);
    expect(host.textContent).toBe('ItemItem');
  });
});

// ── when() conditional ──────────────────────────────────────────────

describe('when() conditional', () => {
  it('shows template when condition is truthy', () => {
    const result = html`<div>${when(true, html`<span>visible</span>`)}</div>`;
    const host = mount(result);
    expect(host.querySelector('span')?.textContent).toBe('visible');
  });

  it('hides template when condition is falsy', () => {
    const result = html`<div>${when(false, html`<span>hidden</span>`)}</div>`;
    const host = mount(result);
    expect(host.querySelector('span')).toBeNull();
  });

  it('works with signal condition', () => {
    const show = signal(true);
    const template = when(show, html`<span>toggle</span>`);
    const result = html`<div>${template}</div>`;
    const host = mount(result);
    expect(host.querySelector('span')?.textContent).toBe('toggle');
  });
});

// ── Disposal ────────────────────────────────────────────────────────

describe('template disposal', () => {
  it('dispose() cleans up signal subscriptions', () => {
    const name = signal('Alice');
    const result = html`<span>${name}</span>`;
    const host = mount(result);
    expect(host.textContent).toContain('Alice');

    result.dispose();

    name.value = 'Bob';
    flushEffects();
    expect(host.textContent).toContain('Alice');
  });

  it('dispose() tears down the currently mounted nested reactive template', () => {
    const label = signal('first');
    const onClick = vi.fn();
    const branch = signal<TemplateResult | null>(
      html`<button @click=${onClick}>${label}</button>`,
    );
    const result = html`<div>${branch}</div>`;
    const host = mount(result);
    const button = host.querySelector('button')!;

    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    result.dispose();

    label.value = 'second';
    flushEffects();
    button.click();
    expect(button.textContent).toBe('first');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reactive factory swaps dispose prop and host-class subscriptions immediately', () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const A = component<{ value: string }>(`slot-owner-a-${suffix}`, (props) =>
      html`<span>${props.value}</span>`,
    );
    const B = component<{ value: string }>(`slot-owner-b-${suffix}`, (props) =>
      html`<span>${props.value}</span>`,
    );
    const selected = signal<'a' | 'b'>('a');
    const value = signal('one');
    const hostClass = signal('before');
    const view = computed(() =>
      selected.value === 'a'
        ? A({ value }, { class: hostClass })
        : B({ value }, { class: hostClass }),
    );
    const result = html`${view}`;
    const host = mount(result);
    document.body.appendChild(host);
    const detached = host.querySelector(`slot-owner-a-${suffix}`) as HTMLElement & {
      _setProp(key: string, value: unknown): void;
    };
    const setProp = vi.spyOn(detached, '_setProp');

    selected.value = 'b';
    flushEffects();
    expect(detached.isConnected).toBe(false);
    setProp.mockClear();

    value.value = 'two';
    hostClass.value = 'after';
    flushEffects();
    expect(setProp).not.toHaveBeenCalled();
    expect(detached.classList.contains('before')).toBe(true);
    expect(detached.classList.contains('after')).toBe(false);
  });
});

// ── Complex scenarios ───────────────────────────────────────────────

describe('complex scenarios', () => {
  it('renders a component-like structure with multiple binding types', () => {
    const title = signal('Task 1');
    const status = signal('open');
    const selected = signal(false);
    const onClick = vi.fn();

    const result = html`
      <div class="task-item" class:selected="${selected}" @click="${onClick}">
        <span class="title">${title}</span>
        <span class="status">${status}</span>
      </div>
    `;
    const host = mount(result);

    // Initial state
    const div = host.querySelector('.task-item');
    expect(div).not.toBeNull();
    expect(host.querySelector('.title')?.textContent).toContain('Task 1');
    expect(host.querySelector('.status')?.textContent).toContain('open');
    expect(div?.classList.contains('selected')).toBe(false);

    // Update signals
    title.value = 'Task 2';
    status.value = 'done';
    selected.value = true;
    flushEffects();

    expect(host.querySelector('.title')?.textContent).toContain('Task 2');
    expect(host.querySelector('.status')?.textContent).toContain('done');
    expect(div?.classList.contains('selected')).toBe(true);

    // Click
    div?.dispatchEvent(new Event('click'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// ── Auto-resolution: props vs attributes ────────────────────────────

describe('mixed static + dynamic attributes', () => {
  it('preserves static text around interpolations', () => {
    const result = html`<div class="prefix-${`dynamic`} suffix"></div>`;
    const host = mount(result);
    expect(host.querySelector('div')?.getAttribute('class')).toBe('prefix-dynamic suffix');
  });

  it('handles multiple interpolations in one attribute', () => {
    const a = 'hello';
    const b = 'world';
    const result = html`<div data-info="${a}-${b}"></div>`;
    const host = mount(result);
    expect(host.querySelector('div')?.getAttribute('data-info')).toBe('hello-world');
  });

  it('reactively updates when signal in mixed attribute changes', () => {
    const status = signal('active');
    const result = html`<div class="badge status-${status}"></div>`;
    const host = mount(result);
    const div = host.querySelector('div')!;
    expect(div.getAttribute('class')).toBe('badge status-active');
    status.value = 'closed';
    flushEffects();
    expect(div.getAttribute('class')).toBe('badge status-closed');
  });
});

describe('auto-resolution', () => {
  it('routes attribute bindings through _setProp on framework components', () => {
    const setPropCalls: [string, unknown][] = [];
    class FakeComponent extends HTMLElement {
      _setProp(key: string, value: unknown) {
        setPropCalls.push([key, value]);
      }
    }
    customElements.define('fake-comp', FakeComponent);

    const obj = { id: 1, title: 'Test' };
    const result = html`<fake-comp task="${obj}" count="${42}"></fake-comp>`;
    const host = mount(result);

    expect(setPropCalls).toContainEqual(['task', obj]);
    expect(setPropCalls).toContainEqual(['count', 42]);
    // Object reference preserved — not serialized to string
    const taskCall = setPropCalls.find(([k]) => k === 'task');
    expect(taskCall![1]).toBe(obj);
  });

  it('routes signal bindings through _setProp reactively', () => {
    const props = new Map<string, unknown>();
    class FakeReactive extends HTMLElement {
      _setProp(key: string, value: unknown) {
        props.set(key, value);
      }
    }
    customElements.define('fake-reactive', FakeReactive);

    // NOTE: was `title` pre-0030.2 — title/role/tabindex/name are now on the
    // auto-resolution exclusion list (plain attributes, never _setProp).
    const label = signal('Hello');
    const result = html`<fake-reactive label="${label}"></fake-reactive>`;
    mount(result);
    flushEffects();

    expect(props.get('label')).toBe('Hello');

    label.value = 'Updated';
    flushEffects();
    expect(props.get('label')).toBe('Updated');
  });

  it('routes title/role/tabindex/name to plain attributes on framework components (ADR 0030.2 §8)', () => {
    const setPropCalls: [string, unknown][] = [];
    class FakeExcluded extends HTMLElement {
      _setProp(key: string, value: unknown) {
        setPropCalls.push([key, value]);
      }
    }
    customElements.define('fake-excluded', FakeExcluded);

    const tabindex = signal(0);
    const result = html`<fake-excluded title="${'tip'}" role="${'menu'}" name="${'field'}" tabindex="${tabindex}"></fake-excluded>`;
    const host = mount(result);
    const el = host.querySelector('fake-excluded')!;

    expect(setPropCalls).toEqual([]);
    expect(el.getAttribute('title')).toBe('tip');
    expect(el.getAttribute('role')).toBe('menu');
    expect(el.getAttribute('name')).toBe('field');
    expect(el.getAttribute('tabindex')).toBe('0');

    tabindex.value = 3;
    flushEffects();
    expect(el.getAttribute('tabindex')).toBe('3');
  });

  it('falls back to setAttribute for vanilla elements', () => {
    const result = html`<div data-id="${'42'}" title="${'hello'}"></div>`;
    const host = mount(result);
    const div = host.querySelector('div')!;

    expect(div.getAttribute('data-id')).toBe('42');
    expect(div.getAttribute('title')).toBe('hello');
  });
});

// ── ADR 0030.2 T4: parse-once template cache (issue 0015) ───────────

describe('parse-once template cache (ADR 0030.2 T4 / issue 0015)', () => {
  it('parses a callsite once and clones per mount', () => {
    const item = (label: string) => html`<span class="pc-item">${label}</span>`;

    const before = __templateParseCount();
    const results = [item('a'), item('b'), item('c'), item('d'), item('e')];
    const hosts = results.map(r => mount(r));

    // One parse for five mounts of the same callsite.
    expect(__templateParseCount() - before).toBe(1);

    // Equivalent DOM per mount, with independent per-mount binding values.
    expect(hosts.map(h => h.querySelector('.pc-item')?.textContent)).toEqual([
      'a', 'b', 'c', 'd', 'e',
    ]);
  });

  it('cloned mounts keep independent reactive bindings', () => {
    const card = (title: Signal<string>) =>
      html`<p class="pc-live">${title}</p>`;

    const t1 = signal('one');
    const t2 = signal('two');
    const before = __templateParseCount();
    const hostA = mount(card(t1));
    const hostB = mount(card(t2));
    expect(__templateParseCount() - before).toBe(1);

    t1.value = 'ONE';
    flushEffects();
    expect(hostA.querySelector('.pc-live')?.textContent).toBe('ONE');
    expect(hostB.querySelector('.pc-live')?.textContent).toBe('two');
  });

  it('dispose → remount reuses the cached parse', () => {
    const value = signal('x');
    const result = html`<i class="pc-re">${value}</i>`;
    mount(result);
    const before = __templateParseCount();
    result.dispose();
    const host2 = mount(result);
    expect(__templateParseCount() - before).toBe(0);
    expect(host2.querySelector('.pc-re')?.textContent).toBe('x');
  });
});

// ── ADR 0030.2 T4: single-mount guard (N105) ────────────────────────

describe('single-mount guard (N105)', () => {
  it('throws N105 on a second mount of a live template with value bindings', () => {
    const result = html`<span>${signal('bound')}</span>`;
    mount(result);
    expect(() => mount(result)).toThrowError(/N105/);
  });

  it('zero-binding templates stay multi-mountable (shared icon pattern)', () => {
    // Mirrors dropdown-menu.ts's module-level checkIcon: one static template
    // instance mounted into several places CONCURRENTLY.
    const icon = html`<svg class="size-4" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"></path></svg>`;
    const hostA = mount(icon);
    const hostB = mount(icon);
    expect(hostA.querySelector('svg')).not.toBeNull();
    expect(hostB.querySelector('svg')).not.toBeNull();
    // Each mount clones its own DOM — the two svgs are distinct nodes.
    expect(hostA.querySelector('svg')).not.toBe(hostB.querySelector('svg'));
  });

  it('dispose() → mount() stays legal for templates with bindings', () => {
    const label = signal('first');
    const result = html`<b>${label}</b>`;
    const hostA = mount(result);
    expect(hostA.querySelector('b')?.textContent).toBe('first');

    result.dispose();
    const hostB = mount(result);
    expect(hostB.querySelector('b')?.textContent).toBe('first');

    label.value = 'second';
    flushEffects();
    expect(hostB.querySelector('b')?.textContent).toBe('second');
  });
});

// ── ADR 0030.2 §3: when() boolean gate + else arm ───────────────────

describe('when() boolean gate and else arm (ADR 0030.2 §3)', () => {
  it('renders the else arm when the condition is falsy (signal)', () => {
    const on = signal(false);
    const result = html`<div>${when(
      on,
      () => html`<span class="then">yes</span>`,
      () => html`<span class="else">no</span>`,
    )}</div>`;
    const host = mount(result);

    expect(host.querySelector('.else')?.textContent).toBe('no');
    expect(host.querySelector('.then')).toBeNull();

    on.value = true;
    flushEffects();
    expect(host.querySelector('.then')?.textContent).toBe('yes');
    expect(host.querySelector('.else')).toBeNull();

    on.value = false;
    flushEffects();
    expect(host.querySelector('.else')?.textContent).toBe('no');
  });

  it('supports the else arm for static conditions and non-callback arms', () => {
    const yes = html`<div>${when(1, html`<i>a</i>`, html`<i>b</i>`)}</div>`;
    const no = html`<div>${when(0, html`<i>a</i>`, html`<i>b</i>`)}</div>`;
    expect(mount(yes).querySelector('i')?.textContent).toBe('a');
    expect(mount(no).querySelector('i')?.textContent).toBe('b');
  });

  it('truthy→truthy transitions never rebuild the branch (boolean gate)', () => {
    const count = signal(1);
    let evals = 0;
    const result = html`<div>${when(count, () => {
      evals++;
      return html`<input class="keep" />`;
    })}</div>`;
    const host = mount(result);
    const input = host.querySelector('.keep');
    expect(evals).toBe(1);
    expect(input).not.toBeNull();

    count.value = 2; // truthy → truthy
    flushEffects();
    expect(evals).toBe(1); // callback NOT re-run
    expect(host.querySelector('.keep')).toBe(input); // same DOM node — no rebuild

    count.value = 0; // truthy → falsy
    flushEffects();
    expect(host.querySelector('.keep')).toBeNull();

    count.value = 7; // falsy → truthy: branch re-evaluates once
    flushEffects();
    expect(evals).toBe(2);
  });

  it('falsy→falsy transitions never re-evaluate the else arm', () => {
    const count = signal(0);
    let elseEvals = 0;
    const result = html`<div>${when(
      count,
      () => html`<span>then</span>`,
      () => {
        elseEvals++;
        return html`<span class="off">off</span>`;
      },
    )}</div>`;
    const host = mount(result);
    const off = host.querySelector('.off');
    expect(elseEvals).toBe(1);

    count.value = NaN; // falsy → falsy
    flushEffects();
    expect(elseEvals).toBe(1);
    expect(host.querySelector('.off')).toBe(off);
  });

  it('evaluates branch callbacks UNTRACKED — construction-time reads cannot rebuild', () => {
    const on = signal(true);
    const insideRead = signal('initial');
    let evals = 0;
    const result = html`<div>${when(on, () => {
      evals++;
      // Raw .value read at construction time — deliberately NOT reactive.
      return html`<span class="ut">${insideRead.value}</span>`;
    })}</div>`;
    const host = mount(result);
    expect(host.querySelector('.ut')?.textContent).toBe('initial');
    expect(evals).toBe(1);

    insideRead.value = 'changed';
    flushEffects();
    // No rebuild, no re-eval: the read did not subscribe the when() computed.
    expect(evals).toBe(1);
    expect(host.querySelector('.ut')?.textContent).toBe('initial');
  });

  it('does not evaluate the inactive arm (laziness, both directions)', () => {
    const on = signal(true);
    let thenEvals = 0;
    let elseEvals = 0;
    const result = html`<div>${when(
      on,
      () => { thenEvals++; return html`<b>t</b>`; },
      () => { elseEvals++; return html`<b>e</b>`; },
    )}</div>`;
    mount(result);
    expect(thenEvals).toBe(1);
    expect(elseEvals).toBe(0);

    on.value = false;
    flushEffects();
    expect(thenEvals).toBe(1);
    expect(elseEvals).toBe(1);
  });
});

// ── ADR 0030.2 §3: html:inner takes branded trust only (N106) ───────

describe('html:inner raw() branding (N106)', () => {
  it('renders raw()-branded static values', () => {
    const result = html`<section html:inner=${raw('<p class="trusted">ok</p>')}></section>`;
    const host = mount(result);
    expect(host.querySelector('section .trusted')?.textContent).toBe('ok');
  });

  it('throws N106 for bare static strings', () => {
    const result = html`<section html:inner=${'<p>nope</p>'}></section>`;
    expect(() => mount(result)).toThrowError(/N106/);
  });

  it('updates reactively from a signal of raw values', () => {
    const content = signal(raw('<em>a</em>'));
    const result = html`<div html:inner=${content}></div>`;
    const host = mount(result);
    expect(host.querySelector('div em')?.textContent).toBe('a');

    content.value = raw('<strong>b</strong>');
    flushEffects();
    expect(host.querySelector('div strong')?.textContent).toBe('b');
    expect(host.querySelector('div em')).toBeNull();
  });

  it('throws N106 at mount for a signal whose initial value is a bare string', () => {
    const content = signal<unknown>('<p>nope</p>');
    const result = html`<div html:inner=${content}></div>`;
    expect(() => mount(result)).toThrowError(/N106/);
  });

  it('renders nothing for null/undefined', () => {
    const result = html`<div html:inner=${null}></div>`;
    const host = mount(result);
    expect(host.querySelector('div')?.innerHTML).toBe('');
  });
});

// ── ADR 0030.2 §8: handler dispatch runs untracked ──────────────────

describe('event handlers run untracked on dispatch', () => {
  it('synchronous dispatch inside an effect does not widen that effect deps', () => {
    const trigger = signal(0);
    const readByHandler = signal('a');
    let handlerRuns = 0;
    let effectRuns = 0;

    const result = html`<button @click=${() => {
      handlerRuns++;
      void readByHandler.value; // handler reads a signal
    }}>go</button>`;
    const host = mount(result);
    const btn = host.querySelector('button')!;

    const dispose = effect(() => {
      void trigger.value;
      effectRuns++;
      btn.dispatchEvent(new Event('click')); // synchronous dispatch inside the effect
    });
    expect(effectRuns).toBe(1);
    expect(handlerRuns).toBe(1);

    // The handler's signal read must NOT have been tracked by the effect.
    readByHandler.value = 'b';
    flushEffects();
    expect(effectRuns).toBe(1);

    // Sanity: the effect's real dependency still re-runs it.
    trigger.value = 1;
    flushEffects();
    expect(effectRuns).toBe(2);
    expect(handlerRuns).toBe(2);

    dispose();
  });
});
