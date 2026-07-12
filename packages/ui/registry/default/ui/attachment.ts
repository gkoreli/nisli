/**
 * ui/attachment.ts — Attachment.
 *
 * Ported from new-york-v4/ui/attachment.tsx (shadcn/ui, MIT — https://github.com/shadcn-ui/ui)
 * as Nisli custom elements. A file/attachment chip (media + title + actions)
 * with upload-state, size, and orientation variants, plus a horizontal group.
 * Pure presentation: the cv() variant maps and data-slot / data-state /
 * data-size / data-orientation / data-variant hooks are verbatim.
 *
 * Elements: ui-attachment / ui-attachment-group / ui-attachment-media /
 * ui-attachment-content / ui-attachment-title / ui-attachment-description /
 * ui-attachment-actions / ui-attachment-action / ui-attachment-trigger.
 *
 * asChild is not supported (native elements rendered directly). The action
 * button reuses the canonical button variants (ghost / icon-xs by default,
 * like upstream) and forwards the native button props (aria-label, disabled,
 * type); the trigger is a plain full-bleed button that forwards the same.
 *
 * This file was copied into your project by `nisli-ui` — you own it.
 */

import { children, component, computed, html, type TemplateResult } from '@nisli/core';
import { cn, cv, transparentHost } from '../lib/utils.js';
import { buttonVariants, type ButtonSize, type ButtonVariant } from './button.js';

// ── ui-attachment ────────────────────────────────────────────────────

export const attachmentVariants = cv(
  'group/attachment relative flex w-fit max-w-full min-w-0 shrink-0 flex-wrap rounded-xl border bg-card text-card-foreground transition-colors focus-within:ring-1 focus-within:ring-ring/50 has-[>a,>button]:hover:bg-muted/50 data-[state=error]:border-destructive/30 data-[state=idle]:border-dashed',
  {
    variants: {
      size: {
        default:
          'gap-2 text-sm has-data-[slot=attachment-content]:px-2.5 has-data-[slot=attachment-content]:py-2 has-data-[slot=attachment-media]:p-2',
        sm: 'gap-2.5 text-xs has-data-[slot=attachment-content]:px-2 has-data-[slot=attachment-content]:py-1.5 has-data-[slot=attachment-media]:p-1.5',
        xs: 'gap-1.5 rounded-lg text-xs has-data-[slot=attachment-content]:px-1.5 has-data-[slot=attachment-content]:py-1 has-data-[slot=attachment-media]:p-1',
      },
      orientation: {
        horizontal: 'min-w-40 items-center',
        vertical: 'w-24 flex-col has-data-[slot=attachment-content]:w-30',
      },
    },
    defaultVariants: { size: 'default', orientation: 'horizontal' },
  },
);

export type AttachmentState = 'idle' | 'uploading' | 'processing' | 'error' | 'done';
export type AttachmentSize = 'default' | 'sm' | 'xs';
export type AttachmentOrientation = 'horizontal' | 'vertical';

export type AttachmentProps = {
  state?: AttachmentState;
  size?: AttachmentSize;
  orientation?: AttachmentOrientation;
  className?: string;
  children?: string | TemplateResult;
};

export const Attachment = component<AttachmentProps>('ui-attachment', (props, host) => {
  transparentHost(host);
  const classes = computed(() =>
    cn(
      attachmentVariants({
        size: props.size.value ?? 'default',
        orientation: props.orientation.value ?? 'horizontal',
      }),
      props.className.value,
    ),
  );
  return html`<div
    data-slot="attachment"
    data-state="${computed(() => props.state.value ?? 'done')}"
    data-size="${computed(() => props.size.value ?? 'default')}"
    data-orientation="${computed(() => props.orientation.value ?? 'horizontal')}"
    class="${classes}"
  >${children()}</div>`;
}, { attrs: { state: 'string', size: 'string', orientation: 'string', className: 'string' } });

// ── ui-attachment-group ──────────────────────────────────────────────

export type AttachmentSectionProps = {
  className?: string;
  children?: string | TemplateResult;
};

export const AttachmentGroup = component<AttachmentSectionProps>(
  'ui-attachment-group',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn(
        'flex min-w-0 scroll-fade-x snap-x snap-mandatory scroll-px-1 scrollbar-none gap-3 overflow-x-auto overscroll-x-contain py-1 *:data-[slot=attachment]:flex-none *:data-[slot=attachment]:snap-start',
        props.className.value,
      ),
    );
    return html`<div data-slot="attachment-group" class="${classes}">${children()}</div>`;
  },
  { attrs: { className: 'string' } },
);

// ── ui-attachment-media ──────────────────────────────────────────────

export const attachmentMediaVariants = cv(
  "relative flex aspect-square w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-foreground group-data-[orientation=vertical]/attachment:w-full group-data-[size=sm]/attachment:w-8 group-data-[size=xs]/attachment:w-7 group-data-[size=xs]/attachment:rounded-md group-data-[state=error]/attachment:bg-destructive/10 group-data-[state=error]/attachment:text-destructive group-data-[orientation=vertical]/attachment:*:data-[slot=spinner]:size-6! [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 group-data-[orientation=vertical]/attachment:[&_svg:not([class*='size-'])]:size-6 group-data-[size=xs]/attachment:[&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        icon: '',
        image:
          "opacity-60 group-data-[state=done]/attachment:opacity-100 group-data-[state=idle]/attachment:opacity-100 *:[img]:aspect-square *:[img]:w-full *:[img]:object-cover",
      },
    },
    defaultVariants: { variant: 'icon' },
  },
);

export type AttachmentMediaProps = {
  variant?: 'icon' | 'image';
  className?: string;
  children?: string | TemplateResult;
};

export const AttachmentMedia = component<AttachmentMediaProps>(
  'ui-attachment-media',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn(attachmentMediaVariants({ variant: props.variant.value ?? 'icon' }), props.className.value),
    );
    return html`<div
      data-slot="attachment-media"
      data-variant="${computed(() => props.variant.value ?? 'icon')}"
      class="${classes}"
    >${children()}</div>`;
  },
  { attrs: { variant: 'string', className: 'string' } },
);

// ── ui-attachment-content / -title / -description / -actions ─────────

export const AttachmentContent = component<AttachmentSectionProps>(
  'ui-attachment-content',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn(
        'max-w-full min-w-0 flex-1 leading-tight group-data-[orientation=vertical]/attachment:px-1',
        props.className.value,
      ),
    );
    return html`<div data-slot="attachment-content" class="${classes}">${children()}</div>`;
  },
  { attrs: { className: 'string' } },
);

export const AttachmentTitle = component<AttachmentSectionProps>(
  'ui-attachment-title',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn(
        'block max-w-full min-w-0 truncate font-medium group-data-[state=processing]/attachment:shimmer group-data-[state=uploading]/attachment:shimmer',
        props.className.value,
      ),
    );
    return html`<span data-slot="attachment-title" class="${classes}">${children()}</span>`;
  },
  { attrs: { className: 'string' } },
);

export const AttachmentDescription = component<AttachmentSectionProps>(
  'ui-attachment-description',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn(
        'mt-0.5 block min-w-0 truncate text-xs text-muted-foreground group-data-[state=error]/attachment:text-destructive/80 max-w-full',
        props.className.value,
      ),
    );
    return html`<span data-slot="attachment-description" class="${classes}">${children()}</span>`;
  },
  { attrs: { className: 'string' } },
);

export const AttachmentActions = component<AttachmentSectionProps>(
  'ui-attachment-actions',
  (props, host) => {
    transparentHost(host);
    const classes = computed(() =>
      cn(
        'relative z-20 flex shrink-0 items-center group-data-[orientation=vertical]/attachment:absolute group-data-[orientation=vertical]/attachment:top-3 group-data-[orientation=vertical]/attachment:right-3 group-data-[orientation=vertical]/attachment:gap-1',
        props.className.value,
      ),
    );
    return html`<div data-slot="attachment-actions" class="${classes}">${children()}</div>`;
  },
  { attrs: { className: 'string' } },
);

// ── ui-attachment-action (canonical ghost icon button) ───────────────

export type AttachmentActionProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  /** Forwarded to the inner <button> so icon-only actions stay accessible. */
  ariaLabel?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const AttachmentAction = component<AttachmentActionProps>(
  'ui-attachment-action',
  (props, host) => {
    transparentHost(host);
    const disabled = computed<boolean>(() => props.disabled.value as boolean);
    const classes = computed(() =>
      cn(
        buttonVariants({
          variant: (props.variant.value as ButtonVariant | undefined) ?? 'ghost',
          size: (props.size.value as ButtonSize | undefined) ?? 'icon-xs',
        }),
        props.className.value,
      ),
    );
    return html`<button
      data-slot="attachment-action"
      class="${classes}"
      type="${computed(() => props.type.value ?? 'button')}"
      aria-label="${props.ariaLabel}"
      disabled="${disabled}"
    >${children()}</button>`;
  },
  { attrs: { variant: 'string', size: 'string', type: 'string', ariaLabel: 'string', disabled: 'boolean', className: 'string' } },
);

// ── ui-attachment-trigger (fills the chip; the main click target) ────

export type AttachmentTriggerProps = {
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  /** Forwarded to the inner <button> (the trigger has no visible text). */
  ariaLabel?: string;
  className?: string;
  children?: string | TemplateResult;
};

export const AttachmentTrigger = component<AttachmentTriggerProps>(
  'ui-attachment-trigger',
  (props, host) => {
    transparentHost(host);
    const disabled = computed<boolean>(() => props.disabled.value as boolean);
    const classes = computed(() => cn('absolute inset-0 z-10 outline-none', props.className.value));
    return html`<button
      data-slot="attachment-trigger"
      class="${classes}"
      type="${computed(() => props.type.value ?? 'button')}"
      aria-label="${props.ariaLabel}"
      disabled="${disabled}"
    >${children()}</button>`;
  },
  { attrs: { type: 'string', ariaLabel: 'string', disabled: 'boolean', className: 'string' } },
);
