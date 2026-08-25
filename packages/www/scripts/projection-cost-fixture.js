/**
 * Measures what light-DOM projection costs today. Not a proof of a fix — a
 * measurement of the current remove-then-append path in projection.ts, so the
 * moveBefore investment can be argued from numbers instead of theory.
 */
import { children, component, html } from '../../core/src/index.js';

const counters = { connected: 0, disconnected: 0, moved: 0, iframeLoads: 0 };
// Absolute counters for the late-sweep subject. Deltas are useless here: the
// sweep runs in a microtask right after insertion, so any baseline taken later
// has already missed the window it means to measure.
const late = { connected: 0, disconnected: 0, moved: 0, iframeLoads: 0 };

window.addEventListener('message', (event) => {
  if (event.data === 'projection-probe-iframe-load') counters.iframeLoads += 1;
  if (event.data === 'projection-probe-late-iframe-load') late.iframeLoads += 1;
});

class ProjectedProbe extends HTMLElement {
  get bucket() {
    return this.hasAttribute('data-late') ? late : counters;
  }

  connectedCallback() {
    this.bucket.connected += 1;
  }

  disconnectedCallback() {
    this.bucket.disconnected += 1;
  }

  connectedMoveCallback() {
    this.bucket.moved += 1;
  }
}
customElements.define('projection-probe', ProjectedProbe);

// A slotting component: the classic transparent wrapper around children().
component('projection-host', () => html`<div data-slot-wrapper>${children()}</div>`);

// The sharper question: does the remove-then-append destroy a NISLI child's
// setup? ADR 0023's deferred disconnect teardown is supposed to survive a
// same-task detach/reattach. setups counts every time setup() actually re-runs,
// which is what "state was lost" concretely means.
const setups = { count: 0 };
component('projection-stateful-child', () => {
  setups.count += 1;
  return html`<span data-stateful>child</span>`;
});


const host = document.createElement('projection-host');
host.innerHTML = `
  <projection-probe></projection-probe>
  <projection-stateful-child></projection-stateful-child>
  <input id="projected-input" value="abcdef">
  <iframe srcdoc="<script>parent.postMessage('projection-probe-iframe-load', '*')</script>"></iframe>
`;

// Scenario 2: the LATE-CHILDREN SWEEP (projection.ts:142-158). Children appear
// after the template is committed — late parser output, innerHTML, or an
// onMount host-append. Unlike the initial capture these nodes are already
// CONNECTED and LIVE when the sweep relocates them, so a teardown here costs a
// real iframe reload, a real focus loss, and a real animation reset.
const lateHost = document.createElement('projection-host');
let lateBaseline;

window.__projectionCost = {
  counters,
  // Connect the host; capture happens on upgrade.
  run() {
    document.body.append(host);
    return { ...counters };
  },
  result() {
    const input = document.querySelector('#projected-input');
    return {
      ...counters,
      // Did the projected nodes survive as the SAME objects, and where?
      probeInSlot: !!document.querySelector('[data-slot-wrapper] projection-probe'),
      inputInSlot: !!document.querySelector('[data-slot-wrapper] #projected-input'),
      inputConnected: !!input?.isConnected,
      childSetups: setups.count,
      supported: typeof Element.prototype.moveBefore === 'function',
    };
  },

  // The sweep is a ONE-SHOT scheduled at mount (projection.ts:142-158), not an
  // ongoing observer: children must appear in the same task as the host's
  // connection to be seen at all. Appending later relocates nothing.
  mountLate() {
    document.body.append(lateHost);
    lateHost.insertAdjacentHTML('beforeend', `
      <projection-probe data-late></projection-probe>
      <input id="late-input" value="abcdef">
      <iframe srcdoc="<script>parent.postMessage('projection-probe-late-iframe-load', '*')</script>"></iframe>
    `);
  },
  addLateChildren() { /* folded into mountLate — timing is the whole point */ },
  captureLateBaseline() {
    const input = document.querySelector('#late-input');
    input.focus();
    input.setSelectionRange(1, 4);
    lateBaseline = { ...counters, input, blurs: 0 };
    input.addEventListener('blur', () => { lateBaseline.blurs += 1; });
    return { iframeLoads: counters.iframeLoads, focused: document.activeElement === input };
  },
  lateResult() {
    const input = lateBaseline.input;
    return {
      // Absolute: 1 connect = clean insertion, 2 = torn down and rebuilt.
      connected: late.connected,
      disconnected: late.disconnected,
      moved: late.moved,
      iframeLoadsTotal: late.iframeLoads,
      blurs: lateBaseline.blurs,
      focusPreserved: document.activeElement === input,
      selectionPreserved: input.selectionStart === 1 && input.selectionEnd === 4,
      relocatedIntoSlot: !!document.querySelector('[data-slot-wrapper] [data-late]'),
    };
  },
};
