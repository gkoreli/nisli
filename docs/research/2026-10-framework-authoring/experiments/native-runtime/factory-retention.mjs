// Second bounded experiment. Keep the first prototype and its failures intact.
// Uses core's INTERNAL factory descriptor/_setProp contract; not a public helper.
import { signal, effect, isSignal } from '@nisli/core';

const read = value => isSignal(value) ? value.value : value;
const isFactory = value => value && value.__type === 'factory';

function factoryTemplate(source) {
  let stop;
  return {
    __templateResult: true,
    mount(host) {
      const element = document.createElement(source.peek().tagName);
      let previousKeys = [], previousClasses = [];
      stop = effect(() => {
        const next = source.value;
        const keys = Object.keys(next.props);
        for (const key of previousKeys) if (!keys.includes(key)) element._setProp(key, undefined);
        for (const [key, value] of Object.entries(next.props)) element._setProp(key, read(value));
        previousKeys = keys;
        const classes = String(read(next.hostAttrs?.class) ?? '').split(/\s+/).filter(Boolean);
        for (const name of previousClasses) if (!classes.includes(name)) element.classList.remove(name);
        for (const name of classes) if (!previousClasses.includes(name)) element.classList.add(name);
        previousClasses = classes;
      });
      host.append(element);
    },
    dispose() { stop?.(); },
  };
}

export function retainFactories(render) {
  let strings, slots = new Map();
  return () => {
    const next = render();
    if (next.strings !== strings) { slots = new Map(); strings = next.strings; }
    const values = next.values.map((value, index) => {
      if (!isFactory(value)) { slots.delete(index); return value; }
      let slot = slots.get(index);
      if (!slot || slot.tagName !== value.tagName) {
        const source = signal(value);
        slot = { tagName: value.tagName, source, template:factoryTemplate(source) };
        slots.set(index, slot);
      } else slot.source.value = value;
      return slot.template;
    });
    return { strings: next.strings, values };
  };
}
