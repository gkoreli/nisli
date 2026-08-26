/**
 * overflow-menu.ts — the destination for collapsed actions.
 *
 * DECLARES: that a fit container has exactly one overflow affordance, and that
 * every action group the solver moved into it is still reachable — by pointer,
 * by keyboard, and to assistive technology.
 *
 * DOES NOT DECIDE: which groups collapse (the solver decides that from declared
 * priority), when the trigger appears (the solver reveals it with `data-shown`),
 * or where the panel sits and how it is painted (the theme owns that, from
 * `data-overflow-anchor` and `data-overflow-menu`).
 *
 * THIS FILE IS THE F6 FIX. The prototype shipped a bare `⋯` button with no
 * panel, no keyboard handling and no ARIA, and the README's own "what this does
 * NOT prove" section records the consequence: "the collapsed actions become
 * unreachable, which in a real implementation is a blocker". It is worse than a
 * missing feature — the fit engine reported `settled` while it was deleting
 * functionality, so the measurement said success and the user had lost Star and
 * Archive. A degradation strategy is only honest if the thing it degrades is
 * still available afterwards; `menu` is the one strategy that promises that, and
 * this is where the promise is kept.
 *
 * Two elements co-operate, which is why the action scope exists. The action
 * GROUPS are laid out by the fit container and marked by the solver; the MENU is
 * a sibling that has to know what those groups contain. Rather than have the
 * menu guess by walking the DOM, each group registers itself with the nearest
 * scope (provided by the pattern on its own host) and the menu reads the scope
 * back. The scope is the seam: the menu never reaches into a group's markup, and
 * a group never knows a menu exists.
 *
 * It also owns the only way in from outside: `sweepOverlays` at the bottom of
 * the file. The promise above is that a collapsed action is still REACHABLE, and
 * for two rounds nothing checked the state in which it is reached — the panel is
 * rendered only while open, every rule traverses what is rendered, and no run
 * ever opened one. The driver lives here rather than in the checker because
 * "how is this overlay invoked and dismissed" is this pattern's contract, and a
 * checker that reimplemented it would be measuring a panel the user cannot get.
 */

import {
  component,
  type ComponentAttrs,
  computed,
  createContext,
  each,
  flush,
  html,
  onMount,
  ref,
  signal,
  useHostEvent,
  when,
} from '@nisli/core';
import type { Emphasis, Priority } from '../../appearance/contracts.js';

/* ── The action scope: how a group and a menu find each other ────────────── */

/** One invocable action. The same record renders the button and the menu item. */
export interface MenuAction {
  readonly id: string;
  readonly label: string;
  readonly emphasis?: Emphasis;
  readonly onSelect?: () => void;
}

/** A group of actions that collapses as ONE unit. */
export interface ActionGroupSpec {
  readonly id: string;
  /** 1 survives longest, 5 collapses first. */
  readonly priority: Priority;
  readonly actions: readonly MenuAction[];
}

/**
 * A registered group. `actions` is a getter, not a snapshot: a group's contents
 * are reactive, and the menu reads them at the moment it opens.
 */
export interface RegisteredGroup {
  readonly element: HTMLElement;
  actions(): readonly MenuAction[];
}

export interface ActionScope {
  /** Register a group. Returns its unregister function. */
  register(group: RegisteredGroup): () => void;
  /** The actions of every group the solver has currently moved into the menu. */
  collapsed(): MenuAction[];
}

/** Document order, so the menu reads top-to-bottom the way the row does. */
function compareDocumentOrder(a: RegisteredGroup, b: RegisteredGroup): number {
  const relation = a.element.compareDocumentPosition(b.element);
  if (relation & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (relation & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return 0;
}

export function actionScope(): ActionScope {
  const groups = new Set<RegisteredGroup>();

  return {
    register(group) {
      groups.add(group);
      return () => {
        groups.delete(group);
      };
    },

    collapsed() {
      const listed: MenuAction[] = [];
      for (const group of [...groups].sort(compareDocumentOrder)) {
        // `data-collapsed` is the fit mutator's mark for the `menu` strategy.
        // Reading it here is what makes the menu's contents a consequence of the
        // solve rather than a second, drifting guess at it.
        if (group.element.hasAttribute('data-collapsed')) listed.push(...group.actions());
      }
      return listed;
    },
  };
}

/**
 * Provided by each pattern on its own host, injected by the groups and the menu
 * inside it. Subtree-scoped rather than global because two toolbars on one page
 * are two independent overflow problems.
 */
export const ActionScopeContext = createContext<ActionScope>('ActionScope');

/* ── The group: one candidate, never a row of loose siblings ─────────────── */

export interface ActionGroupProps {
  priority?: Priority;
  actions?: readonly MenuAction[];
}

const actionGroupAttrs = { priority: 'number' } satisfies ComponentAttrs<ActionGroupProps>;

export const ActionGroup = component<ActionGroupProps, typeof actionGroupAttrs>(
  'app-action-group',
  (props) => {
    const scope = ActionScopeContext.inject();
    const group = ref<HTMLElement>();
    const actions = computed(() => [...(props.actions.value ?? [])]);

    onMount(() => {
      const element = group.current;
      if (!element) return;
      // ONE data-collapse for the whole group, and one registration to match.
      // Declaring each button separately would let the solver collapse Star and
      // leave Archive stranded beside it — a row that degrades into nonsense
      // while every individual decision was locally correct.
      return scope.register({ element, actions: () => actions.value });
    });

    return html`<div
      ref=${group}
      data-component="app-action-group"
      data-layout="row"
      data-priority=${props.priority}
      data-collapse="menu"
    >${each(
      actions,
      (action) => action.id,
      (action) =>
        html`<button
          data-appearance="action"
          data-role=${computed(() => action.value.emphasis ?? 'quiet')}
          type="button"
          @click=${() => action.value.onSelect?.()}
        >${computed(() => action.value.label)}</button>`,
    )}</div>`;
  },
  { attrs: actionGroupAttrs },
);

/* ── The menu ────────────────────────────────────────────────────────────── */

export interface OverflowMenuProps {
  /** Accessible name for the trigger and the panel. */
  label?: string;
}

const overflowMenuAttrs = { label: 'string' } satisfies ComponentAttrs<OverflowMenuProps>;

/** Per-instance id source, so `aria-controls` names one panel and not all of them. */
let panelSeq = 0;

export const OverflowMenu = component<OverflowMenuProps, typeof overflowMenuAttrs>(
  'app-overflow-menu',
  (props, host) => {
    const scope = ActionScopeContext.inject();
    const open = signal(false);
    const items = signal<MenuAction[]>([]);
    const panelId = `app-overflow-panel-${++panelSeq}`;
    const trigger = ref<HTMLElement>();
    const panel = ref<HTMLElement>();
    const name = computed(() => props.label.value ?? 'More actions');

    const menuItems = (): HTMLElement[] =>
      panel.current ? [...panel.current.querySelectorAll<HTMLElement>('[role="menuitem"]')] : [];

    function close(returnFocus: boolean): void {
      if (!open.value) return;
      open.value = false;
      // The panel is torn down by this flush, so focus has to be placed after
      // it: a closed menu that leaves focus on a removed node drops the user
      // back at the top of the document.
      flush();
      if (returnFocus) trigger.current?.focus();
    }

    function show(): void {
      const collapsed = scope.collapsed();
      // Nothing was collapsed, so there is nothing to reveal. An empty
      // `role="menu"` is a dead end for a screen reader, and the trigger is not
      // painted in this state anyway.
      if (collapsed.length === 0) return;
      items.value = collapsed;
      open.value = true;
      // Render the panel now so focus can move into it in the same gesture,
      // rather than a microtask later with focus still on the trigger.
      flush();
      menuItems()[0]?.focus();
    }

    function moveFocus(step: number): void {
      const list = menuItems();
      if (list.length === 0) return;
      const from = list.findIndex((item) => item === document.activeElement);
      // Entering from the trigger, Down lands on the first item and Up on the
      // last; inside the panel the ends wrap.
      const next =
        from < 0 ? (step > 0 ? 0 : list.length - 1) : (from + step + list.length) % list.length;
      list[next]?.focus();
    }

    // Every listener below is registered during setup and disposed with the
    // component. A menu that leaks a document listener re-opens ghosts on the
    // next page, and one that registers on mount instead has a window in which
    // Escape does nothing.
    useHostEvent<PointerEvent>(document, 'pointerdown', (event) => {
      const target = event.target;
      if (target instanceof Node && host.contains(target)) return;
      close(false);
    });

    // A resize re-solves the container, which changes WHICH groups are
    // collapsed — so an open panel is showing a stale answer. Closing also
    // keeps an absolutely-positioned panel out of the geometry the solver and
    // the diagnostics are about to measure.
    useHostEvent(window, 'resize', () => close(false));

    useHostEvent<KeyboardEvent>(host, 'keydown', (event) => {
      if (!open.value) return;
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          close(true);
          return;
        case 'ArrowDown':
          event.preventDefault();
          moveFocus(1);
          return;
        case 'ArrowUp':
          event.preventDefault();
          moveFocus(-1);
          return;
        case 'Home':
          event.preventDefault();
          menuItems()[0]?.focus();
          return;
        case 'End': {
          event.preventDefault();
          const list = menuItems();
          list[list.length - 1]?.focus();
          return;
        }
        case 'Tab':
          // Focus is leaving the menu: it must not stay open behind the user.
          close(false);
          return;
        default:
          return;
      }
    });

    return html`<span data-component="app-overflow-menu" data-overflow-anchor>
      <button
        ref=${trigger}
        data-appearance="action"
        data-role="quiet"
        data-overflow
        type="button"
        aria-haspopup="menu"
        aria-expanded=${computed(() => (open.value ? 'true' : 'false'))}
        aria-controls=${computed(() => (open.value ? panelId : undefined))}
        aria-label=${name}
        @click=${() => (open.value ? close(true) : show())}
      >⋯</button>

      ${when(
        open,
        () => html`<div
          ref=${panel}
          id=${panelId}
          role="menu"
          data-overflow-menu
          data-shown
          data-layout="stack"
          aria-label=${name}
        >${each(
          items,
          (action) => action.id,
          (action) =>
            html`<button
              role="menuitem"
              data-appearance="action"
              data-role="quiet"
              type="button"
              @click=${() => {
                const chosen = action.value;
                // Close first: the action may re-render the subtree this menu
                // item lives in, and running it with the panel still mounted
                // leaves focus on a node that is about to be removed.
                close(true);
                chosen.onSelect?.();
              }}
            >${computed(() => action.value.label)}</button>`,
        )}</div>`,
      )}
    </span>`;
  },
  { attrs: overflowMenuAttrs },
);

/* ── Opening the door: how anything outside this file reaches the panel ──── */

/** One overlay, held open for the duration of a `sweepOverlays` visit. */
export interface OpenOverlay {
  /** The `[data-overflow]` control that was invoked. */
  readonly trigger: HTMLElement;
  /**
   * The panel the trigger named through `aria-controls`, or `null` when the
   * invocation revealed nothing. `null` is a finding, not a skip: the solver
   * only paints a trigger once it has moved a group into the menu, so a painted
   * trigger that opens nothing means those actions are gone.
   */
  readonly panel: HTMLElement | null;
}

/**
 * Invoke every revealed overflow trigger under `root`, one at a time, hand the
 * open panel to `visit`, and put the document back the way it was found.
 * Returns how many overlays were actually opened.
 *
 * WHY THIS EXISTS, and it is the largest hole the checker had: every rule in
 * `appearance/diagnostics` traverses what is RENDERED, an overlay is rendered
 * only while it is open, and until this function existed nothing opened one
 * during a run. So the panel, the menu items and every label in them had never
 * been measured by any check — the context matrix was reporting a clean
 * document with a closed door in it. F4 established that rendered-ness is a
 * precondition of measurement; this is the corollary nobody drew, that
 * something has to make the transient thing rendered or the precondition
 * silently excludes it.
 *
 * Three details are load-bearing.
 *
 * A REAL CLICK, not a signal write and not a synthetic open. `show()` is the
 * only code that knows the panel's contents — it reads the action scope for the
 * groups the solver actually collapsed — so anything that renders a panel
 * without going through the trigger's own handler measures a panel the user
 * would never see. It is also why this is synchronous: `show()` flushes, which
 * is what lets focus move into the panel in the same gesture, and it is what
 * lets a caller measure in the same turn.
 *
 * `aria-controls` RESOLVES THE PANEL, rather than a walk to the anchor's only
 * child. The trigger's own declaration of which panel is its own is the thing a
 * screen reader follows, so resolving through it means a broken wiring surfaces
 * as "this trigger opened nothing" instead of being quietly repaired by the
 * driver — the shape of false pass this repository has recorded six times.
 *
 * CLOSE ON `aria-expanded`, not on whether a panel was found. Leaving one
 * overlay open would put it in the geometry of the next one, and an assertion
 * that measures a document with two menus open in it is measuring a state no
 * user can reach.
 *
 * AND FOCUS IS PART OF "the way it was found". Closing a menu deliberately
 * returns focus to its trigger, which is right for a user and wrong for a
 * sweep: measured, a sweep over the inbox at the narrow widths left the last
 * trigger focused with `:focus-visible` matching, so the proof's own screenshots
 * came out with a focus ring the page never had. A driver that changes what it
 * came to observe is the same class of defect as an oracle that measures the
 * wrong box, and it would have quietly rewritten the committed visual record.
 */
export function sweepOverlays(root: ParentNode, visit: (open: OpenOverlay) => void): number {
  const focusedBefore = document.activeElement;
  let opened = 0;
  try {
    for (const trigger of root.querySelectorAll<HTMLElement>('[data-overflow][data-shown]')) {
      trigger.click();
      const controls = trigger.getAttribute('aria-controls');
      const panel = controls ? document.getElementById(controls) : null;
      if (panel) opened += 1;
      try {
        visit({ trigger, panel });
      } finally {
        if (trigger.getAttribute('aria-expanded') === 'true') trigger.click();
      }
    }
  } finally {
    if (document.activeElement !== focusedBefore) {
      // BLUR FIRST, then restore. Asking `document.body` to take focus does
      // nothing — it is not focusable — so the intuitive "focus whatever was
      // focused before" leaves the trigger's ring exactly where it was and the
      // screenshots still differ. Measured, both ways round.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      if (
        focusedBefore instanceof HTMLElement &&
        focusedBefore.isConnected &&
        focusedBefore !== document.body &&
        focusedBefore !== document.documentElement
      ) {
        focusedBefore.focus();
      }
    }
  }
  return opened;
}
