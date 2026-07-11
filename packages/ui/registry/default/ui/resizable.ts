/**
 * ui/resizable.ts — Resizable panel group.
 *
 * Ported from new-york-v4/ui/resizable.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui).
 * Upstream wraps `react-resizable-panels`, which isn't vendorable into a
 * copy-in file, so — like drawer/toast — the VISUALS are ported verbatim (the
 * panel-group / panel / handle class lists, data-slots, and the `withHandle`
 * grip) while the BEHAVIOR follows react-resizable-panels' conventions on plain
 * DOM: percentage-based flex sizing, pointer-drag on handles, and keyboard
 * arrows on a focused handle (role=separator with aria-valuenow).
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
  component,
  computed,
  effect,
  html,
  onCleanup,
  onMount,
  ref,
  signal,
  type ReadonlySignal,
  type Ref,
  type TemplateResult,
} from '@nisli/core';
import { attr, boolAttr, captureChildren, cn, projectChildren, transparentHost } from '../lib/utils.js';

export type ResizableDirection = 'horizontal' | 'vertical';

const gripIcon = html`<svg class="size-2.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>`;

const KEYBOARD_STEP = 10;

// ── Group state (published on the <ui-resizable-panel-group> host) ───

interface PanelReg {
  el: HTMLElement;
  minSize: number;
}

export interface ResizableGroupState {
  direction: ReadonlySignal<ResizableDirection>;
  layout: ReadonlySignal<number[]>;
  root: Ref<HTMLElement>;
  registerPanel(el: HTMLElement, defaultSize: number | undefined, minSize: number): void;
  /** Register a handle; returns the gap index (between panel i and i+1). */
  registerHandle(): number;
  /** Move `deltaPercent` from the panel after the gap into the one before it. */
  resizeByDelta(gapIndex: number, deltaPercent: number): void;
  /** Group size in px along the resize axis (falls back to 100 pre-layout). */
  groupSize(): number;
  ariaValues(gapIndex: number): { now: number; min: number; max: number };
  emitResize(): void;
}

type GroupHost = HTMLElement & { __uiResizableGroup?: ResizableGroupState };

function useGroup(host: HTMLElement, tag: string): ResizableGroupState {
  const group = (host.closest('ui-resizable-panel-group') as GroupHost | null)?.__uiResizableGroup;
  if (!group) {
    throw new Error(`<${tag}> must be used inside <ui-resizable-panel-group>.`);
  }
  return group;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

// ── ui-resizable-panel-group ─────────────────────────────────────────

export type ResizablePanelGroupProps = {
  direction?: ResizableDirection;
  className?: string;
  children?: string | TemplateResult;
};

export const ResizablePanelGroup = component<ResizablePanelGroupProps>(
  'ui-resizable-panel-group',
  (props, host) => {
    transparentHost(host);
    const projected = captureChildren(host);

    const directionAttr = attr(props.direction, host, 'direction');
    const direction = computed<ResizableDirection>(() =>
      directionAttr.value === 'vertical' ? 'vertical' : 'horizontal',
    );

    const panels: PanelReg[] = [];
    const defaults: (number | undefined)[] = [];
    const layout = signal<number[]>([]);
    const root = ref<HTMLElement>();

    const finalize = (): void => {
      const n = panels.length;
      if (n === 0) return;
      const specified = defaults.reduce<number>((s, d) => s + (d ?? 0), 0);
      const missing = defaults.filter((d) => d == null).length;
      const per = missing > 0 ? Math.max(0, 100 - specified) / missing : 0;
      let sizes = defaults.map((d) => (d == null ? per : d));
      const total = sizes.reduce((a, b) => a + b, 0) || 1;
      sizes = sizes.map((s) => (s * 100) / total);
      layout.value = sizes;
    };

    const state: ResizableGroupState = {
      direction,
      layout,
      root,
      registerPanel: (el, defaultSize, minSize) => {
        panels.push({ el, minSize });
        defaults.push(defaultSize);
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
        const minA = panels[a]?.minSize ?? 0;
        const minB = panels[b]?.minSize ?? 0;
        const d = clamp(deltaPercent, -(cur[a]! - minA), cur[b]! - minB);
        if (d === 0) return;
        cur[a]! += d;
        cur[b]! -= d;
        layout.value = cur;
      },
      ariaValues: (gap) => {
        const sizes = layout.value;
        const minA = panels[gap]?.minSize ?? 0;
        const minB = panels[gap + 1]?.minSize ?? 0;
        return { now: Math.round(sizes[gap] ?? 0), min: minA, max: 100 - minB };
      },
      emitResize: () => {
        host.dispatchEvent(
          new CustomEvent('ui-resize', { detail: { layout: layout.value }, bubbles: true }),
        );
      },
    };
    (host as GroupHost).__uiResizableGroup = state;

    // Apply the layout as flex-grow on each panel's inner element.
    effect(() => {
      const sizes = layout.value;
      panels.forEach((p, i) => {
        p.el.style.flexGrow = String(sizes[i] ?? 0);
        p.el.style.flexBasis = '0';
        p.el.style.flexShrink = '1';
      });
    });

    const className = attr(props.className, host, 'class-name');
    const classes = computed(() =>
      cn('flex h-full w-full aria-[orientation=vertical]:flex-col', className.value),
    );

    onMount(() => {
      if (root.current) {
        projectChildren(host, root.current, projected);
        finalize();
      }
    });

    return html`<div
      ref="${root}"
      data-slot="resizable-panel-group"
      aria-orientation="${direction}"
      class="${classes}"
    >${props.children}</div>`;
  },
);

// ── ui-resizable-panel ───────────────────────────────────────────────

export type ResizablePanelProps = {
  defaultSize?: number;
  minSize?: number;
  className?: string;
  children?: string | TemplateResult;
};

const numAttr = (host: HTMLElement, name: string): number | undefined =>
  host.hasAttribute(name) ? Number(host.getAttribute(name)) : undefined;

export const ResizablePanel = component<ResizablePanelProps>('ui-resizable-panel', (props, host) => {
  const group = useGroup(host, 'ui-resizable-panel');
  transparentHost(host);
  const projected = captureChildren(host);

  const defaultSize = props.defaultSize.value ?? numAttr(host, 'default-size');
  const minSize = props.minSize.value ?? numAttr(host, 'min-size') ?? 0;

  const className = attr(props.className, host, 'class-name');
  const classes = computed(() => cn(className.value));

  const root = ref<HTMLDivElement>();
  onMount(() => {
    if (root.current) {
      projectChildren(host, root.current, projected);
      group.registerPanel(root.current, defaultSize, minSize);
    }
  });

  return html`<div
    ref="${root}"
    data-slot="resizable-panel"
    style="overflow:hidden"
    class="${classes}"
  >${props.children}</div>`;
});

// ── ui-resizable-handle ──────────────────────────────────────────────

const handleClasses =
  'relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90';

const gripBox =
  'z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border';

export type ResizableHandleProps = {
  withHandle?: boolean;
  className?: string;
};

export const ResizableHandle = component<ResizableHandleProps>(
  'ui-resizable-handle',
  (props, host) => {
    const group = useGroup(host, 'ui-resizable-handle');
    transparentHost(host);

    const withHandle = props.withHandle.value ?? host.hasAttribute('with-handle');
    const className = attr(props.className, host, 'class-name');
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
    >${withHandle ? html`<div class="${gripBox}">${gripIcon}</div>` : ''}</div>`;
  },
);
