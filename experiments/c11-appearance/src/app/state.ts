/**
 * state.ts — everything the demo app remembers, and every way it changes.
 *
 * The four context axes live here rather than in the shell because two callers
 * write them: the harness controls and the automated geometry proof. `page` is
 * not a context axis — appearance does not depend on it — but it shares the
 * same patch entry point so the proof can drive one matrix cell in one call.
 *
 * The mutators below exist because of F6: an overflow menu is only worth making
 * reachable if the actions inside it are real, so every action this app offers
 * changes something observable rather than posing for the screenshot.
 */

import { computed, signal, type ReadonlySignal } from '@nisli/core';
import type { Density, Finding, InputMode, ThemeName } from '../appearance/contracts.js';
import type { TableColumn, TableRow } from '../ui/index.js';

/* ── the pages ──────────────────────────────────────────────────────────── */

export type PageId = 'inbox' | 'settings' | 'data' | 'marketing';

export const PAGE_IDS: readonly PageId[] = ['inbox', 'settings', 'data', 'marketing'];

/* ── the context axes plus the harness viewport ─────────────────────────── */

export const page = signal<PageId>('inbox');
export const density = signal<Density>('comfortable');
export const input = signal<InputMode>('pointer');
export const theme = signal<ThemeName>('light');

/**
 * The only numbers in src/app. They are HARNESS GEOMETRY, not styling: the
 * inline-size the shell gives its simulated viewport, so one real browser window
 * can exercise several widths. No component reads them, no appearance value
 * derives from them, and nothing inside the canvas knows they exist.
 */
export const WIDTH_OPTIONS: readonly number[] = [1080, 720, 480, 360, 320];

export const width = signal<number>(1080);

/** null until the first check run; an empty array is a genuine clean result. */
export const findings = signal<Finding[] | null>(null);

/* ── the one write path, shared by the controls and the proof ───────────── */

export interface ContextPatch {
  page?: PageId;
  density?: Density;
  input?: InputMode;
  theme?: ThemeName;
  width?: number;
}

export function setContext(patch: ContextPatch): void {
  if (patch.page !== undefined) page.value = patch.page;
  if (patch.density !== undefined) density.value = patch.density;
  if (patch.input !== undefined) input.value = patch.input;
  if (patch.theme !== undefined) theme.value = patch.theme;
  if (patch.width !== undefined) width.value = patch.width;
}

/* ── the inbox ──────────────────────────────────────────────────────────── */

export interface Message {
  readonly id: string;
  readonly author: string;
  readonly initials: string;
  readonly time: string;
  readonly excerpt: string;
  readonly unread: boolean;
}

/**
 * Deliberately awkward content: long excerpts, a name wider than the rest, and
 * timestamps of very different lengths ('14:32' against 'Yesterday'). The narrow
 * widths have to degrade something, and the strategy each field declares is what
 * the fit solver is being judged on — F5 is the record of getting it wrong.
 */
const DEMO_MESSAGES: readonly Message[] = [
  {
    id: 'm1',
    author: 'Ada Lovelace',
    initials: 'AL',
    time: '14:32',
    excerpt: 'Note G is finished — the engine can weave algebraic patterns.',
    unread: true,
  },
  {
    id: 'm2',
    author: 'Grace Hopper',
    initials: 'GH',
    time: '11:04',
    excerpt: 'Compiler draft attached; the A-0 notes are in the appendix.',
    unread: false,
  },
  {
    id: 'm3',
    author: 'Barbara Liskov',
    initials: 'BL',
    time: 'Yesterday',
    excerpt: 'Substitution principle write-up, plus the CLU abstraction examples.',
    unread: false,
  },
  {
    id: 'm4',
    author: 'Karen Spärck Jones',
    initials: 'KS',
    time: 'Mon',
    excerpt: 'Term weighting results: idf beats raw frequency on every corpus we tried.',
    unread: false,
  },
];

export const messages = signal<Message[]>([...DEMO_MESSAGES]);

/** Off by default: the geometry proof measures four rows, and a filter is a
 *  user act. Nothing about appearance derives from it. */
export const unreadOnly = signal(false);

export const visibleMessages: ReadonlySignal<Message[]> = computed(() =>
  unreadOnly.value ? messages.value.filter((message) => message.unread) : messages.value,
);

export function markRead(id: string): void {
  messages.value = messages.value.map((message) =>
    message.id === id ? { ...message, unread: false } : message,
  );
}

export function markAllRead(): void {
  messages.value = messages.value.map((message) => ({ ...message, unread: false }));
}

export function archive(id: string): void {
  messages.value = messages.value.filter((message) => message.id !== id);
}

/**
 * Replying reads the thread and bumps it. That is what earns Reply the highest
 * priority in the row: it is the only action there whose effect the reader
 * cannot get anywhere else on the page, so it is the last one worth collapsing.
 */
export function reply(id: string): void {
  const replied = messages.value.find((message) => message.id === id);
  if (!replied) return;
  messages.value = [
    { ...replied, unread: false, time: 'now' },
    ...messages.value.filter((message) => message.id !== id),
  ];
}

let composed = 0;

export function compose(): void {
  composed += 1;
  messages.value = [
    {
      id: `draft-${composed}`,
      author: 'You',
      initials: 'YO',
      time: 'now',
      excerpt: 'Draft: nothing in this row picked a size, and it still fits.',
      unread: true,
    },
    ...messages.value,
  ];
}

export function restoreDemoData(): void {
  messages.value = [...DEMO_MESSAGES];
  unreadOnly.value = false;
}

/* ── the data page ──────────────────────────────────────────────────────── */

export const SERVICE_COLUMNS: readonly TableColumn[] = [
  { id: 'name', header: 'Name' },
  { id: 'status', header: 'Status' },
  { id: 'owner', header: 'Owner' },
  { id: 'updated', header: 'Updated' },
];

export const services = signal<TableRow[]>([
  { id: 'r1', name: 'auth-service', status: 'Healthy', owner: 'platform', updated: '2m ago' },
  { id: 'r2', name: 'billing-worker', status: 'Degraded', owner: 'payments', updated: '14m ago' },
  { id: 'r3', name: 'search-index', status: 'Healthy', owner: 'discovery', updated: '1h ago' },
  { id: 'r4', name: 'notification-relay', status: 'Healthy', owner: 'growth', updated: '3h ago' },
]);
