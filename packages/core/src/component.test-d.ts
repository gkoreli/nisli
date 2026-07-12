/** Compile-time API proofs for component() prop inference. */
import { component } from './component.js';
import { html } from './template.js';

interface InterfaceProps {
  title: string;
  count?: number;
}

const InterfaceComponent = component<InterfaceProps>('interface-props-proof', (props) => {
  const title: string = props.title.value;
  const count: number | undefined = props.count.value;
  return html`<span>${title}:${count}</span>`;
});

InterfaceComponent({ title: 'Works' });
InterfaceComponent({ title: 'Works', count: 1 });

// @ts-expect-error title is required
InterfaceComponent({});
// @ts-expect-error count must be a number
InterfaceComponent({ title: 'Wrong', count: 'one' });
