/**
 * Primitives — the only place in the application that writes an intent
 * attribute. Every component above this file composes these; nothing above
 * this file writes `data-appearance`, `data-text` or a context axis by hand.
 *
 * Each primitive is a real custom element with a transparent host, so the
 * element it renders is the one the theme lays out: `data-layout` on a parent
 * reaches these children directly, and `fit()` finds `[data-fit]` beneath them.
 */

import { children, component, type ComponentAttrs, computed, html, ref, when } from '@nisli/core';
import { type AlignKind, type Density, type Emphasis, type InputMode, type LayoutKind, type Priority, type TextRole, type ThemeName, declareItem, Row as EngineRow, VOCABULARY } from '@nisli/intent';

const TEXT_ROLES: ReadonlySet<string> = new Set(VOCABULARY.text);

function transparentHost(host: HTMLElement): void {
  host.style.display = 'contents';
}

/* ── Region: the context, and a plain container ───────────────────────────── */

export interface RegionProps {
  density?: Density;
  input?: InputMode;
  theme?: ThemeName;
  children?: unknown;
}

const regionAttrs = { density: 'string', input: 'string', theme: 'string' } satisfies ComponentAttrs<RegionProps>;

export const Region = component<RegionProps, typeof regionAttrs>(
  'rb-region',
  (props, host) => {
    transparentHost(host);
    return html`<div
      data-component="rb-region"
      data-density=${props.density}
      data-input=${props.input}
      data-theme=${props.theme}
    >${children()}</div>`;
  },
  { attrs: regionAttrs },
);

/* ── Layout: the four compositions, typed ─────────────────────────────────── */

/**
 * `align` exists only here, as a prop of a layout, so "alignment with no
 * container" — the combination the README lists as still open at the type
 * level — cannot be written. `fit` is offered only by `Row`: the measured tier
 * degrades along one axis, and a stack has nothing to spend.
 */
export interface LayoutProps {
  align?: AlignKind;
  grow?: boolean;
  /** Landmark or list semantics, since the element is always a div. See GAPS.md G10. */
  role?: 'list' | 'listitem' | 'group' | 'navigation' | 'banner';
  label?: string;
  children?: unknown;
}

const layoutAttrs = { align: 'string', grow: 'boolean', role: 'string', label: 'string' } satisfies ComponentAttrs<LayoutProps>;

function layout(tag: string, kind: LayoutKind) {
  return component<LayoutProps, typeof layoutAttrs>(
    tag,
    (props, host) => {
      transparentHost(host);
      return html`<div
        data-component=${tag}
        data-layout=${kind}
        data-align=${props.align}
        data-grow=${props.grow}
        role=${props.role}
        aria-label=${props.label}
      >${children()}</div>`;
    },
    { attrs: layoutAttrs },
  );
}

export const Stack = layout('rb-stack', 'stack');
export const Wrap = layout('rb-wrap', 'wrap');
export const Grid = layout('rb-grid', 'grid');

/** The engine's Row: it measures its items once and decides who gives way. */
export const Row = EngineRow;

/* ── Surface: a painted container ─────────────────────────────────────────── */

export interface SurfaceProps {
  flush?: boolean;
  layout?: LayoutKind;
  align?: AlignKind;
  grow?: boolean;
  children?: unknown;
}

const surfaceAttrs = {
  flush: 'boolean',
  layout: 'string',
  align: 'string',
  grow: 'boolean',
} satisfies ComponentAttrs<SurfaceProps>;

export const Surface = component<SurfaceProps, typeof surfaceAttrs>(
  'rb-surface',
  (props, host) => {
    transparentHost(host);
    return html`<div
      data-component="rb-surface"
      data-appearance="surface"
      data-layout=${props.layout}
      data-align=${props.align}
      data-flush=${props.flush}
      data-grow=${props.grow}
    >${children()}</div>`;
  },
  { attrs: surfaceAttrs },
);

/* ── Text ─────────────────────────────────────────────────────────────────── */

export interface TextProps {
  as?: TextRole;
  collapse?: 'truncate' | 'hide';
  priority?: Priority;
  grow?: boolean;
  children?: unknown;
}

const textAttrs = {
  as: 'string',
  collapse: 'string',
  priority: 'number',
  grow: 'boolean',
} satisfies ComponentAttrs<TextProps>;

export const Text = component<TextProps, typeof textAttrs>(
  'rb-text',
  (props, host) => {
    transparentHost(host);
    const box = ref<HTMLElement>();
    declareItem(host, () => box.current, { priority: props.priority.value, collapse: props.collapse.value, grow: props.grow.value });
    return html`<span
      ref=${box}
      data-component="rb-text"
      data-text=${computed(() => props.as.value ?? 'body')}
      data-collapse=${props.collapse}
      data-priority=${props.priority}
      data-grow=${props.grow}
    >${children()}</span>`;
  },
  { attrs: textAttrs },
);

/* ── Button ───────────────────────────────────────────────────────────────── */

export interface ButtonProps {
  role?: Emphasis;
  type?: 'button' | 'submit';
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
  children?: unknown;
}

const buttonAttrs = { role: 'string', type: 'string', disabled: 'boolean' } satisfies ComponentAttrs<ButtonProps>;

export const Button = component<ButtonProps, typeof buttonAttrs>(
  'rb-button',
  (props, host) => {
    transparentHost(host);
    return html`<button
      data-component="rb-button"
      data-appearance="action"
      data-role=${props.role}
      type=${computed(() => props.type.value ?? 'button')}
      aria-disabled=${computed(() => (props.disabled.value ? 'true' : undefined))}
      @click=${(event: MouseEvent) => {
        if (props.disabled.value) return;
        props.onClick.value?.(event);
      }}
    >${children()}</button>`;
  },
  { attrs: buttonAttrs },
);

/* ── Link: navigation painted as an action or a nav item ──────────────────── */

export interface LinkProps {
  href?: string;
  /**
   * `nav` paints a nav item; an emphasis paints an action; a text role paints
   * prose that happens to be a link. A title in a card is the third kind.
   */
  as?: 'nav' | Emphasis | TextRole;
  current?: boolean;
  grow?: boolean;
  collapse?: 'truncate' | 'hide';
  priority?: Priority;
  children?: unknown;
}

const linkAttrs = {
  href: 'string',
  as: 'string',
  current: 'boolean',
  grow: 'boolean',
  collapse: 'string',
  priority: 'number',
} satisfies ComponentAttrs<LinkProps>;

export const Link = component<LinkProps, typeof linkAttrs>(
  'rb-link',
  (props, host) => {
    transparentHost(host);
    const nav = computed(() => props.as.value === 'nav');
    const text = computed(() => (TEXT_ROLES.has(props.as.value ?? '') ? props.as.value : undefined));
    const box = ref<HTMLElement>();
    declareItem(host, () => box.current, { priority: props.priority.value, collapse: props.collapse.value, grow: props.grow.value });
    return html`<a
      ref=${box}
      data-component="rb-link"
      href=${props.href}
      data-text=${text}
      data-appearance=${computed(() => (text.value ? undefined : nav.value ? 'nav-item' : 'action'))}
      data-role=${computed(() => (text.value || nav.value ? undefined : (props.as.value ?? 'quiet')))}
      aria-current=${computed(() => (props.current.value ? 'page' : undefined))}
      data-grow=${props.grow}
      data-collapse=${props.collapse}
      data-priority=${props.priority}
    >${children()}</a>`;
  },
  { attrs: linkAttrs },
);

/* ── Avatar ───────────────────────────────────────────────────────────────── */

export interface AvatarProps {
  initials?: string;
  label?: string;
}

const avatarAttrs = { initials: 'string', label: 'string' } satisfies ComponentAttrs<AvatarProps>;

export const Avatar = component<AvatarProps, typeof avatarAttrs>(
  'rb-avatar',
  (props, host) => {
    transparentHost(host);
    return html`<span
      data-component="rb-avatar"
      data-appearance="avatar"
      role=${computed(() => (props.label.value ? 'img' : undefined))}
      aria-label=${props.label}
      aria-hidden=${computed(() => (props.label.value ? undefined : 'true'))}
    >${props.initials}</span>`;
  },
  { attrs: avatarAttrs },
);

/* ── Field ────────────────────────────────────────────────────────────────── */

export interface FieldProps {
  label?: string;
  value?: string;
  placeholder?: string;
  hint?: string;
  type?: 'text' | 'search' | 'number';
  onInput?: (value: string) => void;
}

const fieldAttrs = {
  label: 'string',
  value: 'string',
  placeholder: 'string',
  hint: 'string',
  type: 'string',
} satisfies ComponentAttrs<FieldProps>;

let fieldSeq = 0;

export const Field = component<FieldProps, typeof fieldAttrs>(
  'rb-field',
  (props, host) => {
    transparentHost(host);
    const id = `rb-field-${++fieldSeq}`;
    const hintId = `${id}-hint`;
    const hasHint = computed(() => Boolean(props.hint.value));
    return html`<div data-component="rb-field" data-layout="stack">
      <label data-text="label" for=${id}>${props.label}</label>
      <input
        id=${id}
        data-appearance="field"
        type=${computed(() => props.type.value ?? 'text')}
        value=${props.value}
        placeholder=${props.placeholder}
        aria-describedby=${computed(() => (hasHint.value ? hintId : undefined))}
        @input=${(event: Event) => {
          const target = event.target;
          if (target instanceof HTMLInputElement) props.onInput.value?.(target.value);
        }}
      />
      ${when(hasHint, () => html`<span id=${hintId} data-text="meta">${props.hint}</span>`)}
    </div>`;
  },
  { attrs: fieldAttrs },
);
