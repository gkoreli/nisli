/**
 * overflow-menu.ts — the destination for collapsed actions.
 *
 * PORTED FROM THE C11 PROTOTYPE, and the port is itself a finding for
 * CAPABILITIES.md: the `menu` strategy is the only one that keeps a collapsed
 * control reachable, the solver reveals the trigger with `data-shown` and the
 * theme paints it from `data-overflow-anchor` / `data-overflow-menu` — but the
 * ~200 lines that make the panel exist, fill it with the collapsed groups, put
 * it in the top layer and make it keyboard-reachable ship in no package. Every
 * consumer of `menu` has to carry this file. See GAPS.md, G1.
 *
 * The panel is a `popover` opened through `command`/`commandfor`, so the
 * browser owns open/close, light dismiss, Escape-with-focus-return,
 * `aria-expanded`, Tab order and initial focus. What it does not give a
 * non-modal popover — focus leaving closes it, resize invalidates it, arrow
 * and Home/End roving — is the only hand-written behaviour here.
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
} from '@nisli/core';
import { declareItem, declareTrigger, type Emphasis, type Priority } from '@nisli/intent';

function transparentHost(host: HTMLElement): void {
  host.style.display = 'contents';
}

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
  'rb-action-group',
  (props, host) => {
    transparentHost(host);
    const scope = ActionScopeContext.inject();
    const group = ref<HTMLElement>();
    const actions = computed(() => [...(props.actions.value ?? [])]);
    declareItem(host, () => group.current, { priority: props.priority.value, collapse: 'menu' });

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
      data-component="rb-action-group"
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

/** Per-instance id source, so `aria-controls` and `commandfor` each name one
 *  panel and not all of them. The one id in the pattern, and the only reason
 *  there is one: an invoker relationship needs a target to point at. */
let panelSeq = 0;

export const OverflowMenu = component<OverflowMenuProps, typeof overflowMenuAttrs>(
  'rb-overflow-menu',
  (props, host) => {
    transparentHost(host);
    const scope = ActionScopeContext.inject();
    const open = signal(false);
    const items = signal<MenuAction[]>([]);
    const panelId = `rb-overflow-panel-${++panelSeq}`;
    const trigger = ref<HTMLElement>();
    const panel = ref<HTMLElement>();
    const name = computed(() => props.label.value ?? 'More actions');
    declareTrigger(host, () => anchor.current);

    const menuItems = (): HTMLElement[] =>
      panel.current ? [...panel.current.querySelectorAll<HTMLElement>('[role="menuitem"]')] : [];

    /**
     * Ask the BROWSER to close. It restores focus to the invoker when focus is
     * inside the panel and leaves it alone when it is not, which is exactly the
     * split the hand-rolled `close(returnFocus)` used to take a boolean for.
     */
    function dismiss(): void {
      if (open.value) panel.current?.hidePopover();
    }

    /**
     * The seam between the browser's open/close and this component's contents,
     * and the only place the two meet.
     *
     * `beforetoggle` and not `toggle`, for a measured reason: `beforetoggle` is
     * dispatched SYNCHRONOUSLY inside the invoker's activation, while `toggle`
     * is queued as a task. `sweepOverlays` below — and every caller that opens a
     * menu and measures it in the same turn — reads `aria-expanded` immediately
     * after the click, so state derived from the async event would still say
     * `false` on a panel that is open. Measured both ways on this Chromium.
     *
     * Filling here rather than after the fact is what lets the panel be laid
     * out, anchored, sized and autofocused exactly once, with its real content
     * already in it.
     */
    function synchronise(event: ToggleEvent): void {
      if (event.newState !== 'open') {
        open.value = false;
        // Deliberately NOT clearing `items`: the browser returns focus during
        // the hide it is in the middle of, and removing the focused menu item
        // first drops the user at the top of the document instead.
        flush();
        return;
      }
      const collapsed = scope.collapsed();
      // Nothing was collapsed, so there is nothing to reveal, and an empty
      // `role="menu"` is a dead end for a screen reader and an "actions the
      // solver moved here cannot be pressed" finding for the overlay pass. The
      // show is CANCELLED rather than reversed: `beforetoggle` is cancelable on
      // the opening edge (measured; it is not on the closing edge), so the panel
      // never reaches the top layer at all.
      if (collapsed.length === 0) {
        event.preventDefault();
        return;
      }
      items.value = collapsed;
      open.value = true;
      flush();
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

    // ── What the browser does NOT give a non-modal popover ─────────────────
    // Measured in the overlays audit, each with a paired control: light
    // dismiss, Escape-with-focus-return, implicit expanded state and Tab order
    // all arrive free, so the hand-rolled versions are gone. These three do
    // not arrive, so they stay — one rule each, authored once, never per
    // callsite.

    // 1. FOCUS AND THE PANEL LIVE AND DIE TOGETHER. A popover contains nothing:
    //    an outside `focus()` succeeds and the menu stays open behind it. This
    //    replaces the old `Tab` key branch, which missed Shift+Tab and every
    //    focus move made by script — `focusout` sees all three, and its
    //    `relatedTarget` is the whole test.
    useHostEvent<FocusEvent>(host, 'focusout', (event) => {
      const next = event.relatedTarget;
      if (next instanceof Node && host.contains(next)) return;
      dismiss();
    });

    // 2. A resize re-solves the container, which changes WHICH groups are
    //    collapsed — so an open panel is showing a stale answer. This is a fit
    //    concern rather than a placement one: anchor positioning re-derives the
    //    panel's position for free, and re-deriving the position of a stale
    //    answer is still a stale answer.
    useHostEvent(window, 'resize', dismiss);

    // 3. ARIA roles carry no behaviour: `ArrowDown` inside a `role="menu"`
    //    moves nothing at all. Escape and Tab are the UA's; the roving is ours.
    useHostEvent<KeyboardEvent>(host, 'keydown', (event) => {
      if (!open.value) return;
      switch (event.key) {
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
        default:
          return;
      }
    });

    // THE PANEL IS IN THE DOM FROM THE START and not conditionally rendered,
    // and the invoker relationship forces that: `commandfor` has to resolve a
    // target at click time, and the implicit anchor is established by that
    // activation. A panel that appeared only after the click would have nothing
    // to be invoked, and `showPopover()` — the only alternative — establishes no
    // implicit anchor at all, so the panel would land at its static position.
    //
    // `role` is therefore bound to the open state, exactly like `aria-controls`
    // and for the same reason. `items` is read from the action scope when the
    // panel opens, so a CLOSED panel holds no menu items whatsoever: declaring
    // `role="menu"` on it would put one empty menu per row into the
    // accessibility tree, which is the dead end this component already refuses
    // to open. The element declares itself a menu exactly while it contains one.
    const anchor = ref<HTMLElement>();
    return html`<span ref=${anchor} data-component="rb-overflow-menu" data-overflow-anchor>
      <button
        ref=${trigger}
        data-appearance="action"
        data-role="quiet"
        data-overflow
        type="button"
        command="toggle-popover"
        commandfor=${panelId}
        aria-haspopup="menu"
        aria-expanded=${computed(() => (open.value ? 'true' : 'false'))}
        aria-controls=${computed(() => (open.value ? panelId : undefined))}
        aria-label=${name}
      >⋯</button>

      <div
        ref=${panel}
        id=${panelId}
        popover="auto"
        role=${computed(() => (open.value ? 'menu' : undefined))}
        data-overflow-menu
        data-layout="stack"
        aria-label=${name}
        @beforetoggle=${synchronise}
      >${each(
        items,
        (action) => action.id,
        (action, index) =>
          html`<button
            role="menuitem"
            tabindex="-1"
            autofocus=${computed(() => (index.value === 0 ? '' : undefined))}
            data-appearance="action"
            data-role="quiet"
            type="button"
            @click=${() => {
              const chosen = action.value;
              // Close first: the action may re-render the subtree this menu
              // item lives in, and running it with the panel still open leaves
              // focus on a node that is about to be removed.
              dismiss();
              chosen.onSelect?.();
            }}
          >${computed(() => action.value.label)}</button>`,
      )}</div>
    </span>`;
  },
  { attrs: overflowMenuAttrs },
);

