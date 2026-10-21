import {
  component, html, signal, effect, flush, onMount, sanitized,
  setDevMode, createToken, inject, provide, resetInjector, QueryClient,
} from '@nisli/core';

setDevMode(true); // Must not resurrect stripped instrumentation.
const result = { errors: {}, lifecycle: {}, events: [], loop: {}, di: {}, duplicate: {} };
document.addEventListener('nisli-error', event => result.events.push(event.detail.code));
const codeOf = err => String(err).match(/N\d{3}/)?.[0] ?? String(err);
const attempt = (key, fn) => {
  try { fn(); result.errors[key] = 'NO_THROW'; }
  catch (e) { result.errors[key] = codeOf(e); }
};
const host = () => document.body.appendChild(document.createElement('div'));
const live = html`<span>${signal('live')}</span>`;
live.mount(host());
attempt('doubleMount', () => live.mount(host()));
attempt('unbranded', () => html`<div html:inner=${'<b>unsafe</b>'}></div>`.mount(host()));
attempt('invalidQueryKey', () => new QueryClient().invalidate([{}]));
const original = Object.getOwnPropertyDescriptor(Element.prototype, 'setHTML');
Object.defineProperty(Element.prototype, 'setHTML', { value: undefined, configurable: true });
attempt('noSanitizer', () => html`<div html:inner=${sanitized('<b>untrusted</b>')}></div>`.mount(host()));
if (original) Object.defineProperty(Element.prototype, 'setHTML', original);
else delete Element.prototype.setHTML;

for (const phase of ['setup', 'mount']) {
  const C = component(`fail-${phase}`, () => {
    if (phase === 'setup') throw new Error('intentional setup failure');
    onMount(() => { throw new Error('intentional mount failure'); });
    return html`<span>failure fixture</span>`;
  });
  const h = host();
  html`${C({})}`.mount(h);
  result.lifecycle[phase] = h.querySelector(`fail-${phase}`).getAttribute('data-nisli-error');
}
const n = signal(0);
let runs = 0;
const stop = effect(() => { runs++; n.value = n.value + 1; });
flush();
const settled = runs;
n.value += 1;
flush();
result.loop = { settled: settled > 1 && settled < 10000, disposed: runs === settled };
stop();
const stopAsync = effect(() => Promise.reject(new Error('async rejection sentinel')));
stopAsync();
const eventHost = host();
const eventCount = signal(0);
html`<button @click=${() => { throw new Error('event rejection sentinel'); }}>fail</button>
  <button @click=${() => eventCount.value++}>continue</button>`.mount(eventHost);
eventHost.querySelectorAll('button')[0].click();
eventHost.querySelectorAll('button')[1].click();
flush();
result.eventContinued = eventCount.value === 1;
const token = createToken('profile-di');
provide(token, () => 1);
const first = inject(token);
try { provide(token, () => 2); result.di = { first, next: inject(token) }; }
catch (e) { result.di = { first, error: codeOf(e) }; }
resetInjector();
component('duplicate-fixture', () => html`<div>first</div>`);
try { component('duplicate-fixture', () => html`<div>second</div>`); result.duplicate = { error: null }; }
catch (e) { result.duplicate = { error: codeOf(e) }; }
const duplicateHost = host();
duplicateHost.appendChild(document.createElement('duplicate-fixture'));
result.duplicate.content = duplicateHost.textContent;
globalThis.safetyResult = result;
