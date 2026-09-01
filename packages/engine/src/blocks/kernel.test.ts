/**
 * The kernel's behaviours, each proven on a throwaway block: measure, surface,
 * status shapes, part(), hostParts, fitRow's report, lockScroll, resize — and
 * the rule that no block styles by hand.
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { el, html, signal, computed, flushEffects } from '@nisli/core';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { block, lockScroll } from './kernel.js';
import { Section } from './section.js';
import { onReport, type LayoutReport } from '../engine/report.js';
import { setDensity, setInput } from '../engine/axes.js';
import { mount, type Mounted } from '../test/mount.js';

const mounted: Mounted[] = [];
const up = (...args: Parameters<typeof mount>) => { const m = mount(...args); mounted.push(m); return m; };
afterEach(() => { while (mounted.length) mounted.pop()!.unmount(); document.body.innerHTML = ''; setDensity('system'); setInput('system'); });

const Probe = block<{ label: string }>('nisli-kernel-probe', {
  measure: 'width',
  host: (ctx) => ({ display: 'block', width: ctx.width.value }),
  hostParts: 'card',
  render: (props, ctx) => [el('span', { style: ctx.part('text.muted', () => ({ minWidth: ctx.width.value / 2 })) }, props.label)],
});
const Floating = block<{ label: string }>('nisli-kernel-floating', { measure: 'viewport', render: (props, ctx) => [el('i', { style: ctx.part('text', () => ({ width: ctx.width.value })) }, props.label)] });
const Plain = block<{ label: string }>('nisli-kernel-plain', { render: (props, ctx) => [el('i', { style: ctx.part('text', { width: ctx.width.value }) }, props.label)] });
const Statish = block<{ value: string; status?: unknown }>('nisli-kernel-statish', {
  status: { skeleton: (ctx) => ctx.skeleton([ctx.bone(ctx.metrics.control.height, ctx.props.value.value)]) },
  render: (props, ctx) => [ctx.failure, ctx.waiting(() => el('b', { id: 'v' }, props.value))],
});
const InPlace = block<{ value: string; status?: unknown }>('nisli-kernel-inplace', {
  status: true,
  render: (props, ctx) => [el('b', { id: 'v', style: ctx.part([], () => ({ display: ctx.pending.value ? 'none' : 'block' })) }, props.value)],
});
const Counted = block<{ items: readonly string[] }>('nisli-kernel-counted', {
  measure: 'width',
  host: (ctx) => ({ display: 'grid', gridTemplateColumns: `repeat(${Math.min(ctx.props.items.value.length, Math.floor(ctx.width.value / 100))}, 1fr)` }),
  render: (props) => [el('i', {}, computed(() => props.items.value.join(',')))],
});
const Standard = block<{ value: string; status?: unknown }>('nisli-kernel-standard', {
  status: true,
  render: (props, ctx) => [ctx.waiting(() => el('b', { id: 'v' }, props.value))],
});
const busy = signal(false);
const Busyish = block<{ label: string }>('nisli-kernel-busyish', {
  hostParts: () => (busy.value ? ['button', 'button.busy'] : ['button']),
  render: (props, ctx) => [el('i', { style: ctx.part(() => (busy.value ? 'button.busy' : []), { display: 'inline' }) }, props.label)],
});
const locked = signal(false);
const Locking = block<{ label: string }>('nisli-kernel-locking', { render: (props) => { lockScroll(locked); return [el('i', {}, props.label)]; } });
const Row = block<{ items: readonly string[] }>('nisli-kernel-row', {
  render: (props, ctx) => {
    ctx.fitRow({ gap: 0, available: () => 100, items: () => props.items.value.map((id) => ({ id, width: 80, priority: 20 })), report: { code: 'FIT_ROW', detail: (p) => `slack ${p.slack}` } });
    return [];
  },
});
const Gapped = block<{ items: readonly string[] }>('nisli-kernel-gapped', {
  render: (props, ctx) => {
    ctx.fitRow({ gap: () => ctx.metrics.space[2], available: () => 100, items: () => props.items.value.map((id) => ({ id, width: 80, priority: 20 })), report: { code: 'FIT_ROW', detail: (p) => `slack ${p.slack}` } });
    return [];
  },
});
const Sized = block<{ label: string }>('nisli-kernel-sized', {
  host: (ctx) => ({ display: 'block', height: ctx.metrics.control.height }),
  render: (props, ctx) => [el('span', { style: ctx.part('text', () => ({ minHeight: ctx.metrics.control.hit, padding: `0 ${ctx.metrics.control.padX}px` })) }, props.label)],
});

describe('block kernel', () => {
  it('measure: width is the host size, viewport the document size, 0 when not measured', () => {
    expect(up(Probe, { label: 'x' }, { width: 640 }).styleOf('span').minWidth).toBe('320px');
    expect(up(Floating, { label: 'x' }, { width: 640, viewport: 360 }).styleOf('i').width).toBe('360px');
    expect(up(Plain, { label: 'x' }, { width: 640 }).styleOf('i').width).toBe('0px');
  });

  it('host: structure is reactive to width; hostParts dress it only when a skin is installed', () => {
    const bare = up(Probe, { label: 'x' }, { width: 500 });
    expect(bare.styleOf().width).toBe('500px');
    expect(bare.styleOf().background).toBe('');
    const skinned = up(Probe, { label: 'x' }, { width: 500, scheme: 'dark' });
    expect(skinned.styleOf().background).not.toBe('');
  });

  it('surface: a Section inside a Section is nested (no padding, card.nested); a Section alone is a card', () => {
    const outer = up(Section, { title: 'O', children: [Section({ title: 'I', children: html`<i id="i"></i>` })] }, { width: 800 });
    const inner = outer.el.querySelector<HTMLElement>('nisli-section')!;
    expect(outer.styleOf().padding).toBe('16px');
    expect(inner.style.padding).toBe('0px');
  });

  it('status shapes: `true` waits with the block skeleton, an object with its own; failure shows with Retry', () => {
    let retried = 0;
    const standard = up(Standard, { value: 'v', status: { loading: signal(true), error: signal(null) } }, {});
    expect(standard.el.querySelectorAll('[role=status] div').length).toBe(3);
    const pending = up(Statish, { value: 'v', status: { loading: signal(true), error: signal(null) } }, {});
    expect(pending.el.querySelectorAll('[role=status] div').length).toBe(1);
    expect(pending.el.querySelector('#v')).toBeNull();
    const failed = up(Statish, { value: 'v', status: { loading: signal(false), error: signal(new Error('no')), refetch: () => retried++ } }, {});
    expect(failed.el.querySelector('#v')).not.toBeNull();
    (failed.el.querySelector('[role=alert] button') as HTMLButtonElement).click();
    expect(retried).toBe(1);
  });

  it('status: a skeleton decides over ctx (metrics, props); pending is a flag for a block that waits in place', () => {
    const loading = signal(true);
    const t = up(Statish, { value: '60%', status: { loading, error: signal(null) } }, {});
    expect(t.styleOf('[role=status] div').width).toBe('60%');
    expect(t.styleOf('[role=status] div').height).toBe('32px');
    const p = up(InPlace, { value: 'v', status: { loading, error: signal(null) } }, {});
    expect(p.styleOf('#v').display).toBe('none');
    loading.value = false; flushEffects();
    expect(p.styleOf('#v').display).toBe('block');
    expect(t.el.querySelector('#v')).not.toBeNull();
  });

  it('host: decides over props as well as width, and re-decides when either moves — resize() is the frame changing', () => {
    const items = signal(['a', 'b', 'c']);
    const t = up(Counted, { items }, { width: 250 });
    expect(t.styleOf().gridTemplateColumns).toBe('repeat(2, 1fr)');
    items.value = ['a']; flushEffects();
    expect(t.styleOf().gridTemplateColumns).toBe('repeat(1, 1fr)');
    items.value = ['a', 'b', 'c', 'd']; flushEffects();
    t.resize(1000);
    expect(t.styleOf().gridTemplateColumns).toBe('repeat(4, 1fr)');
    expect(up(Floating, { label: 'x' }, { width: 640, viewport: 360 }).styleOf('i').width).toBe('360px');
    const f = up(Floating, { label: 'x' }, { width: 640, viewport: 360 });
    f.resize(640, 1200);
    expect(f.styleOf('i').width).toBe('1200px');
  });

  it('status: a slot cuts on its own boolean — flipping `loading` with data present keeps the child element', () => {
    const loading = signal(false);
    const t = up(Standard, { value: 'v', status: { loading, error: signal(null), data: signal([1]) } }, {});
    const before = t.el.querySelector('#v');
    expect(before).not.toBeNull();
    loading.value = true; flushEffects();
    expect(t.el.querySelector('#v')).toBe(before);
    loading.value = false; flushEffects();
    expect(t.el.querySelector('#v')).toBe(before);
  });

  it('status: a block with no status shape cannot place a status slot (setup fails, N401)', () => {
    const Wrong = block<{ label: string }>('nisli-kernel-wrong', { render: (_p, ctx) => [ctx.failure] });
    expect(up(Wrong, { label: 'x' }, {}).el.hasAttribute('data-nisli-error')).toBe(true);
  });

  it('part(): structure then look, live with the skin; parts may be a thunk', () => {
    const tone = signal<'tone.positive' | 'tone.negative'>('tone.positive');
    const Toned = block<{ label: string }>('nisli-kernel-toned', { render: (props, ctx) => [el('em', { style: ctx.part(() => tone.value, { display: 'inline' }) }, props.label)] });
    const t = up(Toned, { label: 'x' }, { scheme: 'light' });
    const before = t.styleOf('em').color;
    expect(t.styleOf('em').display).toBe('inline');
    expect(before).not.toBe('');
    tone.value = 'tone.negative'; flushEffects();
    expect(t.styleOf('em').color).not.toBe(before);
  });

  it('host: the effect replaces — a hostParts thunk toggling button.busy off clears opacity', () => {
    busy.value = false;
    const t = up(Busyish, { label: 'x' }, { scheme: 'dark' });
    expect(t.styleOf().opacity).toBe('');
    busy.value = true; flushEffects();
    expect(t.styleOf().opacity).not.toBe('');
    busy.value = false; flushEffects();
    expect(t.styleOf().opacity).toBe('');
    expect(t.styleOf().borderRadius).not.toBe('');   // the part that stayed is untouched
  });

  it('part(): a parts thunk returning [] switches the look off — the property is cleared on the element', () => {
    busy.value = false;
    const t = up(Busyish, { label: 'x' }, { scheme: 'dark' });
    expect(t.styleOf('i').opacity).toBe('');
    busy.value = true; flushEffects();
    expect(t.styleOf('i').opacity).not.toBe('');
    busy.value = false; flushEffects();
    expect(t.styleOf('i').opacity).toBe('');
    expect(t.styleOf('i').display).toBe('inline');
  });

  it('lockScroll: body overflow follows `open` and is cleared on dispose', async () => {
    locked.value = false;
    const t = up(Locking, { label: 'x' }, {});
    expect(document.body.style.overflow).toBe('');
    locked.value = true; flushEffects();
    expect(document.body.style.overflow).toBe('hidden');
    locked.value = false; flushEffects();
    expect(document.body.style.overflow).toBe('');
    locked.value = true; flushEffects();
    expect(document.body.style.overflow).toBe('hidden');
    t.unmount(); mounted.pop();
    await new Promise<void>((r) => queueMicrotask(r));   // the element's cleanup runs a microtask after removal
    expect(document.body.style.overflow).toBe('');
    locked.value = false; flushEffects();
  });

  it('fitRow: an unsatisfiable plan is reported once per solve through reportIf, with the block tag', () => {
    const reports: LayoutReport[] = [];
    const stop = onReport((r) => reports.push(r));
    up(Row, { items: ['a', 'b'] }, {});
    stop();
    expect(reports).toEqual([{ code: 'FIT_ROW', block: 'nisli-kernel-row', width: 100, deficit: 60, detail: 'slack -60' }]);
  });

  it('axes: a live setInput(touch) re-applies host and every part() thunk; setDensity moves the rhythm (ADR 0046)', () => {
    const t = up(Sized, { label: 'x' }, {});
    expect(t.styleOf().height).toBe('32px');
    expect(t.styleOf('span').minHeight).toBe('24px');
    setInput('touch'); flushEffects();
    expect(t.styleOf().height).toBe('44px');
    expect(t.styleOf('span').minHeight).toBe('44px');
    expect(t.styleOf('span').padding).toBe('0px 12px');
    setDensity('compact'); flushEffects();
    expect(t.styleOf().height).toBe('44px');
    expect(t.styleOf('span').padding).toBe('0px 8px');
  });

  it('fitRow: re-solves on a sizing change with no block deps, and a gap thunk is resolved per solve (ADR 0046 §4)', async () => {
    const reports: LayoutReport[] = [];
    const stop = onReport((r) => reports.push(r));
    up(Gapped, { items: ['a', 'b'] }, {});
    expect(reports.map((r) => r.deficit)).toEqual([68]);   // 2 × 80 + gap 8, in 100
    setDensity('compact'); flushEffects();
    await new Promise<void>((r) => queueMicrotask(r));      // the deps effect queues the solve after the flush
    expect(reports.map((r) => r.deficit)).toEqual([68, 66]); // gap 6 now
    stop();
  });

  // The scan rules: no file under blocks/ other than the kernel itself may
  //   1. import apply, css or look from ../style.js or ../skin.js  (styling around ctx.part)
  //   2. write element.style / element.style[...]                  (an imperative style write)
  //   3. carry a string style literal  style: '…'                   (a style outside ctx.part)
  //   4. import metrics from ../metrics.js                          (structure comes from ctx.metrics)
  //   5. wrap its own root in display:contents                     (the kernel's root is the only one)
  //   6. add a document listener                                    (the overlay manager owns the document)
  //   7. carry a z-index literal                                    (z comes from ctx.metrics.layer or overlay.z)
  const RULES: readonly RegExp[] = [
    /import \{[^}]*\b(apply|css|look)\b[^}]*\} from '\.\.\/(style|skin)\.js'/,
    /\.style\s*[.\[]/,
    /style:\s*['"`]/,
    /import \{[^}]*\bmetrics\b[^}]*\} from '\.\.\/metrics\.js'/,
    /display:\s*contents/,
    /document\.addEventListener/,
    /zIndex:\s*-?\d/,
  ];
  // Every block is on the kernel; the files that are not blocks hold intent, state, or a helper on ctx (actions.ts renders every Action).
  const NOT_BLOCKS = new Set(['kernel.ts', 'status.ts', 'surface.ts', 'types.ts', 'actions.ts']);
  it('no block styles by hand: every block file is on the kernel, and none has a style writer, element.style, string style, module metrics, its own root, a document listener or a z-index literal', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(here)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'kernel.ts')
      .map((f) => [f, readFileSync(join(here, f), 'utf8')] as const);
    const offKernel = files.filter(([f, src]) => !NOT_BLOCKS.has(f) && !/from '\.\/kernel\.js'/.test(src)).map(([f]) => f);
    expect(offKernel).toEqual([]);
    const offenders = files.flatMap(([f, src]) => RULES.filter((r) => r.test(src)).map((r) => `${f}: ${r.source}`));
    expect(offenders).toEqual([]);
  });

  // ADR 0046 §4, "rule 5": under blocks/, the second argument of every `ctx.part(`
  // call, when present, is a thunk — an object literal, a `buttonBox()` call or a
  // bound identifier freezes the table of that moment. Uniform, so no allow-list.
  /** Every `ctx.part(` call in `src`: the line it starts on and the text of its second argument (null when absent). */
  const partCalls = (src: string): { line: number; second: string | null }[] => {
    const calls: { line: number; second: string | null }[] = [];
    const open = /ctx\.part\(/g;
    let m: RegExpExecArray | null;
    while ((m = open.exec(src))) {
      let i = m.index + m[0].length, depth = 0, quote: string | null = null, comma = -1;
      for (; i < src.length; i++) {
        const c = src[i]!;
        if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
        if (c === "'" || c === '"' || c === '`') quote = c;
        else if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') { if (depth === 0) break; depth--; }
        else if (c === ',' && depth === 0 && comma < 0) comma = i;
      }
      calls.push({ line: src.slice(0, m.index).split('\n').length, second: comma < 0 ? null : src.slice(comma + 1, i).trim() });
    }
    return calls;
  };
  it('every ctx.part() structure under blocks/ is a thunk (ADR 0046 rule 5)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(here)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'kernel.ts')
      .map((f) => [f, readFileSync(join(here, f), 'utf8')] as const);
    const offenders = files.flatMap(([f, src]) => partCalls(src).filter((c) => c.second !== null && !c.second.startsWith('() =>')).map((c) => `${f}:${c.line}: ${c.second!.split('\n')[0]}`));
    expect(offenders).toEqual([]);
  });

  // ADR 0043 acceptance 5: every Action is one renderer. `button.danger` is said nowhere but actions.ts;
  // `button.primary` only there and in Form's segmented option (a chosen option, not an action).
  it('every Action row is one renderer: no block says button.danger, and only the segmented option says button.primary', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(here)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'actions.ts')
      .map((f) => [f, readFileSync(join(here, f), 'utf8')] as const);
    expect(files.filter(([, src]) => /button\.danger/.test(src)).map(([f]) => f)).toEqual([]);
    expect(files.filter(([, src]) => /button\.primary/.test(src)).map(([f]) => f)).toEqual(['form.ts']);
  });
});
