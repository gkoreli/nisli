/**
 * roving-focus.test.ts — roving-tabindex keyboard navigation.
 *
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@nisli/core';
import { rovingFocus, type Orientation } from './roving-focus.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

/** Build `count` buttons in a container; mark indices in `disabled` as disabled. */
function group(count: number, disabled: number[] = []): HTMLButtonElement[] {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const items: HTMLButtonElement[] = [];
  for (let i = 0; i < count; i++) {
    const btn = document.createElement('button');
    btn.textContent = String(i);
    if (disabled.includes(i)) btn.setAttribute('disabled', '');
    container.appendChild(btn);
    items.push(btn);
  }
  return items;
}

function keydown(key: string): KeyboardEvent {
  return new KeyboardEvent('keydown', { key, cancelable: true });
}

describe('rovingFocus — horizontal navigation', () => {
  it('ArrowRight/ArrowLeft move focus and activeIndex', () => {
    const items = group(3);
    const roving = rovingFocus(() => items);
    items[0].focus();

    expect(roving.onKeydown(keydown('ArrowRight'))).toBe(true);
    expect(document.activeElement).toBe(items[1]);
    expect(roving.activeIndex.value).toBe(1);

    roving.onKeydown(keydown('ArrowRight'));
    expect(document.activeElement).toBe(items[2]);

    roving.onKeydown(keydown('ArrowLeft'));
    expect(document.activeElement).toBe(items[1]);
    expect(roving.activeIndex.value).toBe(1);
  });

  it('ignores the cross-axis arrow keys', () => {
    const items = group(3);
    const roving = rovingFocus(() => items);
    items[0].focus();

    expect(roving.onKeydown(keydown('ArrowDown'))).toBe(false);
    expect(document.activeElement).toBe(items[0]);
    expect(roving.activeIndex.value).toBe(0);
  });

  it('wraps at both ends when loop is on (default)', () => {
    const items = group(3);
    const roving = rovingFocus(() => items);
    items[0].focus();

    roving.onKeydown(keydown('ArrowLeft')); // 0 -> wrap -> 2
    expect(document.activeElement).toBe(items[2]);

    roving.onKeydown(keydown('ArrowRight')); // 2 -> wrap -> 0
    expect(document.activeElement).toBe(items[0]);
  });

  it('clamps at the ends when loop is off', () => {
    const items = group(3);
    const roving = rovingFocus(() => items, { loop: false });
    items[0].focus();

    expect(roving.onKeydown(keydown('ArrowLeft'))).toBe(false); // already at start
    expect(document.activeElement).toBe(items[0]);

    roving.setActiveIndex(2);
    items[2].focus();
    expect(roving.onKeydown(keydown('ArrowRight'))).toBe(false); // already at end
    expect(document.activeElement).toBe(items[2]);
  });
});

describe('rovingFocus — vertical navigation', () => {
  it('uses ArrowUp/ArrowDown when orientation is vertical', () => {
    const items = group(3);
    const roving = rovingFocus(() => items, { orientation: 'vertical' });
    items[0].focus();

    expect(roving.onKeydown(keydown('ArrowDown'))).toBe(true);
    expect(document.activeElement).toBe(items[1]);

    roving.onKeydown(keydown('ArrowUp'));
    expect(document.activeElement).toBe(items[0]);

    // horizontal arrows are inert on a vertical group
    expect(roving.onKeydown(keydown('ArrowRight'))).toBe(false);
    expect(document.activeElement).toBe(items[0]);
  });

  it('reads a reactive orientation signal', () => {
    const items = group(3);
    const orientation = signal<Orientation>('horizontal');
    const roving = rovingFocus(() => items, { orientation });
    items[0].focus();

    roving.onKeydown(keydown('ArrowRight'));
    expect(document.activeElement).toBe(items[1]);

    orientation.value = 'vertical';
    roving.onKeydown(keydown('ArrowRight')); // now inert
    expect(document.activeElement).toBe(items[1]);
    roving.onKeydown(keydown('ArrowDown'));
    expect(document.activeElement).toBe(items[2]);
  });
});

describe('rovingFocus — Home/End', () => {
  it('Home focuses the first item, End the last', () => {
    const items = group(4);
    const roving = rovingFocus(() => items);
    items[1].focus();
    roving.setActiveIndex(1);

    roving.onKeydown(keydown('End'));
    expect(document.activeElement).toBe(items[3]);
    expect(roving.activeIndex.value).toBe(3);

    roving.onKeydown(keydown('Home'));
    expect(document.activeElement).toBe(items[0]);
    expect(roving.activeIndex.value).toBe(0);
  });
});

describe('rovingFocus — disabled items', () => {
  it('skips disabled items while navigating', () => {
    const items = group(4, [1, 2]);
    const roving = rovingFocus(() => items);
    items[0].focus();

    roving.onKeydown(keydown('ArrowRight')); // 0 -> skip 1,2 -> 3
    expect(document.activeElement).toBe(items[3]);

    roving.onKeydown(keydown('ArrowLeft')); // 3 -> skip 2,1 -> 0
    expect(document.activeElement).toBe(items[0]);
  });

  it('Home/End land on the first/last enabled item', () => {
    const items = group(4, [0, 3]);
    const roving = rovingFocus(() => items);
    items[1].focus();

    roving.onKeydown(keydown('End'));
    expect(document.activeElement).toBe(items[2]); // 3 is disabled

    roving.onKeydown(keydown('Home'));
    expect(document.activeElement).toBe(items[1]); // 0 is disabled
  });

  it('honors aria-disabled', () => {
    const items = group(3);
    items[1].setAttribute('aria-disabled', 'true');
    const roving = rovingFocus(() => items);
    items[0].focus();

    roving.onKeydown(keydown('ArrowRight'));
    expect(document.activeElement).toBe(items[2]);
  });
});

describe('rovingFocus — activation follows focus', () => {
  it('calls onActiveChange with the new index and item', () => {
    const items = group(3);
    const onActiveChange = vi.fn();
    const roving = rovingFocus(() => items, { onActiveChange });
    items[0].focus();

    roving.onKeydown(keydown('ArrowRight'));
    expect(onActiveChange).toHaveBeenCalledTimes(1);
    expect(onActiveChange).toHaveBeenCalledWith(1, items[1]);
  });

  it('does not fire onActiveChange when focus does not move', () => {
    const items = group(2);
    const onActiveChange = vi.fn();
    const roving = rovingFocus(() => items, { loop: false, onActiveChange });
    items[0].focus();

    roving.onKeydown(keydown('ArrowLeft')); // clamped, no move
    expect(onActiveChange).not.toHaveBeenCalled();
  });
});

describe('rovingFocus — tabindex + setActiveIndex', () => {
  it('tabindex is 0 for the active item, -1 otherwise', () => {
    const items = group(3);
    const roving = rovingFocus(() => items);
    expect(roving.tabindex(0)).toBe(0);
    expect(roving.tabindex(1)).toBe(-1);

    roving.setActiveIndex(2);
    expect(roving.tabindex(0)).toBe(-1);
    expect(roving.tabindex(2)).toBe(0);
  });

  it('setActiveIndex clamps into the item range', () => {
    const items = group(3);
    const roving = rovingFocus(() => items);
    roving.setActiveIndex(99);
    expect(roving.activeIndex.value).toBe(2);
    roving.setActiveIndex(-5);
    expect(roving.activeIndex.value).toBe(0);
  });

  it('focus() moves DOM focus to the active item', () => {
    const items = group(3);
    const roving = rovingFocus(() => items, { active: 1 });
    roving.focus();
    expect(document.activeElement).toBe(items[1]);
    roving.focus(2);
    expect(document.activeElement).toBe(items[2]);
  });
});

describe('rovingFocus — edge cases', () => {
  it('non-navigation keys are ignored', () => {
    const items = group(3);
    const roving = rovingFocus(() => items);
    items[0].focus();
    expect(roving.onKeydown(keydown('a'))).toBe(false);
    expect(roving.onKeydown(keydown('Enter'))).toBe(false);
    expect(document.activeElement).toBe(items[0]);
  });

  it('preventDefault is called for handled navigation keys', () => {
    const items = group(3);
    const roving = rovingFocus(() => items);
    items[0].focus();
    const ev = keydown('ArrowRight');
    const spy = vi.spyOn(ev, 'preventDefault');
    roving.onKeydown(ev);
    expect(spy).toHaveBeenCalled();
  });

  it('handles an empty group without throwing', () => {
    const roving = rovingFocus(() => []);
    expect(roving.onKeydown(keydown('ArrowRight'))).toBe(false);
    expect(() => roving.focus()).not.toThrow();
  });
});
