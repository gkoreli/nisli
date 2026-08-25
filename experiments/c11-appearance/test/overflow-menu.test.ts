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
 * Written by UiDomain alongside the fix and adopted here, since `test/` is
 * where the contract's module map puts tests.
 *
 * @vitest-environment happy-dom
 */
import { beforeEach, expect, test } from 'vitest';
import { flush, html } from '@nisli/core';
import type { ActionGroupSpec } from '../src/ui/patterns/overflow-menu.js';
import { MessageRow } from '../src/ui/patterns/message-row.js';

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
const panel = (): HTMLElement | null => root.querySelector<HTMLElement>('[data-overflow-menu]');
const items = (): HTMLElement[] => [...(panel()?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

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
  expect(panel()).toBeNull();
});

test('opening lists exactly the collapsed actions and moves focus into them', () => {
  trigger().click();
  flush();

  expect(trigger().getAttribute('aria-expanded')).toBe('true');
  expect(trigger().getAttribute('aria-controls')).toBe(panel()?.getAttribute('id'));
  expect(panel()?.getAttribute('role')).toBe('menu');
  expect(items().map((item) => item.textContent)).toEqual(['Star', 'Archive']);
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

test('Escape closes and returns focus to the trigger', () => {
  trigger().click();
  flush();

  key(items()[0]!, 'Escape');
  expect(panel()).toBeNull();
  expect(trigger().getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(trigger());
});

test('an outside pointerdown closes without stealing focus', () => {
  trigger().click();
  flush();

  const outside = document.createElement('div');
  document.body.appendChild(outside);
  outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  flush();

  expect(panel()).toBeNull();
  expect(document.activeElement).not.toBe(trigger());
});

test('a pointerdown inside the menu leaves it open', () => {
  trigger().click();
  flush();

  items()[0]!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  flush();

  expect(panel()).not.toBeNull();
});

test('choosing an item runs it, closes, and returns focus', () => {
  trigger().click();
  flush();

  items()[1]!.click();
  flush();

  expect(selected).toEqual(['archive']);
  expect(panel()).toBeNull();
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
  root.querySelector('[data-collapsed]')?.removeAttribute('data-collapsed');
  trigger().click();
  flush();
  expect(panel()).toBeNull();
  expect(trigger().getAttribute('aria-expanded')).toBe('false');
});
