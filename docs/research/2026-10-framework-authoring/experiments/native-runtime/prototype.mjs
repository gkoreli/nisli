// Research only. No source transform and no changes to production core.
import { html, signal, computed, effect, untrack, isSignal, isRef } from '@nisli/core';

export const record = (strings, ...values) => ({ strings, values });
const eventSlot = text => /@[\w.-]+\s*=\s*["']?$/.test(text);
const refSlot = text => /\bref\s*=\s*["']?$/.test(text);

// Bounded prototype: native child/attribute expressions; callbacks in typed
// factory props remain data. This deliberately does not infer their intent.
export function localHtml(strings, ...values) {
  return html(strings, ...values.map((value, index) =>
    typeof value === 'function' && !eventSlot(strings[index]) && !refSlot(strings[index])
      ? computed(value) : value));
}

// Isolate live-instance reuse independently of its eventual public API.
// A record stands in for internal strings/values metadata on html's result.
// This does NOT implement recursive factory/list reconciliation, batching,
// production error recovery, or static-value optimization.
export function region(render, identity = () => undefined) {
  let stop, current, nodes = [], lastKey, start, end;
  const clear = () => {
    current?.template.dispose();
    for (const node of nodes) node.remove();
    nodes = [];
    current = undefined;
  };
  return {
    __templateResult: true,
    mount(host) {
      start = document.createComment('research-region');
      end = document.createComment('/research-region');
      host.append(start, end);
      stop = effect(() => {
        const key = identity();
        const next = render();
        untrack(() => {
          if (current && current.strings === next.strings && Object.is(key, lastKey)) {
            current.update(next.values);
            return;
          }
          clear();
          lastKey = key;
          const setters = [];
          const values = next.values.map((value, index) => {
            if (eventSlot(next.strings[index])) {
              let handler = value;
              setters.push(next => { handler = next; });
              return function (event) { if (typeof handler === 'function') handler.call(this, event); };
            }
            if (isRef(value)) {
              setters.push(next => { if (next !== value) throw new Error('Research prototype requires stable ref identity'); });
              return value;
            }
            if (typeof value === 'function') throw new Error('Use an explicit binding for a function-valued slot');
            const source = signal(value);
            setters.push(next => { source.value = next; });
            return computed(() => {
              const current = source.value;
              return isSignal(current) ? current.value : current;
            });
          });
          const template = html(next.strings, ...values);
          const fragment = document.createDocumentFragment();
          template.mount(fragment);
          nodes = [...fragment.childNodes];
          end.parentNode.insertBefore(fragment, end);
          current = { strings: next.strings, template,
            update(values) { values.forEach((value, i) => setters[i](value)); } };
        });
      });
    },
    dispose() { stop?.(); current?.template.dispose(); },
  };
}
