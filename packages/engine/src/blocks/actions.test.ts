/**
 * ADR 0043 — the vocabulary contract, where it is behaviour: one `Action`
 * honoured identically by every host; a `Text` role that reaches AT; a
 * Table's empty state as the Empty block; a boolean field with one label.
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { flushEffects, html, signal } from '@nisli/core';
import { look } from '../skin.js';
import { mount, textMeasurer, type Mounted } from '../test/mount.js';
import { Toolbar } from './toolbar.js';
import { Empty } from './empty.js';
import { Dialog } from './dialog.js';
import { Form } from './form.js';
import { Text } from './text.js';
import { confirm } from './confirm.js';
import { variantOf } from './actions.js';
import type { Action } from './types.js';
import { Table } from './table.js';

const mounted: Mounted[] = [];
const up = (...args: Parameters<typeof mount>) => { const m = mount(...args); mounted.push(m); return m; };
afterEach(() => { while (mounted.length) mounted.pop()!.unmount(); document.body.innerHTML = ''; });

const buttons = (root: ParentNode) => [...root.querySelectorAll<HTMLButtonElement>('button')];
const byText = (root: ParentNode, text: string) => buttons(root).find((b) => b.textContent === text)!;
const bg = (b: HTMLElement) => b.style.background;
const actions: Action[] = [
  { id: 'p', label: 'Primary', priority: 'primary' },
  { id: 's', label: 'Secondary' },
  { id: 'd', label: 'Danger', destructive: true, priority: 'primary' },
];

describe('one Action, one rule, one renderer', () => {
  it('variantOf: destructive wins, a primary is filled, everything else is plain — per action, never counted', () => {
    expect(actions.map(variantOf)).toEqual(['primary', 'plain', 'danger']);
    expect(variantOf({ priority: 'tertiary' })).toBe('plain');
    const two: Action[] = [{ id: 'a', label: 'A', priority: 'primary' }, { id: 'b', label: 'B', priority: 'primary' }];
    expect(two.map(variantOf)).toEqual(['primary', 'primary']);
  });

  it('Toolbar, Empty, Form and Dialog dress the same action the same way', () => {
    const hosts = {
      toolbar: up(Toolbar, { title: 'T', actions }, { width: 1200, scheme: 'light' }),
      empty: up(Empty, { title: 'Nothing', actions }, { width: 800, scheme: 'light' }),
      form: up('nisli-form', { fields: [], owned: true, initial: {}, onSubmit: () => {}, actions }, { width: 800, scheme: 'light' }),
      dialog: up(Dialog, { title: 'D', open: true, onClose: () => {}, children: html`<i></i>`, actions }, { width: 800, scheme: 'light' }),
    };
    for (const [, host] of Object.entries(hosts)) {
      expect(bg(byText(host.el, 'Primary'))).toBe(String(look('button.primary').background));
      expect(bg(byText(host.el, 'Secondary'))).toBe(String(look('button.plain').background));
      expect(byText(host.el, 'Danger').style.borderColor || byText(host.el, 'Danger').style.border).toContain(String(look('button.danger').color));
    }
    // Empty no longer assumes its action is primary; Form's submit is the row's primary.
    expect(bg(byText(hosts.form.el, 'Save'))).toBe(String(look('button.primary').background));
  });

  it('a footer (Form, Dialog) places a destructive action first and apart; Empty centres; a Dialog row sits after its content and wraps', () => {
    const form = up('nisli-form', { fields: [], owned: true, initial: {}, onSubmit: () => {}, onCancel: () => {}, actions }, { width: 800, scheme: 'light' });
    expect(buttons(form.el).map((b) => b.textContent)).toEqual(['Danger', 'Primary', 'Secondary', 'Cancel', 'Save']);
    expect(byText(form.el, 'Danger').style.marginRight).toBe('auto');
    expect(byText(form.el, 'Primary').style.marginRight).toBe('');
    const dialog = up(Dialog, { title: 'D', open: true, onClose: () => {}, children: html`<i id="body"></i>`, actions }, { width: 800 });
    const row = byText(dialog.el, 'Danger').closest('div')!;
    expect(row.previousElementSibling!.id).toBe('body');
    expect(row.style.flexWrap).toBe('wrap');
    expect(byText(dialog.el, 'Danger').style.marginRight).toBe('auto');
    const empty = up(Empty, { title: 'Nothing', actions: [{ id: 'a', label: 'Add' }] }, { width: 800 });
    expect(byText(empty.el, 'Add').closest('div')!.style.justifyContent).toBe('center');
    expect(up(Empty, { title: 'Nothing' }, { width: 800 }).el.querySelector<HTMLElement>('div > div:last-child')!.style.display).toBe('none');
  });

  it('busy: a promise-returning action is busy under its id in every host, and Form actions run through the same path', async () => {
    let resolve!: () => void;
    const p = new Promise<void>((r) => { resolve = r; });
    const empty = up(Empty, { title: 'N', actions: [{ id: 'sync', label: 'Sync', onSelect: () => p }] }, { width: 800 });
    const form = up('nisli-form', { fields: [], owned: true, initial: {}, onSubmit: () => {}, actions: [{ id: 'sync', label: 'Sync', onSelect: () => p }] }, { width: 800 });
    for (const host of [empty, form]) {
      byText(host.el, 'Sync').click(); flushEffects();
      expect(byText(host.el, 'Sync').getAttribute('aria-busy')).toBe('true');
    }
    resolve(); await p; await new Promise((r) => setTimeout(r, 0)); flushEffects();
    for (const host of [empty, form]) expect(byText(host.el, 'Sync').hasAttribute('aria-busy')).toBe(false);
  });

  it('an action overflowed into the Toolbar menu keeps the same rule: a destructive item is danger, and busy under its id', async () => {
    let resolve!: () => void;
    const p = new Promise<void>((r) => { resolve = r; });
    const t = up(Toolbar, { title: 'Connections', actions: [
      { id: 'live', label: 'Start fresh', priority: 'tertiary', destructive: true, onSelect: () => p },
      { id: 'b', label: 'Bravo', priority: 'primary' },
    ] }, { width: 160, text: textMeasurer(8), scheme: 'light' });
    t.el.querySelector<HTMLElement>('[aria-label="More actions"]')!.click(); flushEffects();
    const item = t.el.querySelector<HTMLElement>('[role=menuitem]')!;
    expect(item.textContent).toBe('Start fresh');
    expect(item.style.color).toBe(String(look('menu.item.danger').color));
    item.click(); flushEffects();
    expect(item.getAttribute('aria-busy')).toBe('true');
    resolve(); await p; await new Promise((r) => setTimeout(r, 0)); flushEffects();
    expect(item.hasAttribute('aria-busy')).toBe(false);
  });

  it('confirm: the answer is the row’s primary — filled, or danger when destructive — and Cancel is plain', async () => {
    up(Text, { text: 'skin' }, { width: 100, scheme: 'light' });   // installs the skin the confirm dialog is dressed by
    const ask = (destructive: boolean) => { const p = confirm({ title: 'Q', text: 't', action: { label: 'Go', destructive } }); flushEffects(); return p; };
    const p1 = ask(false);
    let dlg = document.querySelector('[role=dialog]')!;
    expect(bg(byText(dlg, 'Go'))).toBe(String(look('button.primary').background));
    expect(bg(byText(dlg, 'Cancel'))).toBe(String(look('button.plain').background));
    byText(dlg, 'Cancel').click(); expect(await p1).toBe(false);
    await new Promise((r) => setTimeout(r, 5));
    const p2 = ask(true);
    dlg = document.querySelector('[role=dialog]')!;
    expect(byText(dlg, 'Go').style.color).toBe(String(look('button.danger').color));
    byText(dlg, 'Go').click(); expect(await p2).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
  });
});

describe('Text roles and the Table’s empty state', () => {
  it('note is WAI-ARIA note: role="note" and the muted look; body has no role; code is role="code"', () => {
    const note = up(Text, { text: 'aside', role: 'note' }, { width: 800, scheme: 'light' });
    expect(note.el.querySelector('span')!.getAttribute('role')).toBe('note');
    expect(note.styleOf('span').color).toBe(String(look('text.muted').color));
    expect(up(Text, { text: 'main' }, { width: 800 }).el.querySelector('span')!.hasAttribute('role')).toBe(false);
    expect(up(Text, { text: 'x' , role: 'code' }, { width: 800 }).el.querySelector('span')!.getAttribute('role')).toBe('code');
  });

  it('a Table with no rows renders the Empty block: a string is its title, EmptyProps pass through with their actions', () => {
    let ran = 0;
    const columns = [{ id: 'a', label: 'A', cell: (r: { a: string }) => r.a }];
    const plain = up('nisli-table', { columns, rows: [], rowKey: (r: { a: string }) => r.a, empty: 'Nothing yet.' }, { width: 800 });
    expect(plain.el.querySelector('nisli-empty')!.textContent).toContain('Nothing yet.');
    const rich = up('nisli-table', { columns, rows: [], rowKey: (r: { a: string }) => r.a, empty: { title: 'No rules', hint: 'Add one.', actions: [{ id: 'add', label: 'Add rule', onSelect: () => { ran++; } }] } }, { width: 800 });
    expect(rich.el.querySelector('nisli-empty')!.textContent).toContain('Add one.');
    byText(rich.el, 'Add rule').click(); expect(ran).toBe(1);
    const rows = signal<{ a: string }[]>([]);
    const live = up(Table as never, { columns, rows, rowKey: (r: { a: string }) => r.a }, { width: 800 });
    expect(live.el.querySelector('nisli-empty')!.textContent).toContain('Nothing here yet.');
    rows.value = [{ a: 'x' }]; flushEffects();
    expect(live.el.querySelector('nisli-empty')).toBeNull();
  });
});

describe('the words the compiler rejects', () => {
  it('old words are type errors: header, key on a field, select/textarea/checkbox kinds, muted/heading roles, Empty.action, Form.destructive, confirmLabel', () => {
    // @ts-expect-error header → label
    const c1: import('./table.js').Column<{ a: string }> = { id: 'a', header: 'A', cell: (r) => r.a };
    // @ts-expect-error key → name
    const f1: import('./form.js').Field<{ a: string }> = { key: 'a', label: 'A' };
    // @ts-expect-error 'select' is a widget, not a kind
    const f2: import('./form.js').Field<{ a: string }> = { name: 'a', label: 'A', kind: 'select' };
    // @ts-expect-error 'textarea' is a widget: say long: true
    const f3: import('./form.js').Field<{ a: string }> = { name: 'a', label: 'A', kind: 'textarea' };
    // @ts-expect-error 'checkbox' is a widget: say kind: 'boolean'
    const f4: import('./form.js').Field<{ a: boolean }> = { name: 'a', label: 'A', kind: 'checkbox' };
    // @ts-expect-error a file has no placeholder
    const f5: import('./form.js').Field<{ a: File }> = { name: 'a', label: 'A', kind: 'file', placeholder: 'x' };
    // @ts-expect-error 'muted' is a Part
    const t1: import('./text.js').TextProps = { text: 'x', role: 'muted' };
    // @ts-expect-error a heading is a container's title
    const t2: import('./text.js').TextProps = { text: 'x', role: 'heading' };
    // @ts-expect-error action → actions
    const e1: import('./empty.js').EmptyProps = { title: 'x', action: { id: 'a', label: 'A' } };
    // @ts-expect-error confirmLabel/message → action/text
    const c2: import('./confirm.js').ConfirmOptions = { title: 'x', message: 'm', confirmLabel: 'Yes' };
    // @ts-expect-error dir → order
    const s1: import('./table.js').Sort = { by: 'a', dir: 'asc' };
    void [c1, f1, f2, f3, f4, f5, t1, t2, e1, c2, s1];
    expect(true).toBe(true);
  });
});
