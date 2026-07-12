/**
 * ui/input-group.ts — InputGroup and its control/addon parts.
 *
 * Ported from shadcn/ui `new-york-v4/ui/input-group.tsx` (MIT —
 * https://github.com/shadcn-ui/ui) as Nisli components. Button, input, and
 * textarea primitives are rendered as native light-DOM elements so focus,
 * form participation, and bubbling events retain their platform behavior.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import {
  children,
  component,
  computed,
  effect,
  html,
  onMount,
  ref,
  type TemplateResult,
} from '@nisli/core';
import { buttonVariants, type ButtonVariant } from './button.js';
import { inputClasses, type InputProps } from './input.js';
import { textareaClasses, type TextareaProps } from './textarea.js';
import {
  captureChildren,
  cn,
  cv,
  transparentHost,
} from '../lib/utils.js';

export const inputGroupClasses =
  'group/input-group relative flex w-full items-center rounded-md border border-input shadow-xs transition-[color,box-shadow] outline-none dark:bg-input/30 h-9 min-w-0 has-[>textarea]:h-auto has-[>[data-align=inline-start]]:[&>input]:pl-2 has-[>[data-align=inline-end]]:[&>input]:pr-2 has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3 has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-[3px] has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-destructive/20 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40';

type PartProps = { className?: string; children?: string | TemplateResult };

export const InputGroup = component<PartProps>('ui-input-group', (props, host) => {
  transparentHost(host);
  // ADR 0025 item 3: className fallback declared via `attrs` below (no userland
  // attr()); item 1: light-DOM projection via children() (no captureChildren /
  // projectChildren / projection onMount / projection ref).
  const className = props.className;
  const classes = computed(() => cn(inputGroupClasses, className.value));
  return html`<div
    data-slot="input-group"
    role="group"
    class="${classes}"
  >${children()}</div>`;
}, {
  attrs: { className: 'string' },
});

export const inputGroupAddonVariants = cv(
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        'inline-start':
          'order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]',
        'inline-end':
          'order-last pr-3 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]',
        'block-start':
          'order-first w-full justify-start px-3 pt-3 group-has-[>input]/input-group:pt-2.5 [.border-b]:pb-3',
        'block-end':
          'order-last w-full justify-start px-3 pb-3 group-has-[>input]/input-group:pb-2.5 [.border-t]:pt-3',
      },
    },
    defaultVariants: { align: 'inline-start' },
  },
);

export type InputGroupAddonAlign =
  | 'inline-start'
  | 'inline-end'
  | 'block-start'
  | 'block-end';
export type InputGroupAddonProps = PartProps & { align?: InputGroupAddonAlign };

export const InputGroupAddon = component<InputGroupAddonProps>(
  'ui-input-group-addon',
  (props, host) => {
    transparentHost(host);
    const align = computed<InputGroupAddonAlign>(() => props.align.value ?? 'inline-start');
    const className = props.className;
    const classes = computed(() =>
      cn(inputGroupAddonVariants({ align: align.value }), className.value),
    );
    const focusControl = (event: Event): void => {
      const target = event.target as HTMLElement;
      if (target.closest('button')) return;
      host.parentElement?.querySelector<HTMLInputElement>('input')?.focus();
    };
    return html`<div
      role="group"
      data-slot="input-group-addon"
      data-align="${align}"
      class="${classes}"
      @click=${focusControl}
    >${children()}</div>`;
  },
  {
    attrs: { align: 'string', className: 'string' },
  },
);

export const inputGroupButtonVariants = cv('flex items-center gap-2 text-sm shadow-none', {
  variants: {
    size: {
      xs: "h-6 gap-1 rounded-[calc(var(--radius)-5px)] px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5",
      sm: 'h-8 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2.5',
      'icon-xs': "size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0",
      'icon-sm': 'size-8 p-0 has-[>svg]:p-0',
    },
  },
  defaultVariants: { size: 'xs' },
});

export type InputGroupButtonSize = 'xs' | 'sm' | 'icon-xs' | 'icon-sm';
export type InputGroupButtonProps = PartProps & {
  type?: 'button' | 'submit' | 'reset';
  variant?: ButtonVariant;
  size?: InputGroupButtonSize;
  disabled?: boolean;
};

export const InputGroupButton = component<InputGroupButtonProps>(
  'ui-input-group-button',
  (props, host) => {
    transparentHost(host);
    const type = props.type;
    const variant = props.variant;
    const size = computed<InputGroupButtonSize>(() => props.size.value ?? 'xs');
    const disabled = computed<boolean>(() => props.disabled.value as boolean);
    const className = props.className;
    const classes = computed(() =>
      cn(
        buttonVariants({ variant: variant.value ?? 'ghost' }),
        inputGroupButtonVariants({ size: size.value }),
        className.value,
      ),
    );
    return html`<button
      data-slot="button"
      data-size="${size}"
      data-variant="${computed(() => variant.value ?? 'ghost')}"
      type="${computed(() => type.value ?? 'button')}"
      disabled="${disabled}"
      class="${classes}"
    >${children()}</button>`;
  },
  {
    attrs: {
      type: 'string',
      variant: 'string',
      size: 'string',
      disabled: 'boolean',
      className: 'string',
    },
  },
);

export const inputGroupTextClasses =
  "flex items-center gap-2 text-sm text-muted-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4";

export const InputGroupText = component<PartProps>('ui-input-group-text', (props, host) => {
  transparentHost(host);
  const className = props.className;
  const classes = computed(() => cn(inputGroupTextClasses, className.value));
  return html`<span
    data-slot="input-group-text"
    class="${classes}"
  >${children()}</span>`;
}, {
  attrs: { className: 'string' },
});

export const inputGroupInputClasses =
  'flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent';

export const InputGroupInput = component<InputProps>('ui-input-group-input', (props, host) => {
  transparentHost(host);
  // ADR 0025 item 3: attribute fallbacks declared via `attrs` below; delivered
  // as live prop signals — no userland attr()/boolAttr()/forwardedAttr().
  // 'forward' relocates id/name onto the inner control. Declared-default
  // booleans are runtime-guaranteed non-undefined (`as boolean` is the stopgap).
  const type = props.type;
  const placeholder = props.placeholder;
  const autocomplete = props.autocomplete;
  const value = props.value;
  const id = props.id;
  const name = props.name;
  const disabled = computed<boolean>(() => props.disabled.value as boolean);
  const required = computed<boolean>(() => props.required.value as boolean);
  const readOnly = computed<boolean>(() => props.readOnly.value as boolean);
  const className = props.className;
  const classes = computed(() => cn(inputClasses, inputGroupInputClasses, className.value));
  const root = ref<HTMLInputElement>();
  effect(() => {
    const input = root.current;
    const next = value.value;
    if (input && next != null && input.value !== next) input.value = next;
  });
  onMount(() => {
    const input = root.current;
    const initial = value.value;
    if (input && initial != null) {
      input.setAttribute('value', initial);
      input.value = initial;
    }
  });
  return html`<input
    ref="${root}"
    data-slot="input-group-control"
    class="${classes}"
    type="${computed(() => type.value ?? 'text')}"
    id="${id}"
    name="${name}"
    placeholder="${placeholder}"
    autocomplete="${autocomplete}"
    disabled="${disabled}"
    required="${required}"
    readonly="${readOnly}"
  />`;
}, {
  attrs: {
    type: 'string',
    placeholder: 'string',
    autocomplete: 'string',
    value: 'string',
    className: 'string',
    id: 'forward',
    name: 'forward',
    disabled: 'boolean',
    required: 'boolean',
    readOnly: { type: 'boolean', attr: 'readonly' },
  },
});

export const inputGroupTextareaClasses =
  'flex-1 resize-none rounded-none border-0 bg-transparent py-3 shadow-none focus-visible:ring-0 dark:bg-transparent';

export const InputGroupTextarea = component<TextareaProps>(
  'ui-input-group-textarea',
  (props, host) => {
    transparentHost(host);
    // A textarea's child text is its value; capture pre-existing content.
    // NOTE: captureChildren here CONSUMES child text as the initial value
    // (native <textarea> semantics) — it does NOT project children into a slot,
    // so this is deliberately kept rather than migrated to children().
    const captured = captureChildren(host);
    const capturedText = captured.map((node) => node.textContent ?? '').join('');
    // ADR 0025 item 3: attribute fallbacks declared via `attrs` below; delivered
    // as live prop signals — no userland attr()/boolAttr()/forwardedAttr().
    const placeholder = props.placeholder;
    const autocomplete = props.autocomplete;
    const value = props.value;
    const id = props.id;
    const name = props.name;
    const disabled = computed<boolean>(() => props.disabled.value as boolean);
    const required = computed<boolean>(() => props.required.value as boolean);
    const readOnly = computed<boolean>(() => props.readOnly.value as boolean);
    const className = props.className;
    const rows = props.rows; // 'number' attr (declared below) — live
    const classes = computed(() =>
      cn(textareaClasses, inputGroupTextareaClasses, className.value),
    );
    const root = ref<HTMLTextAreaElement>();
    effect(() => {
      const textarea = root.current;
      const next = value.value;
      if (textarea && next != null && textarea.value !== next) textarea.value = next;
    });
    const setInitial = (textarea: HTMLTextAreaElement, text: string): void => {
      textarea.textContent = text;
      textarea.value = text;
    };
    onMount(() => {
      const textarea = root.current;
      if (!textarea) return;
      const initial = value.value ?? capturedText;
      if (initial !== '') setInitial(textarea, initial);
    });
    return html`<textarea
      ref="${root}"
      data-slot="input-group-control"
      class="${classes}"
      id="${id}"
      name="${name}"
      placeholder="${placeholder}"
      autocomplete="${autocomplete}"
      rows="${rows}"
      disabled="${disabled}"
      required="${required}"
      readonly="${readOnly}"
    ></textarea>`;
  },
  {
    attrs: {
      placeholder: 'string',
      autocomplete: 'string',
      value: 'string',
      className: 'string',
      id: 'forward',
      name: 'forward',
      disabled: 'boolean',
      required: 'boolean',
      readOnly: { type: 'boolean', attr: 'readonly' },
      rows: 'number',
    },
  },
);
