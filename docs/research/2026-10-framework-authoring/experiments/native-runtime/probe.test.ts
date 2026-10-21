import { afterEach, expect, it } from 'vitest';
import { component, html, computed, signal, flush, children } from '@nisli/core';
import { Progress } from '@fixture/progress';
import { Input } from '@fixture/input';
import { Slider } from '@fixture/slider';
import { record, region, localHtml } from './prototype.mjs';
import { ProgressRender } from './progress-variant.mjs';

const cleanups: (() => void)[] = [];
const mount = (template: any) => {
  const host = document.createElement('div'); document.body.append(host);
  template.mount(host); cleanups.push(() => { template.dispose(); host.remove(); }); return host;
};
afterEach(async () => { for (const stop of cleanups.splice(0)) stop(); await Promise.resolve(); });

it('compares existing computed view with runtime retention, including unfinished input', () => {
  const n = signal(1);
  const baseline = mount(html`${computed(() => html`<section><input value="seed"><p>${n.value * 2}</p></section>`)}`);
  const retained = mount(region(() => record`<section><input value="seed"><p>${n.value * 2}</p></section>`));
  const oldA = baseline.querySelector('input')!, oldB = retained.querySelector('input')!;
  oldA.value = oldB.value = 'unfinished'; n.value = 2; flush();
  expect(baseline.querySelector('input')).not.toBe(oldA);
  expect(retained.querySelector('input')).toBe(oldB);
  expect(oldB.value).toBe('unfinished'); expect(retained.querySelector('p')!.textContent).toBe('4');
  console.log(JSON.stringify({case:'same template', baselineRetainsInput:false, prototypeRetainsInput:true}));
});

it('retains button identity but replaces a handler closure capturing the old render value', () => {
  const selected = signal('A'); const calls: string[] = [];
  const host = mount(region(() => {
    const id = selected.value;
    return record`<button @click=${() => calls.push(id)}>${id}</button>`;
  }));
  const button = host.querySelector('button')!; button.click();
  selected.value = 'B'; flush(); button.click();
  expect(host.querySelector('button')).toBe(button); expect(calls).toEqual(['A', 'B']);
});

it('replaces a signal binding without keeping the old signal subscribed', () => {
  const a = signal('a'), b = signal('b'), chooseB = signal(false);
  const host = mount(region(() => record`<p>${chooseB.value ? b : a}</p>`));
  chooseB.value = true; flush(); a.value = 'obsolete'; flush();
  expect(host.textContent).toBe('b'); b.value = 'fresh'; flush(); expect(host.textContent).toBe('fresh');
});

it('an explicit entity key resets unfinished state while same-key updates retain it', () => {
  const id = signal('A'), title = signal('first');
  const host = mount(region(() => record`<input value="seed"><p>${title.value}</p>`, () => id.value));
  const first = host.querySelector('input')!; first.value = 'draft for A';
  title.value = 'updated'; flush(); expect(host.querySelector('input')).toBe(first);
  id.value = 'B'; flush(); expect(host.querySelector('input')).not.toBe(first);
  expect(host.querySelector('input')!.value).toBe('seed');
});

it('actual Progress and render variant agree over value, max, class and plain-HTML updates', () => {
  const value = signal<number | undefined>(undefined), max = signal(100), className = signal('');
  const a = mount(html`${Progress({ value, max, className })}`);
  const b = mount(html`${ProgressRender({ value, max, className })}`);
  const attributes = (root: Element) => [...root.attributes].map(x => [x.name, x.value]).sort();
  const snapshot = (host: Element) => [attributes(host.querySelector('[role=progressbar]')!), attributes(host.querySelector('[data-slot=progress-indicator]')!)];
  const indicator = b.querySelector('[data-slot=progress-indicator]');
  for (const next of [undefined, 0, 50, 100, 120]) {
    value.value = next; max.value = next === 120 ? 150 : 100; className.value = next === 50 ? 'custom' : ''; flush();
    expect(snapshot(b)).toEqual(snapshot(a)); expect(b.querySelector('[data-slot=progress-indicator]')).toBe(indicator);
  }
  const plainA = document.createElement('ui-progress'); const plainB = document.createElement('research-progress-render');
  document.body.append(plainA, plainB); cleanups.push(() => { plainA.remove(); plainB.remove(); });
  for (const next of ['20', '120']) {
    for (const el of [plainA, plainB]) { el.setAttribute('value', next); el.setAttribute('max', '150'); } flush();
    expect(snapshot(plainB)).toEqual(snapshot(plainA));
  }
  console.log(JSON.stringify({case:'actual Progress variant',originalComputedDeclarations:5,variantComputedDeclarations:0,controlledStates:5,attributeStates:2}));
});

it('local expression functions update text/classes while events remain deferred and disposal stops updates', () => {
  const n = signal(1); let clicks = 0;
  const template = localHtml`<button class:on=${() => n.value > 1} @click=${() => clicks++}>${() => n.value * 2}</button>`;
  const host = mount(template); const button = host.querySelector('button')!;
  expect(clicks).toBe(0); n.value = 2; flush();
  expect(button.textContent).toBe('4'); expect(button.classList.contains('on')).toBe(true);
  button.click(); expect(clicks).toBe(1); template.dispose(); n.value = 3; flush(); expect(button.textContent).toBe('4');
});

it('current typed factory callbacks remain data, so blanket auto-invocation is unsound', () => {
  let calls = 0;
  const callback = () => ++calls;
  const Child = component<{ callback: () => number }>('research-callback-data', props => html`<button @click=${() => props.callback.value()}>Run</button>`);
  const host = mount(localHtml`${Child({ callback })}`);
  expect(calls).toBe(0); host.querySelector('button')!.click(); expect(calls).toBe(1);
  const dangerousNormalization = computed(callback); dangerousNormalization.value;
  expect(calls).toBe(2);
  console.log(JSON.stringify({case:'function-valued props',blanketInvocationWouldExecuteAction:true}));
});

it('actual Input preserves its initial reset target while later values update the property', () => {
  const value = signal('initial');
  const host = mount(html`<form>${Input({ name:'note', value })}</form>`);
  const input = host.querySelector('input')!; input.value = 'typed';
  value.value = 'server'; flush();
  expect(input.value).toBe('server'); expect(input.getAttribute('value')).toBe('initial');
  host.querySelector('form')!.reset(); expect(input.value).toBe('initial');
});

it('records actual Slider setup snapshots: live declared min/max inputs do not reach the native control', () => {
  const min = signal(0), max = signal(100), step = signal(1);
  const host = mount(html`${Slider({ min, max, step, value:50 })}`);
  min.value = 20; max.value = 200; step.value = 5; flush();
  const input = host.querySelector('input')!;
  expect([input.min,input.max,input.step]).toEqual(['0','100','1']);
  console.log(JSON.stringify({case:'actual Slider snapshots',requested:[20,200,5],native:[input.min,input.max,input.step]}));
});

it('documents that children() is a setup operation, not safe to move blindly into a render callback', () => {
  expect(() => children()).toThrow();
});

it('render retention can still rerun unrelated expensive calculations', () => {
  const a = signal(1), b = signal(1); let renderA = 0, renderB = 0, localA = 0, localB = 0;
  mount(region(() => record`<p>${(renderA++, a.value)}</p><p>${(renderB++, b.value)}</p>`));
  mount(localHtml`<p>${() => (localA++, a.value)}</p><p>${() => (localB++, b.value)}</p>`);
  a.value++; flush();
  expect([renderA, renderB, localA, localB]).toEqual([2,2,2,1]);
  console.log(JSON.stringify({case:'calculation counts',region:[renderA,renderB],local:[localA,localB]}));
});
