/**
 * overflow-menu.test.ts — F6, the accessible overflow menu.
 *
 * "Overflow menus are stubs. No popover, no keyboard, no ARIA — the collapsed
 * actions become unreachable" was the recorded blocker. It matters more than
 * it looks: the fit solver's entire licence to collapse a control rests on the
 * control staying reachable afterwards. A `menu` strategy that loses the
 * action is not a degradation, it is a deletion.
 *
 * happy-dom has no layout, so the solver's decision is stood in for by hand:
 * the group is marked `data-collapsed` exactly as `domMutator` marks it. What
 * is under test here is behaviour, not geometry — geometry is proven for real
 * in `proof/geometry-proof.mjs`.
 *
 * THE PANEL IS NOW A POPOVER OPENED BY AN INVOKER, so this file needs a second
 * stand-in, and it is the honest part of it. happy-dom 20.8.9 has NO Popover
 * API at all — `showPopover` and `hidePopover` are `undefined`,
 * `command`/`commandfor` do nothing, `:popover-open` matches nothing, and there
 * is no top layer. Without a platform stand-in the component cannot be opened
 * here at all.
 *
 * THE SHIM IS NAMED AND BOUNDED ON PURPOSE. A stand-in that quietly emulated
 * the top layer would make this lens and the browser's disagree about the same
 * document, which is the divergence that decided `[popover]` over
 * `:popover-open` in N710's exemption — an attribute selector answers the same
 * in both lenses and a pseudo does not. So what is shimmed is exactly the
 * surface the component CALLS INTO, and every line of it was measured in real
 * Chromium 149 before being written down:
 *
 *   - `beforetoggle` dispatched SYNCHRONOUSLY inside the invoker's activation,
 *     cancelable on the opening edge and not cancelable on the closing edge;
 *   - `toggle` queued as a task, which is precisely why the component derives
 *     no state from it;
 *   - `hidePopover()` returning focus to the invoker when focus is inside the
 *     panel, and leaving it alone when it is not;
 *   - the first `autofocus` element inside the panel taking focus on show;
 *   - `onbeforetoggle`/`ontoggle` present as IDL attributes, which they are on
 *     `HTMLElement` in Chromium and are not in happy-dom.
 *
 * WHAT IT CANNOT PROVIDE, AND WHERE THAT COVERAGE WENT. These four behaviours
 * were hand-rolled in this component and are now the UA's, so the component
 * holds no line about any of them and there is nothing here left to unit-test —
 * a test written against this file's own imitation of them would assert the
 * imitation. Every one is asserted against real Chromium, and the row that does
 * it is named so a reader can see the coverage MOVED rather than vanished:
 *
 *   | behaviour                        | asserted by                                   |
 *   |----------------------------------|-----------------------------------------------|
 *   | Escape closes and returns focus  | proof/geometry-proof.mjs, F6 reachability row |
 *   |                                  | "escape returns focus" — a real keypress,     |
 *   |                                  | then 0 panels, aria-expanded false, focus on  |
 *   |                                  | the trigger                                   |
 *   | click light dismiss              | the overlays audit's measured outside click   |
 *   |                                  | at (5,300); and every cell of the 240-cell    |
 *   |                                  | matrix, where `sweepOverlays` must leave the  |
 *   |                                  | document with no panel open or the next       |
 *   |                                  | cell's geometry reports two menus at once     |
 *   | anchored, derived placement      | proof/geometry-proof.mjs, the `overlay`       |
 *   |                                  | column in all 240 cells — this file has no    |
 *   |                                  | layout and can assert no geometry             |
 *   | the panel owns a box when open   | proof/geometry-proof.mjs --self-test,         |
 *   |                                  | `overlay/boxless`                             |
 *
 * Two of the assertions below exist BECAUSE of that split: "the panel is opened
 * by the invoker relationship, never by script" is the only place a unit test
 * can defend the derived placement, since `showPopover()` silently establishes
 * no implicit anchor and no amount of geometry-free testing would notice.
 *
 * Written by UiDomain alongside the fix and adopted here, since `test/` is
 * where the contract's module map puts tests.
 *
 * @vitest-environment happy-dom
 */
import { beforeEach, expect, test } from 'vitest';
import { flush, html } from '@nisli/core';
import type { ActionGroupSpec } from '../src/ui/patterns/overflow-menu.js';
import { MessageRow } from '../src/ui/patterns/message-row.js';

/* ── The platform stand-in ─────────────────────────────────────────────────
   Installed once, at module scope, because the component reaches for these
   during setup and the invoker listener has to be on the document before the
   first click. Keyed off attributes only, so remounting the row needs no
   teardown. */

const shown = new WeakSet<HTMLElement>();
const invokers = new WeakMap<HTMLElement, HTMLElement>();

function toggleEvent(type: string, newState: 'open' | 'closed', cancelable: boolean): Event {
  const event = new Event(type, { cancelable });
  Object.defineProperty(event, 'newState', { value: newState });
  Object.defineProperty(event, 'oldState', { value: newState === 'open' ? 'closed' : 'open' });
  return event;
}

function showPopover(this: HTMLElement): void {
  if (shown.has(this)) return;
  const before = toggleEvent('beforetoggle', 'open', true);
  this.dispatchEvent(before);
  // The opening edge is cancelable, and the component uses it: a menu with
  // nothing collapsed into it refuses the show rather than painting a dead end.
  if (before.defaultPrevented) return;
  shown.add(this);
  this.querySelector<HTMLElement>('[autofocus]')?.focus();
  queueMicrotask(() => this.dispatchEvent(toggleEvent('toggle', 'open', false)));
}

function hidePopover(this: HTMLElement): void {
  if (!shown.has(this)) return;
  // Captured BEFORE the event, the way the UA captures its previously-focused
  // element: focus only comes back when it was inside the panel to begin with,
  // which is what makes one `hidePopover()` serve both the user closing a menu
  // and focus walking out of it.
  const held = this.contains(document.activeElement);
  this.dispatchEvent(toggleEvent('beforetoggle', 'closed', false));
  shown.delete(this);
  if (held) invokers.get(this)?.focus();
  queueMicrotask(() => this.dispatchEvent(toggleEvent('toggle', 'closed', false)));
}

// `onbeforetoggle` and `ontoggle` are part of the shim rather than decoration:
// nisli's template audit decides whether `@beforetoggle` is a real native event
// by asking `'onbeforetoggle' in el`, which is TRUE on `HTMLElement` in Chromium
// (the 240-cell run reports zero page errors) and absent in happy-dom. Without
// them this file reports N102 on a binding the browser is perfectly happy with —
// the shim's own version of the lens-disagreement it exists to avoid.
Object.assign(HTMLElement.prototype, {
  showPopover,
  hidePopover,
  onbeforetoggle: null,
  ontoggle: null,
});

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const invoker = target.closest<HTMLElement>('[command][commandfor]');
  if (!invoker || invoker.getAttribute('command') !== 'toggle-popover') return;
  const target_ = document.getElementById(invoker.getAttribute('commandfor') ?? '');
  if (!target_) return;
  invokers.set(target_, invoker);
  if (shown.has(target_)) target_.hidePopover();
  else target_.showPopover();
});

/* ── The fixture ──────────────────────────────────────────────────────────── */

const selected: string[] = [];

const groups: ActionGroupSpec[] = [
  {
    id: 'secondary',
    priority: 2,
    actions: [
      { id: 'star', label: 'Star', onSelect: () => selected.push('star') },
      { id: 'archive', label: 'Archive', onSelect: () => selected.push('archive') },
    ],
  },
  {
    id: 'primary',
    priority: 1,
    actions: [{ id: 'reply', label: 'Reply', onSelect: () => selected.push('reply') }],
  },
];

let root: HTMLElement;

function mountRow(): void {
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.appendChild(root);
  html`${MessageRow({
    author: 'Ada Lovelace',
    initials: 'AL',
    time: '11:04',
    excerpt: 'The Analytical Engine weaves algebraic patterns.',
    unread: true,
    actions: groups,
  })}`.mount(root);
  flush();
}

const q = <T extends Element>(selector: string): T => {
  const found = root.querySelector<T>(selector);
  if (!found) throw new Error(`missing ${selector}`);
  return found;
};

const trigger = (): HTMLElement => q<HTMLElement>('[data-overflow]');
/**
 * The panel is in the DOM whether or not it is open — `commandfor` has to
 * resolve a target at click time — so "is there a panel" is no longer the
 * question. `isOpen()` asks the component's own observable state instead.
 */
const panel = (): HTMLElement => q<HTMLElement>('[data-overflow-menu]');
const isOpen = (): boolean => trigger().getAttribute('aria-expanded') === 'true';
const items = (): HTMLElement[] => [...panel().querySelectorAll<HTMLElement>('[role="menuitem"]')];

const key = (target: Element, name: string): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  flush();
};

beforeEach(() => {
  selected.length = 0;
  mountRow();
  // The solver has no layout to measure under happy-dom, so stand in for its
  // decision: mark the secondary group as moved into the menu, exactly as
  // domMutator does for the `menu` strategy.
  const collapsedGroup = q<HTMLElement>('[data-collapse="menu"]');
  collapsedGroup.setAttribute('data-collapsed', '');
});

test('declares the vocabulary, never a value', () => {
  expect(q('[data-fit]').getAttribute('data-layout')).toBe('row');
  const time = [...root.querySelectorAll('[data-text="meta"]')].find(
    (el) => el.textContent === '11:04',
  );
  // F5: a timestamp hides, it never truncates.
  expect(time?.getAttribute('data-collapse')).toBe('hide');
  const excerpt = [...root.querySelectorAll('[data-text="meta"]')].find((el) =>
    el.textContent?.startsWith('The Analytical'),
  );
  expect(excerpt?.getAttribute('data-collapse')).toBe('truncate');
  // Groups collapse as one unit: two buttons, one declaration.
  const group = q<HTMLElement>('[data-collapse="menu"]');
  expect(group.querySelectorAll('[data-appearance="action"]').length).toBe(2);
  expect(group.querySelectorAll('[data-collapse], [data-priority]').length).toBe(0);
});

test('trigger announces a menu and is closed to begin with', () => {
  expect(trigger().getAttribute('aria-haspopup')).toBe('menu');
  expect(trigger().getAttribute('aria-expanded')).toBe('false');
  expect(trigger().hasAttribute('aria-controls')).toBe(false);
  expect(isOpen()).toBe(false);
});

test('the panel is opened by the invoker relationship, never by script', () => {
  // THIS IS LOAD-BEARING GEOMETRY, not markup tidiness. The theme authors no
  // side, no offset, no anchor name and no `position-anchor`, because the panel
  // is placed against its IMPLICIT anchor — and an implicit anchor is
  // established by invoker ACTIVATION. `showPopover()` establishes none, so the
  // day someone replaces these two attributes with a click handler that calls
  // it, every panel silently lands at its static position and the whole derived
  // placement becomes fiction. Measured in real Chromium, both ways round.
  expect(trigger().getAttribute('command')).toBe('toggle-popover');
  expect(trigger().getAttribute('commandfor')).toBe(panel().id);
  expect(panel().getAttribute('popover')).toBe('auto');
});

test('the panel declares itself a menu only while it holds one', () => {
  // `items` is read from the action scope when the panel opens, so a closed
  // panel holds nothing. `role="menu"` on it would put one empty menu per row
  // into the accessibility tree — the dead end this component refuses to open.
  expect(panel().hasAttribute('role')).toBe(false);
  trigger().click();
  flush();
  expect(panel().getAttribute('role')).toBe('menu');
  trigger().click();
  flush();
  expect(panel().hasAttribute('role')).toBe(false);
});

test('opening lists exactly the collapsed actions and moves focus into them', () => {
  trigger().click();
  flush();

  expect(trigger().getAttribute('aria-expanded')).toBe('true');
  expect(trigger().getAttribute('aria-controls')).toBe(panel().getAttribute('id'));
  expect(panel().getAttribute('role')).toBe('menu');
  expect(items().map((item) => item.textContent)).toEqual(['Star', 'Archive']);
  // Declarative `autofocus`, not a `focus()` call: the first item carries the
  // attribute and the platform places focus as it shows the panel.
  expect(items()[0]?.hasAttribute('autofocus')).toBe(true);
  expect(items()[1]?.hasAttribute('autofocus')).toBe(false);
  expect(document.activeElement).toBe(items()[0]);
});

test('arrow keys move between items and wrap', () => {
  trigger().click();
  flush();

  key(items()[0]!, 'ArrowDown');
  expect(document.activeElement).toBe(items()[1]);
  key(items()[1]!, 'ArrowDown');
  expect(document.activeElement).toBe(items()[0]);
  key(items()[0]!, 'ArrowUp');
  expect(document.activeElement).toBe(items()[1]);
  key(items()[1]!, 'Home');
  expect(document.activeElement).toBe(items()[0]);
  key(items()[0]!, 'End');
  expect(document.activeElement).toBe(items()[1]);
});

test('focus leaving the panel closes it, and does not snatch focus back', () => {
  // The one containment the browser does NOT give a non-modal popover: measured,
  // an outside `focus()` succeeds and the menu stays open behind it. This
  // replaces a `Tab` key branch that missed Shift+Tab and every focus move made
  // by script; `focusout` sees all three, and `relatedTarget` is the whole test.
  trigger().click();
  flush();
  expect(isOpen()).toBe(true);

  const outside = document.createElement('button');
  document.body.appendChild(outside);
  outside.focus();
  flush();

  expect(isOpen()).toBe(false);
  expect(document.activeElement).toBe(outside);
});

test('focus moving between items leaves it open', () => {
  // The other half of the same claim, and the one that a `host.contains()` test
  // written the wrong way round would break: focus moving WITHIN the panel is
  // not focus leaving it.
  trigger().click();
  flush();

  items()[1]!.focus();
  flush();

  expect(isOpen()).toBe(true);
  expect(document.activeElement).toBe(items()[1]);
});

test('a resize closes an open panel, because the answer in it is stale', () => {
  // A resize re-solves the container, which changes WHICH groups are collapsed.
  // Anchor positioning re-derives the panel's position for free, and re-deriving
  // the position of a stale answer is still a stale answer.
  trigger().click();
  flush();
  expect(isOpen()).toBe(true);

  window.dispatchEvent(new Event('resize'));
  flush();

  expect(isOpen()).toBe(false);
});

test('choosing an item runs it, closes, and returns focus', () => {
  trigger().click();
  flush();

  items()[1]!.click();
  flush();

  expect(selected).toEqual(['archive']);
  expect(isOpen()).toBe(false);
  expect(document.activeElement).toBe(trigger());
});

test('a collapsed action is still reachable — the F6 regression', () => {
  // Star lives in the collapsed group, so it is gone from the row...
  const group = q<HTMLElement>('[data-collapse="menu"][data-collapsed]');
  expect(group.hasAttribute('data-collapsed')).toBe(true);
  // ...and reachable through the menu, which is the whole promise of `menu`.
  trigger().click();
  flush();
  const star = items().find((item) => item.textContent === 'Star');
  expect(star).toBeDefined();
  star?.click();
  flush();
  expect(selected).toEqual(['star']);
});

test('nothing collapsed means nothing to open', () => {
  // The show is CANCELLED rather than reversed: `beforetoggle` is cancelable on
  // the opening edge, so the panel never reaches the top layer and there is no
  // frame in which an empty `role="menu"` existed.
  root.querySelector('[data-collapsed]')?.removeAttribute('data-collapsed');
  trigger().click();
  flush();
  expect(isOpen()).toBe(false);
  expect(panel().hasAttribute('role')).toBe(false);
  expect(items()).toHaveLength(0);
});
