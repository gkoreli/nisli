/**
 * The engine owns waiting: blocks given an async result render pending,
 * failure and refresh themselves; actions that return a promise go busy.
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { flushEffects, html, signal } from '@nisli/core';
import { setMeasurer } from '../engine/measure.js';
import { mount, type Mounted } from '../test/mount.js';
import { __notices } from './notice.js';
import './section.js'; import './table.js'; import './stat.js'; import './page.js'; import './toolbar.js';

const mounted: Mounted[] = [];
beforeEach(() => { document.body.innerHTML = ''; setMeasurer(() => 800); __notices.value = []; });
afterEach(() => { while (mounted.length) mounted.pop()!.unmount(); setMeasurer(null); });

// Kernel blocks are mounted through the test kernel.
const KERNEL = new Set(['nisli-section', 'nisli-toolbar', 'nisli-stat', 'nisli-page']);
const make = (tag: string, props: Record<string, unknown>) => {
  if (KERNEL.has(tag)) { const m = mount(tag, props, { width: 800 }); mounted.push(m); return m.el; }
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) (el as any)._setProp(k, v);
  document.body.appendChild(el); flushEffects();
  return el;
};
const status = (o: { loading?: boolean; error?: Error | null; data?: unknown; retry?: () => void }) => ({
  loading: signal(o.loading ?? false),
  error: signal(o.error ?? null),
  data: signal(o.data),
  refetch: o.retry,
});

describe('Section with a status', () => {
  it('pending: a skeleton stands in for the children', () => {
    const el = make('nisli-section', { title: 'S', children: html`<b id="c">x</b>`, status: status({ loading: true }) });
    expect(el.querySelector('[role=status][aria-label=Loading]')).not.toBeNull();
    expect(el.querySelector('#c')).toBeNull();
  });
  it('failed: the message and a Retry that calls back; stale content stays', () => {
    let retried = 0;
    const el = make('nisli-section', { title: 'S', children: html`<b id="c">x</b>`, status: status({ error: new Error('Bank is down'), data: [1], retry: () => retried++ }) });
    expect(el.querySelector('[role=alert]')!.textContent).toContain('Bank is down');
    expect(el.querySelector('#c')).not.toBeNull();
    (el.querySelector('[role=alert] button') as HTMLButtonElement).click();
    expect(retried).toBe(1);
  });
  it('refreshing: content stays and the title says Updating…', () => {
    const el = make('nisli-section', { title: 'S', children: html`<b id="c">x</b>`, status: status({ loading: true, data: [1] }) });
    expect(el.querySelector('#c')).not.toBeNull();
    expect(el.querySelector('h3')!.textContent).toContain('Updating…');
    expect(el.querySelector('[aria-label=Loading]')).toBeNull();
  });
  it('no status: nothing extra', () => {
    const el = make('nisli-section', { title: 'S', children: html`<b id="c">x</b>` });
    expect(el.querySelector('[role=status],[role=alert]')).toBeNull();
    expect(el.querySelector('#c')).not.toBeNull();
  });
});

describe('Table, Stat, Page with a status', () => {
  it('Table pending: five skeleton rows under the real header, no data rows', () => {
    const el = make('nisli-table', { columns: [{ id: 'a', label: 'A', cell: () => 'a' }, { id: 'b', label: 'B', cell: () => 'b' }], rows: [{ id: 1 }], rowKey: (r: { id: number }) => String(r.id), status: status({ loading: true }) });
    expect(el.querySelectorAll('thead th').length).toBe(2);
    expect(el.querySelectorAll('tbody[role=status] tr').length).toBe(5);
    expect((el.querySelector('tbody:not([role])') as HTMLElement).style.display).toBe('none');
  });
  it('Stat pending: label stays, value is a bone', () => {
    const el = make('nisli-stat', { label: 'Balance', value: '$1', status: status({ loading: true }) });
    expect(el.textContent).toContain('Balance');
    expect(el.textContent).not.toContain('$1');
    expect(el.querySelector('[role=status]')).not.toBeNull();
  });
  it('Page pending / refreshing', () => {
    const el = make('nisli-page', { title: 'P', children: html`<b id="c">x</b>`, status: status({ loading: true }) });
    expect(el.querySelector('#c')).toBeNull();
    expect(el.querySelector('[role=status][aria-label=Loading]')).not.toBeNull();
    const r = make('nisli-page', { title: 'P', children: html`<b id="c">x</b>`, status: status({ loading: true, data: 1 }) });
    expect(r.querySelector('h2')!.textContent).toContain('Updating…');
  });
});

describe('async actions', () => {
  it('a promise-returning action is busy until it settles', async () => {
    let done!: () => void;
    const p = new Promise<void>((r) => { done = r; });
    const el = make('nisli-toolbar', { title: 'T', actions: [{ id: 'sync', label: 'Sync', onSelect: () => p }] });
    const btn = el.querySelector<HTMLButtonElement>('[data-nisli-action=sync]')!;
    btn.click(); flushEffects();
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('Sync');
    done(); await p; await Promise.resolve(); await Promise.resolve(); flushEffects();
    expect(btn.getAttribute('aria-busy')).toBeNull();
    expect(btn.disabled).toBe(false);
  });
  it('a rejection is told to the person and the action is released', async () => {
    const el = make('nisli-toolbar', { title: 'T', actions: [{ id: 'sync', label: 'Sync', onSelect: () => Promise.reject(new Error('Chase said no')) }] });
    const btn = el.querySelector<HTMLButtonElement>('[data-nisli-action=sync]')!;
    btn.click(); flushEffects();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); flushEffects();
    expect(__notices.value.map((n) => n.text)).toEqual(['Chase said no']);
    expect(btn.disabled).toBe(false);
  });
});
