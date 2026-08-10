/**
 * projection.ts — First-class content projection (ADR 0025 item 1)
 *
 * `children(fallback?)` is a setup-context primitive that owns the light-DOM
 * projection machinery the registry currently hand-rolls
 * (captureChildren/projectChildren + per-component conditional-default swaps).
 *
 * ```ts
 * component('ui-button', (props, host) => {
 *   transparentHost(host);
 *   return html`<button class="${classes}">${children()}</button>`;
 * });
 * ```
 *
 * Semantics:
 * - Returns a reactive slot value (a signal) that a template interpolates. The
 *   slot resolves, in priority order: the factory `children` prop → the host's
 *   captured light-DOM children → the fallback.
 * - Factory `children` route through the SAME slot: `children()` READS the
 *   host's `children` prop signal (sugar over one path). Crucially it renders
 *   them AT the slot position (not by relocating them to light DOM), so a
 *   factory-composed child element is a DOM descendant of its parent when its
 *   connectedCallback runs — `closest()`-based parent lookup keeps working.
 * - Plain-HTML light-DOM children are captured pre-setup by component.ts
 *   (SEED → CAPTURE → CONTEXT) and projected here; late parser children are
 *   swept in a microtask (the ADR 0023 streaming machinery, now in core).
 * - `children(fallback)` renders `fallback` when no MEANINGFUL children exist
 *   (whitespace-only light DOM does not count) and REPLACES it reactively when
 *   children arrive — including late parser children. This natively solves the
 *   conditional-default class (message-scroller-button's default glyph).
 * - Single default slot only; named/multiple slots are a later design (v1 OUT).
 *
 * Zero-cost when unused: component.ts only snapshots childNodes when the host
 * has any, and only children() consumes them.
 */

import { getCurrentComponent } from './context.js';
import { onCleanup } from './lifecycle.js';
import { signal, computed, flush, type ReadonlySignal, type Signal } from './signal.js';
import type { TemplateResult } from './template.js';

/** True if the nodes carry meaningful content (element or non-blank text). */
function isMeaningful(nodes: Node[]): boolean {
  return nodes.some(
    (n) => n.nodeType === 1 || (n.nodeType === 3 && (n.textContent ?? '').trim() !== ''),
  );
}

/** A minimal TemplateResult that mounts pre-existing DOM nodes into the slot. */
function nodesTemplate(nodes: Node[]): TemplateResult {
  return {
    __templateResult: true,
    mount(w: HTMLElement) {
      for (const node of nodes) w.appendChild(node);
    },
    dispose() { /* nodes are owned by the host tree; nothing to tear down */ },
  } as unknown as TemplateResult;
}

/** A re-mountable TemplateResult that renders a primitive as a fresh text node. */
function textTemplate(text: string): TemplateResult {
  return {
    __templateResult: true,
    mount(w: HTMLElement) {
      w.appendChild(document.createTextNode(text));
    },
    dispose() { /* text node removed by the slot */ },
  } as unknown as TemplateResult;
}

/**
 * Normalize a slot value so the template ALWAYS sees a TemplateResult / factory
 * / array / null — never a bare primitive. Projection values may be detached
 * and reinserted as fallback/light-DOM ownership changes, so wrapping primitive
 * text keeps that projection value explicitly re-mountable.
 */
function asSlot(value: unknown): unknown {
  if (value == null || value === '') return null;
  if (
    typeof value === 'object'
    && ('__templateResult' in (value as object) || '__type' in (value as object))
  ) {
    return value;
  }
  if (Array.isArray(value)) return value;
  return textTemplate(String(value));
}

/**
 * Project the host's children (factory `children` prop or light DOM) into this
 * slot, with an optional `fallback` rendered when empty. Must be called in
 * setup context. Interpolate the result in a template:
 * `html`<button>${children()}</button>``.
 */
export function children(fallback?: TemplateResult | string): ReadonlySignal<unknown> {
  const host = getCurrentComponent().element as HTMLElement & {
    __capturedChildren?: Node[];
    __nisliProjectionSweep?: () => void;
    _propSignal?(key: string): Signal<unknown>;
  };

  // Consume the pre-setup light-DOM capture; remove those nodes from the host
  // so the rendered template doesn't duplicate them.
  const captured = host.__capturedChildren ?? [];
  host.__capturedChildren = undefined;
  for (const node of captured) {
    if (node.parentNode === host) host.removeChild(node);
  }

  // The factory `children` prop, folded into the same slot (sugar over one path).
  const childrenProp = host._propSignal ? host._propSignal('children') : undefined;

  // Projected light-DOM nodes; grows when the late-parser sweep finds more.
  const projectedNodes = signal<Node[]>(captured);

  // True once this setup scope has been disposed (true disconnect, HMR
  // teardown, OR the containment boundary tearing down a failed mount). The
  // queued sweep below must then no-op: it would otherwise misread the
  // post-teardown host children (restored light DOM, or the error fallback)
  // as "late" and relocate them into a dead slot.
  let disposed = false;

  // A true disconnect/HMR teardown clears the component-owned rendered tree
  // before setup runs again. Hand the plain light-DOM nodes back to component.ts
  // so it can restore them as direct host children for the next capture.
  onCleanup(() => {
    disposed = true;
    const nodes = projectedNodes.value;
    host.__capturedChildren = nodes.length ? nodes : undefined;
  });

  // LATE-CHILDREN SWEEP — scheduled by component.ts's dedicated projection
  // phase (ADR 0030.2 §3), which runs after the template is committed and
  // BEFORE any onMount callback. Pre-0030.2 this was registered via
  // children()'s own onMount, so the rendered-roots snapshot depended on
  // where children() sat relative to other onMount() registrations (the 0025
  // batch-3B ordering trap). Hoisting the SCHEDULING makes the rule
  // universal: the snapshot is exactly the rendered template roots, and
  // anything appearing after it — late parser/innerHTML children AND onMount
  // host-appends — classifies as projected content. Only scheduling moved;
  // the prop READ path (the computed below) is unchanged.
  host.__nisliProjectionSweep = () => {
    // The host's direct children at phase time are the rendered template
    // roots. Anything that appears later is late projected content.
    const renderedRoots = new Set<Node>(Array.from(host.childNodes));
    queueMicrotask(() => {
      if (disposed) return; // scope torn down before the sweep ran
      const late = Array.from(host.childNodes).filter((n) => !renderedRoots.has(n));
      if (late.length && isMeaningful(late)) {
        for (const node of late) host.removeChild(node);
        projectedNodes.value = [...projectedNodes.value, ...late];
        // Flush the slot effect NOW so the late children land in this same
        // microtask — the projectChildren() this replaces mutated the DOM
        // imperatively, so callers only await one microtask for the sweep.
        flush();
      }
    });
  };

  // Stable, RE-MOUNTABLE fallback slot: the same slot object is returned on
  // every empty render, and it can be mounted → unmounted → mounted again
  // (empty → filled → empty) without crashing. A string wraps to a fresh text
  // node each mount. A TemplateResult is mounted ONCE here into a detached
  // holder (its reactive bindings run in this component's context and dispose
  // with it); its rendered nodes are then exposed as a re-mountable node slot,
  // so the engine can detach and re-append them freely.
  let fallbackSlot: unknown = null;
  if (fallback != null) {
    if (typeof fallback === 'string') {
      fallbackSlot = textTemplate(fallback);
    } else {
      const holder = document.createDocumentFragment();
      fallback.mount(holder as unknown as HTMLElement);
      const fallbackNodes = Array.from(holder.childNodes);
      onCleanup(() => { try { fallback.dispose(); } catch (_) { /* ignore */ } });
      fallbackSlot = nodesTemplate(fallbackNodes);
    }
  }

  // Priority: factory children → captured/late light DOM → fallback. Reactive,
  // so late children (or a changing `children` prop) replace the fallback.
  return computed(() => {
    const kids = childrenProp?.value;
    if (kids != null && kids !== '') return asSlot(kids);
    const nodes = projectedNodes.value;
    if (isMeaningful(nodes)) return nodesTemplate(nodes);
    return fallbackSlot;
  });
}
