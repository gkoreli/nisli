/**
 * ui/resizable.ts — Resizable panel group.
 *
 * Ported from new-york-v4/ui/resizable.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui).
 * Upstream wraps `react-resizable-panels`, which isn't vendorable into a
 * copy-in file, so — like drawer/toast — the VISUALS are ported verbatim (the
 * panel-group / panel / handle class lists, data-slots, and the `withHandle`
 * grip) while the BEHAVIOR follows react-resizable-panels' conventions on plain
 * DOM: percentage-based flex sizing, pointer-drag on handles, and keyboard
 * arrows on a focused handle (role=separator with aria-valuenow). Like the
 * upstream primitive, panel registration follows mounted membership: removing
 * a panel removes it from layout math, and constraint changes re-clamp live.
 *
 * Three elements:
 *   <ui-resizable-panel-group direction="horizontal">
 *     <ui-resizable-panel default-size="50" min-size="20">…</ui-resizable-panel>
 *     <ui-resizable-handle with-handle></ui-resizable-handle>
 *     <ui-resizable-panel>…</ui-resizable-panel>
 *   </ui-resizable-panel-group>
 *
 * Groups nest (a panel may hold another group — each resolves its nearest
 * group). Sizes are percentages that always sum to 100; min-size is respected.
 * Releasing a drag (or a keyboard step) dispatches a bubbling `ui-resize`
 * CustomEvent (`detail: { layout }`) from the group host.
 *
 * v1 limits (documented): no collapsible panels and no imperative resize API.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  children,
  component,
  type ComponentAttrs,
  createContext,
  computed,
  effect,
  html,
  onCleanup,
  onMount,
  ref,
  signal,
  untrack,
  type ReadonlySignal,
  type Ref,
  type TemplateResult,
} from '@nisli/core';
import { cn, transparentHost } from '../lib/utils.js';

export type ResizableDirection = 'horizontal' | 'vertical';

const gripIcon = html`<svg class="size-2.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>`;

const KEYBOARD_STEP = 10;

// ── Group state (published on the <ui-resizable-panel-group> host) ───

interface PanelReg {
  el: HTMLElement;
  /** LIVE default-size (percent) — reactive so post-mount attr changes reflow. */
  defaultSize: ReadonlySignal<number | undefined>;
  /** LIVE min-size (percent) — reactive so post-mount attr changes clamp/aria. */
  minSize: ReadonlySignal<number>;
}

export interface ResizableGroupState {
  direction: ReadonlySignal<ResizableDirection>;
  layout: ReadonlySignal<number[]>;
  root: Ref<HTMLElement>;
  registerPanel(
    el: HTMLElement,
    defaultSize: ReadonlySignal<number | undefined>,
    minSize: ReadonlySignal<number>,
  ): void;
  /** Remove a disconnected panel from layout math and reflow survivors. */
  unregisterPanel(el: HTMLElement): void;
  /** Register a handle; returns the gap index (between panel i and i+1). */
  registerHandle(): number;
  /** Move `deltaPercent` from the panel after the gap into the one before it. */
  resizeByDelta(gapIndex: number, deltaPercent: number): void;
  /** Group size in px along the resize axis (falls back to 100 pre-layout). */
  groupSize(): number;
  ariaValues(gapIndex: number): { now: number; min: number; max: number };
  emitResize(): void;
}

/** Subtree-scoped channel from the Resizable provider to its parts. */
const ResizableContext = createContext<ResizableGroupState>('Resizable', { providerTag: 'ui-resizable-panel-group' });

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

// ── ui-resizable-panel-group ─────────────────────────────────────────

export type ResizablePanelGroupProps = {
  direction?: ResizableDirection;
  className?: string;
  children?: string | TemplateResult;
};

const resizablePanelGroupAttrs = {
  direction: 'string',
  className: 'string',
} satisfies ComponentAttrs<ResizablePanelGroupProps>;

export const ResizablePanelGroup = component<ResizablePanelGroupProps, typeof resizablePanelGroupAttrs>(
  'ui-resizable-panel-group',
  (props, host) => {
    transparentHost(host);

    // ADR 0025 items 1 + 3: attribute fallbacks (direction/class-name) come from
    // the `attrs` option below as LIVE prop signals — no userland attribute
    // helpers, and children() owns projection (no hand-rolled capture/project).
    const direction = computed<ResizableDirection>(() =>
      props.direction.value === 'vertical' ? 'vertical' : 'horizontal',
    );

    const panels: PanelReg[] = [];
    const layout = signal<number[]>([]);
    const root = ref<HTMLElement>();
    // Bumped whenever a panel (re)registers, so the reflow effect below re-reads
    // the panel list and re-subscribes to each panel's LIVE default-size signal.
    const reflowVersion = signal(0);

    const clampToMins = (input: number[]): number[] => {
      const sizes = [...input];
      const rawMins = panels.map((panel) => Math.max(0, panel.minSize.value));
      const minTotal = rawMins.reduce((sum, min) => sum + min, 0);
      // Impossible constraints degrade deterministically to normalized minima.
      const mins = minTotal > 100
        ? rawMins.map((min) => (min * 100) / minTotal)
        : rawMins;
      for (let i = 0; i < sizes.length; i += 1) {
        const min = mins[i] ?? 0;
        if ((sizes[i] ?? 0) >= min) continue;
        let deficit = min - (sizes[i] ?? 0);
        sizes[i] = min;
        for (let j = 0; j < sizes.length && deficit > 0; j += 1) {
          if (j === i) continue;
          const available = Math.max(0, (sizes[j] ?? 0) - (mins[j] ?? 0));
          const take = Math.min(available, deficit);
          sizes[j] = (sizes[j] ?? 0) - take;
          deficit -= take;
        }
      }
      return sizes;
    };

    const finalize = (): void => {
      const n = panels.length;
      if (n === 0) return;
      const defs = panels.map((p) => p.defaultSize.value);
      const specified = defs.reduce<number>((s, d) => s + (d ?? 0), 0);
      const missing = defs.filter((d) => d == null).length;
      const per = missing > 0 ? Math.max(0, 100 - specified) / missing : 0;
      let sizes = defs.map((d) => (d == null ? per : d));
      const total = sizes.reduce((a, b) => a + b, 0) || 1;
      sizes = sizes.map((s) => (s * 100) / total);
      // Initial/default reflow respects current constraints without subscribing
      // this effect to them; the dedicated min-size effect below preserves the
      // current user layout on later constraint changes.
      let clamped = sizes;
      untrack(() => {
        clamped = clampToMins(sizes);
      });
      layout.value = clamped;
    };

    const state: ResizableGroupState = {
      direction,
      layout,
      root,
      registerPanel: (el, defaultSize, minSize) => {
        panels.push({ el, defaultSize, minSize });
        reflowVersion.value += 1;
      },
      unregisterPanel: (el) => {
        const index = panels.findIndex((panel) => panel.el === el);
        if (index === -1) return;
        panels.splice(index, 1);
        reflowVersion.value += 1;
      },
      registerHandle: () => panels.length - 1,
      groupSize: () => {
        const el = root.current;
        if (!el) return 100;
        const rect = el.getBoundingClientRect();
        const s = direction.value === 'vertical' ? rect.height : rect.width;
        return s > 0 ? s : 100;
      },
      resizeByDelta: (gap, deltaPercent) => {
        const cur = [...layout.value];
        const a = gap;
        const b = gap + 1;
        if (cur[a] == null || cur[b] == null) return;
        const minA = panels[a]?.minSize.value ?? 0;
        const minB = panels[b]?.minSize.value ?? 0;
        const d = clamp(deltaPercent, -(cur[a]! - minA), cur[b]! - minB);
        if (d === 0) return;
        cur[a]! += d;
        cur[b]! -= d;
        layout.value = cur;
      },
      ariaValues: (gap) => {
        const sizes = layout.value;
        const minA = panels[gap]?.minSize.value ?? 0;
        const minB = panels[gap + 1]?.minSize.value ?? 0;
        return { now: Math.round(sizes[gap] ?? 0), min: minA, max: 100 - minB };
      },
      emitResize: () => {
        host.dispatchEvent(
          new CustomEvent('ui-resize', { detail: { layout: layout.value }, bubbles: true }),
        );
      },
    };
    ResizableContext.provide(host, state);

    // Apply the layout as flex-grow on each panel's inner element.
    effect(() => {
      const sizes = layout.value;
      panels.forEach((p, i) => {
        p.el.style.flexGrow = String(sizes[i] ?? 0);
        p.el.style.flexBasis = '0';
        p.el.style.flexShrink = '1';
      });
    });

    const className = props.className;
    const classes = computed(() =>
      cn('flex h-full w-full aria-[orientation=vertical]:flex-col', className.value),
    );

    // Reactive (re)layout: runs once panels register (reflowVersion bump) and
    // again whenever a panel's LIVE default-size signal changes, so post-mount
    // setAttribute('default-size', …) flows through to the flex layout. Reads
    // no `layout`, so setting it here is loop-free.
    effect(() => {
      reflowVersion.value;
      panels.forEach((p) => p.defaultSize.value);
      finalize();
    });

    // Constraints are independent of default-size reflow: a live min-size
    // change clamps the CURRENT layout instead of resetting a user-resized
    // layout back to defaults. Membership bumps retrack the signal set.
    effect(() => {
      reflowVersion.value;
      panels.forEach((panel) => panel.minSize.value);
      const current = layout.value;
      if (current.length !== panels.length || current.length === 0) return;
      const next = clampToMins(current);
      if (next.some((size, index) => size !== current[index])) layout.value = next;
    });

    return html`<div
      ref="${root}"
      data-slot="resizable-panel-group"
      aria-orientation="${direction}"
      class="${classes}"
    >${children()}</div>`;
  },
  { attrs: resizablePanelGroupAttrs },
);

// ── ui-resizable-panel ───────────────────────────────────────────────

export type ResizablePanelProps = {
  defaultSize?: number;
  minSize?: number;
  className?: string;
  children?: string | TemplateResult;
};

const resizablePanelAttrs = {
  defaultSize: 'number',
  minSize: 'number',
  className: 'string',
} satisfies ComponentAttrs<ResizablePanelProps>;

export const ResizablePanel = component<ResizablePanelProps, typeof resizablePanelAttrs>('ui-resizable-panel', (props, host) => {
  const group = ResizableContext.inject();
  transparentHost(host);

  // ADR 0025 items 1 + 3 (+ v1.1 'number' kind): default-size/min-size are
  // declared 'number' below (absent → undefined; the `?? 0` also covers garbage
  // → undefined), delivered as LIVE prop signals — no raw host attribute reads.
  // They register with the group as SIGNALS so a post-mount setAttribute flows
  // through (default-size reflows the layout; min-size re-clamps + updates aria).
  // class-name is a LIVE 'string' signal, and children() owns projection.
  const defaultSize = computed<number | undefined>(() => props.defaultSize.value);
  const minSize = computed<number>(() => props.minSize.value ?? 0);

  const className = props.className;
  const classes = computed(() => cn(className.value));

  const root = ref<HTMLDivElement>();
  let registered: HTMLElement | null = null;
  onMount(() => {
    if (root.current) {
      registered = root.current;
      group.registerPanel(registered, defaultSize, minSize);
    }
  });
  onCleanup(() => {
    if (registered) group.unregisterPanel(registered);
    registered = null;
  });

  return html`<div
    ref="${root}"
    data-slot="resizable-panel"
    style="overflow:hidden"
    class="${classes}"
  >${children()}</div>`;
}, { attrs: resizablePanelAttrs });

// ── ui-resizable-handle ──────────────────────────────────────────────

const handleClasses =
  'relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90';

const gripBox =
  'z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border';

export type ResizableHandleProps = {
  withHandle?: boolean;
  className?: string;
};

const resizableHandleAttrs = {
  withHandle: 'boolean',
  className: 'string',
} satisfies ComponentAttrs<ResizableHandleProps>;

export const ResizableHandle = component<ResizableHandleProps, typeof resizableHandleAttrs>(
  'ui-resizable-handle',
  (props, host) => {
    const group = ResizableContext.inject();
    transparentHost(host);

    // ADR 0025 item 3: with-handle is a declared 'boolean' (runtime-guaranteed
    // non-undefined, and now TYPED `boolean` via the second type arg — ADR 0025
    // candidate (b)) and class-name a LIVE 'string' — both come from the `attrs`
    // option as prop signals, so post-mount setAttribute flows through. No raw
    // host attribute reads.
    const withHandle = computed<boolean>(() => props.withHandle.value);
    const className = props.className;
    const classes = computed(() => cn(handleClasses, className.value));

    // A horizontal group's divider is a vertical separator, and vice versa.
    const orientation = computed(() =>
      group.direction.value === 'horizontal' ? 'vertical' : 'horizontal',
    );

    const root = ref<HTMLDivElement>();
    let gapIndex = 0;
    onMount(() => {
      gapIndex = group.registerHandle();
    });

    // ── Drag ──
    let dragging = false;
    let lastPos = 0;
    const axisPos = (event: MouseEvent): number =>
      group.direction.value === 'vertical' ? event.clientY : event.clientX;

    const onPointerMove = (event: PointerEvent): void => {
      if (!dragging) return;
      const pos = axisPos(event);
      const deltaPx = pos - lastPos;
      lastPos = pos;
      group.resizeByDelta(gapIndex, (deltaPx / group.groupSize()) * 100);
    };
    const endDrag = (): void => {
      if (!dragging) return;
      dragging = false;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', endDrag);
      document.removeEventListener('pointercancel', endDrag);
      group.emitResize();
    };
    const onPointerDown = (event: PointerEvent): void => {
      dragging = true;
      lastPos = axisPos(event);
      try {
        if (event.pointerId != null) root.current?.setPointerCapture?.(event.pointerId);
      } catch {
        /* setPointerCapture unsupported — fine */
      }
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', endDrag);
      document.addEventListener('pointercancel', endDrag);
    };

    // ── Keyboard ──
    const onKeyDown = (event: KeyboardEvent): void => {
      const horizontal = group.direction.value === 'horizontal';
      let step = 0;
      if (event.key === (horizontal ? 'ArrowRight' : 'ArrowDown')) step = KEYBOARD_STEP;
      else if (event.key === (horizontal ? 'ArrowLeft' : 'ArrowUp')) step = -KEYBOARD_STEP;
      else if (event.key === 'Home') step = -100;
      else if (event.key === 'End') step = 100;
      else return;
      event.preventDefault();
      group.resizeByDelta(gapIndex, step);
      group.emitResize();
    };

    onCleanup(() => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', endDrag);
      document.removeEventListener('pointercancel', endDrag);
    });

    return html`<div
      ref="${root}"
      role="separator"
      data-slot="resizable-handle"
      tabindex="0"
      aria-orientation="${orientation}"
      aria-valuenow="${computed(() => String(group.ariaValues(gapIndex).now))}"
      aria-valuemin="${computed(() => String(group.ariaValues(gapIndex).min))}"
      aria-valuemax="${computed(() => String(group.ariaValues(gapIndex).max))}"
      class="${classes}"
      @pointerdown=${onPointerDown}
      @keydown=${onKeyDown}
    >${computed(() => (withHandle.value ? html`<div class="${gripBox}">${gripIcon}</div>` : null))}</div>`;
  },
  { attrs: resizableHandleAttrs },
);
