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
 *
 * THE STATE SPACE IS DECLARED HERE TOO, and it is a fifth axis of a different
 * kind. The context axes change how a thing is RESOLVED; a state changes what
 * there is to resolve. Both are enumerable, which is the whole reason this file
 * grew: the 240-cell matrix swept every context of exactly ONE state — the
 * happy path with four seeded rows — so every defect it ever caught was in
 * geometry it happened to render. Nobody looks at an empty list or a failed
 * load, which is precisely why they rot. Declared, they can be swept.
 */

import { computed, signal, type ReadonlySignal } from '@nisli/core';
import type { Density, Finding, InputMode, ThemeName } from '../appearance/contracts.js';
import type { TableColumn, TableRow } from '../ui/index.js';

/* ── the pages ──────────────────────────────────────────────────────────── */

export type PageId = 'inbox' | 'settings' | 'data' | 'marketing';

export const PAGE_IDS: readonly PageId[] = ['inbox', 'settings', 'data', 'marketing'];

/* ── the declared state space ───────────────────────────────────────────── */

/**
 * Every state a page in this app can be in, as a closed vocabulary rather than
 * a config file. Seven ids, each of which changes WHAT IS THERE and none of
 * which changes how any of it is resolved — no state selects a size, a colour
 * or a layout, because a state that needed its own styling would be a finding
 * about the vocabulary rather than a state.
 *
 * `empty` is deliberately NOT a rendering branch of its own: it is the id that
 * seeds an empty corpus, and the empty rendering is a CONSEQUENCE of the list
 * being empty. That matters, because it means archiving the last message in
 * `ready` arrives at exactly the same geometry the sweep measures under
 * `empty` — one code path, reachable two ways, so the swept state is the state
 * a user actually gets.
 */
export type StateId = 'ready' | 'loading' | 'error' | 'empty' | 'single' | 'many' | 'hostile';

export interface StateSpec {
  readonly id: StateId;
  /** One line, so the sweep can name what it was measuring. */
  readonly what: string;
}

export const STATES: readonly StateSpec[] = [
  { id: 'ready', what: 'the happy path — the four seeded rows the context matrix has always swept' },
  { id: 'loading', what: 'content has not arrived yet; the page must say so without inventing a skeleton' },
  { id: 'error', what: 'content will not arrive; the page must say so and offer a way out' },
  { id: 'empty', what: 'the corpus is empty, so the empty rendering is reached as a consequence' },
  { id: 'single', what: 'exactly one item — the count where a list stops looking like a list' },
  { id: 'many', what: 'enough items that repetition, not composition, is what fails' },
  { id: 'hostile', what: 'unbreakable token, right-to-left string, and a Latin token inside a Japanese sentence' },
];

/**
 * Which states each page CLAIMS. Declared per page rather than swept as a
 * cross product on purpose: a marketing page has no corpus to be empty or
 * singular, and sweeping states a page cannot be in would pad the cell count
 * with cells that prove nothing. The declaration is data, so the sweep reports
 * what was claimed alongside what it measured.
 */
export const PAGE_STATES: Readonly<Record<PageId, readonly StateId[]>> = {
  inbox: ['ready', 'loading', 'error', 'empty', 'single', 'many', 'hostile'],
  data: ['ready', 'loading', 'error', 'empty', 'single', 'many', 'hostile'],
  settings: ['ready', 'loading', 'error', 'hostile'],
  marketing: ['ready', 'hostile'],
};

/**
 * Delivery is the only thing a state changes about STRUCTURE, and it has three
 * values because the three renderings are genuinely different answers to "what
 * should the reader see": the content, a statement that it is coming, or a
 * statement that it is not. Every other state id resolves to `ready` and
 * differs only in its corpus.
 */
export type Delivery = 'ready' | 'loading' | 'error';

/* ── the context axes plus the harness viewport ─────────────────────────── */

export const page = signal<PageId>('inbox');
export const density = signal<Density>('comfortable');
export const input = signal<InputMode>('pointer');
export const theme = signal<ThemeName>('light');
export const pageState = signal<StateId>('ready');

export const delivery: ReadonlySignal<Delivery> = computed(() =>
  pageState.value === 'loading' ? 'loading' : pageState.value === 'error' ? 'error' : 'ready',
);

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

/**
 * How many overflow panels the last check actually opened, or null if that run
 * did not ask for the open state.
 *
 * It exists because a guard must not be able to pass vacuously. An overlay
 * sweep that opened no door reports exactly the same zero findings as one that
 * opened every door and found nothing wrong, and those are different facts. The
 * readout prints the count beside the tallies so the two can never be confused
 * — the same argument the values guard makes when it prints how many literals
 * it still matches inside the theme.
 */
export const overlaysOpened = signal<number | null>(null);

/* ── the one write path, shared by the controls and the proof ───────────── */

export interface ContextPatch {
  page?: PageId;
  density?: Density;
  input?: InputMode;
  theme?: ThemeName;
  width?: number;
  state?: StateId;
}

export function setContext(patch: ContextPatch): void {
  if (patch.page !== undefined) page.value = patch.page;
  if (patch.density !== undefined) density.value = patch.density;
  if (patch.input !== undefined) input.value = patch.input;
  if (patch.theme !== undefined) theme.value = patch.theme;
  if (patch.width !== undefined) width.value = patch.width;
  // Last, and unconditionally re-seeded even when the id is unchanged: a state
  // is a corpus, the mutators edit that corpus, and a sweep that re-selected
  // the state it was already in would otherwise measure whatever the previous
  // cell's actions left behind.
  if (patch.state !== undefined) seedState(patch.state);
}

/* ── hostile content, declared once ─────────────────────────────────────── */

/**
 * Three specimens, each chosen because something in this repository is already
 * known or suspected to mishandle it.
 *
 *  - `unbreakable` — a real German compound with no hyphenation opportunity.
 *    The theme answers this with `overflow-wrap: break-word`, which means the
 *    box is satisfied and the WORD pays; N690 exists to report exactly that.
 *  - `rtl` — a right-to-left string with trailing punctuation, in a document
 *    that never declares a direction. Nothing in the vocabulary can.
 *  - `mixedScript` — a twenty-character Latin token inside a Japanese
 *    sentence. The text audit measured that this genuinely shreds while N690
 *    declines on it, because the rule's `lines > words` inference does not
 *    hold for a script that wraps between characters. A specimen that is
 *    known to be invisible to the checker is worth rendering: if the sweep
 *    reports it clean, that silence is now a recorded, reproduced fact rather
 *    than an untested assumption.
 */
export const HOSTILE = {
  unbreakable: 'Rechtsschutzversicherungsgesellschaftsvertreterversammlung',
  rtl: 'رسالة اختبار لاتجاه الكتابة من اليمين إلى اليسار، مع علامات ترقيم في النهاية.',
  mixedScript: '認証サービスの更新に失敗しました。原因はqxjvbmzntrwdkslfhgpcです。',
} as const;

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

const HOSTILE_MESSAGES: readonly Message[] = [
  {
    id: 'h1',
    author: HOSTILE.unbreakable,
    initials: 'RV',
    time: 'now',
    excerpt: `Ein Wort ohne Trennstelle: ${HOSTILE.unbreakable}.`,
    unread: true,
  },
  {
    id: 'h2',
    author: 'مكتب التوثيق',
    initials: 'مت',
    time: 'Mon',
    excerpt: HOSTILE.rtl,
    unread: false,
  },
  {
    id: 'h3',
    author: '認証サービス',
    initials: '認',
    time: 'Yesterday',
    excerpt: HOSTILE.mixedScript,
    unread: false,
  },
];

/**
 * How many rows `many` means. A count, not a size — nothing derives an
 * appearance value from it. Two dozen is the smallest number where the failure
 * mode stops being composition and starts being repetition: enough rows that
 * the page is taller than any viewport, that the solver runs two dozen times
 * in one cell, and that a per-row defect appearing once in four is certain to
 * appear rather than merely likely.
 */
const MANY = 24;

/** Deterministic, so a sweep cell is reproducible and a diff is meaningful. */
function repeated<T extends { readonly id: string }>(
  seed: readonly T[],
  count: number,
  stamp: (item: T, index: number) => T,
): T[] {
  return Array.from({ length: count }, (_, index) => stamp(seed[index % seed.length]!, index));
}

const MANY_MESSAGES: readonly Message[] = repeated(DEMO_MESSAGES, MANY, (message, index) => ({
  ...message,
  id: `${message.id}-${index}`,
  unread: index % 3 === 0,
}));

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
  seedState(pageState.value);
}

/**
 * The way out of the error state, and a real one: it re-seeds the happy path,
 * so the button changes what is on screen rather than posing for a screenshot.
 * Same reasoning as every other mutator in this file (F6).
 */
export function retry(): void {
  seedState('ready');
}

/* ── the data page ──────────────────────────────────────────────────────── */

export const SERVICE_COLUMNS: readonly TableColumn[] = [
  { id: 'name', header: 'Name' },
  { id: 'status', header: 'Status' },
  { id: 'owner', header: 'Owner' },
  { id: 'updated', header: 'Updated' },
];

const DEMO_SERVICES: readonly TableRow[] = [
  { id: 'r1', name: 'auth-service', status: 'Healthy', owner: 'platform', updated: '2m ago' },
  { id: 'r2', name: 'billing-worker', status: 'Degraded', owner: 'payments', updated: '14m ago' },
  { id: 'r3', name: 'search-index', status: 'Healthy', owner: 'discovery', updated: '1h ago' },
  { id: 'r4', name: 'notification-relay', status: 'Healthy', owner: 'growth', updated: '3h ago' },
];

const HOSTILE_SERVICES: readonly TableRow[] = [
  {
    id: 'hr1',
    name: HOSTILE.unbreakable,
    status: 'Degraded',
    owner: 'platform',
    updated: 'now',
  },
  { id: 'hr2', name: 'مكتب-التوثيق', status: HOSTILE.rtl, owner: 'مكتب التوثيق', updated: 'Mon' },
  { id: 'hr3', name: '認証サービス', status: 'Degraded', owner: HOSTILE.mixedScript, updated: 'now' },
];

const MANY_SERVICES: readonly TableRow[] = repeated(DEMO_SERVICES, MANY, (row, index) => ({
  ...row,
  id: `${row.id}-${index}`,
}));

export const services = signal<TableRow[]>([...DEMO_SERVICES]);

/* ── the settings page ──────────────────────────────────────────────────── */

/**
 * The settings form as data, so the hostile state can put a hostile string
 * through the same component the happy path uses instead of a second call site
 * written to look broken.
 */
export interface FieldSpec {
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly hint?: string;
  readonly invalid?: boolean;
}

const DEMO_FIELDS: readonly FieldSpec[] = [
  { label: 'Display name', value: 'Ada Lovelace' },
  { label: 'Email', value: 'ada@analytical.engine', hint: 'Used for sign-in.' },
  { label: 'Organisation', value: 'Analytical Society' },
  {
    label: 'Recovery code',
    value: '',
    placeholder: 'XXXX-XXXX',
    invalid: true,
    hint: 'Required before enabling two-factor sign-in.',
  },
];

const HOSTILE_FIELDS: readonly FieldSpec[] = [
  { label: HOSTILE.unbreakable, value: HOSTILE.unbreakable },
  { label: 'اسم المؤسسة', value: 'مكتب التوثيق', hint: HOSTILE.rtl },
  { label: '認証コード', value: '', invalid: true, hint: HOSTILE.mixedScript },
];

export const fields = signal<FieldSpec[]>([...DEMO_FIELDS]);

/* ── the marketing page ─────────────────────────────────────────────────── */

/** The one piece of `display`-level text in the app, and the widest type the
 *  table derives — so the hostile specimen belongs here more than anywhere. */
export interface HeroCopy {
  readonly headline: string;
  readonly sub: string;
}

const DEMO_HERO: HeroCopy = {
  headline: 'Declare what it is. Not how big it is.',
  sub: 'Every value on this page was derived from context. No component in this app contains a pixel value, a colour, or a breakpoint.',
};

const HOSTILE_HERO: HeroCopy = {
  headline: HOSTILE.unbreakable,
  sub: `${HOSTILE.mixedScript} ${HOSTILE.rtl}`,
};

export const hero = signal<HeroCopy>(DEMO_HERO);

/* ── seeding ────────────────────────────────────────────────────────────── */

/**
 * One switch, over a closed union, writing every corpus. Every page therefore
 * sees the same state id, which is what makes a sweep cell one label rather
 * than four independent setups — and what makes `PAGE_STATES` a claim the
 * sweep can hold a page to instead of a hint.
 *
 * `loading` and `error` seed an empty corpus deliberately: a page that is still
 * loading has nothing to show, and one that failed has nothing it can trust.
 * Anything else would render stale content under a state that denies it.
 */
export function seedState(id: StateId): void {
  pageState.value = id;
  unreadOnly.value = false;
  switch (id) {
    case 'ready':
      messages.value = [...DEMO_MESSAGES];
      services.value = [...DEMO_SERVICES];
      fields.value = [...DEMO_FIELDS];
      hero.value = DEMO_HERO;
      return;
    case 'loading':
    case 'error':
    case 'empty':
      messages.value = [];
      services.value = [];
      fields.value = [...DEMO_FIELDS];
      hero.value = DEMO_HERO;
      return;
    case 'single':
      messages.value = [DEMO_MESSAGES[0]!];
      services.value = [DEMO_SERVICES[0]!];
      fields.value = [DEMO_FIELDS[0]!];
      hero.value = DEMO_HERO;
      return;
    case 'many':
      messages.value = [...MANY_MESSAGES];
      services.value = [...MANY_SERVICES];
      fields.value = [...DEMO_FIELDS];
      hero.value = DEMO_HERO;
      return;
    case 'hostile':
      messages.value = [...HOSTILE_MESSAGES];
      services.value = [...HOSTILE_SERVICES];
      fields.value = [...HOSTILE_FIELDS];
      hero.value = HOSTILE_HERO;
      return;
  }
}
