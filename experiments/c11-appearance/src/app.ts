/**
 * app.ts — real pages, mounted as one small app.
 *
 * The harness controls (density / input / theme / width) exist to make the
 * point visible: the SAME component source renders correctly in every
 * combination, because none of the values live in the components.
 */

import { computed, each, html, signal } from '@nisli/core';
import { check, explain, solve } from './appearance.js';
import {
  Avatar,
  Button,
  DataTable,
  Escaped,
  Field,
  Hero,
  MessageRow,
  NavItem,
  Region,
  type Row,
  Surface,
  Text,
  Toolbar,
} from './components.js';

/* ── state ──────────────────────────────────────────────────────────────── */

type Page = 'inbox' | 'settings' | 'data' | 'marketing';

const page = signal<Page>('inbox');
const density = signal<'comfortable' | 'compact' | 'dense'>('comfortable');
const input = signal<'pointer' | 'touch'>('pointer');
const theme = signal<'light' | 'dark'>('light');
const width = signal<number>(1080);
const findings = signal<string[]>([]);

const messages = signal([
  { id: '1', author: 'Ada Lovelace', initials: 'AL', time: '14:32', excerpt: 'Note G is finished — the engine can weave algebraic patterns.', unread: true },
  { id: '2', author: 'Grace Hopper', initials: 'GH', time: '11:04', excerpt: 'Compiler draft attached; the A-0 notes are in the appendix.', unread: false },
  { id: '3', author: 'Barbara Liskov', initials: 'BL', time: 'Yesterday', excerpt: 'Substitution principle write-up, plus the CLU abstraction examples.', unread: false },
  { id: '4', author: 'Karen Spärck Jones', initials: 'KS', time: 'Mon', excerpt: 'Term weighting results: idf beats raw frequency on every corpus we tried.', unread: false },
]);

const rows = signal<Row[]>([
  { id: 'r1', name: 'auth-service', status: 'Healthy', owner: 'platform', updated: '2m ago' },
  { id: 'r2', name: 'billing-worker', status: 'Degraded', owner: 'payments', updated: '14m ago' },
  { id: 'r3', name: 'search-index', status: 'Healthy', owner: 'discovery', updated: '1h ago' },
  { id: 'r4', name: 'notification-relay', status: 'Healthy', owner: 'growth', updated: '3h ago' },
]);

/* ── pages: each one is ordinary composition, no values anywhere ─────────── */

function InboxPage() {
  return html`${Region({
    layout: 'stack',
    children: html`
      ${Toolbar({ title: 'Inbox' })}
      ${Surface({
        flush: true,
        children: html`${each(
          messages,
          (m) => m.id,
          (m) => html`${Region({
            layout: 'stack',
            children: MessageRow({
              author: computed(() => m.value.author),
              initials: computed(() => m.value.initials),
              time: computed(() => m.value.time),
              excerpt: computed(() => m.value.excerpt),
              unread: computed(() => m.value.unread),
            }),
          })}`,
        )}`,
      })}
    `,
  })}`;
}

function SettingsPage() {
  return html`${Region({
    layout: 'stack',
    children: html`
      ${Toolbar({ title: 'Settings' })}
      ${Surface({
        layout: 'grid',
        children: html`
          ${Field({ label: 'Display name', value: 'Ada Lovelace' })}
          ${Field({ label: 'Email', value: 'ada@analytical.engine', hint: 'Used for sign-in.' })}
          ${Field({ label: 'Organisation', value: 'Analytical Society' })}
          ${Field({ label: 'Recovery code', value: '', placeholder: 'XXXX-XXXX', invalid: true, hint: 'Required before enabling 2FA.' })}
        `,
      })}
      ${Surface({
        layout: 'stack',
        children: html`
          ${Text({ as: 'label', children: 'Danger zone' })}
          ${Text({ as: 'body', children: 'Deleting the workspace removes every message and cannot be undone.' })}
          <div data-layout="row">
            ${Button({ role: 'danger', children: 'Delete workspace' })}
            ${Button({ role: 'quiet', children: 'Cancel' })}
          </div>
        `,
      })}
      ${Surface({
        layout: 'stack',
        children: html`
          ${Text({ as: 'label', children: 'Escape hatch' })}
          ${Text({ as: 'meta', children: 'Raw styling stays possible. It is explicit, outlined, counted, and excluded from the guarantees.' })}
          ${Escaped({ children: Button({ children: 'Hand-placed button' }) })}
        `,
      })}
    `,
  })}`;
}

function DataPage() {
  return html`${Region({
    layout: 'stack',
    children: html`
      ${Toolbar({ title: 'Services' })}
      ${Surface({ flush: true, children: DataTable({ rows }) })}
      ${Region({
        density: 'dense',
        layout: 'stack',
        children: html`
          ${Text({ as: 'label', children: 'Same table, dense context, identical source' })}
          ${Surface({ flush: true, children: DataTable({ rows }) })}
        `,
      })}
    `,
  })}`;
}

function MarketingPage() {
  return html`${Region({
    layout: 'stack',
    children: html`
      ${Surface({
        children: Hero({
          headline: 'Declare what it is. Not how big it is.',
          sub: 'Every value on this page was derived from context. No component in this app contains a pixel value, a colour, or a breakpoint.',
        }),
      })}
      ${Region({
        layout: 'grid',
        children: html`
          ${Surface({ layout: 'stack', children: html`${Text({ as: 'title', children: 'Same button' })}${Text({ as: 'body', children: 'One role, four contexts, four resolved sizes.' })}${Button({ role: 'primary', children: 'Save' })}` })}
          ${Region({ density: 'compact', children: Surface({ layout: 'stack', children: html`${Text({ as: 'title', children: 'Compact' })}${Text({ as: 'body', children: 'Nothing changed but the context attribute.' })}${Button({ role: 'primary', children: 'Save' })}` }) })}
          ${Region({ density: 'dense', children: Surface({ layout: 'stack', children: html`${Text({ as: 'title', children: 'Dense' })}${Text({ as: 'body', children: 'Floors keep the dense end legible.' })}${Button({ role: 'primary', children: 'Save' })}` }) })}
          ${Region({ input: 'touch', children: Surface({ layout: 'stack', children: html`${Text({ as: 'title', children: 'Touch' })}${Text({ as: 'body', children: 'A 44px hit-target floor arrives with the context.' })}${Button({ role: 'primary', children: 'Save' })}` }) })}
        `,
      })}
    `,
  })}`;
}

/* ── the shell ──────────────────────────────────────────────────────────── */

const pages: Record<Page, () => unknown> = {
  inbox: InboxPage,
  settings: SettingsPage,
  data: DataPage,
  marketing: MarketingPage,
};

function runCheck(): void {
  // Re-solve every fit container first so findings reflect the current width.
  for (const c of document.querySelectorAll<HTMLElement>('[data-fit]')) solve(c);
  const results = check(document.getElementById('canvas') ?? document);
  findings.value = results.length
    ? results.map((f) => `${f.severity.toUpperCase()} ${f.code} · ${f.subject} — ${f.detail}`)
    : ['PASS — no findings: vocabulary legal, every fit container settled, contrast and hit targets within floors.'];
}

const App = () => html`
  <div id="harness" data-layout="stack">
    <div data-layout="row" data-align="between" id="controls">
      <div data-layout="row">
        ${(['inbox', 'settings', 'data', 'marketing'] as Page[]).map((p) =>
          NavItem({
            label: p,
            current: computed(() => page.value === p),
            onSelect: () => {
              page.value = p;
            },
          }),
        )}
      </div>
      <div data-layout="row">
        <label data-text="meta">density
          <select @change=${(e: Event) => (density.value = (e.target as HTMLSelectElement).value as never)}>
            <option value="comfortable">comfortable</option>
            <option value="compact">compact</option>
            <option value="dense">dense</option>
          </select>
        </label>
        <label data-text="meta">input
          <select @change=${(e: Event) => (input.value = (e.target as HTMLSelectElement).value as never)}>
            <option value="pointer">pointer</option>
            <option value="touch">touch</option>
          </select>
        </label>
        <label data-text="meta">theme
          <select @change=${(e: Event) => (theme.value = (e.target as HTMLSelectElement).value as never)}>
            <option value="light">light</option>
            <option value="dark">dark</option>
          </select>
        </label>
        <label data-text="meta">width
          <select @change=${(e: Event) => (width.value = Number((e.target as HTMLSelectElement).value))}>
            <option value="1080">1080</option>
            <option value="720">720</option>
            <option value="480">480</option>
            <option value="360">360</option>
            <option value="320">320</option>
          </select>
        </label>
        ${Button({ children: 'nisli check', onClick: runCheck })}
      </div>
    </div>

    <div id="viewport" style=${computed(() => `inline-size: ${width.value}px`)}>
      ${Region({
        density: computed(() => density.value),
        input: computed(() => input.value),
        theme: computed(() => theme.value),
        layout: 'stack',
        children: html`<div id="canvas">${computed(() => pages[page.value]())}</div>`,
      })}
    </div>

    <div id="findings" data-layout="stack">
      ${each(
        findings,
        (f, i) => `${i}:${f}`,
        (f) => html`<code>${f}</code>`,
      )}
    </div>
  </div>
`;

html`${App()}`.mount(document.getElementById('root')!);

// expose the framework-side surfaces for measurement from the browser tool
Object.assign(window as unknown as Record<string, unknown>, {
  __c11: {
    check,
    explain,
    solve,
    set: (patch: Partial<{ page: Page; density: string; input: string; theme: string; width: number }>) => {
      if (patch.page) page.value = patch.page;
      if (patch.density) density.value = patch.density as never;
      if (patch.input) input.value = patch.input as never;
      if (patch.theme) theme.value = patch.theme as never;
      if (patch.width) width.value = patch.width;
    },
  },
});
