import { component, computed, html } from '@nisli/core';

interface GreetingProps {
  name: string;
}

export const Greeting = component<GreetingProps>('x-greeting', (props) => {
  const upper = computed(() => props.name.value.toUpperCase());
  return html`<p>Hello, ${upper}</p>`;
});
