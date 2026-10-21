import { afterEach, expect, it } from 'vitest';
import { component, html, signal, flush, onCleanup, each } from '@nisli/core';
import { record, region } from './prototype.mjs';
import { retainFactories } from './factory-retention.mjs';

const cleanups: (() => void)[] = [];
const mount = (result:any) => {
  const host = document.createElement('div'); document.body.append(host); result.mount(host);
  const stop = () => { result.dispose(); host.remove(); }; cleanups.push(stop); return {host,stop};
};
afterEach(async () => { for (const stop of cleanups.splice(0)) stop(); await Promise.resolve(); });

it('retains a stateful factory and forwards new plain props and captured callbacks', () => {
  let setups = 0; const actions:string[] = []; const label = signal('A');
  const Child = component<{label:string;onSave:()=>void}>('research-refined-child', props => {
    setups++; return html`<input value="seed"><b>${props.label}</b><button @click=${()=>props.onSave.value()}>Save</button>`;
  });
  const {host} = mount(region(retainFactories(() => {
    const id = label.value;
    return record`<section>${Child({label:id,onSave:()=>actions.push(id)})}</section>`;
  })));
  const input = host.querySelector('input')!; input.value = 'unfinished';
  label.value = 'B'; flush(); host.querySelector('button')!.click();
  expect(host.querySelector('input')).toBe(input); expect(input.value).toBe('unfinished');
  expect(host.querySelector('b')!.textContent).toBe('B'); expect(setups).toBe(1); expect(actions).toEqual(['B']);
  console.log(JSON.stringify({case:'refined child factory',setups,preservesDraft:true,freshCallback:true}));
});

it('updates and removes optional props, retaining declared attribute fallback semantics', () => {
  const mode = signal(0);
  const Child = component<{label?:string}>('research-refined-optional', props => html`<p>${props.label}</p>`,
    {attrs:{label:{type:'string',default:'fallback'}}});
  const {host} = mount(region(retainFactories(() => record`${Child(mode.value===1?{label:'present'}:{})}`)));
  const element = host.querySelector('research-refined-optional');
  expect(host.textContent).toBe('fallback'); mode.value=1;flush();expect(host.textContent).toBe('present');
  mode.value=2;flush();expect(host.textContent).toBe('fallback');expect(host.querySelector('research-refined-optional')).toBe(element);
});

it('replaces the source signal behind a factory prop and unsubscribes the obsolete source', () => {
  const a=signal('A'),b=signal('B'),chooseB=signal(false);
  const Child=component<{label:string}>('research-refined-source',props=>html`<p>${props.label}</p>`);
  const {host}=mount(region(retainFactories(()=>record`${Child({label:chooseB.value?b:a})}`)));
  chooseB.value=true;flush();a.value='obsolete';flush();expect(host.textContent).toBe('B');
  b.value='fresh';flush();expect(host.textContent).toBe('fresh');
});

it('an explicit parent key recreates the child and cleans up the old instance', async () => {
  const id=signal('A');let setups=0,disposals=0;
  const Child=component('research-refined-key',()=>{setups++;onCleanup(()=>disposals++);return html`<input value="seed">`;});
  const {host}=mount(region(retainFactories(()=>record`${Child({})}`),()=>id.value));
  const first=host.querySelector('input')!;first.value='A draft';id.value='B';flush();await Promise.resolve();
  expect(host.querySelector('input')).not.toBe(first);expect(host.querySelector('input')!.value).toBe('seed');
  expect([setups,disposals]).toEqual([2,1]);
});

it('preserves existing each() keyed list identity when the list is created once', () => {
  const items=signal([{id:'a'},{id:'b'}]),title=signal('before');
  const list=each(items,x=>x.id,item=>html`<label>${item}<input value="seed"></label>`);
  const {host}=mount(region(retainFactories(()=>record`<h2>${title.value}</h2>${list}`)));
  const before=[...host.querySelectorAll('input')];before[0]!.value='draft A';before[1]!.value='draft B';
  title.value='after';items.value=[{id:'b'},{id:'a'}];flush();
  expect([...host.querySelectorAll('input')]).toEqual([before[1],before[0]]);
});
