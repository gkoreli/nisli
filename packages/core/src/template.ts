/**
 * template.ts — Tagged template engine with targeted DOM binding
 *
 * The html tagged template literal parses HTML with expression slots,
 * creates bindings for signals, and produces a TemplateResult that
 * can be mounted into the DOM with surgical updates.
 *
 * Two phases:
 * 1. First render: parse template, clone, create bindings, mount
 * 2. Updates: signal changes trigger individual binding updates (O(1))
 */

import {
  signal,
  isSignal,
  effect,
  computed,
  untrack,
  type Signal,
  type ReadonlySignal,
} from './signal.js';
import { isRef, type Ref } from './ref.js';
// First-parse audit (ADR 0030.2 T4). The import is static — core has no
// build-time dev/prod define yet (a named Wave-1 deliverable, §8) — but every
// entry point is a no-op behind template-audit's own dev flag.
import { auditTemplate, captureCallsite } from './template-audit.js';

// ── Types ───────────────────────────────────────────────────────────

export interface TemplateResult {
  /** Mount this template into a host element */
  mount(host: HTMLElement): void;
  /** Dispose all bindings and effects */
  dispose(): void;
  /** Brand for type checking */
  __templateResult: true;
}

// TypeScript's DOM library does not expose moveBefore() yet.
interface MoveCapableParent extends ParentNode {
  moveBefore(node: Node, child: Node | null): void;
}

const canMoveWithin = (parent: ParentNode): parent is MoveCapableParent =>
  typeof (parent as Partial<MoveCapableParent>).moveBefore === 'function';

/** A DOM event handler whose event type is inferred from its native event name. */
export type TypedEventHandler<K extends keyof HTMLElementEventMap> = (
  event: HTMLElementEventMap[K],
) => void;

/**
 * Value-returning untrack. signal.ts's `untrack` is `(fn: () => void) => void`
 * (the value-returning form is a 0030.2 §3 papercut owned elsewhere); this
 * local wrapper closes over the result until that lands.
 */
function untracked<T>(fn: () => T): T {
  let result!: T;
  untrack(() => { result = fn(); });
  return result;
}

// ── Trusted HTML brand (raw) ────────────────────────────────────────

/**
 * Branded trusted-HTML value accepted by `html:inner` (and by @nisli/ssg's
 * static renderer, which re-exports this brand — core owns it, ADR 0030.2 §8).
 * Structural, not nominal: cross-package/cross-realm values with the same
 * shape stay valid.
 */
export interface RawHtml {
  value: string;
  __raw: true;
}

/**
 * Mark a string as trusted raw HTML. `html:inner` accepts ONLY branded
 * values — a bare string throws N106 (the accidental-XSS-sink class closes,
 * ADR 0030.2 §3). NEVER wrap user-generated input.
 */
export function raw(value: string): RawHtml {
  return { __raw: true as const, value };
}

function isRawHtml(value: unknown): value is RawHtml {
  return (
    typeof value === 'object'
    && value !== null
    && '__raw' in value
    && (value as RawHtml).__raw === true
    && typeof (value as RawHtml).value === 'string'
  );
}

// ── Sanitized HTML brand (untrusted markup) ─────────────────────────

/**
 * Branded UNTRUSTED-HTML value accepted by `html:inner`. The mirror image of
 * {@link RawHtml}: where `raw()` is the author asserting markup is already
 * trustworthy, this brand asserts the opposite — the string is untrusted and
 * MUST pass a sanitizer before it reaches the DOM (ADR 0019:124–128, executed
 * by bet-09(c)). Structural, not nominal, on the same rule as RawHtml.
 */
export interface SanitizedHtml {
  value: string;
  __sanitize: true;
}

/**
 * Mark a string as untrusted markup to be sanitized at the sink — the brand
 * for user-generated HTML, which must NEVER go through `raw()`.
 *
 * `html:inner` writes it with the platform's `Element.setHTML()` (the spec's
 * XSS-safe default sanitizer) when the engine has one, otherwise with the hook
 * registered by {@link setSanitizerFallback}. With NEITHER available the
 * binding throws N107: it never falls back to `innerHTML`. nisli bundles no
 * sanitizer — the trust decision, and its bytes, stay in the app.
 */
export function sanitized(value: string): SanitizedHtml {
  return { __sanitize: true as const, value };
}

function isSanitizedHtml(value: unknown): value is SanitizedHtml {
  return (
    typeof value === 'object'
    && value !== null
    && '__sanitize' in value
    && (value as SanitizedHtml).__sanitize === true
    && typeof (value as SanitizedHtml).value === 'string'
  );
}

// ── Sanitizer sinks ─────────────────────────────────────────────────

/** A sanitizing writer: sanitize `html`, then put the result inside `el`. */
export type SanitizerFallback = (el: Element, html: string) => void;

let sanitizerFallback: SanitizerFallback | null = null;

/**
 * Register the sanitizing writer used for `sanitized()` values on engines
 * WITHOUT native `Element.setHTML()` (Safari today, older Chromium/Firefox),
 * or `null` to unregister. Native `setHTML()` always wins where it exists, so
 * modern engines never pay the hook. nisli ships no sanitizer; wire one:
 *
 *   setSanitizerFallback((el, html) => {
 *     el.innerHTML = DOMPurify.sanitize(html);
 *   });
 */
export function setSanitizerFallback(fn: SanitizerFallback | null): void {
  sanitizerFallback = fn;
}

// TypeScript's DOM library does not expose Element.setHTML() yet.
interface SanitizeCapableElement extends Element {
  setHTML(html: string): void;
}

const nativeSetHtml: SanitizerFallback = (el, html) => {
  (el as SanitizeCapableElement).setHTML(html);
};

/**
 * The sanitizing writer for this element, or `null` when the engine has none
 * and the app registered none — the fail-closed signal N107 is thrown on.
 *
 * The method must be the one on `Element.prototype`, not merely *a* callable
 * named `setHTML`. A duck-typed check here is a sanitizer bypass: an element
 * carrying its own `setHTML` — DOM clobbering, an unsafe polyfill, a library
 * shim — would be trusted as the platform sanitizer and would preempt the
 * fallback the app explicitly registered as safe. Verified: with an
 * own-property `setHTML`, the registered fallback was never called and
 * `<img src=x onerror=…>` reached innerHTML intact.
 *
 * Read from the prototype per write rather than captured at module load, so a
 * late polyfill or a test's stub is still honoured; identity is what is
 * checked, not existence. Replacing `Element.prototype.setHTML` wholesale is
 * out of scope — an attacker who can do that owns the realm regardless.
 */
function sanitizerFor(el: Element): SanitizerFallback | null {
  const platform = typeof Element === 'function'
    ? (Element.prototype as Partial<SanitizeCapableElement>).setHTML
    : undefined;
  return typeof platform === 'function'
    && (el as Partial<SanitizeCapableElement>).setHTML === platform
    ? nativeSetHtml
    : sanitizerFallback;
}

// ── Trusted Types pass-through ──────────────────────────────────────

/**
 * The native `TrustedHTML` shape — also missing from TypeScript's DOM library.
 * Only `isHTML()` recognition is needed: under CSP
 * `require-trusted-types-for 'script'` the raw sink's plain-string `innerHTML`
 * assignment throws, so policy-created values pass through `html:inner`
 * unwrapped instead of being re-wrapped in `raw()`.
 */
interface TrustedHtml {
  toJSON(): string;
}

interface TrustedTypeChecker {
  isHTML(value: unknown): boolean;
}

function isTrustedHtml(value: unknown): value is TrustedHtml {
  const tt = (globalThis as { trustedTypes?: TrustedTypeChecker }).trustedTypes;
  return tt !== undefined && tt.isHTML(value);
}

// TODO(diagnostics): replace with the core diagnostics leaf (parallel
// worktree); template-layer codes N101–N107 register there. N105–N107 are
// thrown (correctness/security guards), unlike the warn-level audit codes.
function nisliError(code: string, message: string): Error {
  return new Error(`[nisli] ${code}: ${message}`);
}

// ── Template cache ──────────────────────────────────────────────────

/**
 * Cache parsed templates by their static string parts.
 * Since tagged templates always produce the same static strings array
 * reference per call site, we use WeakMap for efficient caching.
 */
const templateCache = new WeakMap<TemplateStringsArray, HTMLTemplateElement>();

/** Parses performed since module load — test-only regression hook (issue 0015). */
let parseCount = 0;

/** @internal Test-only: number of actual `<template>` parses performed. */
export function __templateParseCount(): number {
  return parseCount;
}

/**
 * Parse-once (ADR 0030.2 T4, issue 0015): build the marker HTML string and
 * parse it into a `<template>` exactly once per callsite, keyed by
 * TemplateStringsArray identity. The string depends only on the static
 * `strings` (marker indices are positional), so every TemplateResult from the
 * same callsite shares one parsed template and clones per mount.
 *
 * The first parse also runs the one-time static audit (template-audit.ts)
 * over the pristine parsed element — it still carries the raw `@event`/
 * `class:`/marker attributes that processAttributes later strips from clones.
 */
function parseTemplate(strings: TemplateStringsArray, valueCount: number): HTMLTemplateElement {
  let template = templateCache.get(strings);
  if (template) return template;

  // Build the HTML string with markers.
  // Track HTML parsing state to auto-quote markers in unquoted
  // attribute positions where the > in --> would close the tag.
  // See ADR 0069.
  let htmlStr = '';
  let inTag = false;
  let quoteChar: string | null = null;

  for (let i = 0; i < strings.length; i++) {
    const s = strings[i] ?? '';
    for (let c = 0; c < s.length; c++) {
      const ch = s.charAt(c);
      if (quoteChar) { if (ch === quoteChar) quoteChar = null; }
      else if (inTag) {
        if (ch === '>') inTag = false;
        else if (ch === '"' || ch === "'") quoteChar = ch;
      } else { if (ch === '<') inTag = true; }
    }
    htmlStr += s;
    if (i < valueCount) {
      const needsQuotes = inTag && !quoteChar && /=\s*$/.test(s);
      htmlStr += needsQuotes ? `"${createMarker(i)}"` : createMarker(i);
    }
  }

  parseCount++;
  template = document.createElement('template');
  template.innerHTML = htmlStr;
  templateCache.set(strings, template);

  // Dev-only first-parse audit (N101–N104); no-op when disabled.
  auditTemplate(strings, template);

  return template;
}

// ── Marker for expression slots ─────────────────────────────────────

const MARKER_PREFIX = '<!--bk-';
const MARKER_SUFFIX = '-->';
const ATTR_MARKER = 'bk-';

/**
 * Generate a unique marker for each expression slot.
 * We use HTML comments as markers in text positions and
 * special attribute prefixes for attribute positions.
 */
function createMarker(index: number): string {
  return `${MARKER_PREFIX}${index}${MARKER_SUFFIX}`;
}

// ── Binding types ───────────────────────────────────────────────────

interface TextBinding {
  type: 'text';
  node: Text;
  dispose?: () => void;
}

interface AttributeBinding {
  type: 'attribute';
  element: Element;
  name: string;
  dispose?: () => void;
}

interface ClassBinding {
  type: 'class';
  element: Element;
  className: string;
  dispose?: () => void;
}

interface EventBinding {
  type: 'event';
  element: Element;
  eventName: string;
  handler: EventListener;
  modifiers: string[];
  dispose?: () => void;
}

interface InnerHtmlBinding {
  type: 'innerHtml';
  element: Element;
  dispose?: () => void;
}

interface ChildBinding {
  type: 'child';
  startMarker: Comment;
  endMarker: Comment;
  currentNodes: Node[];
  dispose?: () => void;
}

type Binding = TextBinding | AttributeBinding | ClassBinding | EventBinding | InnerHtmlBinding | ChildBinding;

// ── html tagged template ────────────────────────────────────────────

/**
 * Tagged template literal for creating reactive DOM templates.
 *
 * ```ts
 * const name = signal('World');
 * const greeting = html`<h1>Hello, ${name}!</h1>`;
 * ```
 *
 * Signals in expression slots are detected automatically and
 * create fine-grained bindings. When the signal changes, only
 * the specific text node or attribute updates — no diffing needed.
 */
export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): TemplateResult {
  const bindings: Binding[] = [];
  const disposers: (() => void)[] = [];
  // Dev-only: remember the authoring callsite for first-parse audit
  // diagnostics — by first-mount time this frame is gone from the stack.
  captureCallsite(strings);
  let mounted = false;

  return {
    __templateResult: true as const,

    mount(host: HTMLElement): void {
      // Single-mount guard (ADR 0030.2 T4 + §8): a second mount of a live,
      // un-disposed result with value bindings would attach a second set of
      // bindings to the same shared arrays — shared-binding corruption.
      // Zero-binding templates (the registry's shared static icon pattern)
      // stay multi-mountable; dispose() → mount() stays legal.
      if (mounted && values.length > 0) {
        throw nisliError(
          'N105',
          `mount() on an already-mounted TemplateResult with ${values.length} value ` +
          `binding(s) — dispose() it first or create a fresh template per mount. ` +
          `Template starts: ${JSON.stringify((strings[0] ?? '').slice(0, 60))}`,
        );
      }
      mounted = true;

      // Parse-once: the parsed template is cached per callsite; each mount
      // only pays the clone + binding walk. The per-mount processNode walk
      // below REMAINS by design until the ADR 0014-class work — caching
      // removes the *parse*, not the walk (ADR 0030.2 §8).
      const template = parseTemplate(strings, values.length);
      const fragment = template.content.cloneNode(true) as DocumentFragment;

      // Walk the DOM tree and replace markers with bindings
      processNode(fragment, values, bindings, disposers);

      // Mount into host
      host.appendChild(fragment);
    },

    dispose(): void {
      for (const d of disposers) {
        try { d(); } catch (_) {}
      }
      disposers.length = 0;
      for (const b of bindings) {
        if ('dispose' in b && b.dispose) {
          try { b.dispose(); } catch (_) {}
        }
      }
      bindings.length = 0;
      mounted = false;
    },
  };
}

// ── DOM walking and binding creation ────────────────────────────────

function processNode(
  node: Node,
  values: unknown[],
  bindings: Binding[],
  disposers: (() => void)[],
): void {
  // Process element attributes
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    processAttributes(el, values, bindings, disposers);
  }

  // Process text nodes and comments (markers)
  if (node.nodeType === Node.COMMENT_NODE) {
    const comment = node as Comment;
    const text = comment.textContent || '';
    // Check if this is one of our markers
    if (text.startsWith('bk-') && !isNaN(Number(text.slice(3)))) {
      const index = Number(text.slice(3));
      const value = values[index];
      replaceMarkerWithBinding(comment, value, bindings, disposers);
      return; // Don't recurse into replaced content
    }
  }

  // Process child nodes (make a copy since we may mutate)
  const children = [...node.childNodes];
  for (const child of children) {
    processNode(child, values, bindings, disposers);
  }
}

function processAttributes(
  el: Element,
  values: unknown[],
  bindings: Binding[],
  disposers: (() => void)[],
): void {
  // We need to find attributes that contain markers
  const attrsToRemove: string[] = [];

  for (const attr of [...el.attributes]) {
    const name = attr.name;
    const attrValue = attr.value;

    // Check for @event bindings
    if (name.startsWith('@')) {
      const eventParts = name.slice(1).split('.');
      const eventName = eventParts[0] ?? '';
      const modifiers = eventParts.slice(1);

      // The value should be a marker containing the handler
      const markerMatch = attrValue.match(/<!--bk-(\d+)-->/);
      if (markerMatch) {
        const index = Number(markerMatch[1]);
        const handler = values[index];
        if (typeof handler === 'function') {
          // Cleanup is registered on the EventBinding (removes the installed
          // safeHandler); a manual removeEventListener here would target the
          // original handler and no-op. See bindEvent (UI-33-R).
          bindEvent(el, eventName, handler as EventListener, modifiers, bindings);
        }
      }
      attrsToRemove.push(name);
      continue;
    }

    // Check for class:name bindings
    if (name.startsWith('class:')) {
      const className = name.slice(6);
      const markerMatch = attrValue.match(/<!--bk-(\d+)-->/);
      if (markerMatch) {
        const index = Number(markerMatch[1]);
        const value = values[index];
        bindClass(el, className, value, bindings, disposers);
      }
      attrsToRemove.push(name);
      continue;
    }

    // Check for html:inner binding (trusted HTML rendering)
    if (name === 'html:inner') {
      const markerMatch = attrValue.match(/<!--bk-(\d+)-->/);
      if (markerMatch) {
        const index = Number(markerMatch[1]);
        const value = values[index];
        bindInnerHtml(el, value, bindings, disposers);
      }
      attrsToRemove.push(name);
      continue;
    }

    // Check for ref binding: ref="${myRef}"
    if (name === 'ref' && attrValue.includes(MARKER_PREFIX)) {
      const markerMatch = attrValue.match(/<!--bk-(\d+)-->/);
      if (markerMatch) {
        const index = Number(markerMatch[1]);
        const value = values[index];
        if (isRef(value)) {
          (value as Ref).current = el;
          disposers.push(() => { (value as Ref).current = null; });
        }
      }
      attrsToRemove.push(name);
      continue;
    }

    // Check for regular attribute bindings with markers
    if (attrValue.includes(MARKER_PREFIX)) {
      const markers = [...attrValue.matchAll(/<!--bk-(\d+)-->/g)];
      if (markers.length) {
        const first = markers[0];
        // Single expression = entire value: preserve raw type and signal
        if (markers.length === 1 && first && attrValue === first[0]) {
          bindAttribute(el, name, values[Number(first[1])], bindings, disposers);
        } else {
          // Mixed static + dynamic: resolve markers into string
          const resolve = () => attrValue.replace(/<!--bk-(\d+)-->/g, (_, i) => {
            const v = values[Number(i)];
            const raw = isSignal(v) ? (v as ReadonlySignal<unknown>).value : v;
            return raw == null || raw === false ? '' : String(raw);
          });
          const hasSignals = markers.some(m => isSignal(values[Number(m[1])]));
          bindAttribute(el, name, hasSignals ? computed(resolve) : resolve(), bindings, disposers);
        }
      }
      continue;
    }
  }

  for (const name of attrsToRemove) {
    el.removeAttribute(name);
  }
}

/**
 * Mount a factory result (from component() factory functions) into a DOM element.
 * Handles prop forwarding (with signal subscriptions) and host-level class attrs.
 */
function mountFactoryResult(
  factory: { tagName: string; props: Record<string, unknown>; hostAttrs?: { class?: unknown } },
): { element: HTMLElement; dispose: () => void } {
  const el = document.createElement(factory.tagName);
  const localDisposers: (() => void)[] = [];
  for (const [key, raw] of Object.entries(factory.props)) {
    if (isSignal(raw)) {
      const sig = raw as ReadonlySignal<unknown>;
      const unsub = sig.subscribe((newVal: unknown) => {
        (el as any)._setProp?.(key, newVal);
      });
      localDisposers.push(unsub);
    } else {
      (el as any)._setProp?.(key, raw);
    }
  }
  if (factory.hostAttrs?.class != null) {
    const classVal = factory.hostAttrs.class;
    if (isSignal(classVal)) {
      const sig = classVal as ReadonlySignal<string>;
      let prevClasses: string[] = [];
      const applyClasses = (raw: string) => {
        const next = raw ? raw.split(/\s+/).filter(Boolean) : [];
        for (const cls of prevClasses) {
          if (!next.includes(cls)) el.classList.remove(cls);
        }
        for (const cls of next) {
          if (!prevClasses.includes(cls)) el.classList.add(cls);
        }
        prevClasses = next;
      };
      const unsub = sig.subscribe(applyClasses);
      localDisposers.push(unsub);
    } else if (typeof classVal === 'string' && classVal) {
      for (const cls of classVal.split(/\s+/).filter(Boolean)) {
        el.classList.add(cls);
      }
    }
  }
  return {
    element: el,
    dispose() {
      for (const dispose of localDisposers.splice(0)) {
        try { dispose(); } catch (_) { /* swallow */ }
      }
    },
  };
}

function replaceMarkerWithBinding(
  comment: Comment,
  value: unknown,
  bindings: Binding[],
  disposers: (() => void)[],
): void {
  const parent = comment.parentNode;
  if (!parent) return;

  if (isSignal(value)) {
    // Every reactive child is a slot because its future values may have any
    // documented child type. The slot still keeps a single Text node alive for
    // primitive-to-primitive updates, preserving the O(1) text fast path.
    const startMarker = document.createComment('slot-start');
    const endMarker = document.createComment('slot-end');
    parent.replaceChild(endMarker, comment);
    parent.insertBefore(startMarker, endMarker);

    let currentResults: TemplateResult[] = [];
    let currentNodes: Node[] = [];
    let currentFactoryDisposers: (() => void)[] = [];
    let currentText: Text | null = null;
    // Sentinel distinct from any resolvable value (including null/undefined)
    // so the FIRST effect run always mounts. See ADR 0008.1.
    const NOT_RENDERED = Symbol('not-rendered');
    let lastValue: unknown = NOT_RENDERED;

    const dispose = effect(() => {
      const newValue = (value as ReadonlySignal<unknown>).value;
      // Use endMarker.parentNode — the captured `parent` may be a
      // DocumentFragment that was already appended to the real DOM,
      // leaving the markers reparented under the actual DOM element.
      const liveParent = endMarker.parentNode;
      if (!liveParent) return;

      // Memoize by referential identity. A computed/signal only notifies
      // when its value changes by Object.is, so an EQUAL value here means
      // this effect was re-triggered by some OTHER dependency (a tracking
      // leak), not by an actual change to this slot. Re-mounting identical
      // content would destroy live DOM (and reset scroll/focus) for nothing.
      // See ADR 0008.1.
      if (newValue === lastValue) return;
      lastValue = newValue;

      const isTemplate = Boolean(
        newValue
        && typeof newValue === 'object'
        && '__templateResult' in newValue,
      );
      const isFactory = Boolean(
        newValue
        && typeof newValue === 'object'
        && '__type' in newValue
        && (newValue as any).__type === 'factory',
      );
      const isPrimitive = newValue != null
        && newValue !== false
        && !Array.isArray(newValue)
        && !isTemplate
        && !isFactory;

      if (isPrimitive && currentText) {
        currentText.data = String(newValue);
        return;
      }

      // Dispose and remove the previous slot value before mounting the next.
      // Ownership is per VALUE, not per outer template lifetime: factory prop
      // subscriptions must stop as soon as their child leaves (issue 0011).
      for (const r of currentResults) {
        try { r.dispose(); } catch (_) {}
      }
      for (const dispose of currentFactoryDisposers) {
        try { dispose(); } catch (_) {}
      }
      for (const node of currentNodes) {
        node.parentNode?.removeChild(node);
      }
      currentNodes = [];
      currentResults = [];
      currentFactoryDisposers = [];
      currentText = null;

      if (newValue == null) {
        // null/undefined — nothing to mount
      } else if (Array.isArray(newValue)) {
        // Array of TemplateResults (or mixed content)
        for (const item of newValue) {
          if (item && typeof item === 'object' && '__templateResult' in item) {
            const tpl = item as TemplateResult;
            const wrapper = document.createDocumentFragment();
            tpl.mount(wrapper as unknown as HTMLElement);
            const nodes = [...wrapper.childNodes];
            currentNodes.push(...nodes);
            currentResults.push(tpl);
            liveParent.insertBefore(wrapper, endMarker);
          } else if (item && typeof item === 'object' && '__type' in item && (item as any).__type === 'factory') {
            const mounted = mountFactoryResult(item as any);
            currentNodes.push(mounted.element);
            currentFactoryDisposers.push(mounted.dispose);
            liveParent.insertBefore(mounted.element, endMarker);
          } else if (item != null && item !== false) {
            const textNode = document.createTextNode(String(item));
            currentNodes.push(textNode);
            liveParent.insertBefore(textNode, endMarker);
          }
        }
      } else if (isTemplate) {
        // Single TemplateResult
        const tpl = newValue as TemplateResult;
        const wrapper = document.createDocumentFragment();
        tpl.mount(wrapper as unknown as HTMLElement);
        currentNodes = [...wrapper.childNodes];
        currentResults.push(tpl);
        liveParent.insertBefore(wrapper, endMarker);
      } else if (isFactory) {
        // Factory result — create child element
        const mounted = mountFactoryResult(newValue as any);
        currentNodes.push(mounted.element);
        currentFactoryDisposers.push(mounted.dispose);
        liveParent.insertBefore(mounted.element, endMarker);
      } else if (newValue !== false) {
        currentText = document.createTextNode(String(newValue));
        currentNodes.push(currentText);
        liveParent.insertBefore(currentText, endMarker);
      }
    });
    disposers.push(dispose);
    // TemplateResult.dispose() intentionally leaves mounted DOM in place, but
    // it must still dispose bindings owned by the CURRENT reactive slot value.
    disposers.push(() => {
      for (const r of currentResults.splice(0)) {
        try { r.dispose(); } catch (_) {}
      }
      for (const factoryDispose of currentFactoryDisposers.splice(0)) {
        try { factoryDispose(); } catch (_) {}
      }
      currentNodes = [];
      currentText = null;
    });
  } else if (value && typeof value === 'object' && '__templateResult' in value) {
    // Nested template result — mount it
    const result = value as TemplateResult;
    const startMarker = document.createComment('tpl-start');
    const endMarker = document.createComment('tpl-end');
    parent.replaceChild(endMarker, comment);
    parent.insertBefore(startMarker, endMarker);

    // Create a wrapper element to mount into
    const wrapper = document.createDocumentFragment();
    result.mount(wrapper as unknown as HTMLElement);
    parent.insertBefore(wrapper, endMarker);

    disposers.push(() => result.dispose());
  } else if (value && typeof value === 'object' && '__type' in value && (value as any).__type === 'factory') {
    // Factory result — create child element
    const mounted = mountFactoryResult(value as any);
    parent.replaceChild(mounted.element, comment);
    disposers.push(mounted.dispose);
  } else if (Array.isArray(value)) {
    // Array of template results
    const startMarker = document.createComment('list-start');
    const endMarker = document.createComment('list-end');
    parent.replaceChild(endMarker, comment);
    parent.insertBefore(startMarker, endMarker);

    for (const item of value) {
      if (item && typeof item === 'object' && '__templateResult' in item) {
        const wrapper = document.createDocumentFragment();
        (item as TemplateResult).mount(wrapper as unknown as HTMLElement);
        parent.insertBefore(wrapper, endMarker);
        disposers.push(() => (item as TemplateResult).dispose());
      } else if (item && typeof item === 'object' && '__type' in item && (item as any).__type === 'factory') {
        const mounted = mountFactoryResult(item as any);
        parent.insertBefore(mounted.element, endMarker);
        disposers.push(mounted.dispose);
      } else {
        const textNode = document.createTextNode(String(item));
        parent.insertBefore(textNode, endMarker);
      }
    }
  } else if (value == null || value === false) {
    // null, undefined, false — render nothing
    parent.removeChild(comment);
  } else {
    // Primitive value — render as text
    const textNode = document.createTextNode(String(value));
    parent.replaceChild(textNode, comment);
  }
}

function bindAttribute(
  el: Element,
  name: string,
  value: unknown,
  bindings: Binding[],
  disposers: (() => void)[],
): void {
  // class attribute gets special handling to avoid conflicts with
  // class:name directives (see bindClassAttribute for details).
  if (name === 'class') {
    bindClassAttribute(el, value, bindings, disposers);
    return;
  }

  // Auto-resolution: framework components get _setProp for custom props
  // (preserves types). Standard HTML attributes (id, style, data-*, aria-*,
  // and — ADR 0030.2 §8 — title/role/tabindex/name) always use setAttribute
  // even on framework components: routed through _setProp they were silently
  // dead (no component declares them as props).
  const isHtmlAttr = name === 'id' || name === 'style'
    || name === 'slot' || name === 'title' || name === 'role'
    || name === 'tabindex' || name === 'name'
    || name.startsWith('data-') || name.startsWith('aria-');
  const hasPropSetter = !isHtmlAttr && typeof (el as any)._setProp === 'function';

  if (hasPropSetter) {
    if (isSignal(value)) {
      const binding: AttributeBinding = { type: 'attribute', element: el, name };
      bindings.push(binding);
      const dispose = effect(() => {
        (el as any)._setProp(name, (value as ReadonlySignal<unknown>).value);
      });
      binding.dispose = dispose;
      disposers.push(dispose);
    } else {
      (el as any)._setProp(name, value);
    }
    return;
  }

  bindPlainAttribute(el, name, value, bindings, disposers);
}

/**
 * Bind a value as a plain HTML attribute via `setAttribute`, reactive when it
 * is a signal, with `html`'s boolean/null semantics (true → present empty,
 * false/null/undefined → absent). NEVER uses `_setProp` — this is the shared
 * attribute path used by both `bindAttribute` (its non-component branch) and
 * `el()`, whose contract is *plain-HTML authoring*: a framework component tag
 * reached this way receives its values as attributes and resolves them through
 * its `attr()`/`boolAttr()` fallbacks, not typed prop setters.
 */
function bindPlainAttribute(
  el: Element,
  name: string,
  value: unknown,
  bindings: Binding[],
  disposers: (() => void)[],
): void {
  if (isSignal(value)) {
    const binding: AttributeBinding = { type: 'attribute', element: el, name };
    bindings.push(binding);

    const dispose = effect(() => {
      const v = (value as ReadonlySignal<unknown>).value;
      if (v == null || v === false) {
        el.removeAttribute(name);
      } else if (v === true) {
        el.setAttribute(name, '');
      } else {
        el.setAttribute(name, String(v));
      }
    });
    binding.dispose = dispose;
    disposers.push(dispose);
  } else {
    if (value == null || value === false) {
      el.removeAttribute(name);
    } else if (value === true) {
      el.setAttribute(name, '');
    } else {
      el.setAttribute(name, String(value));
    }
  }
}

/**
 * Bind a reactive class attribute using classList.add/remove instead of
 * setAttribute('class', ...). This prevents the class attribute binding
 * from overwriting classes toggled by class:name directives.
 *
 * The problem: setAttribute('class', 'foo bar') replaces ALL classes,
 * wiping out any classes added by classList.toggle() from class:name
 * bindings. By tracking which classes "belong" to the class attribute
 * and using classList operations, we only manage our own classes.
 */
function bindClassAttribute(
  el: Element,
  value: unknown,
  bindings: Binding[],
  disposers: (() => void)[],
): void {
  // On first call, we must clear the parser-set class attribute which
  // contains raw marker text (e.g. "badge status-<!--bk-0-->").
  // We snapshot any non-marker classes set by the parser before clearing.
  let initialized = false;
  let prevClasses: string[] = [];

  const applyClasses = (raw: unknown) => {
    if (!initialized) {
      // Clear the parser's class attribute (contains marker text)
      el.setAttribute('class', '');
      initialized = true;
    }
    const str = raw == null || raw === false ? '' : String(raw);
    const next = str.split(/\s+/).filter(Boolean);

    // Remove classes no longer in the attribute value
    for (const cls of prevClasses) {
      if (!next.includes(cls)) {
        el.classList.remove(cls);
      }
    }
    // Add new classes
    for (const cls of next) {
      if (!prevClasses.includes(cls)) {
        el.classList.add(cls);
      }
    }
    prevClasses = next;
  };

  if (isSignal(value)) {
    const binding: AttributeBinding = { type: 'attribute', element: el, name: 'class' };
    bindings.push(binding);

    const dispose = effect(() => {
      applyClasses((value as ReadonlySignal<unknown>).value);
    });
    binding.dispose = dispose;
    disposers.push(dispose);
  } else {
    applyClasses(value);
  }
}

function bindClass(
  el: Element,
  className: string,
  value: unknown,
  bindings: Binding[],
  disposers: (() => void)[],
): void {
  if (isSignal(value)) {
    const binding: ClassBinding = { type: 'class', element: el, className };
    bindings.push(binding);

    const dispose = effect(() => {
      const v = (value as ReadonlySignal<unknown>).value;
      el.classList.toggle(className, !!v);
    });
    binding.dispose = dispose;
    disposers.push(dispose);
  } else {
    el.classList.toggle(className, !!value);
  }
}

/**
 * Bind branded HTML content to an element's inner markup.
 *
 * Never a bare string — a brand is the author's explicit decision about where
 * the markup came from, which is what closes the accidental-XSS-sink class
 * (ADR 0030.2 §3/§8). Three shapes resolve, in the order they are checked:
 *
 * - `raw()` (core owns the `__raw` brand; @nisli/ssg re-exports it):
 *   author-asserted trust → today's `innerHTML` sink, unchanged.
 *   NEVER wrap user-generated input in raw().
 * - `sanitized()` → the sanitizer sink: native `Element.setHTML()`, else the
 *   `setSanitizerFallback()` hook, else N107. It NEVER reaches `innerHTML`
 *   (ADR 0019:124–128, bet-09(c)).
 * - A native `TrustedHTML` object → the same `innerHTML` sink as `raw()`,
 *   passed through unwrapped so Trusted-Types-enforcing apps can assign
 *   policy output directly.
 *
 * Anything else throws N106. Supports both static values and reactive
 * `Signal`s of them; when the signal changes the content is rewritten through
 * the same branch. null/undefined (branded or not) clears the content.
 *
 * Usage in templates:
 *   html`<span html:inner="${raw(highlightedHtml)}"></span>`
 *   html`<span html:inner="${sanitized(userComment)}"></span>`
 */
function bindInnerHtml(
  el: Element,
  value: unknown,
  bindings: Binding[],
  disposers: (() => void)[],
): void {
  // PURE — validates the brand and proves a sink exists without writing
  // anything, so the eager signal check below can run it for its throw alone.
  // A SanitizedHtml resolves to ITSELF (the writer routes it to the
  // sanitizer); everything else resolves to the innerHTML payload.
  const resolveHtml = (v: unknown): string | SanitizedHtml | TrustedHtml => {
    if (v == null) return '';
    if (isRawHtml(v)) {
      // Both brands at once: trust is not resolvable in favour of the raw
      // sink, so reject rather than guess which one the author meant.
      if (isSanitizedHtml(v)) {
        throw nisliError(
          'N106',
          `html:inner rejects a value branded both raw() and sanitized() — the ` +
          `trust decision is ambiguous. Pick one brand.`,
        );
      }
      return v.value;
    }
    if (isSanitizedHtml(v)) {
      // FAIL CLOSED. Untrusted markup is only ever eligible to be written once
      // a sanitizing sink is proven to exist; no native setHTML() and no
      // registered hook is a hard error, because silently downgrading to
      // innerHTML would reopen the exact XSS hole this brand closes.
      if (sanitizerFor(el) === null) {
        throw nisliError(
          'N107',
          `html:inner cannot render sanitized() markup: this engine has no native ` +
          `Element.setHTML() and no fallback is registered. Wire one at startup — ` +
          `setSanitizerFallback((el, html) => { el.innerHTML = DOMPurify.sanitize(html) }) ` +
          `— nisli ships no sanitizer and will not fall back to innerHTML.`,
        );
      }
      return v;
    }
    if (isTrustedHtml(v)) return v;
    throw nisliError(
      'N106',
      `html:inner rejects unbranded values (got ${typeof v}). Wrap trusted markup ` +
      `in raw(html), untrusted markup in sanitized(html) — and never wrap ` +
      `user-generated input in raw().`,
    );
  };

  const writeHtml = (v: unknown): void => {
    const resolved = resolveHtml(v);
    if (isSanitizedHtml(resolved)) {
      // The sanitizer sink. resolveHtml has already proven a writer exists,
      // and `el.innerHTML` is unreachable from this branch by construction.
      sanitizerFor(el)?.(el, resolved.value);
      return;
    }
    // The raw sink, unchanged: a plain string, or a TrustedHTML object handed
    // over WITHOUT stringifying it (stringifying would defeat the CSP check).
    // The cast only satisfies the DOM library's `string` typing.
    el.innerHTML = resolved as string;
  };

  if (isSignal(value)) {
    // Validate the INITIAL value untracked and eagerly so an unbranded or
    // unsanitizable signal throws synchronously out of mount(); later invalid
    // values throw inside the effect and land in effect error containment
    // (console.error, element content untouched).
    untracked(() => resolveHtml((value as ReadonlySignal<unknown>).value));

    const binding: InnerHtmlBinding = { type: 'innerHtml', element: el };
    bindings.push(binding);

    const dispose = effect(() => {
      writeHtml((value as ReadonlySignal<unknown>).value);
    });
    binding.dispose = dispose;
    disposers.push(dispose);
  } else {
    writeHtml(value);
  }
}

function bindEvent(
  el: Element,
  eventName: string,
  handler: EventListener,
  modifiers: string[],
  bindings: Binding[],
): void {
  // One canonical INSTALLED identity that every removal path references — the
  // EventBinding `dispose` below AND the `once` self-removal. Forward-declared
  // so the modifier wrappers close over it before it is assigned; it is only
  // ever *called* after addEventListener, so the reference always resolves.
  // This identity-mismatch class bit el() dispose, html dispose, and once — a
  // single installed handler that all removals target closes it (UI-33-R2).
  let safeHandler!: EventListener;

  // Compose the modifier chain (inner); safeHandler wraps it in try/catch below.
  let composed: EventListener = handler;

  if (modifiers.includes('stop')) {
    const inner = composed;
    composed = (e: Event) => {
      e.stopPropagation();
      inner(e);
    };
  }
  if (modifiers.includes('prevent')) {
    const inner = composed;
    composed = (e: Event) => {
      e.preventDefault();
      inner(e);
    };
  }
  if (modifiers.includes('once')) {
    const inner = composed;
    composed = (e: Event) => {
      // Remove the ACTUALLY-INSTALLED listener, not this intermediate wrapper.
      el.removeEventListener(eventName, safeHandler);
      inner(e);
    };
  }

  // Keyboard modifiers
  for (const mod of modifiers) {
    if (['enter', 'escape', 'space', 'tab'].includes(mod)) {
      const keyMap: Record<string, string> = {
        enter: 'Enter',
        escape: 'Escape',
        space: ' ',
        tab: 'Tab',
      };
      const inner = composed;
      composed = (e: Event) => {
        if ((e as KeyboardEvent).key === keyMap[mod]) {
          inner(e);
        }
      };
    }
  }

  // Wrap in try/catch for error containment — THIS is the installed handler.
  // Handler bodies run UNTRACKED (ADR 0030.2 §8, surfaced by the T5 review):
  // synchronous dispatchEvent from inside an effect would otherwise run the
  // handler under that effect's observer — widening the effect's dependency
  // set with every signal the handler reads and mis-attributing its writes.
  safeHandler = (e: Event) => {
    try {
      untrack(() => composed(e));
    } catch (err) {
      console.error(`Event handler error for '${eventName}':`, err);
    }
  };

  el.addEventListener(eventName, safeHandler);

  // Register cleanup of the ACTUALLY-INSTALLED handler (safeHandler), not the
  // caller's original — their identities differ, so a removeEventListener with
  // the original is a silent no-op (the UI-33-R leak). Both `html` dispose and
  // `el()` dispose iterate bindings and call `dispose`, so this is the single
  // correct cleanup path for event listeners.
  bindings.push({
    type: 'event',
    element: el,
    eventName,
    handler: safeHandler,
    modifiers,
    dispose: () => el.removeEventListener(eventName, safeHandler),
  });
}

// ── each() reactive list rendering ──────────────────────────────────

/** Brand for each result detection */
const EACH_BRAND = Symbol.for('backlog.each');

interface EachEntry<T> {
  key: string | number;
  itemSignal: Signal<T>;
  indexSignal: Signal<number>;
  templateResult: TemplateResult;
  /** Stable wrapper element that survives inner reactive content changes. */
  wrapper: HTMLElement;
}

/**
 * Reactive list rendering with keyed reconciliation.
 *
 * Renders a list of items from a signal, tracking each item by key.
 * When the array changes, only affected DOM nodes are added, removed,
 * or reordered — existing items update in-place via their signals.
 *
 * ```ts
 * const tasks = signal([{ id: '1', title: 'A' }, { id: '2', title: 'B' }]);
 * html`<ul>${each(tasks, t => t.id, (task, index) =>
 *   html`<li>${computed(() => task.value.title)}</li>`
 * )}</ul>`
 * ```
 */
export function each<T>(
  items: ReadonlySignal<T[]>,
  keyFn: (item: T, index: number) => string | number,
  templateFn: (item: ReadonlySignal<T>, index: ReadonlySignal<number>) => TemplateResult,
): TemplateResult {
  let startMarker: Comment;
  let endMarker: Comment;
  let entries: EachEntry<T>[] = [];
  let effectDispose: (() => void) | null = null;

  return {
    __templateResult: true as const,

    mount(host: HTMLElement) {
      startMarker = document.createComment('each-start');
      endMarker = document.createComment('each-end');
      host.appendChild(startMarker);
      host.appendChild(endMarker);

      effectDispose = effect(() => {
        const newItems = items.value;
        reconcile(newItems);
      });
    },

    dispose() {
      if (effectDispose) {
        effectDispose();
        effectDispose = null;
      }
      for (const entry of entries) {
        entry.templateResult.dispose();
      }
      entries = [];
    },
  };

  function reconcile(newItems: T[]) {
    const parent = endMarker.parentNode;
    if (!parent) return;

    // Validate the whole key set before updating item signals, mounting new
    // entries, or touching DOM. A duplicate update must leave the last valid
    // reconciliation intact so a later corrected array can recover normally.
    const keyedItems: Array<{ item: T; index: number; key: string | number }> = [];
    const keyIndices = new Map<string | number, number>();
    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      if (item === undefined) continue;
      const key = keyFn(item, i);
      const previousIndex = keyIndices.get(key);
      if (previousIndex !== undefined) {
        const formattedKey = typeof key === 'string' ? JSON.stringify(key) : String(key);
        console.error(
          `each() requires unique keys. Duplicate key ${formattedKey} ` +
          `found at indices ${previousIndex} and ${i}; reconciliation skipped.`,
        );
        return;
      }
      keyIndices.set(key, i);
      keyedItems.push({ item, index: i, key });
    }

    // Build old key → entry map
    const oldMap = new Map<string | number, EachEntry<T>>();
    for (const entry of entries) {
      oldMap.set(entry.key, entry);
    }

    // Build new entries list
    const newEntries: EachEntry<T>[] = [];
    const newKeys = new Set<string | number>();

    for (const { item, index, key } of keyedItems) {
      newKeys.add(key);

      const existing = oldMap.get(key);
      if (existing) {
        // Reuse — update signals in place
        existing.itemSignal.value = item;
        existing.indexSignal.value = index;
        newEntries.push(existing);
      } else {
        // Create new entry with a stable wrapper element.
        // Using display:contents so the wrapper is invisible to layout —
        // inner reactive content can freely swap DOM nodes without
        // invalidating the each() reconciler's node tracking.
        const itemSignal = signal(item) as Signal<T>;
        const indexSignal = signal(index);
        const wrapper = document.createElement('each-item');
        wrapper.style.display = 'contents';
        const templateResult = templateFn(itemSignal, indexSignal);
        templateResult.mount(wrapper);
        newEntries.push({ key, itemSignal, indexSignal, templateResult, wrapper });
      }
    }

    // Remove entries whose key is gone
    for (const entry of entries) {
      if (!newKeys.has(entry.key)) {
        entry.templateResult.dispose();
        entry.wrapper.parentNode?.removeChild(entry.wrapper);
      }
    }

    // Reorder DOM nodes to match new order.
    // Each entry has exactly one stable wrapper element, so positioning
    // is simple and immune to inner reactive content swaps.
    let cursor: Node = startMarker;
    for (const entry of newEntries) {
      const nextSibling = cursor.nextSibling;
      if (nextSibling !== entry.wrapper) {
        if (entry.wrapper.parentNode === parent && canMoveWithin(parent)) {
          // Already attached under this parent: atomic move preconditions hold.
          parent.moveBefore(entry.wrapper, nextSibling);
        } else {
          // Fresh wrapper, or a browser without moveBefore().
          parent.insertBefore(entry.wrapper, nextSibling);
        }
      }
      cursor = entry.wrapper;
    }

    entries = newEntries;
  }
}

/**
 * Conditional rendering helper (ADR 0030.2 §3, boolean-gated with `else`).
 *
 * Shows `template` when the condition is truthy, `elseTemplate` (optional)
 * when falsy. Both arms accept a TemplateResult or a lazy callback
 * `() => TemplateResult`; callbacks are only evaluated for the active arm.
 *
 * Semantics for signal conditions:
 * - The gate is `!!condition.value` — a truthy→truthy (or falsy→falsy)
 *   transition returns the memoized previous result, so the live branch is
 *   NEVER rebuilt (no state/scroll/focus loss) and callbacks never re-run.
 * - Branch callbacks evaluate UNTRACKED: a signal read during branch
 *   construction does not subscribe the when() computed, so it cannot
 *   trigger a rebuild. Reactive parts inside a branch must be interpolated
 *   as signals/computeds (values), not read raw at construction time.
 */
export function when(
  condition: unknown,
  template: TemplateResult | (() => TemplateResult),
  elseTemplate?: TemplateResult | (() => TemplateResult),
): TemplateResult | ReadonlySignal<TemplateResult | null> | null {
  const resolveBranch = (
    branch: TemplateResult | (() => TemplateResult) | undefined,
  ): TemplateResult | null => {
    if (branch === undefined) return null;
    if (typeof branch === 'function') return untracked(branch);
    return branch;
  };

  if (isSignal(condition)) {
    // Boolean-gated memo: notify() marks observers dirty EAGERLY (before
    // value-equality is known), so a computed chain alone cannot stop a
    // truthy→truthy recompute from re-evaluating the branch. The memo pins
    // branch evaluation to actual boolean FLIPS; equal gates return the
    // cached result, which the slot then memoizes by identity (ADR 0008.1).
    let lastGate: boolean | undefined;
    let lastResult: TemplateResult | null = null;
    return computed(() => {
      const gate = !!(condition as ReadonlySignal<unknown>).value;
      if (gate === lastGate) return lastResult;
      const next = gate ? resolveBranch(template) : resolveBranch(elseTemplate);
      // Commit the memo only after a successful resolve so a throwing branch
      // callback retries on the next read (computed error containment).
      lastGate = gate;
      lastResult = next;
      return next;
    });
  }
  return condition ? resolveBranch(template) : resolveBranch(elseTemplate);
}

// ── el(): dynamic tag names (ADR 0025 item 11) ──────────────────────

/** A value bindable to an `el()` attribute — static or reactive. */
type ElAttrValue = string | number | boolean | null | undefined | ReadonlySignal<unknown>;

export interface ElProps {
  /** Assigned to `.current` on mount, nulled on dispose. */
  ref?: Ref;
  /** Event handlers by native event name; auto-removed on dispose. */
  on?: Record<string, EventListener>;
  /** Any other key is an HTML attribute (static or signal → reactive). */
  [attr: string]: ElAttrValue | Ref | Record<string, EventListener> | undefined;
}

/** A child accepted by `el()` — anything an `html` text slot accepts, plus arrays. */
export type ElChild =
  | string
  | number
  | boolean
  | null
  | undefined
  | TemplateResult
  | ReadonlySignal<unknown>
  | { __type: 'factory' }
  | ElChild[];

/**
 * Build a DOM element by a (possibly *dynamic*) tag name with reactive
 * attributes, event handlers, and children, returned as a mountable/disposable
 * `TemplateResult` — so it composes in an `html` slot:
 * `` html`${el(tag, { class: cls }, children)}` ``.
 *
 * `el()` is the "author plain HTML programmatically" primitive. It exists for
 * the one thing `html` cannot express — a tag name chosen at runtime — while
 * the `html` PARSER STAYS 100% STATIC: `el()` is a separate construction path
 * that shares `html`'s binding helpers (`bindPlainAttribute`, `bindClassAttribute`,
 * `bindEvent`, and the `replaceMarkerWithBinding` slot mounter). Prefer `html`
 * for static tags and typed factories for typed composition.
 *
 * Semantics (ADR 0025 item 11):
 * - Props are **HTML attributes**: `class` uses the reactive class binder, every
 *   other key uses `setAttribute` with `html`'s boolean/null rules — NEVER
 *   `_setProp`. A framework component tag reached via `el()` receives its values
 *   as attributes and resolves them through its `attr()`/`boolAttr()` fallbacks.
 * - `ref` assigns `.current`; `on: { event: handler }` adds auto-removed listeners.
 * - Children accept the full `html` text-slot range — string/number, signals
 *   (reactive text or reactive template slot), `TemplateResult`, factory results,
 *   and arrays — via the shared slot mounter.
 * - v1 is HTML-only: SVG/namespaced tags (`createElementNS`) are deferred until a
 *   real consumer needs them.
 */
export function el(
  tag: string,
  props: ElProps = {},
  children?: ElChild | ElChild[],
): TemplateResult {
  let node: HTMLElement | null = null;
  const bindings: Binding[] = [];
  const disposers: (() => void)[] = [];

  return {
    __templateResult: true,

    mount(host: HTMLElement): void {
      const element = document.createElement(tag);
      node = element;

      for (const [key, val] of Object.entries(props)) {
        if (val === undefined) continue;
        if (key === 'ref') {
          if (isRef(val)) {
            (val as Ref).current = element;
            disposers.push(() => { (val as Ref).current = null; });
          }
          continue;
        }
        if (key === 'on') {
          // bindEvent registers correct disposal on the EventBinding (removes
          // the installed safeHandler); no manual removeEventListener (UI-33-R).
          for (const [event, handler] of Object.entries(val as Record<string, EventListener>)) {
            bindEvent(element, event, handler, [], bindings);
          }
          continue;
        }
        if (key === 'class') {
          bindClassAttribute(element, val, bindings, disposers);
          continue;
        }
        bindPlainAttribute(element, key, val, bindings, disposers);
      }

      // Children reuse html's text-slot mounter: append a comment anchor per
      // child and let replaceMarkerWithBinding resolve its type in place.
      const flat: ElChild[] = [];
      flattenChildren(children, flat);
      for (const child of flat) {
        const anchor = document.createComment('');
        element.appendChild(anchor);
        replaceMarkerWithBinding(anchor, child, bindings, disposers);
      }

      host.appendChild(element);
    },

    dispose(): void {
      for (const d of disposers) {
        try { d(); } catch (_) { /* swallow */ }
      }
      disposers.length = 0;
      for (const b of bindings) {
        if ('dispose' in b && b.dispose) {
          try { b.dispose(); } catch (_) { /* swallow */ }
        }
      }
      bindings.length = 0;
      node?.parentNode?.removeChild(node);
      node = null;
    },
  };
}

function flattenChildren(children: ElChild | ElChild[] | undefined, out: ElChild[]): void {
  if (children === undefined) return;
  if (Array.isArray(children)) {
    for (const c of children) flattenChildren(c, out);
  } else {
    out.push(children);
  }
}
