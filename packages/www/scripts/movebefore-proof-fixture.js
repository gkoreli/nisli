import {
  component,
  computed,
  each,
  flushEffects,
  html,
  onMount,
  ref,
  signal,
} from '../../core/src/index.js';
import { portal } from '../../ui/registry/default/lib/portal.js';

const counters = {
  connected: 0,
  disconnected: 0,
  iframeLoads: 0,
  moved: 0,
  setup: 0,
};

window.addEventListener('message', (event) => {
  if (event.data === 'movebefore-proof-iframe-load') counters.iframeLoads += 1;
});

const StateProbe = component('movebefore-state-probe', () => {
  counters.setup += 1;
  return html`<span data-state-probe></span>`;
});

const probePrototype = customElements.get('movebefore-state-probe').prototype;
for (const [callback, counter] of [
  ['connectedCallback', 'connected'],
  ['disconnectedCallback', 'disconnected'],
  ['connectedMoveCallback', 'moved'],
]) {
  const original = probePrototype[callback];
  Object.defineProperty(probePrototype, callback, {
    configurable: true,
    value(...args) {
      counters[counter] += 1;
      return Reflect.apply(original, this, args);
    },
  });
}

const items = signal([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
const ListProof = component('movebefore-list-proof', () => html`
  <div id="proof-list">${each(
    items,
    (item) => item.id,
    (item) => html`
      <section data-row="${computed(() => item.value.id)}">
        ${StateProbe({})}
        <input value="abcdef">
        <span data-selection>select me</span>
        <span data-animation></span>
        <div popover="manual" data-popover>open</div>
        <iframe srcdoc="<script>parent.postMessage('movebefore-proof-iframe-load', '*')</script>"></iframe>
      </section>
    `,
  )}</div>
`);

let portalResult;
const PortalProof = component('movebefore-portal-proof', () => {
  const box = ref();
  let before;

  onMount(() => {
    const input = box.current.querySelector('input');
    const popover = box.current.querySelector('[popover]');
    input.focus();
    popover.showPopover();
    before = { ...counters, input, popover };
  });
  portal(box, { target: () => document.querySelector('#portal-target') });
  onMount(() => {
    portalResult = {
      connected: counters.connected - before.connected,
      disconnected: counters.disconnected - before.disconnected,
      focusPreserved: document.activeElement === before.input,
      moved: counters.moved - before.moved,
      popoverPreserved: before.popover.matches(':popover-open'),
      setup: counters.setup - before.setup,
    };
  });

  return html`<div ref="${box}" data-portal-box>
    ${StateProbe({})}
    <input value="portal focus">
    <div popover="manual">portal popover</div>
  </div>`;
});

document.body.append(
  document.createElement('movebefore-list-proof'),
  document.createElement('movebefore-portal-proof'),
);
flushEffects();

let baseline;
let animation;
let selectionNode;

window.__moveBeforeProof = {
  counters,
  portalResult: () => portalResult,
  prepare() {
    const row = document.querySelector('[data-row="b"]');
    const input = row.querySelector('input');
    const selectionText = row.querySelector('[data-selection]').firstChild;
    const range = document.createRange();
    range.setStart(selectionText, 1);
    range.setEnd(selectionText, 5);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    selectionNode = selection.anchorNode;

    input.addEventListener('blur', () => { baseline.blurs += 1; });
    input.focus();
    input.setSelectionRange(1, 4);
    const popover = row.querySelector('[popover]');
    popover.showPopover();
    animation = row.querySelector('[data-animation]').getAnimations()[0];
    baseline = {
      animationTime: animation.currentTime,
      blurs: 0,
      connected: counters.connected,
      disconnected: counters.disconnected,
      iframeLoads: counters.iframeLoads,
      input,
      moved: counters.moved,
      popover,
      selectionAnchorOffset: selection.anchorOffset,
      selectionFocusOffset: selection.focusOffset,
      setup: counters.setup,
    };
  },
  reorder() {
    const forward = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const reverse = [{ id: 'c' }, { id: 'b' }, { id: 'a' }];
    for (let index = 0; index < 5; index += 1) {
      items.value = index % 2 === 0 ? reverse : forward;
      flushEffects();
    }
  },
  result() {
    const selection = getSelection();
    return {
      animationPreserved: animation === document.querySelector('[data-row="b"] [data-animation]').getAnimations()[0],
      animationTimePreserved: animation.currentTime >= baseline.animationTime,
      blurs: baseline.blurs,
      connected: counters.connected - baseline.connected,
      disconnected: counters.disconnected - baseline.disconnected,
      focusPreserved: document.activeElement === baseline.input,
      iframeLoadsAfter: counters.iframeLoads,
      iframeLoadsBefore: baseline.iframeLoads,
      inputSelectionPreserved: baseline.input.selectionStart === 1 && baseline.input.selectionEnd === 4,
      moved: counters.moved - baseline.moved,
      order: [...document.querySelectorAll('[data-row]')].map((row) => row.dataset.row),
      popoverPreserved: baseline.popover.matches(':popover-open'),
      selectionPreserved:
        selection.anchorNode === selectionNode
        && selection.anchorOffset === baseline.selectionAnchorOffset
        && selection.focusOffset === baseline.selectionFocusOffset,
      setup: counters.setup - baseline.setup,
      supported: typeof Element.prototype.moveBefore === 'function',
    };
  },
};
