import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { component, computed, flush, html, setDevMode, signal, untrack } from '../../../../../packages/core/src/index.ts';
import * as core from '../../../../../packages/core/src/index.ts';
import * as utils from '../../../../../packages/ui/registry/default/lib/utils.ts';
import { Progress } from '../../../../../packages/ui/registry/default/ui/progress.ts';
import { lower } from './lower.ts';

setDevMode(false);
afterEach(() => { document.body.replaceChildren(); setDevMode(null); });
const evaluate = (code: string, scope: Record<string, unknown>) => Function(...Object.keys(scope), `${code}; return result;`)(...Object.values(scope));
const primitives = { html, computed, signal, untrack };
const host = () => { const el = document.createElement('div'); document.body.append(el); return el; };

describe('opt-in lowering into existing Nisli primitives', () => {
  it('changes scalar snapshot syntax into a reactive leaf only when lowered', () => {
    const count = signal(1);
    const code = 'const result = html`<p>${count.value + 1}</p>`;';
    const raw = evaluate(code, { ...primitives, count });
    const compiled = evaluate(lower(code, ['count']), { ...primitives, count });
    const a = host(), b = host();
    try {
      raw.mount(a); compiled.mount(b);
      count.value = 5; flush();
      expect(a.textContent).toBe('2');
      expect(b.textContent).toBe('6');
    } finally { raw.dispose(); compiled.dispose(); }
  });

  it('matches the explicit computed reference and preserves input identity and edit value', () => {
    const code = 'const panel = computed(() => html`<section><input value="initial"><p>${label.value}</p></section>`); const result = html`${panel}`;';
    const manual = 'const panel = computed(() => html`<section><input value="initial"><p>${computed(() => label.value)}</p></section>`); const result = html`${panel}`;';
    const snapshots = [];
    for (const [name, source] of [['raw', code], ['lowered', lower(code, ['label'])], ['manual', manual]]) {
      const label = signal('before');
      const result = evaluate(source!, { ...primitives, label });
      const el = host();
      try {
        result.mount(el);
        const input = el.querySelector('input')!;
        input.value = 'unsaved edit';
        label.value = 'after'; flush();
        const same = el.querySelector('input') === input;
        snapshots.push({ name, same, value: el.querySelector('input')!.value, text: el.querySelector('p')!.textContent });
        expect(same).toBe(name !== 'raw');
        expect(el.querySelector('p')!.textContent).toBe('after');
        if (name !== 'raw') expect(el.querySelector('input')!.value).toBe('unsaved edit');
      } finally { result.dispose(); el.remove(); }
    }
    console.log(JSON.stringify({ experiment: 'leaf update under computed view', snapshots }));
  });

  it('does not invoke handlers early and keeps explicit snapshots unchanged', () => {
    const count = signal(1);
    const code = 'const result = html`<button @click=${() => { count.value++; }}>Run</button><p>${untrack(() => count.value)}</p><b>${count.value}</b>`;';
    const result = evaluate(lower(code, ['count']), { ...primitives, count });
    const el = host();
    try {
      result.mount(el);
      expect(count.value).toBe(1);
      el.querySelector('button')!.click(); flush();
      expect(count.value).toBe(2);
      expect(el.querySelector('p')!.textContent).toBe('1');
      expect(el.querySelector('b')!.textContent).toBe('2');
    } finally { result.dispose(); }
  });

  it('keeps existing typed factory composition and signal props available', () => {
    const Child = component<{ label: string }>('research-compiled-child', props => html`<strong>${props.label}</strong>`);
    const label = signal('before');
    const code = 'const result = html`${Child({ label })}`;';
    const result = evaluate(lower(code, ['label']), { ...primitives, label, Child });
    const el = host();
    try {
      result.mount(el);
      const child = el.querySelector('research-compiled-child');
      label.value = 'after'; flush();
      expect(el.querySelector('research-compiled-child')).toBe(child);
      expect(el.querySelector('strong')!.textContent).toBe('after');
    } finally { result.dispose(); }
  });

  it('does not rewrite opaque calls or eager factory props heuristically', () => {
    expect(() => lower('const result = html`${format(count.value)}`;', ['count'])).toThrow('Unsupported');
    expect(() => lower('const result = html`${Child({ label: count.value })}`;', ['count'])).toThrow('Unsupported');
    expect(() => lower('const result = html`${count.value++}`;', ['count'])).toThrow('Unsupported');
  });

  it('matches the actual Progress component across controlled prop updates', () => {
    const file = 'packages/ui/registry/default/ui/progress.ts';
    let source = readFileSync(file, 'utf8').replace("'ui-progress'", "'research-compiled-progress'");
    const names = ['value', 'max', 'state', 'classes', 'indicatorStyle'];
    // Variant authors ordinary .value expressions at the original binding sites.
    // All domain calculations and component/attribute behavior remain source-identical.
    for (const name of names) source = source.split('${' + name + '}').join('${' + name + '.value}');
    const output = ts.transpileModule(lower(source, names), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const exports: Record<string, any> = {};
    Function('require', 'exports', output)((specifier: string) => {
      if (specifier === '@nisli/core') return core;
      if (specifier === '../lib/utils.js') return utils;
      throw new Error(`Unexpected fixture import ${specifier}`);
    }, exports);
    const value = signal<number | undefined>(undefined);
    const max = signal(100);
    const className = signal('');
    const a = html`${Progress({ value, max, className })}`;
    const b = html`${exports.Progress({ value, max, className })}`;
    const left = host(), right = host();
    try {
      a.mount(left); b.mount(right);
      const originalIndicator = left.querySelector('[data-slot=progress-indicator]');
      const compiledIndicator = right.querySelector('[data-slot=progress-indicator]');
      for (const next of [undefined, 0, 50, 100, 120]) {
        value.value = next; max.value = next === 120 ? 150 : 100; className.value = next === 50 ? 'custom' : ''; flush();
        expect(right.querySelector('[role=progressbar]')!.outerHTML).toBe(left.querySelector('[role=progressbar]')!.outerHTML);
        expect(right.querySelector('[data-slot=progress-indicator]')).toBe(compiledIndicator);
        expect(left.querySelector('[data-slot=progress-indicator]')).toBe(originalIndicator);
      }
    } finally { a.dispose(); b.dispose(); }
  });

  it('stops compiled binding updates through the existing template disposer', () => {
    const count = signal(1);
    const result = evaluate(lower('const result = html`<p>${count.value * 2}</p>`;', ['count']), { ...primitives, count });
    const el = host();
    result.mount(el);
    expect(el.textContent).toBe('2');
    result.dispose();
    count.value = 4; flush();
    expect(el.textContent).toBe('2');
  });
});
