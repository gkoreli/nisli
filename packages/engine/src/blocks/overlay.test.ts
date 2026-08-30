/**
 * The overlay behaviour, proven through mount(): one manager routes Escape and
 * an outside pointer to the top layer, a modal traps and restores focus and
 * locks scroll, a menu has a keyboard model.
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { el, html, signal, flushEffects } from '@nisli/core';
import { block, lockScroll } from './kernel.js';
import { Dialog } from './dialog.js';
import { Toolbar } from './toolbar.js';
import { confirm } from './confirm.js';
import { notify, __notices } from './notice.js';
import { __layers } from './kernel.js';
import { metrics } from '../metrics.js';
import { mount, textMeasurer, type Mounted } from '../test/mount.js';

const mounted: Mounted[] = [];
const up = (...args: Parameters<typeof mount>) => { const m = mount(...args); mounted.push(m); return m; };
afterEach(() => { while (mounted.length) mounted.pop()!.unmount(); __notices.value = []; flushEffects(); document.body.innerHTML = ''; });

const key = (k: string, target: Element | Document = document, init: KeyboardEventInit = {}) => { target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); flushEffects(); };
const pointer = (target: Element) => { target.dispatchEvent(new Event('pointerdown', { bubbles: true })); flushEffects(); };
const tick = () => new Promise<void>((r) => queueMicrotask(r));

const dialog = (title: string, open: ReturnType<typeof signal<boolean>>, children: unknown = html`<button id="${title}-ok">ok</button>`) =>
  ({ title, open, onClose: () => { open.value = false; }, children });

describe('overlay — one manager, the top layer', () => {
  it('two modals stacked: one Escape closes only the top; the next closes the other', () => {
    const a = signal(true), b = signal(true);
    up(Dialog, dialog('A', a, html`<b>a</b>`));
    up(Dialog, dialog('B', b, html`<b>b</b>`));
    expect(__layers.value.map((l) => l.kind)).toEqual(['modal', 'modal']);
    key('Escape');
    expect(b.value).toBe(false);
    expect(a.value).toBe(true);
    expect(__layers.value.length).toBe(1);
    key('Escape');
    expect(a.value).toBe(false);
    expect(__layers.value.length).toBe(0);
  });

  it('confirm() over a Dialog: Escape answers the confirm, the dialog stays open, scroll stays locked', async () => {
    const open = signal(true);
    up(Dialog, dialog('Outer', open));
    const p = confirm({ title: 'Sure?', message: 'm' }); flushEffects();
    expect(document.body.style.overflow).toBe('hidden');
    key('Escape');
    expect(await p).toBe(false);
    expect(open.value).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    await new Promise((r) => setTimeout(r, 5));
    expect(document.querySelectorAll('[role=dialog]').length).toBe(1);
  });

  it('a pointer outside the dialog surface closes it; one inside does not; z comes from metrics', () => {
    const open = signal(true);
    const t = up(Dialog, dialog('D', open));
    expect(t.styleOf('[role=presentation]').zIndex).toBe(String(metrics.layer.modal));
    pointer(t.el.querySelector('[role=dialog]')!);
    expect(open.value).toBe(true);
    pointer(t.el.querySelector('[role=presentation]')!);
    expect(open.value).toBe(false);
  });

  it('a menu inside a dialog: an outside pointer on the backdrop closes the menu, not the dialog; the second closes the dialog', () => {
    const open = signal(true);
    const t = up(Dialog, dialog('D', open, [Toolbar({ title: 'T', actions: [{ id: 'a', label: 'Alpha', priority: 'tertiary' }, { id: 'b', label: 'Bravo', priority: 'primary' }] })]), { width: 800, viewport: 800, text: textMeasurer(8) });
    const trigger = t.el.querySelector<HTMLElement>('[aria-label="More actions"]')!;
    trigger.click(); flushEffects();
    const menu = t.el.querySelector<HTMLElement>('[role=menu]')!;
    expect(menu.style.display).toBe('flex');
    expect(__layers.value.map((l) => l.kind)).toEqual(['modal', 'popover']);
    expect(menu.style.zIndex).toBe(String(metrics.layer.popover + 1));
    pointer(t.el.querySelector('[role=presentation]')!);
    expect(menu.style.display).toBe('none');
    expect(open.value).toBe(true);
    pointer(t.el.querySelector('[role=presentation]')!);
    expect(open.value).toBe(false);
  });

  it('Escape with a menu open inside a dialog closes the menu only', () => {
    const open = signal(true);
    const t = up(Dialog, dialog('D', open, [Toolbar({ title: 'T', actions: [{ id: 'a', label: 'Alpha', priority: 'tertiary' }, { id: 'b', label: 'Bravo', priority: 'primary' }] })]), { width: 800, viewport: 800, text: textMeasurer(8) });
    t.el.querySelector<HTMLElement>('[aria-label="More actions"]')!.click(); flushEffects();
    key('Escape');
    expect(t.el.querySelector<HTMLElement>('[role=menu]')!.style.display).toBe('none');
    expect(open.value).toBe(true);
    key('Escape');
    expect(open.value).toBe(false);
  });

  it('the document listeners exist only while a layer is open (teardown is a microtask after removal)', async () => {
    const open = signal(false);
    const onClose = () => { open.value = false; };
    up(Dialog, { title: 'D', open, onClose, children: html`<b>x</b>` });
    let closes = 0;
    const spy = { title: 'S', open: signal(true), onClose: () => closes++, children: html`<b>x</b>` };
    const s = up(Dialog, spy);
    key('Escape');
    expect(closes).toBe(1);
    s.unmount(); mounted.pop();
    await tick();
    expect(__layers.value.length).toBe(0);
    key('Escape');
    expect(closes).toBe(1);
  });
});

describe('overlay — focus, inert and scroll lock', () => {
  it('a modal focuses its first control on open (never Close), makes its siblings inert, and restores focus to the opener on close', async () => {
    const opener = document.createElement('button'); opener.id = 'opener'; document.body.appendChild(opener); opener.focus();
    const sibling = document.createElement('div'); sibling.id = 'sib'; document.body.appendChild(sibling);
    expect(document.activeElement).toBe(opener);
    const open = signal(true);
    const t = up(Dialog, dialog('D', open, html`<input id="first" /><button id="second">b</button>`));
    await tick();
    expect(document.activeElement?.id).toBe('first');
    expect(opener.hasAttribute('inert')).toBe(true);
    expect(sibling.hasAttribute('inert')).toBe(true);
    expect(t.el.closest('[inert]')).toBeNull();
    open.value = false; flushEffects();
    expect(opener.hasAttribute('inert')).toBe(false);
    expect(sibling.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('a modal with no control focuses its surface, so a keyboard user lands inside it; aria-labelledby names it', async () => {
    const open = signal(true);
    const t = up(Dialog, dialog('Plain', open, html`<p>text only</p>`));
    await tick();
    const dlg = t.el.querySelector<HTMLElement>('[role=dialog]')!;
    expect(document.activeElement).toBe(dlg);
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(dlg.hasAttribute('aria-label')).toBe(false);              // one name: the visible title
    expect(document.getElementById(dlg.getAttribute('aria-labelledby')!)!.textContent).toBe('Plain');
  });

  it('Tab wraps inside the surface: from the last control to the first, and Shift+Tab back', async () => {
    const open = signal(true);
    const t = up(Dialog, dialog('D', open, html`<input id="first" /><button id="last">b</button>`));
    await tick();
    const close = t.el.querySelector<HTMLElement>('[aria-label="Close"]')!;
    t.el.querySelector<HTMLElement>('#last')!.focus();
    key('Tab', document.activeElement!);
    expect(document.activeElement).toBe(close);                     // Close is the first focusable of the surface
    key('Tab', document.activeElement!, { shiftKey: true });
    expect(document.activeElement?.id).toBe('last');
  });

  it('nested modals: the inner un-inerts only what it marked, and focus returns into the outer', async () => {
    const outer = signal(true);
    const t = up(Dialog, dialog('Outer', outer, html`<button id="del">Delete</button>`));
    await tick();
    t.el.querySelector<HTMLElement>('#del')!.focus();
    const p = confirm({ title: 'Sure?', message: 'm' }); flushEffects();
    await tick();
    expect(t.el.closest('[inert]')).not.toBeNull();                 // the outer is behind the confirm now
    expect(document.activeElement?.textContent).toBe('Cancel');
    key('Escape');
    await p;
    expect(t.el.closest('[inert]')).toBeNull();
    expect(document.activeElement?.id).toBe('del');
    expect(document.body.style.overflow).toBe('hidden');
    outer.value = false; flushEffects();
    expect(document.body.style.overflow).toBe('');
  });

  it('scroll lock: a popover alone never locks; a modal does, and closing a popover above it keeps the lock', () => {
    const t = up(Toolbar, { title: 'T', actions: [{ id: 'a', label: 'Alpha', priority: 'tertiary' }, { id: 'b', label: 'Bravo', priority: 'primary' }] }, { width: 160, text: textMeasurer(8) });
    const trigger = t.el.querySelector<HTMLElement>('[aria-label="More actions"]')!;
    trigger.click(); flushEffects();
    expect(__layers.value.map((l) => l.kind)).toEqual(['popover']);
    expect(document.body.style.overflow).toBe('');
    key('Escape');
    const open = signal(true);
    up(Dialog, dialog('D', open, [Toolbar({ title: 'T', actions: [{ id: 'a', label: 'Alpha', priority: 'tertiary' }, { id: 'b', label: 'Bravo', priority: 'primary' }] })]), { width: 160, viewport: 800, text: textMeasurer(8) });
    expect(document.body.style.overflow).toBe('hidden');
    document.querySelectorAll<HTMLElement>('[aria-label="More actions"]')[1]!.click(); flushEffects();
    key('Escape');
    expect(__layers.value.map((l) => l.kind)).toEqual(['modal']);
    expect(document.body.style.overflow).toBe('hidden');
  });
});

describe('overlay — the menu keyboard model', () => {
  const actions = [
    { id: 'a', label: 'Alpha', priority: 'tertiary' as const },
    { id: 'b', label: 'Bravo', priority: 'tertiary' as const },
    { id: 'c', label: 'Charlie', priority: 'tertiary' as const },
    { id: 'p', label: 'Primary', priority: 'primary' as const },
  ];
  const menuUp = async () => {
    const t = up(Toolbar, { title: 'T', actions }, { width: 200, text: textMeasurer(8) });
    const trigger = t.el.querySelector<HTMLElement>('[aria-label="More actions"]')!;
    const menu = t.el.querySelector<HTMLElement>('[role=menu]')!;
    const items = () => [...menu.querySelectorAll<HTMLElement>('[role=menuitem]')];
    expect(items().map((i) => i.textContent)).toEqual(['Alpha', 'Bravo', 'Charlie']);
    trigger.focus();
    trigger.click(); flushEffects();
    await tick();
    return { t, trigger, menu, items };
  };

  it('opens with focus on the first item; the trigger names and controls the menu', async () => {
    const { trigger, menu, items } = await menuUp();
    expect(document.activeElement).toBe(items()[0]);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(menu.id);
    expect(menu.getAttribute('aria-labelledby')).toBe(trigger.id);
    expect(items().map((i) => i.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('ArrowDown/ArrowUp move with wrap, Home/End jump, and the roving tabindex follows', async () => {
    const { menu, items } = await menuUp();
    key('ArrowDown', document.activeElement!);
    expect(document.activeElement?.textContent).toBe('Bravo');
    expect(items().map((i) => i.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
    key('ArrowDown', document.activeElement!);
    key('ArrowDown', document.activeElement!);
    expect(document.activeElement?.textContent).toBe('Alpha');       // wrapped
    key('ArrowUp', document.activeElement!);
    expect(document.activeElement?.textContent).toBe('Charlie');     // wrapped back
    key('Home', document.activeElement!);
    expect(document.activeElement?.textContent).toBe('Alpha');
    key('End', document.activeElement!);
    expect(document.activeElement?.textContent).toBe('Charlie');
    expect(menu.style.display).toBe('flex');
  });

  it('Escape closes the menu and returns focus to the trigger; ArrowDown on the trigger opens it', async () => {
    const { trigger, menu } = await menuUp();
    key('Escape', document.activeElement!);
    expect(menu.style.display).toBe('none');
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    key('ArrowDown', trigger);
    await tick();
    expect(menu.style.display).toBe('flex');
    expect(document.activeElement?.textContent).toBe('Alpha');
  });

  it('Enter/Space activate natively (click): the item runs and the menu closes; Tab leaves and closes', async () => {
    let ran = '';
    const t = up(Toolbar, { title: 'T', actions: actions.map((a) => ({ ...a, onSelect: () => { ran = a.id; } })) }, { width: 200, text: textMeasurer(8) });
    const trigger = t.el.querySelector<HTMLElement>('[aria-label="More actions"]')!;
    const menu = t.el.querySelector<HTMLElement>('[role=menu]')!;
    trigger.click(); flushEffects(); await tick();
    (document.activeElement as HTMLElement).click(); flushEffects();
    expect(ran).toBe('a');
    expect(menu.style.display).toBe('none');
    trigger.click(); flushEffects(); await tick();
    key('Tab', document.activeElement!);
    expect(menu.style.display).toBe('none');
  });

  it('the menu is a fixed layer placed by the engine, not an absolute offset', async () => {
    const { menu } = await menuUp();
    expect(menu.style.position).toBe('fixed');
    expect(menu.style.right).toBe('');
    expect(menu.style.top).toBe(`${metrics.space[1]}px`);       // happy-dom rects are 0: below the anchor by the gap
  });
});

describe('overlay — review round: sibling modals, hidden controls, scroll, focus fallback', () => {
  it('a second modal that is a DOM sibling of an open modal is not inert itself, and gets focus', async () => {
    const a = signal(false), b = signal(false);
    up(Dialog, dialog('A', a, html`<button id="A-btn">a</button>`));
    const tb = up(Dialog, dialog('B', b, html`<button id="B-btn">b</button>`));
    a.value = true; flushEffects();
    await tick();
    expect(tb.el.closest('[inert]')).not.toBeNull();                // B closed: behind A
    b.value = true; flushEffects();
    await tick();
    expect(tb.el.closest('[inert]')).toBeNull();
    expect(document.activeElement?.id).toBe('B-btn');
    expect(document.querySelector('#A-btn')!.closest('[inert]')).not.toBeNull();   // A is behind B now
    b.value = false; flushEffects();
    expect(tb.el.closest('[inert]')).not.toBeNull();                // A still open: B's subtree is inert again
    expect(document.querySelector('#A-btn')!.closest('[inert]')).toBeNull();
    a.value = false; flushEffects();
    expect(document.querySelector('[inert]')).toBeNull();
  });

  it('the trap and the initial focus skip hidden and disabled controls', async () => {
    const open = signal(true);
    const t = up(Dialog, dialog('D', open, html`<button id="dis" disabled>x</button><input id="gone" style="display:none" /><input id="first" /><span style="display:none"><button id="deep">hidden</button></span><button id="last">b</button>`));
    await tick();
    expect(document.activeElement?.id).toBe('first');
    t.el.querySelector<HTMLElement>('#last')!.focus();
    key('Tab', document.activeElement!);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close');   // wrapped past the hidden button
    key('Tab', document.activeElement!, { shiftKey: true });
    expect(document.activeElement?.id).toBe('last');
  });

  it('a Toolbar inside a Dialog: Tab from the last visible control wraps, ignoring overflowed buttons and the closed menu', async () => {
    const open = signal(true);
    const t = up(Dialog, dialog('D', open, [Toolbar({ title: 'T', actions: [{ id: 'a', label: 'Alpha', priority: 'tertiary' }, { id: 'b', label: 'Bravo', priority: 'primary' }] })]), { width: 160, viewport: 800, text: textMeasurer(8) });
    await tick();
    const trigger = t.el.querySelector<HTMLElement>('[aria-label="More actions"]')!;
    expect(t.el.querySelector<HTMLElement>('[data-nisli-action="a"]')!.style.display).toBe('none');
    trigger.focus();
    key('Tab', trigger);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Close');
  });

  it('an anchored menu is re-placed on scroll (capture, any scroller) and on resize', async () => {
    const t = up(Toolbar, { title: 'T', actions: [{ id: 'a', label: 'Alpha', priority: 'tertiary' }, { id: 'b', label: 'Bravo', priority: 'primary' }] }, { width: 160, text: textMeasurer(8) });
    const trigger = t.el.querySelector<HTMLElement>('[aria-label="More actions"]')!;
    const menu = t.el.querySelector<HTMLElement>('[role=menu]')!;
    let top = 40;
    trigger.getBoundingClientRect = () => ({ top, left: 10, width: 32, height: 32, right: 42, bottom: top + 32, x: 10, y: top, toJSON: () => ({}) });
    trigger.click(); flushEffects(); await tick(); flushEffects();
    expect(menu.style.top).toBe(`${40 + 32 + metrics.space[1]}px`);
    top = 10;
    document.dispatchEvent(new Event('scroll')); flushEffects();
    expect(menu.style.top).toBe(`${10 + 32 + metrics.space[1]}px`);
    key('Escape');
    top = 90;
    document.dispatchEvent(new Event('scroll')); flushEffects();
    expect(menu.style.display).toBe('none');                        // closed: the listener is gone, nothing re-measured
  });

  it('the menu is unseen until placed, and is placed from its fallback size when its rect is 0 (never past the right edge)', async () => {
    const t = up(Toolbar, { title: 'T', actions: [{ id: 'a', label: 'Alpha', priority: 'tertiary' }, { id: 'b', label: 'Bravo', priority: 'primary' }] }, { width: 160, text: textMeasurer(8) });
    const trigger = t.el.querySelector<HTMLElement>('[aria-label="More actions"]')!;
    const menu = t.el.querySelector<HTMLElement>('[role=menu]')!;
    expect(menu.style.visibility).toBe('hidden');
    trigger.getBoundingClientRect = () => ({ top: 0, left: 300, width: 32, height: 32, right: 332, bottom: 32, x: 300, y: 0, toJSON: () => ({}) });
    trigger.click(); flushEffects(); await tick(); flushEffects();
    expect(menu.style.visibility).toBe('visible');
    expect(parseFloat(menu.style.left)).toBe(332 - metrics.layout.menuWidth);   // trailing-aligned by the fallback width
  });

  it('scroll lock is one ref-counted writer: a lockScroll holder releasing never drops an open modal\'s lock', () => {
    const held = signal(true);
    const Holder = block<{ label: string }>('nisli-overlay-holder', { render: (props) => { lockScroll(held); return [el('i', {}, props.label)]; } });
    const h = up(Holder, { label: 'x' });
    expect(document.body.style.overflow).toBe('hidden');
    const open = signal(true);
    up(Dialog, dialog('D', open));
    held.value = false; flushEffects();
    expect(document.body.style.overflow).toBe('hidden');
    h.unmount(); mounted.splice(mounted.indexOf(h), 1);
    expect(document.body.style.overflow).toBe('hidden');
    open.value = false; flushEffects();
    expect(document.body.style.overflow).toBe('');
  });

  it('focus restore when the opener is gone: the nearest main landmark, not the top of the document', async () => {
    const main = document.createElement('main'); document.body.appendChild(main);
    const opener = document.createElement('button'); main.appendChild(opener); opener.focus();
    const open = signal(true);
    const frame = document.createElement('div'); main.appendChild(frame);
    const tpl = el('div', {}, [Dialog({ title: 'D', open, onClose: () => { open.value = false; }, children: html`<button>ok</button>` })]); tpl.mount(frame); flushEffects();
    await tick();
    opener.remove();
    open.value = false; flushEffects();
    expect(document.activeElement).toBe(main);
    expect(main.getAttribute('tabindex')).toBe('-1');
    tpl.dispose();
  });

  it('ArrowUp on the trigger opens with focus on the last item; Tab from an item leaves forwards past the trigger', async () => {
    const after = document.createElement('button'); after.id = 'after';
    // available 168: T 8 + Primary 88 + trigger 32 + gaps fit; Alpha and Bravo overflow
    const t = up(Toolbar, { title: 'T', actions: [{ id: 'a', label: 'Alpha', priority: 'tertiary' }, { id: 'b', label: 'Bravo', priority: 'tertiary' }, { id: 'p', label: 'Primary', priority: 'primary' }] }, { width: 200, text: textMeasurer(8) });
    document.body.appendChild(after);
    const trigger = t.el.querySelector<HTMLElement>('[aria-label="More actions"]')!;
    const menu = t.el.querySelector<HTMLElement>('[role=menu]')!;
    trigger.focus();
    key('ArrowUp', trigger); await tick();
    expect(document.activeElement?.textContent).toBe('Bravo');
    key('Tab', document.activeElement!);
    await tick(); flushEffects();
    expect(menu.style.display).toBe('none');
    expect(document.activeElement?.id).toBe('after');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    key('ArrowDown', trigger); await tick();
    expect(document.activeElement?.textContent).toBe('Alpha');
    key('Tab', document.activeElement!, { shiftKey: true });
    await tick(); flushEffects();
    expect(document.activeElement).toBe(t.el.querySelector('[data-nisli-action="p"]'));
  });
});

describe('overlay — confirm() and notify() as layers', () => {
  it('confirm() over a Dialog stacks above it: a second modal layer with a higher z; Escape answers it alone; focus returns to the invoker', async () => {
    const open = signal(true);
    const t = up(Dialog, dialog('Outer', open, html`<button id="del">Delete</button>`));
    await tick();
    const del = t.el.querySelector<HTMLElement>('#del')!;
    del.focus();
    const p = confirm({ title: 'Sure?', message: 'm' }); flushEffects();
    await tick();
    expect(__layers.value.map((l) => l.kind)).toEqual(['modal', 'modal']);
    const dialogs = [...document.querySelectorAll<HTMLElement>('[role=presentation]')];
    expect(dialogs.length).toBe(2);
    expect(Number(dialogs[1]!.style.zIndex)).toBeGreaterThan(Number(dialogs[0]!.style.zIndex));
    expect(Number(dialogs[0]!.style.zIndex)).toBe(metrics.layer.modal);
    expect(del.closest('[inert]')).not.toBeNull();
    expect(document.activeElement?.textContent).toBe('Cancel');
    key('Escape');
    expect(await p).toBe(false);
    expect(open.value).toBe(true);
    expect(__layers.value.map((l) => l.kind)).toEqual(['modal']);
    expect(document.activeElement).toBe(del);
    expect(del.closest('[inert]')).toBeNull();
  });

  it('notify() is a passive layer: top of the z-order, never focused, never inert; a click dismisses the notice and not the dialog under it', async () => {
    const open = signal(true);
    const t = up(Dialog, dialog('D', open, html`<input id="first" />`));
    await tick();
    expect(document.activeElement?.id).toBe('first');
    notify('Saved', 'positive'); flushEffects();
    await tick();
    const region = document.querySelector<HTMLElement>('[role=status][aria-live=polite]')!;
    expect(__layers.value.map((l) => l.kind)).toEqual(['modal', 'passive']);
    expect(document.activeElement?.id).toBe('first');
    expect(region.closest('[inert]')).toBeNull();
    expect(Number(region.style.zIndex)).toBeGreaterThan(Number(t.styleOf('[role=presentation]').zIndex));
    expect(region.style.zIndex).toBe(String(metrics.layer.passive + 1));
    const notice = region.querySelector<HTMLElement>('each-item > div')!;
    pointer(notice);
    expect(open.value).toBe(true);                                  // a pointer on the notice is not outside the dialog
    notice.click(); flushEffects();
    expect(__notices.value.length).toBe(0);
    expect(__layers.value.map((l) => l.kind)).toEqual(['modal']);
    expect(open.value).toBe(true);
    expect(document.activeElement?.id).toBe('first');               // the passive layer moved no focus, coming or going
    notify('Again'); flushEffects();
    key('Escape');
    expect(open.value).toBe(false);                                 // a notice on top does not swallow the dialog's Escape
    expect(__notices.value.length).toBe(1);
  });

  it('a notice that arrives while a modal is open is clickable (not inert) and the region goes inert again only when empty and a modal is open', async () => {
    notify('Early'); flushEffects();
    const region = document.querySelector<HTMLElement>('[role=status][aria-live=polite]')!;
    __notices.value = []; flushEffects();
    const open = signal(true);
    up(Dialog, dialog('D', open));
    expect(region.closest('[inert]')).not.toBeNull();               // empty region behind the modal
    notify('Late', 'negative'); flushEffects();
    expect(region.closest('[inert]')).toBeNull();
    __notices.value = []; flushEffects();
    expect(region.closest('[inert]')).not.toBeNull();
  });
});
