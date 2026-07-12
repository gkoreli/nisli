/**
 * ui/command.ts — Command palette.
 *
 * Visuals ported from shadcn/ui `new-york-v4/ui/command.tsx` (MIT —
 * https://github.com/shadcn-ui/ui); shadcn delegates behavior to the `cmdk`
 * package (MIT — https://github.com/pacocoursey/cmdk), so the behavior here
 * is an original zero-dependency implementation following cmdk's
 * conventions: type-to-filter, group auto-hiding, empty state, arrow-key
 * highlight + Enter to select. v1 filter is case-insensitive substring over
 * `value`/text/`keywords` (no fuzzy scoring — documented deviation). Matching
 * cmdk, items receive stable IDs and input/list reference the highlighted
 * option through `aria-activedescendant`.
 *
 * Elements also carry cmdk's marker attributes (`cmdk-item`, `cmdk-group`,
 * `cmdk-group-heading`, `cmdk-input-wrapper`) so upstream selector-based
 * classes (e.g. in CommandDialog) apply verbatim.
 *
 * Selecting an item dispatches a bubbling `ui-select` CustomEvent
 * (`detail: { value }`) from the item's host.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  children,
  component,
  createContext,
  computed,
  html,
  onMount,
  ref,
  signal,
  type Signal,
  type TemplateResult,
} from '@nisli/core';
import { cn, transparentHost } from '../lib/utils.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  type DialogProps,
} from './dialog.js';

// ── Shared state ─────────────────────────────────────────────────────

interface CommandState {
  query: Signal<string>;
  activeItemId: Signal<string | undefined>;
  listId: string;
  /** Re-apply filtering/highlight to the current DOM. */
  refresh(): void;
  move(delta: number | 'start' | 'end'): void;
  selectHighlighted(): void;
  setHighlighted(el: HTMLElement): void;
}

/** Subtree-scoped channel from the Command provider to its parts. */
const CommandContext = createContext<CommandState>('Command', { providerTag: 'ui-command' });

const itemText = (el: HTMLElement): string =>
  `${el.getAttribute('data-value') ?? ''} ${el.textContent ?? ''} ${el.getAttribute('data-keywords') ?? ''}`.toLowerCase();

let commandUid = 0;

// ── ui-command (root: owns filter + highlight) ──────────────────────

export type CommandProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const Command = component<CommandProps>('ui-command', (props, host) => {
  transparentHost(host);

  const query = signal('');
  const activeItemId = signal<string | undefined>(undefined);
  const baseId = `ui-command-${++commandUid}`;
  const listId = `${baseId}-list`;
  let itemUid = 0;
  let highlighted: HTMLElement | null = null;

  const allItems = (): HTMLElement[] =>
    Array.from(host.querySelectorAll<HTMLElement>('[data-slot="command-item"]'));
  const visibleItems = (): HTMLElement[] =>
    allItems().filter((el) => !el.hasAttribute('hidden') && el.getAttribute('data-disabled') !== 'true');

  const applyHighlight = (el: HTMLElement | null): void => {
    highlighted = el;
    for (const item of allItems()) {
      if (!item.id) item.id = `${baseId}-item-${++itemUid}`;
      item.setAttribute('data-selected', item === el ? 'true' : 'false');
      item.setAttribute('aria-selected', item === el ? 'true' : 'false');
    }
    activeItemId.value = el?.id || undefined;
    el?.scrollIntoView?.({ block: 'nearest' });
  };

  const refresh = (): void => {
    const q = query.value.trim().toLowerCase();
    for (const item of allItems()) {
      const match = q === '' || itemText(item).includes(q);
      if (match) item.removeAttribute('hidden');
      else item.setAttribute('hidden', '');
    }
    for (const group of host.querySelectorAll<HTMLElement>('[data-slot="command-group"]')) {
      const any = Array.from(group.querySelectorAll('[data-slot="command-item"]')).some(
        (el) => !el.hasAttribute('hidden'),
      );
      if (any) group.removeAttribute('hidden');
      else group.setAttribute('hidden', '');
    }
    const anyVisible = visibleItems().length > 0;
    for (const empty of host.querySelectorAll<HTMLElement>('[data-slot="command-empty"]')) {
      if (anyVisible) empty.setAttribute('hidden', '');
      else empty.removeAttribute('hidden');
    }
    const vis = visibleItems();
    applyHighlight(highlighted && vis.includes(highlighted) ? highlighted : (vis[0] ?? null));
  };

  const state: CommandState = {
    query,
    activeItemId,
    listId,
    refresh,
    move(delta) {
      const vis = visibleItems();
      if (vis.length === 0) return;
      if (delta === 'start') return applyHighlight(vis[0] ?? null);
      if (delta === 'end') return applyHighlight(vis[vis.length - 1] ?? null);
      const idx = highlighted ? vis.indexOf(highlighted) : -1;
      const next = Math.min(Math.max(idx + delta, 0), vis.length - 1);
      applyHighlight(vis[next] ?? null);
    },
    selectHighlighted() {
      highlighted?.click();
    },
    setHighlighted(el) {
      applyHighlight(el);
    },
  };
  CommandContext.provide(host, state);

  const onKeydown = (e: KeyboardEvent): void => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); state.move(1); break;
      case 'ArrowUp': e.preventDefault(); state.move(-1); break;
      case 'Home': e.preventDefault(); state.move('start'); break;
      case 'End': e.preventDefault(); state.move('end'); break;
      case 'Enter': e.preventDefault(); state.selectHighlighted(); break;
    }
  };

  onMount(() => {
    // Items mount (and children slots settle) before this runs.
    queueMicrotask(refresh);
  });

  const classes = computed(() =>
    cn(
      'flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground',
      props.className.value,
    ),
  );

  return html`<div
    data-slot="command"
    class="${classes}"
    @keydown=${onKeydown}
  >${children()}</div>`;
}, { attrs: { className: 'string' } });

// ── ui-command-input ─────────────────────────────────────────────────

export type CommandInputProps = {
  placeholder?: string;
  className?: string;
};

export const CommandInput = component<CommandInputProps>('ui-command-input', (props, host) => {
  const state = CommandContext.inject();
  transparentHost(host);

  const classes = computed(() =>
    cn(
      'flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
      props.className.value,
    ),
  );

  const onInput = (e: Event): void => {
    state.query.value = (e.target as HTMLInputElement).value;
    state.refresh();
  };

  return html`<div data-slot="command-input-wrapper" cmdk-input-wrapper="" class="flex h-9 items-center gap-2 border-b px-3">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 shrink-0 opacity-50" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <input
      data-slot="command-input"
      cmdk-input=""
      type="text"
      role="combobox"
      aria-expanded="true"
      aria-autocomplete="list"
      aria-controls="${state.listId}"
      aria-activedescendant="${state.activeItemId}"
      autocomplete="off"
      spellcheck="false"
      placeholder="${computed(() => props.placeholder.value ?? 'Search for a command to run...')}"
      class="${classes}"
      @input=${onInput}
    />
  </div>`;
}, { attrs: { placeholder: 'string', className: 'string' } });

// ── ui-command-list / -empty / -group / -separator / -shortcut ──────

function commandSection(
  tag: string,
  slot: string,
  base: string,
  extra?: { role?: string; hiddenByDefault?: boolean; cmdkAttr?: string },
) {
  return component<{ className?: string; children?: string | TemplateResult }>(tag, (props, host) => {
    CommandContext.inject();
    transparentHost(host);
    const classes = computed(() => cn(base, props.className.value));
    return html`<div
      data-slot="${slot}"
      role="${extra?.role}"
      hidden="${extra?.hiddenByDefault ?? false}"
      class="${classes}"
    >${children()}</div>`;
  }, { attrs: { className: 'string' } });
}

export const CommandList = component<{ className?: string; children?: string | TemplateResult }>(
  'ui-command-list',
  (props, host) => {
    const state = CommandContext.inject();
    transparentHost(host);
    const classes = computed(() => cn(
      'max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto',
      props.className.value,
    ));
    return html`<div
      id="${state.listId}"
      data-slot="command-list"
      role="listbox"
      tabindex="-1"
      aria-activedescendant="${state.activeItemId}"
      class="${classes}"
    >${children()}</div>`;
  },
  { attrs: { className: 'string' } },
);

export const CommandEmpty = commandSection(
  'ui-command-empty',
  'command-empty',
  'py-6 text-center text-sm',
  { hiddenByDefault: true },
);

export const CommandSeparator = commandSection(
  'ui-command-separator',
  'command-separator',
  '-mx-1 h-px bg-border',
);

export type CommandGroupProps = {
  heading?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const CommandGroup = component<CommandGroupProps>('ui-command-group', (props, host) => {
  CommandContext.inject();
  transparentHost(host);
  const classes = computed(() =>
    cn(
      'overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground',
      props.className.value,
    ),
  );
  return html`<div data-slot="command-group" cmdk-group="" role="group" class="${classes}">
    ${computed(() =>
      props.heading.value
        ? html`<div data-slot="command-group-heading" cmdk-group-heading="">${props.heading.value}</div>`
        : null,
    )}
    <div data-slot="command-group-items" role="presentation">${children()}</div>
  </div>`;
}, { attrs: { heading: 'string', className: 'string' } });

export type CommandItemProps = {
  /** Filter/select value; falls back to the item's text. */
  value?: string;
  /** Extra space-separated filter terms. */
  keywords?: string;
  disabled?: boolean;
  className?: string;
  children?: string | TemplateResult;
};

export const CommandItem = component<CommandItemProps>('ui-command-item', (props, host) => {
  const state = CommandContext.inject();
  transparentHost(host);

  const disabled = computed<boolean>(() => props.disabled.value as boolean);
  const classes = computed(() =>
    cn(
      "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
      props.className.value,
    ),
  );

  // Kept for reading the item's own text (select fallback) + highlight target.
  const root = ref<HTMLDivElement>();

  const select = (): void => {
    if (disabled.value) return;
    host.dispatchEvent(
      new CustomEvent('ui-select', {
        detail: { value: props.value.value ?? root.current?.textContent?.trim() ?? '' },
        bubbles: true,
        cancelable: true,
      }),
    );
  };

  return html`<div
    ref="${root}"
    data-slot="command-item"
    cmdk-item=""
    role="option"
    data-value="${props.value}"
    data-keywords="${props.keywords}"
    data-disabled="${computed(() => (disabled.value ? 'true' : 'false'))}"
    data-selected="false"
    class="${classes}"
    @click=${select}
    @pointerenter=${() => { if (!disabled.value && root.current) state.setHighlighted(root.current); }}
  >${children()}</div>`;
}, { attrs: { value: 'string', keywords: 'string', disabled: 'boolean', className: 'string' } });

export const CommandShortcut = commandSection(
  'ui-command-shortcut',
  'command-shortcut',
  'ml-auto text-xs tracking-widest text-muted-foreground',
);

// ── CommandDialog — plain composition, no new element ───────────────

export type CommandDialogProps = DialogProps & {
  /** Accessible dialog title (sr-only; labels the palette). Upstream default. */
  title?: string;
  /** Accessible dialog description (sr-only). Upstream default. */
  description?: string;
  commandClassName?: string;
};

/** Dialog + Command composed, with upstream's palette styling. */
export function CommandDialog(props: CommandDialogProps): TemplateResult {
  const {
    children,
    title = 'Command Palette',
    description = 'Search for a command to run...',
    commandClassName,
    ...dialogProps
  } = props;
  return Dialog({
    ...dialogProps,
    // Accessible-by-construction: upstream renders a sr-only title/description so
    // the palette dialog has an accessible name. DialogContent's
    // aria-labelledby/-describedby reference the ids DialogTitle/DialogDescription
    // self-assign from DialogContext, so placement as a sibling here wires up.
    children: html`${DialogHeader({
      className: 'sr-only',
      children: html`${DialogTitle({ children: title })}${DialogDescription({
        children: description,
      })}`,
    })}${DialogContent({
      className: 'overflow-hidden p-0',
      children: Command({
        className: cn(
          '**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5',
          commandClassName,
        ),
        children,
      }),
    })}`,
  });
}
