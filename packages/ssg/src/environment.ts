import { Window } from 'happy-dom';

const DOM_GLOBALS = [
  'window',
  'document',
  'customElements',
  'HTMLElement',
  'Element',
  'Node',
  'Text',
  'Comment',
  'DocumentFragment',
  'HTMLTemplateElement',
  'Event',
  'KeyboardEvent',
  'EventTarget',
  'MutationObserver',
] as const;

let windowRef: Window | null = null;

function installGlobal(name: string, value: unknown): void {
  const globalObject = globalThis as Record<string, unknown>;
  if (globalObject[name] != null) {
    return;
  }

  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

export function ensureSsgDomEnvironment(): void {
  const globalObject = globalThis as Record<string, unknown>;
  if (globalObject.document && globalObject.customElements && globalObject.HTMLElement) {
    return;
  }

  windowRef ??= new Window();
  const windowObject = windowRef as unknown as Record<string, unknown>;

  for (const name of DOM_GLOBALS) {
    installGlobal(name, windowObject[name]);
  }
}
