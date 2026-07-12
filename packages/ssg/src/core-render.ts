import { tick, type TemplateResult } from '@nisli/core';
import { ensureSsgDomEnvironment } from './environment.js';

interface ComponentFactoryResult {
  __type: 'factory';
  tagName: string;
  props: Record<string, unknown>;
  hostAttrs?: { class?: unknown };
}

export type Renderable = string | TemplateResult | ComponentFactoryResult;

function isTemplateResult(value: unknown): value is TemplateResult {
  return Boolean(
    value
      && typeof value === 'object'
      && '__templateResult' in value
      && typeof (value as TemplateResult).mount === 'function',
  );
}

function isComponentFactoryResult(value: unknown): value is ComponentFactoryResult {
  return Boolean(
    value
      && typeof value === 'object'
      && '__type' in value
      && (value as ComponentFactoryResult).__type === 'factory'
      && typeof (value as ComponentFactoryResult).tagName === 'string',
  );
}

function setFactoryProps(element: HTMLElement, factory: ComponentFactoryResult): void {
  for (const [key, value] of Object.entries(factory.props)) {
    (element as unknown as { _setProp?: (key: string, value: unknown) => void })._setProp?.(key, value);
  }

  if (typeof factory.hostAttrs?.class === 'string' && factory.hostAttrs.class) {
    element.className = factory.hostAttrs.class;
  }
}

// Async because ui relies on microtask work after mount — content-projection
// sweeps and query/command initial passes run via queueMicrotask. `tick()`
// settles those (and any effects they schedule) before we snapshot innerHTML,
// so plain-HTML-authored nested content lands in static output (ADR 0025 §5).
export async function renderToHtml(value: Renderable): Promise<string> {
  if (typeof value === 'string') {
    return value;
  }

  ensureSsgDomEnvironment();

  if (isTemplateResult(value)) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      value.mount(host);
      await tick();
      return host.innerHTML;
    } finally {
      value.dispose();
      host.remove();
    }
  }

  if (isComponentFactoryResult(value)) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const element = document.createElement(value.tagName);
    setFactoryProps(element, value);
    host.appendChild(element);
    await tick();
    const html = host.innerHTML;
    host.remove();
    return html;
  }

  throw new Error('Static route render must return a string or @nisli/core TemplateResult');
}
