/**
 * portal.test.ts — move-on-mount / remove-on-teardown, reactivity-preserving.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { component, flushEffects, html, ref, signal, type TemplateResult } from '@nisli/core';
import { portal } from './portal.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

function mount(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  container.setAttribute('data-container', '');
  document.body.appendChild(container);
  template.mount(container);
  flushEffects();
  return container;
}
function flush2(): void {
  flushEffects();
  flushEffects();
}

// A component whose inner box is portaled to document.body, with a reactive
// label so we can prove bindings survive the reparent.
const PortalBox = component<{ label?: string | TemplateResult; enabled?: boolean }>(
  'portal-box',
  (props) => {
    const box = ref<HTMLElement>();
    portal(box, { enabled: props.enabled.value ?? true });
    return html`<div ref="${box}" data-slot="box">${props.label}</div>`;
  },
);

// A child custom element that counts its own setup runs, wrapped in a portaled
// box — used to prove the move does NOT re-run a moved subtree's setup.
let childSetups = 0;
const PortalSetupChild = component('portal-setup-child', () => {
  childSetups += 1;
  return html`<span data-slot="child">child</span>`;
});
const PortalSetupParent = component('portal-setup-parent', () => {
  const b = ref<HTMLElement>();
  portal(b);
  return html`<div ref="${b}" data-slot="pbox">${PortalSetupChild({})}</div>`;
});

// Portals into an explicit container instead of <body>.
let customTarget: HTMLElement | null = null;
const TargetedBox = component<{ label?: string }>('portal-targeted-box', (props) => {
  const box = ref<HTMLElement>();
  portal(box, { target: () => customTarget });
  return html`<div ref="${box}" data-slot="targeted">${props.label}</div>`;
});

const box = (root: ParentNode = document) => root.querySelector<HTMLElement>('[data-slot="box"]')!;

describe('portal — move on mount', () => {
  it('moves the referenced subtree to document.body', () => {
    const c = mount(html`${PortalBox({ label: 'hi' })}`);
    const b = box();
    // It left the component/container and is now a direct child of <body>.
    expect(b.parentElement).toBe(document.body);
    expect(b.closest('portal-box')).toBeNull();
    expect(c.querySelector('[data-slot="box"]')).toBeNull();
    expect(b.textContent).toBe('hi');
  });

  it('honours a custom (function) target', () => {
    customTarget = document.createElement('section');
    customTarget.id = 'portal-root';
    document.body.appendChild(customTarget);
    mount(html`${TargetedBox({ label: 'x' })}`);
    const t = document.querySelector<HTMLElement>('[data-slot="targeted"]')!;
    expect(t.parentElement).toBe(customTarget);
  });

  it('enabled:false leaves the subtree in place', () => {
    const c = mount(html`${PortalBox({ label: 'stay', enabled: false })}`);
    const b = box();
    expect(b.parentElement).not.toBe(document.body);
    expect(b.closest('portal-box')).not.toBeNull();
    expect(c.contains(b)).toBe(true);
  });
});

describe('portal — reactivity survives the move', () => {
  it('a signal bound inside the portaled subtree still updates after reparent', () => {
    const label = signal('before');
    mount(html`${PortalBox({ label })}`);
    const b = box();
    expect(b.parentElement).toBe(document.body); // moved
    expect(b.textContent).toBe('before');

    label.value = 'after';
    flush2();
    expect(b.textContent).toBe('after'); // binding tracked the node by reference
  });
});

describe('portal — removal on teardown', () => {
  it('removes the portaled subtree when the host is disconnected', async () => {
    const c = mount(html`${PortalBox({ label: 'bye' })}`);
    const b = box();
    expect(b.parentElement).toBe(document.body);

    const host = c.querySelector('portal-box')!;
    host.remove();
    // ADR 0023 defers teardown one microtask.
    await Promise.resolve();
    await Promise.resolve();
    expect(document.body.contains(b)).toBe(false);
  });
});

describe('portal — stacking', () => {
  it('multiple portals stack under the target and remove independently', async () => {
    const c = mount(
      html`${PortalBox({ label: 'a' })}${PortalBox({ label: 'b' })}${PortalBox({ label: 'c' })}`,
    );
    const boxes = () => Array.from(document.querySelectorAll('[data-slot="box"]'));
    expect(boxes()).toHaveLength(3);
    // All three landed directly under <body>, in mount order.
    expect(boxes().map((n) => n.textContent)).toEqual(['a', 'b', 'c']);
    expect(boxes().every((n) => n.parentElement === document.body)).toBe(true);

    // Remove only the middle host — its box goes, the others remain.
    const middle = c.querySelectorAll('portal-box')[1]!;
    middle.remove();
    await Promise.resolve();
    await Promise.resolve();
    expect(boxes().map((n) => n.textContent)).toEqual(['a', 'c']);
  });
});

describe('portal — move-resilience (the graduating invariant)', () => {
  it('reparenting does not re-run the moved subtree\'s setup (setup stays 1)', async () => {
    childSetups = 0;
    const c = mount(html`${PortalSetupParent({})}`);

    // The box (with its custom-element child) was moved to <body>.
    const box = document.querySelector<HTMLElement>('[data-slot="pbox"]')!;
    expect(box.parentElement).toBe(document.body);
    expect(document.querySelector('[data-slot="child"]')).not.toBeNull();
    // Despite the disconnected+connected the appendChild move fires, ADR 0023
    // skips the deferred teardown on same-tick reconnect — so setup ran once.
    expect(childSetups).toBe(1);

    // Teardown after the move: still no re-setup, and the subtree is removed.
    c.querySelector('portal-setup-parent')!.remove();
    await Promise.resolve();
    await Promise.resolve();
    expect(childSetups).toBe(1);
    expect(document.querySelector('[data-slot="pbox"]')).toBeNull();
  });
});

describe('portal — misuse', () => {
  it('throws when called outside component setup', () => {
    expect(() => portal(ref<HTMLElement>())).toThrow(/during component setup/);
  });
});
