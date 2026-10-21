// Served verbatim. No application source transform or framework compiler.
import { html, signal, flush, component } from '@nisli/core';
import { Input } from '@fixture/input';
import { Slider } from '@fixture/slider';
import { region, record, localHtml } from './prototype.mjs';
import { retainFactories } from './factory-retention.mjs';

const checks = [];
const check = (name, actual, expected) => checks.push({ name, actual, expected, pass: Object.is(actual, expected) });
const mounts = [];
const mount = template => {
  const host = document.createElement('div'); document.body.append(host); template.mount(host);
  mounts.push(() => { template.dispose(); host.remove(); }); return host;
};

try {
  const n = signal(1);
  const retained = region(() => record`<section><input value="seed"><p>${n.value * 2}</p></section>`);
  const host = mount(retained), input = host.querySelector('input');
  input.value = 'unfinished'; input.focus(); input.setSelectionRange(2, 5);
  n.value = 3; flush();
  check('region retains node', host.querySelector('input') === input, true);
  check('region retains focus', document.activeElement === input, true);
  check('region retains selection', `${input.selectionStart}:${input.selectionEnd}`, '2:5');
  check('region retains draft', input.value, 'unfinished');
  check('region updates calculation', host.querySelector('p').textContent, '6');
  retained.dispose(); n.value = 4; flush();
  check('disposed region stops updating', host.querySelector('p').textContent, '6');

  const local = signal(1);
  const localHost = mount(localHtml`<p>${() => local.value * 3}</p>`);
  local.value = 3; flush(); check('local callback tracks in native ESM', localHost.textContent, '9');

  const fieldValue = signal('initial');
  const formHost = mount(html`<form>${Input({ name:'note', value:fieldValue })}</form>`);
  const field = formHost.querySelector('input'); field.value = 'typed';
  fieldValue.value = 'server'; flush();
  check('actual Input writes current value', field.value, 'server');
  check('actual Input retains initial default', field.defaultValue, 'initial');
  formHost.querySelector('form').reset();
  check('actual Input native reset', field.value, 'initial');

  const attrValue = signal('initial');
  const rawHost = mount(html`<form><input value=${attrValue}></form>`);
  const raw = rawHost.querySelector('input'); raw.value = 'typed'; attrValue.value = 'server'; flush();
  check('attribute update preserves dirty current value', raw.value, 'typed');
  check('attribute update changes reset default', raw.defaultValue, 'server');
  rawHost.querySelector('form').reset(); check('native reset follows new attribute', raw.value, 'server');

  const min = signal(0), max = signal(100), step = signal(1);
  const sliderHost = mount(html`${Slider({min,max,step,value:50})}`);
  min.value = 20; max.value = 200; step.value = 5; flush();
  const slider = sliderHost.querySelector('input');
  // Observation of the frozen implementation; not a claim that stale bounds
  // satisfy its documented live-attribute intent.
  check('actual Slider snapshot reproduced', `${slider.min}:${slider.max}:${slider.step}`, '0:100:1');

  const label=signal('A');let setups=0;const saved=[];
  const Child=component('research-browser-child',props=>{
    setups++;return html`<input value="seed"><button @click=${()=>props.save.value()}>Save</button>`;
  });
  const childHost=mount(region(retainFactories(()=>{
    const id=label.value;return record`<section>${Child({save:()=>saved.push(id)})}<p>${id}</p></section>`;
  })));
  const childInput=childHost.querySelector('input');childInput.value='unfinished';childInput.focus();childInput.setSelectionRange(1,4);
  label.value='B';flush();
  check('refined factory retains native input',childHost.querySelector('input')===childInput,true);
  check('refined factory retains focus',document.activeElement===childInput,true);
  check('refined factory retains selection',`${childInput.selectionStart}:${childInput.selectionEnd}`,'1:4');
  childHost.querySelector('button').click();
  check('refined factory runs setup once',setups,1);
  check('refined factory uses latest callback',saved.join(','),'B');
} catch (error) {
  checks.push({ name:'fixture exception', pass:false, error:String(error) });
} finally {
  for (const dispose of mounts) dispose();
  window.probeResult = checks;
}
