/**
 * components.ts — real @nisli/core components.
 *
 * THE RULE THIS FILE EXISTS TO DEMONSTRATE:
 *   grep this file for a pixel value, a colour, a rem, a gap, a breakpoint or a
 *   media query. There are none. Not one number that affects appearance.
 *
 * Every component declares only:
 *   - what it IS          (data-appearance, data-role, data-text)
 *   - how it composes     (data-layout, data-grow, data-align)
 *   - what matters least  (data-priority, data-collapse)
 *
 * Values are resolved by src/theme.css from the inherited context. There is no
 * `size` prop and no `className` prop anywhere: the caller cannot make an
 * appearance decision, because there is no channel through which to make one.
 */

import {
  children,
  component,
  type ComponentAttrs,
  computed,
  each,
  html,
  type ReadonlySignal,
  signal,
  type TemplateResult,
  when,
} from '@nisli/core';
import { fit } from './appearance.js';

/* ── Region: the context provider. The ONLY way appearance is influenced. ── */

export type RegionProps = {
  density?: 'comfortable' | 'compact' | 'dense';
  input?: 'pointer' | 'touch';
  theme?: 'light' | 'dark';
  layout?: 'row' | 'stack' | 'wrap' | 'grid';
  grow?: boolean;
  children?: unknown;
};

const regionAttrs = {
  density: 'string',
  input: 'string',
  theme: 'string',
  layout: 'string',
  grow: 'boolean',
} satisfies ComponentAttrs<RegionProps>;

export const Region = component<RegionProps, typeof regionAttrs>(
  'app-region',
  (props) => html`<div
    data-component="app-region"
    data-density=${props.density}
    data-input=${props.input}
    data-theme=${props.theme}
    data-density-name=${props.density}
    data-layout=${props.layout}
    data-grow=${computed(() => (props.grow.value ? '' : undefined))}
    style=${computed(() => (props.density.value ? `--density-name: ${props.density.value}` : undefined))}
  >${children()}</div>`,
  { attrs: regionAttrs },
);

/* ── Surface: elevation derives from nesting depth, never from a prop ────── */

export type SurfaceProps = { flush?: boolean; layout?: RegionProps['layout']; children?: unknown };

const surfaceAttrs = { flush: 'boolean', layout: 'string' } satisfies ComponentAttrs<SurfaceProps>;

export const Surface = component<SurfaceProps, typeof surfaceAttrs>(
  'app-surface',
  (props) => html`<div
    data-component="app-surface"
    data-surface
    data-flush=${computed(() => (props.flush.value ? '' : undefined))}
    data-layout=${props.layout}
  >${children()}</div>`,
  { attrs: surfaceAttrs },
);

/* ── Text: five semantic roles, no font sizes ───────────────────────────── */

export type TextProps = {
  as?: 'display' | 'title' | 'body' | 'meta' | 'label';
  truncate?: boolean;
  priority?: number;
  children?: unknown;
};

const textAttrs = { as: 'string', truncate: 'boolean', priority: 'number' } satisfies ComponentAttrs<TextProps>;

export const Text = component<TextProps, typeof textAttrs>(
  'app-text',
  (props) => html`<span
    data-component="app-text"
    data-text=${computed(() => props.as.value ?? 'body')}
    data-priority=${props.priority}
    data-collapse=${computed(() => (props.truncate.value ? 'truncate' : undefined))}
  >${children()}</span>`,
  { attrs: textAttrs },
);

/* ── Button: four roles. No size, no variant table, NO className. ───────── */

export type ButtonProps = {
  role?: 'primary' | 'quiet' | 'danger';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
  children?: unknown;
};

const buttonAttrs = {
  role: 'string',
  type: 'string',
  disabled: 'boolean',
} satisfies ComponentAttrs<ButtonProps>;

export const Button = component<ButtonProps, typeof buttonAttrs>(
  'app-button',
  (props) => html`<button
    data-component="app-button"
    data-appearance="action"
    data-role=${props.role}
    type=${computed(() => props.type.value ?? 'button')}
    aria-disabled=${computed(() => (props.disabled.value ? 'true' : undefined))}
    @click=${(event: MouseEvent) => props.onClick.value?.(event)}
  >${children()}</button>`,
  { attrs: buttonAttrs },
);

/* ── Avatar ─────────────────────────────────────────────────────────────── */

export type AvatarProps = { initials?: string };

const avatarAttrs = { initials: 'string' } satisfies ComponentAttrs<AvatarProps>;

export const Avatar = component<AvatarProps, typeof avatarAttrs>(
  'app-avatar',
  (props) => html`<span
    data-component="app-avatar"
    data-appearance="avatar"
    aria-hidden="true"
  >${props.initials}</span>`,
  { attrs: avatarAttrs },
);

/* ── Field ──────────────────────────────────────────────────────────────── */

export type FieldProps = {
  label?: string;
  value?: string;
  placeholder?: string;
  invalid?: boolean;
  hint?: string;
};

const fieldAttrs = {
  label: 'string',
  value: 'string',
  placeholder: 'string',
  invalid: 'boolean',
  hint: 'string',
} satisfies ComponentAttrs<FieldProps>;

export const Field = component<FieldProps, typeof fieldAttrs>(
  'app-field',
  (props) => html`<label data-component="app-field" data-layout="stack">
    <span data-text="label">${props.label}</span>
    <input
      data-appearance="field"
      value=${props.value}
      placeholder=${props.placeholder}
      aria-invalid=${computed(() => (props.invalid.value ? 'true' : undefined))}
    />
    ${when(
      computed(() => Boolean(props.hint.value)),
      () => html`<span data-text="meta">${props.hint}</span>`,
    )}
  </label>`,
  { attrs: fieldAttrs },
);

/* ══════════════════════════════════════════════════════════════════════════
   THE DECISIVE CASE — bespoke components the framework has never seen.
   Written the way an agent would write them: structure, meaning, priority.
   ══════════════════════════════════════════════════════════════════════════ */

export type MessageRowProps = {
  author?: string;
  initials?: string;
  time?: string;
  excerpt?: string;
  unread?: boolean;
};

const messageAttrs = {
  author: 'string',
  initials: 'string',
  time: 'string',
  excerpt: 'string',
  unread: 'boolean',
} satisfies ComponentAttrs<MessageRowProps>;

export const MessageRow = component<MessageRowProps, typeof messageAttrs>(
  'app-message-row',
  (props, host) => {
    fit(host); // the framework's measured tier, attached in one line

    return html`<div data-component="app-message-row" data-fit data-layout="row">
      ${Avatar({ initials: props.initials })}

      <div data-layout="stack" data-grow>
        <div data-layout="row">
          ${Text({ as: 'title', children: props.author })}
          ${when(
            props.unread,
            () => html`<span data-text="meta" data-priority="5" data-collapse="menu">●</span>`,
          )}
        </div>
        <span data-text="meta" data-priority="4" data-collapse="truncate" data-truncate
          >${props.excerpt}</span
        >
      </div>

      <span data-text="meta" data-priority="4" data-collapse="truncate">${props.time}</span>

      <div data-layout="row" data-priority="3" data-collapse="menu">
        ${Button({ role: 'quiet', children: 'Star' })} ${Button({ role: 'quiet', children: 'Archive' })}
      </div>
      <div data-layout="row" data-priority="2" data-collapse="menu">
        ${Button({ role: 'quiet', children: 'Reply' })}
      </div>

      ${html`<button data-appearance="action" data-role="quiet" data-overflow aria-label="More actions">
        ⋯
      </button>`}
    </div>`;
  },
  { attrs: messageAttrs },
);

/* ── A toolbar: same fit contract, completely different content ─────────── */

export type ToolbarProps = { title?: string };

const toolbarAttrs = { title: 'string' } satisfies ComponentAttrs<ToolbarProps>;

export const Toolbar = component<ToolbarProps, typeof toolbarAttrs>(
  'app-toolbar',
  (props, host) => {
    fit(host);

    return html`<div data-component="app-toolbar" data-fit data-layout="row">
      ${Text({ as: 'title', children: props.title })}
      <span data-grow></span>
      <div data-layout="row" data-priority="4" data-collapse="menu">
        ${Button({ role: 'quiet', children: 'Import' })} ${Button({ role: 'quiet', children: 'Export' })}
      </div>
      <div data-layout="row" data-priority="3" data-collapse="menu">
        ${Button({ role: 'quiet', children: 'Filter' })}
      </div>
      <div data-layout="row" data-priority="1">${Button({ role: 'primary', children: 'New message' })}</div>
      ${html`<button data-appearance="action" data-role="quiet" data-overflow aria-label="More">⋯</button>`}
    </div>`;
  },
  { attrs: toolbarAttrs },
);

/* ── A data table: density is a context, not a set of cell classes ──────── */

export type Row = { id: string; name: string; status: string; owner: string; updated: string };
export type TableProps = { rows?: Row[] };

export const DataTable = component<TableProps>('app-data-table', (props) => {
  const rows = computed<Row[]>(() => props.rows.value ?? []);

  return html`<table data-component="app-data-table" data-appearance="table">
    <thead>
      <tr>
        <th>Name</th>
        <th>Status</th>
        <th>Owner</th>
        <th>Updated</th>
      </tr>
    </thead>
    <tbody>
      ${each(
        rows,
        (row) => row.id,
        (row) => html`<tr>
          <td>${computed(() => row.value.name)}</td>
          <td>${computed(() => row.value.status)}</td>
          <td>${computed(() => row.value.owner)}</td>
          <td>${computed(() => row.value.updated)}</td>
        </tr>`,
      )}
    </tbody>
  </table>`;
});

/* ── A hero: the same Button, in the loudest context in the app ─────────── */

export type HeroProps = { headline?: string; sub?: string };

const heroAttrs = { headline: 'string', sub: 'string' } satisfies ComponentAttrs<HeroProps>;

export const Hero = component<HeroProps, typeof heroAttrs>(
  'app-hero',
  (props, host) => {
    fit(host);

    return html`<div data-component="app-hero" data-fit data-layout="stack">
      ${Text({ as: 'display', children: props.headline })}
      ${Text({ as: 'body', children: props.sub })}
      <div data-layout="row">
        ${Button({ role: 'primary', children: 'Get started' })}
        <div data-priority="4" data-collapse="menu">${Button({ children: 'Read the docs' })}</div>
        ${html`<button data-appearance="action" data-role="quiet" data-overflow aria-label="More">⋯</button>`}
      </div>
    </div>`;
  },
  { attrs: heroAttrs },
);

/* ── Nav ────────────────────────────────────────────────────────────────── */

export type NavItemProps = { label?: string; current?: boolean; onSelect?: () => void };

const navAttrs = { label: 'string', current: 'boolean' } satisfies ComponentAttrs<NavItemProps>;

export const NavItem = component<NavItemProps, typeof navAttrs>(
  'app-nav-item',
  (props) => html`<button
    data-component="app-nav-item"
    data-appearance="nav-item"
    aria-current=${computed(() => (props.current.value ? 'page' : undefined))}
    @click=${() => props.onSelect.value?.()}
  >
    <span data-grow>${props.label}</span>
  </button>`,
  { attrs: navAttrs },
);

/* ── The escape hatch: possible, explicit, visibly unverified ───────────── */

export type EscapedProps = { note?: string; children?: unknown };

const escapedAttrs = { note: 'string' } satisfies ComponentAttrs<EscapedProps>;

export const Escaped = component<EscapedProps, typeof escapedAttrs>(
  'app-escaped',
  (props) => html`<div
    data-component="app-escaped"
    data-escaped=${computed(() => props.note.value ?? 'margin-block-start: 7px')}
    style="margin-block-start: 7px; transform: rotate(-1deg)"
  >${children()}</div>`,
  { attrs: escapedAttrs },
);

/* ── local helper the pages use for lists ───────────────────────────────── */

export function list<T>(items: T[]): ReadonlySignal<T[]> {
  return signal(items);
}

export type { TemplateResult };
