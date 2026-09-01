# Nisli Engine — Complete Agent Guide

Every rule for writing and reviewing application UI built from `@nisli/engine`. Each rule gives the invariant, the bug it prevents, and an incorrect/correct pair. Correct examples are lifted from Ledger (`packages/ledger/src/screens/*.ts`) wherever one exists.

**Engine source**: `packages/engine/src` — public surface is exactly what `src/index.ts` exports
**Test surface**: `@nisli/engine/test` → `packages/engine/src/test/prove.ts` (`prove`, `axisStale`, `estimator`, `mount`, `textMeasurer`, `claimsOf`, `checkers`); `@nisli/engine/verify` → `src/verify/index.ts` (`verify`, `format`) and the `nisli-verify` CLI (`bin/nisli-verify.mjs`)
**Screen proof**: `packages/ledger/src/screens/screens.proof.test.ts` — nine screens × five widths × three axes contexts, zero claims
**ADRs**: `docs/adr/0034-engine-typed-blocks-decided-by-an-engine.md` (contract, language, decision rules), `0035-engine-appearance-layer.md` (skins, parts, axes), `0037-engine-form-intent-capture-domain.md` (the ten Form rules), `0040-engine-overlay-domain.md` (layers), `0041-engine-proof-domain.md` (claims, prove, verify), `0042-engine-reachability.md` (keyboard and AT), `0043-engine-intent-vocabulary-contract.md` (one word, one meaning; one Action rule; capture derived), `0044-engine-deterministic-decisions.md` (the determinism tenet: a decision is a function of width and intent, never data; `DECISION_UNSTABLE`), `0046-engine-density-and-input-axes.md` (the three axes `scheme`/`density`/`input`; `metrics` as a live door over `metricsFor()`; rhythm moves, floors never; `TARGET_SMALL`, `AXIS_STALE`)
**Worked example**: `packages/ledger` — nine screens, `TENETS.md`

The engine's block kernel (`src/blocks/kernel.ts`, `src/engine/space.ts`) is being refactored; nothing below depends on it. Only the public intent API and the rules are documented.

---

## 1. The Intent Contract (CRITICAL)

### `intent-say-what-not-how` — Props state what a thing is

The public prop types (`blocks/types.ts`, each `blocks/*.ts`) offer only meaning: `priority` (survival order), `kind` (what a value is), `tone` (whether a number is good news), `role` (what a run of prose is), `destructive`, `sortable`, `required`, and structure — what contains what. How a thing is captured (a select, a textarea, a checkbox) or dressed (muted) is never said. "These are the actions" is intent; where they sit is the engine's (ADR 0034, *The contract*).

```typescript
// ❌ WRONG — the author is making the visual decision, in a new syntax
Toolbar({ title: 'Budgets', actions: [{ id: 'add', label: 'Add budget', align: 'right', bold: true }] });

// ✅ CORRECT — packages/ledger/src/screens/budgets.ts
Page({
  title: computed(() => `Budgets · ${monthLabel(period.value)}`),
  actions: [
    { id: 'add', label: 'Add budget', priority: 'primary', onSelect: () => edit() },
    { id: 'prev', label: '‹ Previous', priority: 'secondary', onSelect: () => shiftPeriod(-1) },
    { id: 'next', label: 'Next ›', priority: 'secondary', onSelect: () => shiftPeriod(1) },
  ],
  children: [/* … */],
});
```

### `intent-one-word-one-meaning` — The vocabulary is one language (ADR 0043)

A term means the same thing on every interface it applies to and appears on no other. A subset of a type is allowed (`confirm` takes two fields of `Action`; `Column.kind` takes four of the six `Kind`s); a synonym is not. The whole intent vocabulary, as `index.ts` exports it:

| term | meaning | applies to |
|---|---|---|
| `id` | identity among siblings — the sort key, the busy key, the DOM id | `Column`, `Action` |
| `key` | identity across renders: a change is a new thing (a Form resets to `initial`) | `FormProps` |
| `rowKey` | `key`, per row — `(row) => string` | `TableProps` |
| `name` | the property of `T` a field edits; the control's HTML `name` | `Field` |
| `kind` | what a value *is*: `Kind = 'text' \| 'number' \| 'money' \| 'date' \| 'boolean' \| 'file'`; never how it is captured. A Column takes the first four | `Column`, `Field` |
| `label` | the human name of an item or datum | `Stat`, `Meter`, `Field`, `Option`, `BarItem`, `NavItem`, `Link`, `Action`, `Column`, `Series` |
| `title` | the heading of a block, at a level the block knows: a container's name, a dialog's question, an empty state's statement. The only way an app says a heading | `Page`, `Section`, `Dialog`, `Empty`, `Toolbar`, `confirm` |
| `text` | a human-readable string the app wrote: prose, or the reading of a number in the app's units | `Text`, `Delta`, `BarItem`, `Meter`, `confirm`, `notify` |
| `format` | a function from a number to its `text` | `ColumnsProps` |
| `hint` | secondary text *of* an item — an explanation under it. (`role: 'note'` is the free-standing form of the same concept; they are not synonyms) | `Empty`, `Stat`, `Field` |
| `placeholder` | what an empty control shows: ghost text, or the empty choice ("All accounts"); a type error on `boolean` and `file` | `Field` |
| `empty` | what to say when there is nothing: a string (the `Empty` title) or `EmptyProps` | `TableProps` |
| `children` | what a container holds. The only prop word for it | `App`, `Page`, `Section`, `Grid`, `Dialog` |
| `Action` | `{ id; label; priority?; destructive?; onSelect? }` — a thing a person may activate; one type, one rule, one renderer | `Toolbar`, `Page`, `Empty`, `Form`, `Dialog`; `confirm` takes `Pick<Action, 'label' \| 'destructive'>` |
| `actions` | the Actions a block offers, in the author's order; the engine places them | `Toolbar`, `Page`, `Empty`, `Form`, `Dialog` |
| `action` | the one Action a confirm offers as its answer: `Pick<Action, 'label' \| 'destructive'>` | `confirm` |
| `Priority` | survival order only, default `'secondary'`. That the primary is the filled button, and the fold target, are engine rules | `Action`, `Column` |
| `destructive` | cannot be undone; danger, and nothing further asked | `Action` |
| `onSelect` | an Action was activated | `Action` |
| `onOpen` | a row was opened (not a selection) | `TableProps` |
| `order` | sort order `'asc' \| 'desc'` | `Sort` |
| `role` | what a run of prose is: `'body'`, `'note'`, `'code'`. Never a Part | `TextProps` |
| `tone` | whether a number is good news; optional everywhere | `Text`, `Delta`, `Series`, `notify` |
| `Delta` | `{ text; tone? }`, exported — annotate a computed delta with it | `StatProps.delta` |

```typescript
// ❌ WRONG — synonyms and look words: the compiler rejects every one since 0.8.0
{ id: 'payee', header: 'Payee', cell: (t) => t.payee }
{ name: 'note', label: 'Note', kind: 'textarea' }
Text({ text: 'Backups are written nightly.', role: 'muted' })
confirm({ title: 'Delete?', message: '…', confirmLabel: 'Delete', destructive: true })
delta: computed(() => ({ text: 'On track', tone: 'positive' as const }))

// ✅ CORRECT — one word each
{ id: 'payee', label: 'Payee', cell: (t) => t.payee }
{ name: 'note', label: 'Note', long: true }
Text({ text: 'Backups are written nightly.', role: 'note' })
confirm({ title: 'Delete?', text: '…', action: { label: 'Delete', destructive: true } })
delta: computed<Delta | undefined>(() => ({ text: 'On track', tone: 'positive' }))
```

---

### `intent-no-appearance-vocabulary` — The banned spelling of appearance

Banned in app code: `className`, `style`, `data-*`, pixels, rem, colours, fonts, `flex-end`, `sticky`, breakpoints, "what collapses at 360". The types do not offer any of it; `blocks/toolbar.test.ts` › *the public type offers no visual escape hatch* proves `className`, `style` and `align` are compile errors. If it typechecks, it is laid out right.

```typescript
// ❌ WRONG — will not typecheck, and must not be worked around with a cast
Toolbar({ title: 't', actions: [], className: 'x' });
Section({ title: 'S', children, style: 'padding: 0' });

// ✅ CORRECT — say the structure; the engine pads, pins, and truncates
Section({ title: 'Recent transactions', children: [Table<Transaction>({ columns, rows: recent, rowKey: (t) => t.id })] });
```

### `intent-new-need-home` — Three homes for a new need, never a fourth

In order of preference (ADR 0034, *Where a new need goes*; ADR 0035, *Rationale*):
1. **An engine rule derived from structure** — the engine knows the tree (card-in-card was solved here).
2. **A skin part** — how a nested card, a busy button, a warning meter looks (`card.nested`, `button.busy`).
3. **A new semantic word on a block** — `priority`, `tone`, `kind`: closed, typed, engine-interpreted.

Never a per-instance appearance prop. It is a decision verifiable by eye alone, and an agent will sprinkle it inconsistently.

```typescript
// ❌ WRONG — a per-instance appearance flag; erodes the contract
Section({ title: a.name, flat: true, children: [Stat({ /* … */ })] });

// ✅ CORRECT — packages/ledger/src/screens/accounts.ts: nesting is the intent; the engine draws no second card
Section({
  title: a.name,
  children: [
    Stat({ label: KIND_LABEL[a.kind], value: money(balance(a.id)), hint: a.institution }),
    Link({ href: AppRouter.routes.account.href({ params: { id: a.id } }), label: 'View transactions →' }),
  ],
});
```

### `intent-app-imports-blocks-only` — The application context imports Intent and `useSkin`

Dependency direction is Intent → Decision → Appearance (ADR 0034, *Bounded contexts*). An app imports blocks, `notify`, `confirm`, `useSkin`/`setScheme`/`setDensity`/`setInput`/`defaultSkin`, and types. `metrics`, `metricsFor`, `axes`, `look`, `fit`, `columnsFor`, `block` are exported for skin authors, engine tooling and tests — an app that reads them for its own layout, or branches on `axes.value.input`, has re-entered the decision layer (ADR 0046 §6: a block or app that wants "is this touch?" as a boolean is asking for a look word).

```typescript
// ❌ WRONG — app code deciding layout with engine internals, or from an axis by name
import { metrics, fit, look, axes } from '@nisli/engine';
const cols = width > metrics.layout.contentMin ? 2 : 1;
const rows = computed(() => (axes.value.input === 'touch' ? recent.value.slice(0, 20) : recent.value));

// ✅ CORRECT — packages/ledger/src/main.ts forwards scheme this way; density is the same line beside it (ADR 0046 §Consequences)
import { App, useSkin, setScheme, setDensity, defaultSkin } from '@nisli/engine';
useSkin(bare ? null : defaultSkin, { scheme: settings.value.appearance ?? 'system', density: settings.value.density ?? 'system' });
effect(() => { setScheme(settings.value.appearance ?? 'system'); setDensity(settings.value.density ?? 'system'); });
```

### `intent-no-per-block-density` — Density and input are context, never a prop (ADR 0046)

No block, screen or prop says `compact` or `touch`. `density` is a person's preference forwarded once, exactly as `appearance` is; `input` the engine detects from `(pointer: coarse)`, live. Every number in every block then comes through `metrics` — a touch user gets 44 px rows, buttons and menu items on the phone with no app line. A per-block density (`Table({ density: 'compact' })`, a "dense" context provider, a `?density` read in a screen) is the per-instance appearance prop 0034 bans: a "dense table on a comfortable page" is the first step back to `className`, and one axis derived from another (compact because touch) is how a table states an impossible constraint (F9).

```typescript
// ❌ WRONG — density said per block, or derived from the device in app code
Section({ title: 'Recent', children: [Table({ columns, rows, rowKey, density: 'compact' })] });
setDensity(matchMedia('(pointer: coarse)').matches ? 'comfortable' : 'compact');

// ✅ CORRECT — the shape of Ledger's `appearance` setting (settings.ts), applied to density; main.ts forwards it once
{ name: 'density', label: 'Density', required: true, options: [{ value: 'system', label: 'System' }, { value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }] }
setDensity(settings.value.density ?? 'system');
```

### `intent-structure-is-the-decision` — Nesting and counts are already intent

A `Stat` inside a `Section` is a nested surface; a field with three `options` is a segmented control; a form with six visible fields at 800 px is three columns. The engine reads these from structure. Do not restate them as props.

```typescript
// ❌ WRONG — restating what the schema already carries
{ name: 'amountShape', label: 'Amounts are', segmented: true, options: [/* 2 */] }

// ✅ CORRECT — packages/ledger/src/screens/import.ts: a 2-option choice; the engine makes it segmented
{ name: 'amountShape', label: 'Amounts are', required: true,
  options: [{ value: 'signed', label: 'One signed column' }, { value: 'split', label: 'Money out / money in' }] }
```

---

## 2. Blocks (CRITICAL)

Fifteen blocks plus `notify()` and `confirm()` — the whole vocabulary (`src/index.ts`). Each entry: props (from the exported prop type), the decisions the engine makes, one Ledger example.

### `block-app` — `App` is the shell; sidebar vs bar is the engine's

`AppProps { brand; nav: NavItem[]; location; children }` (`blocks/app.ts`). Sidebar iff `width ≥ sidebarWidth + contentMin` (232 + 560), else a sticky top bar whose menu is a `popover` layer through `ctx.overlay` (ADR 0042): the toggle is `aria-expanded` + `aria-controls`, open focuses the first link (ArrowUp: the last), arrows wrap, Home/End jump, Escape and an outside tap close and return focus to the toggle, Tab leaves past the toggle, navigation closes without moving focus. The matching nav item gets `aria-current="page"`; `/` matches exactly, others by prefix.

```typescript
// ❌ WRONG — the app choosing the shell shape
App({ brand: 'Ledger', nav, location, children, layout: window.innerWidth > 900 ? 'sidebar' : 'bar' });

// ✅ CORRECT — packages/ledger/src/main.ts
const app = App({
  brand: 'Ledger',
  nav,
  location: computed(() => router.url.value.pathname),
  children: AppRouter({}),
});
```

### `block-page` — `Page` is a routed screen

`PageProps { title; actions?; children; status? }` (`blocks/page.ts`). A pinned `Toolbar` over a centred column (`contentMax` 1120). `status` pending → skeleton instead of children; failed → failure line with Retry; refreshing → title becomes `"<title> · Updating…"`. `Page` reads `children` eagerly (see *Common mistakes*).

```typescript
// ✅ CORRECT — packages/ledger/src/screens/transactions.ts
return Page({
  title: 'Transactions',
  actions: [
    { id: 'add', label: 'Add transaction', priority: 'primary', onSelect: () => { editing.value = undefined; open.value = true; } },
    { id: 'clear', label: 'Clear filters', priority: 'tertiary', onSelect: () => { filters.value = { q: '', categoryId: '', accountId: '', uncategorized: false }; } },
  ],
  children: [/* Sections */],
});
```

### `block-toolbar` — `Toolbar` ranks actions above the title, primaries above all

`ToolbarProps { title; actions? }`; `Action { id; label; priority?; destructive?; onSelect? }` (`blocks/toolbar.ts`, `blocks/types.ts`). Rank `tertiary 1 < secondary 2 < title 10 < primary 20`: tertiaries overflow into the "More actions" menu first (later ones first), then secondaries, then the title truncates to `minTitle` (80). A primary never leaves — it is not overflowable; the plan reports `FIT_ROW` instead. A busy action is `aria-busy` and disabled. Buttons and menu items come from the one renderer (`blocks/actions.ts`, see `decide-one-action-rule`). The More menu is a `popover` layer its trigger toggles (a tap on the open trigger closes, never reopens).

```typescript
// ✅ CORRECT — packages/engine/README.md; proven at 1024/768/600/480/360 in toolbar.test.ts
Toolbar({
  title: 'Grandmother’s lasagne al forno',
  actions: [
    { id: 'share',  label: 'Share',       priority: 'tertiary' },
    { id: 'export', label: 'Export',      priority: 'tertiary' },
    { id: 'edit',   label: 'Edit' },
    { id: 'save',   label: 'Save recipe', priority: 'primary', onSelect: save },
  ],
});
```

Usually reached through `Page.actions`; use `Toolbar` directly only for a bar that is not a page.

### `block-section` — `Section` is a titled surface that knows when it is nested

`SectionProps { title?; children; status? }` (`blocks/section.ts`). Draws a card; inside another surface (`Section`/`Stat`) draws none (`card.nested`). Owns waiting: skeleton, failure + Retry, "Updating…" beside the title.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/overview.ts
Section({ title: 'Spending by category', children: [Bars({ items: byCategory })] })
```

### `block-grid` — `Grid` chooses how many cells sit side by side

`GridProps { children }` (`blocks/grid.ts`). `columnsFor(width, count, cellFloor(), gap)` — the floor is derived (a card's padding + one figure column + `minTextColumn`; 238.4 at the default), never a declared number; reports `FIT_CELL` when a single column is narrower than the minimum. Children may be a computed list.

```typescript
// ❌ WRONG — asking for a column count
Grid({ columns: 3, children: cards });

// ✅ CORRECT — packages/ledger/src/screens/accounts.ts
Grid({ children: cards })   // cards: computed(() => accounts.value.map((a) => Section({ … })))
```

### `block-stat` — `Stat` is a labelled figure with a toned delta

`StatProps { label; value; delta?: Delta; hint?; status? }` (`Delta { text; tone? }`, exported; `blocks/stat.ts`). The value truncates; `delta.tone` colours the change through the skin's `tone.*` part; nested in a surface it draws no card; pending shows a one-bone skeleton.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/overview.ts
Stat({ label: 'Spending', value: computed(() => money(spendNow.value)), delta: spendDelta })
// spendDelta: computed<Delta | undefined>(() => ({ text: '+12% vs Jul', tone: pct > 0 ? 'negative' : 'positive' }))
```

### `block-table` — `Table` drops, truncates and folds by column meaning

`TableProps<T> { columns: Column<T>[]; rows; rowKey; onOpen?; sort?; onSort?; empty?: string | EmptyProps; status? }`; `Column<T> { id; label; cell; kind?; priority?; sortable? }`; `Sort { by; order }` (`blocks/table.ts`). Decisions: text columns truncate to `minTextColumn` (96), figures and dates never; non-primary columns leave by priority (tertiary first, later first) and **fold under the first primary text column** as a muted line (numeric ones as "Label value"; empties earn no slot); primaries never leave (`FIT_COLUMNS` if they cannot fit); `kind: 'number' | 'money'` aligns right with tabular numerals; 60 rows then "Show N more of M"; `onOpen` makes rows tab stops named by their primary `<td>` (`aria-labelledby`), opened by Enter or Space (Space without scrolling; a control inside a cell keeps its own keys) and lit while focused; `sortable` headers hold a real `<button>` so Enter/Space toggle `onSort`, with `aria-sort` on the `th`; with no rows, `empty` renders the `Empty` block (a string is its `title`; pass `EmptyProps` for a `hint` or `actions`).

```typescript
// ✅ CORRECT — packages/ledger/src/screens/transactions.ts
const columns: Column<Transaction>[] = [
  { id: 'date', label: 'Date', kind: 'date', cell: (t) => shortDate(t.date), priority: 'primary', sortable: true },
  { id: 'payee', label: 'Payee', cell: (t) => t.payee, priority: 'primary', sortable: true },
  { id: 'category', label: 'Category', cell: (t) => categoryName(t.categoryId), sortable: true },
  { id: 'account', label: 'Account', cell: (t) => accountName(t.accountId), priority: 'tertiary' },
  { id: 'note', label: 'Note', cell: (t) => t.note ?? '', priority: 'tertiary' },
  { id: 'amount', label: 'Amount', kind: 'money', cell: (t) => Text({ text: money(t.amount, { sign: true }), tone: t.amount > 0 ? 'positive' : 'neutral' }), priority: 'primary', sortable: true },
];
Table<Transaction>({ columns, rows, rowKey: (t) => t.id, sort, onSort: (s) => { sort.value = s; }, onOpen: (t) => { editing.value = t; open.value = true; }, empty: 'No transactions match these filters.' });
```

### `block-form` — `Form` is a schema; the engine decides the rest

`FormProps<T> { fields; value? | initial? + key?; onChange?; onSubmit; submitLabel?; onCancel?; actions?; mode?; ref? }`; `FormHandle { reset(); submit() }` (`blocks/form.ts`, `blocks/form/schema.ts`). The ten rules are section 3. Columns from the visible field count (`minField` 240); `FIT_CELL` below it. Every control is labelled by the engine: `<label for>` for a labelable control, `aria-labelledby` for a segmented group (its heading click focuses the checked option), and a boolean's one string — its `label` — is the `<label for>` beside the box. `actions` sit beside Cancel and the submit: the submit is the row's primary, a destructive action sits first and apart, and every one is drawn by the one renderer.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/accounts.ts (owned draft in a dialog)
Form<Draft>({
  fields, initial: empty, key: opens.value,
  onSubmit: (d) => { addAccount({ name: d.name, institution: d.institution, kind: d.kind, opening: Math.round((d.opening ?? 0) * 100) }); adding.value = false; },
  submitLabel: 'Add account', onCancel: () => { adding.value = false; },
})
```

### `block-dialog` — `Dialog` is a card with room and a sheet on a phone

`DialogProps { title; open; onClose; children; actions? }` (`blocks/dialog.ts`). Below `dialogMin` (640) viewport it is a full-height sheet; otherwise a centred card of `dialogWidth` (520). The engine locks body scroll, closes on Escape and overlay click, focuses the first control on open, and restores focus on close. `actions` render after `children`, wrap and never overflow (the dialog is already the focused layer) — a dialog whose purpose is a decision says `actions`, never `Form({ fields: [] })` (issue 0023, resolved).

```typescript
// ✅ CORRECT — packages/ledger/src/screens/transaction-dialog.ts
return Dialog({
  title: computed(() => (props.transaction.value ? 'Edit transaction' : 'Add transaction')),
  open: props.open,
  onClose: props.onClose,
  children: computed(() => [Form<Draft>({ fields, initial: toDraft(props.transaction.value, props.accountId.value), key: draftKey.value, onSubmit: submit, /* … */ })]),
});

// ✅ CORRECT — a decision dialog: content, then its actions
Dialog({ title: `${item.institution}`, open, onClose, children: [Text({ text: summary, role: 'note' }), Table({ /* … */ })],
  actions: [{ id: 'sync', label: 'Sync now', priority: 'primary', onSelect: sync }, { id: 'disconnect', label: 'Disconnect', destructive: true, onSelect: disconnect }] });
```

### `block-meter` — `Meter` tones itself by ratio

`MeterProps { label; value; max; text? }` (`blocks/meter.ts`). `value/max > 1` → negative, `> 0.85` → warning, else neutral; `role="meter"` with `aria-valuenow/min/max`. The app supplies numbers and the reading as `text`.

```typescript
// ❌ WRONG — the app picking the tone
Meter({ label, value, max, tone: spent > limit ? 'negative' : 'neutral' });

// ✅ CORRECT — packages/ledger/src/screens/budgets.ts
Meter({ label: r.category, value: r.spent, max: r.limit, text: `${money(r.spent)} of ${money(r.limit)}` })
```

### `block-bars` — `Bars` sizes its label column

`BarsProps { items: BarItem[] }`; `BarItem { label; value; text }` (`blocks/bars.ts`). Labels take their natural width up to a third of the block (never under `minLabel` 64) and truncate; bars scale to the largest value; `text` is the app's formatted value — the app knows its units.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/overview.ts
Bars({ items: byCategory })   // [{ label: c.name, value: cents, text: money(cents) }, …] sorted by the app
```

### `block-columns` — `Columns` is grouped bars over an ordered axis

`ColumnsProps { labels; series: Series[]; format }`; `Series { label; tone?; values }` (`blocks/columns.ts`). The engine sizes bars to width and shows every nth axis label so none overlap; the legend is drawn from `series`; `tone` picks `chart.bar.*`.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/overview.ts
Columns({ labels: trendLabels, series: trendSeries, format: (v) => money(v) })
// trendSeries: Series[] = [{ label: 'Income', tone: 'positive', values }, { label: 'Spending', tone: 'negative', values }]
```

### `block-empty` — `Empty` is the statement when there is nothing

`EmptyProps { title; hint?; actions? }` (`blocks/empty.ts`). The `title` is the statement ("No banks connected"), the `hint` what to do about it, and `actions` a centred row through the one renderer — mark the one the person came for `priority: 'primary'` and it is filled; Empty no longer assumes so. Use it for a whole-screen or whole-section nothing; `Table.empty` renders this same block inside a table.

```typescript
// ✅ CORRECT
Empty({ title: 'No banks connected', hint: 'Link a bank to sync transactions automatically.', actions: [{ id: 'link', label: 'Connect a bank', priority: 'primary', onSelect: link }] })
```

### `block-text` — `Text` names a role and a tone

`TextProps { text; role?: 'body' | 'note' | 'code'; tone? }` (`blocks/text.ts`). `role` says what the prose is: `body` (default); `note` — WAI-ARIA's word for content ancillary to the main content, a free-standing secondary paragraph (the engine emits `role="note"` and the skin's muted look); `code`, a literal (`role="code"`). There is no `muted` (a Part) and no `heading` (a heading is a container's `title` — a heading between blocks is a Section). Tone maps to a `tone.*` part; long text wraps anywhere. Also valid as a table `CellValue`.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/budgets.ts (inside a column cell)
Text({ text: money(r.remaining, { sign: true }), tone: r.remaining < 0 ? 'negative' : r.remaining < r.limit * 0.15 ? 'warning' : 'positive' })

// ✅ CORRECT — packages/ledger/src/screens/settings.ts: an explanatory paragraph under a Section
Text({ text: 'Backups are written on the Mac daily, under server/data/backups.', role: 'note' })

// ✅ CORRECT — an error line is body text with a tone, not a note
Text({ text: `${error.code}: ${error.message}`, tone: 'negative' })
```

### `block-link` — `Link` is a dressed anchor

`LinkProps { href; label }` (`blocks/text.ts`). Route hrefs come from the router; the skin's `link` part dresses it.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/accounts.ts
Link({ href: AppRouter.routes.account.href({ params: { id: a.id } }), label: 'View transactions →' })
```

### `block-notify` — `notify()` tells the person something happened

`notify(text, tone = 'neutral')` (`blocks/notice.ts`). Two live regions at the bottom, both mounted before the first notice: `negative` is an assertive `alert` (8 s), every other tone a polite `status` (4 s). Each notice is a `group` named Error / Success / Warning / Note with a Dismiss `<button>` in the tab order; Escape dismisses (and never reaches a dialog below); the countdown pauses while hovered or focused; a keyboard dismiss returns focus to where it came from — else the open dialog, else `main`, never `<body>`. Busy actions call it on rejection for you.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/transaction-dialog.ts
notify(existing ? 'Transaction saved' : 'Transaction added', 'positive');
```

### `block-confirm` — `confirm()` asks before the irreversible

`confirm({ title, text, action: Pick<Action, 'label' | 'destructive'> }): Promise<boolean>` (`blocks/confirm.ts`). Renders a `Dialog` with Cancel and the answer; the engine makes the answer the row's primary (filled, or danger when destructive) — the same rule as every other row. Pair with `destructive: true` actions (Ledger tenet 3: deletions ask first and say what they delete).

```typescript
// ✅ CORRECT — packages/ledger/src/screens/budgets.ts
actions: editing.value ? [{ id: 'delete', label: 'Delete budget', destructive: true, onSelect: async () => {
  const b = editing.value!;
  if (!(await confirm({ title: 'Delete budget?', text: `${categoryName(b.categoryId)} · ${money(b.limit)} per month`, action: { label: 'Delete', destructive: true } }))) return;
  removeBudget(b.id); open.value = false; notify('Budget deleted');
} }] : [],
```

### `block-part-structure-is-a-thunk` — A block reads the door live (ADR 0046 §2, §4; for block authors)

`metrics` is one object at every read, but its groups are getters over `metricsFor(sizing)` — the table for the current density and input. A read inside a reactive scope (the `host` effect, a `ctx.part()` thunk, a `computed`) follows an axis change; a read outside one holds the table of that moment and never moves. So under `blocks/`: every `ctx.part(parts, () => ({ … }))` structure is a thunk — an object literal, a `buttonBox()` call or a bound identifier is a failure of kernel scan rule 5 (`kernel.test.ts`), even when it names no metric (uniformity is cheaper than an allow-list); a derived constant (a chart budget, a form gap, a page seed) is read inside the computed that uses it; a read that must *not* re-run on a flip — Table's page reset, because an axis change is not new data — is `untrack(() => metrics.layout.tablePage)`; `FitSpec.gap` is `number | (() => number)` and `fitRow` re-solves on a sizing change on its own (`useFit` depends on `sizing`, never on `axes`, so a scheme flip re-solves nothing). Setup-time constants escape the scan; `AXIS_STALE` catches them (`prove-live-flip-equals-fresh-mount`).

```typescript
// ❌ WRONG — three frozen reads: a literal structure, a setup constant, a plain gap
const gap = metrics.space[2];
el('div', { style: ctx.part(['card'], { padding: `${metrics.space[4]}px`, gap: `${gap}px` }) }, …);
fitRow({ gap: metrics.space[2], items: … });

// ✅ CORRECT — packages/engine/src/blocks/toolbar.ts, table.ts: read where the number is used
el('div', { style: ctx.part(['card'], () => ({ padding: `${metrics.space[4]}px`, gap: `${metrics.space[2]}px` })) }, …);
fitRow({ gap: () => metrics.space[2], items: … });
const stopReset = effect(() => { allRows.value; limit.value = untrack(() => metrics.layout.tablePage); });
```

---

## 3. Form Schema (HIGH) — ADR 0037

`Field<T> = DatumField | BooleanField | FileField`, discriminated on `kind?: Kind` (`blocks/form/schema.ts`): `DatumField { name; label; kind?: 'text' | 'number' | 'money' | 'date'; required?; placeholder?; hint?; options?; when?; readOnly?; validate?; min?; max?; step?; group?; long? }`; `BooleanField { name; label; kind: 'boolean'; … }` (no `placeholder`, `options`, `long`, bounds); `FileField { name; label; kind: 'file'; accept?; … }` (no `placeholder`). `kind` says what the value is; how it is captured is derived — see `form-capture-derived`. Each rule below is one place in `form/*` and one named test in `form.test.ts`.

### `form-capture-derived` — `kind` is the datum; capture is the engine's (ADR 0043 rule 4)

There is no `'select'`, `'textarea'` or `'checkbox'`. `options` present → a choice (segmented at ≤ 3, else a list — the engine's call); `long: true` → a multi-line control; `kind: 'boolean'` → a box with the field's `label` beside it as its `<label for>` (one string, the whole name); `kind: 'file'` → a picker. A `placeholder` is ghost text or the empty choice, and a type error on `boolean` and `file`.

```typescript
// ❌ WRONG — widget words, and a checkbox named twice (0042 §(d), superseded)
{ name: 'categoryId', label: 'Category', kind: 'select', options }
{ name: 'note', label: 'Note', kind: 'textarea' }
{ name: 'income', label: 'Kind', kind: 'checkbox', placeholder: 'This is income' }

// ✅ CORRECT — what the value is; the engine captures it
{ name: 'categoryId', label: 'Category', options }
{ name: 'note', label: 'Note', long: true }
{ name: 'income', label: 'This is income', kind: 'boolean' }
{ name: 'file', label: 'CSV file', kind: 'file', accept: '.csv,text/csv', required: true }
```

### `form-when-presence` — Presence is `when(draft)`, never hint prose (rule 1)

A field whose `when` is false is not rendered, carries no error, and leaves the submitted object. A rule stated as hint text is an instruction to the user, not a control (Ledger tenet 12).

```typescript
// ❌ WRONG — issue 0022: the rule lives in prose and is validated after the fact
{ name: 'amount', label: 'Amount column', hint: 'One signed column — or leave blank and use debit/credit below' }

// ✅ CORRECT — packages/ledger/src/screens/import.ts
const signed = (d: Partial<Mapping>) => d.amountShape === 'signed';
const split = (d: Partial<Mapping>) => d.amountShape === 'split';
{ name: 'amount', label: 'Amount column', required: true, options: colOptions.value, when: signed, validate: differsFrom('date', 'date') },
{ name: 'debit', label: 'Money out column', options: colOptions.value, placeholder: 'None', when: split, validate: differsFrom('credit', 'money in') },
{ name: 'credit', label: 'Money in column', options: colOptions.value, placeholder: 'None', when: split, validate: differsFrom('debit', 'money out') },
```

### `form-options-draft` — Dependent choices are `options(draft)` (rule 2)

`options` may be a function of the draft; it is re-evaluated on every change and a value no longer offered is cleared to a fixpoint. Do not filter options in `onChange` or clear the dependent value by hand.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/transaction-dialog.ts
{ name: 'categoryId', label: 'Category',
  options: (d) => categories.value.filter((c) => c.id === 'transfer' || !!c.income === (d.kind === 'income')).map((c) => ({ value: c.id, label: c.name })),
  hint: 'Left blank, a matching rule decides; otherwise Uncategorized.' }
```

### `form-validate-reason` — `validate` returns the reason; the engine owns timing (rule 3)

`validate: (value, draft) => string | undefined`. `required`, bounds and choice membership run first, then `validate`. Errors never show on a first keystroke; they show on blur for that field and on a submit attempt for every visible field, with `aria-invalid`/`aria-describedby`, a `role="alert"` "N fields need attention." summary for 2+, and focus on the first invalid control. Do not validate in `onChange`, and do not render your own error text.

```typescript
// ❌ WRONG — app-side validation and announcement
onChange: (v) => { error.value = v.opening > 0 && v.kind === 'credit' ? 'Enter as negative' : ''; }

// ✅ CORRECT — packages/ledger/src/screens/accounts.ts
{ name: 'opening', label: 'Opening balance', kind: 'money', required: true, step: 0.01, hint: 'Negative for money owed',
  validate: (v, d) => (d.kind === 'credit' && typeof v === 'number' && v > 0 ? 'A credit card balance is money owed — enter it as zero or negative' : undefined) }
```

### `form-owned-initial-key` — Dialog drafts are owned: `initial` + `key` (rule 5)

Omit `value` and the engine owns the draft: it equals `initial` on mount and whenever `key` changes; a file input remounts; cancelling a dirty draft asks "Discard changes?"; a successful submit commits; `ref` gives a `FormHandle` for `reset()`/`submit()`. Use one key per opening for "add", the entity id for "edit".

```typescript
// ❌ WRONG — the pre-0037 boilerplate: a hand-seeded draft and a remount hack
const draft = signal<Draft | undefined>(undefined);
props.open.subscribe((o) => { if (o) draft.value = toDraft(props.transaction.value); });
Form<Draft>({ fields, value: draft as Signal<Draft>, onChange: (v) => { draft.value = v; }, onSubmit: submit });

// ✅ CORRECT — packages/ledger/src/screens/transaction-dialog.ts
const opens = signal(0);
props.open.subscribe((open) => { if (open) opens.value++; });
const draftKey = computed(() => props.transaction.value?.id ?? `new-${opens.value}`);
Form<Draft>({ fields, initial: toDraft(props.transaction.value, props.accountId.value), key: draftKey.value, onSubmit: submit, /* … */ })
```

### `form-controlled-value` — Shared state is controlled: `value` (rule 5, controlled mode)

Presence of the `value` key selects controlled mode; a writable signal is edited in place (an explicit `onChange` wins); no confirm-on-cancel because the base can change externally. Never pass both `value` and `initial`.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/settings.ts (a draft shared with the reset/restore actions)
const draft = signal<Settings>({ ...settings.value });
Form<Settings>({ fields, value: draft, onChange: (v) => { draft.value = v; }, onSubmit: (v) => { saveSettings(v); notify('Preferences saved', 'positive'); }, submitLabel: 'Save preferences' })
```

### `form-live-mode` — Filters are `mode: 'live'` (rule 9)

No button row, no submit; `onChange` fires per change; validation still runs on blur. `onSubmit` is still required by the type — pass a no-op.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/transactions.ts
Form<Filters>({ fields: filterFields, value: filters, onChange: (v) => { filters.value = v; }, onSubmit: () => {}, mode: 'live' })
```

### `form-group` — `group` gathers fields into one titled fieldset (rule 6)

Fields sharing a `group` string become one `fieldset` with a `legend`, spanning the row at the position of the first member, laying out its own members by the same column rule.

```typescript
// ✅ CORRECT
{ name: 'street', label: 'Street', kind: 'text', group: 'Shipping', long: true },
{ name: 'city', label: 'City',   kind: 'text', group: 'Shipping' },
{ name: 'zip', label: 'Postcode', kind: 'text', group: 'Shipping' },
```

### `form-long` — `long` spans the row; there is no width word (rule 6, non-goals)

`long: true` takes the full row and a multi-line control. `Field` has no `width`, `inline`, `columns`, `segmented` or `textarea` — by the 0034 rule.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/transaction-dialog.ts
{ name: 'note', label: 'Note', placeholder: 'Optional', long: true }
```

### `form-bounds-readonly` — Bounds reach the control; read-only follows the draft (rules 7, 8)

`min`/`max`/`step` reach the native input (money steps 0.01, number `any`, dates take ISO strings; money/number get `inputmode="decimal"`). `readOnly: boolean | (draft) => boolean` renders `readonly`/`disabled` plus the `input.readonly` part, reactively. There is no `disabled` prop.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/budgets.ts
{ name: 'limit', label: 'Monthly limit', kind: 'money', required: true, min: 0 }
```

### `form-submit-async` — A promise from `onSubmit` goes busy on its own (rule 10)

Return the promise; the submit button is `aria-busy` and disabled until it settles, a rejection becomes a negative notice, and the draft commits on success. Same for an `actions[].onSelect`.

```typescript
// ❌ WRONG
const saving = signal(false);
onSubmit: async (v) => { saving.value = true; try { await save(v); } finally { saving.value = false; } }

// ✅ CORRECT — packages/ledger/src/screens/settings.ts
Form<Record<string, never>>({ fields: [], value: {}, onChange: () => {}, onSubmit: restoreFromServer, submitLabel: 'Restore', onCancel: () => { restoring.value = false; } })
```

---

## 4. Status & Busy (HIGH)

### `status-pass-result` — Pass a `QueryResult`/`ResourceResult` straight in as `status`

`Status` (`blocks/status.ts`) structurally matches core's `QueryResult<T>` and `ResourceResult<T>`: `{ loading, error, data?, refetch?/refresh? }`. `Page`, `Section`, `Table`, `Stat` accept it and render pending (skeleton), failed (message + Retry when the source can retry), and refreshing ("Updating…").

```typescript
// ✅ CORRECT — packages/ledger/src/screens/settings.ts
const backups = query(() => ['ledger', 'backups'], () => listBackups());
Table<ServerBackup>({ columns: backupColumns, rows: backupRows, rowKey: (b) => b.name, status: backups, onOpen: (b) => { chosen.value = b; restoring.value = true; }, empty: 'No backups yet. The first one is written tonight.' })
```

### `status-async-actions-busy` — Return the promise from `onSelect`

`Action.onSelect` may return a promise; every host of an `Action` (Toolbar/Page, Empty, Form, Dialog) shows it busy until it settles and notifies on rejection — one renderer, one rule.

```typescript
// ❌ WRONG — a hand-rolled busy flag and swallowed error
{ id: 'sync', label: 'Sync now', onSelect: () => { busy.value = true; sync().catch(() => {}).finally(() => { busy.value = false; }); } }

// ✅ CORRECT — packages/ledger/src/screens/settings.ts
{ id: 'reset', label: 'Reset demo data', priority: 'tertiary', destructive: true, onSelect: async () => {
  if (!(await confirm({ title: 'Reset all data?', text: 'This replaces everything with the demo data. Export a backup first if you need it.', action: { label: 'Reset', destructive: true } }))) return;
  resetToSeed(); draft.value = { ...settings.value }; notify('Demo data restored');
} }
```

### `status-no-loading-flags` — Never hand-roll loading states

A `loading` signal that swaps children for a spinner is the engine's waiting rule re-implemented in app code, unproven and unskinned. Give the block the result.

```typescript
// ❌ WRONG
children: computed(() => (backups.loading.value ? [Text({ text: 'Loading…' })] : [Table({ /* … */ })]))

// ✅ CORRECT
children: [Table({ /* … */, status: backups })]
```

### `status-stale-stays` — Failure and refresh keep the content

On failure the last content stays and a failure line is added; on refresh the content stays and "Updating…" appears. Do not clear rows on error or hide a table while it refetches.

---

## 5. Skin & Axes (MEDIUM-HIGH) — ADR 0035, 0046

### `skin-use-once-root` — Install the skin once, before the App

`useSkin(skin: Skin | null, { scheme?, density?, input? }: SkinOptions)` (`skin.ts`), each option `| 'system'` (the default). It is the one visual decision an app makes; blocks re-style live, and the sizing options set the axes through `setDensity`/`setInput` in the same call. Call it at the entry, not per screen.

```typescript
// ✅ CORRECT — packages/ledger/src/main.ts (scheme today; the density option is the same line, ADR 0046 §Consequences)
const bare = new URLSearchParams(location.search).has('bare');
useSkin(bare ? null : defaultSkin, { scheme: settings.value.appearance ?? 'system', density: settings.value.density ?? 'system' });
effect(() => { setScheme(settings.value.appearance ?? 'system'); setDensity(settings.value.density ?? 'system'); });
```

### `skin-scheme-preference` — The axes are preferences an app forwards, never readings it takes

Three axes (`engine/axes.ts`), one resolved signal `axes: { scheme, density, input }`, each a preference over a platform reading: `Scheme = 'light' | 'dark'` — `'system'` follows `prefers-color-scheme` live, and the engine sets `color-scheme` on the document so native controls agree; `Density = 'comfortable' | 'compact'` — a preference, `'system'` is `comfortable` (the word is kept so a platform density can be honoured later without an API change); `Input = 'pointer' | 'touch'` — `'system'` follows `(pointer: coarse)` live. `setScheme()`, `setDensity()`, `setInput()` change one without reinstalling the skin. An app forwards what the person chose and nothing more: it never reads `matchMedia`, never derives one axis from another, and normally never calls `setInput` at all — detection is the engine's.

```typescript
// ❌ WRONG — the app taking the platform reading, and coupling axes
const dark = matchMedia('(prefers-color-scheme: dark)').matches;
useSkin(dark ? darkSkin : lightSkin);
if (navigator.maxTouchPoints > 0) setDensity('comfortable');

// ✅ CORRECT — packages/ledger/src/screens/settings.ts offers appearance as a select; density takes the same shape, and main.ts forwards both
{ name: 'appearance', label: 'Appearance', required: true, options: [{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] }
{ name: 'density', label: 'Density', required: true, options: [{ value: 'system', label: 'System' }, { value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }] }
```

### `skin-write-parts` — A skin is a map of parts, or a function of the axes

`Skin = SkinParts | ((axes: Axes) => SkinParts)` (`SkinAxes` is `Axes`: `{ scheme, density, input }`); `SkinParts = Partial<Record<Part, StyleRecord>>`; `PARTS` lists every part in family order (Surface, Text, Control, Navigation, Data, Feedback). A complete skin defines every part in both schemes; `skin.test.ts` enforces completeness for the default. `lightPalette`, `darkPalette`, `partsOf` (`skin/default.ts`) are exported to build one. A skin function that destructures `{ scheme }` is unaffected by the two new axes. Density and input are already engine numbers behind `metrics` — `space`, `control.height`, `control.hit` — so a skin never scales spacing, control size or type with them (`skin-no-layout`; type scaling with density is a future round with a `charWidth` recalibration, ADR 0046 §Non-goals). What a skin may legitimately vary by them is look: a heavier border on touch, a quieter divider on compact.

```typescript
// ❌ WRONG — a skin sizing layout from an axis
const brand: Skin = ({ density }) => ({ 'table.cell': { padding: density === 'compact' ? '4px' : '8px' } });

// ✅ CORRECT — a skin as a function of the axes, varying look only
import { type Skin, type Axes, partsOf, lightPalette, darkPalette } from '@nisli/engine';
const brand: Skin = ({ scheme }: Axes) => partsOf(scheme === 'dark' ? { ...darkPalette, accent: '#7c5cff' } : { ...lightPalette, accent: '#4b2ee0' });
```

### `skin-no-layout` — A skin never contains layout

Structural properties (display, flex, grid, width, gap, padding, position, z-index, overflow, ellipsis, alignment of figures) are the engine's from `metrics`; a skin sets only colour, background, font, border, radius, shadow, decoration. A skin that sets `display` or `width` is lying about what it is.

```typescript
// ❌ WRONG
const skin: Skin = { 'table.cell': { display: 'none', color: '#333' } };

// ✅ CORRECT
const skin: Skin = { 'table.cell': { color: '#333', borderBottom: '1px solid #eee' } };
```

### `skin-bare-proves` — `useSkin(null)` proves the scaffold

With no skin every `look()` is empty and blocks render bare: browser-default text on a correct layout. Ledger exposes it at `/?bare`. If a layout looks wrong bare, the bug is in the engine; if it looks wrong only skinned, it is the skin.

---

## 6. Decisions & Levers (MEDIUM-HIGH)

The levers an author holds are `priority`, `kind`, `tone`, `destructive`, `role`, `required`, `sortable`, `options`, `long`, and structure. Everything else is the engine's (ADR 0034, *Decision rules that exist today*).

### `decide-priority-lever` — `priority` is survival order

`Priority = 'primary' | 'secondary' | 'tertiary'` (exported), default `'secondary'`. On `Action` and `Column`: `primary` survives longest, `tertiary` leaves first; equal priority gives ground from the end (document order). Order your tertiaries so the least valuable is last. The word has one meaning — survival; that the primary action is the filled button, and that the first primary text column is the fold target, are the engine's rules.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/overview.ts: cadence is the first to fold
const recurringColumns: Column<RecurringItem>[] = [
  { id: 'payee', label: 'Payee', cell: (r) => r.payee, priority: 'primary' },
  { id: 'cadence', label: 'Cadence', cell: (r) => r.cadence, priority: 'tertiary' },
  { id: 'typical', label: 'Typical', kind: 'money', cell: (r) => money(r.typicalAmount, { sign: true }) },
  { id: 'next', label: 'Next expected', kind: 'date', cell: (r) => shortDate(r.nextExpected) },
];
```

### `decide-kind-lever` — `kind` says what a cell holds

`Kind` (exported) says what a value is, on a Column and a Field alike. On a column (`'text' | 'number' | 'money' | 'date'`): `number`/`money` align right with tabular numerals and never truncate; `date` uses tabular numerals and never truncates; `text` (default) truncates to `minTextColumn`. Mark every figure column — an unmarked amount column will be truncated as text. On a field the same four, plus `'boolean'` and `'file'`; never a widget.

```typescript
// ❌ WRONG — a money column left as text: it may truncate and aligns left
{ id: 'amount', label: 'Amount', cell: (t) => money(t.amount) }

// ✅ CORRECT
{ id: 'amount', label: 'Amount', kind: 'money', cell: (t) => money(t.amount), priority: 'primary' }
```

### `decide-tone-lever` — `tone` names meaning, once

`Tone = 'neutral' | 'positive' | 'negative' | 'warning'` (`blocks/types.ts`) on `Stat.delta`, `Text`, `Series`, `notify`. The skin decides what "negative" looks like in each scheme; the app decides only whether a number is good news.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/import.ts
Text({ text: c.status, tone: c.ok ? 'positive' : 'negative' })
```

### `decide-one-action-rule` — One `Action`, one renderer, one rule (ADR 0043 rule 3)

Every host of an `Action` — Toolbar (and Page), Empty, Form, Dialog, and `confirm`'s answers — draws it through `blocks/actions.ts` with one rule, applied per action: `destructive` → `button.danger` (wins); else `priority: 'primary'` → `button.primary`; else `button.plain`; busy under its `id` on a returned promise. The renderer never counts: two primaries are two filled buttons. One primary per row is the convention to write to; in a Form the submit is the row's primary, so a Form or Dialog `actions` entry is normally secondary, tertiary or destructive. Only the Toolbar overflows (to a menu, `FIT_ROW` below the minimum); Empty, Form and Dialog rows wrap. In a footer (Form, Dialog) a destructive action sits first and apart.

```typescript
// ❌ WRONG — expecting Empty to fill its only action, or a Form to make an extra action danger on its own
Empty({ title: 'No rules', actions: [{ id: 'add', label: 'Add rule' }] })            // plain: nothing said primary
Form({ /* … */ actions: [{ id: 'delete', label: 'Delete' }] })                          // plain: nothing said destructive

// ✅ CORRECT — the word carries the meaning; the rule is the same everywhere
Empty({ title: 'No rules', actions: [{ id: 'add', label: 'Add rule', priority: 'primary', onSelect: add }] })
Form({ /* … */ actions: [{ id: 'delete', label: 'Delete', destructive: true, onSelect: remove }] })
```

### `decide-destructive-lever` — `destructive` is danger, never primary

`Action.destructive: true` renders as danger (`button.danger`, `menu.item.danger`) wherever it is placed and wins over `priority: 'primary'`. It is a word about consequence; pair it with `confirm()`.

### `decide-text-truncates` — Text gives ground before anything leaves; figures never do

A Toolbar title shrinks to `minTitle` before a primary action leaves; a text column shrinks to `minTextColumn` before it folds. Do not pre-shorten titles or cell text to "make it fit" at a width.

### `decide-columns-fold` — A dropped column folds under the primary text cell

When a non-primary column leaves the row it appears as a muted line under the first primary text column ("Shopping · Card"; numeric as "Limit €500"). Nothing is lost, so do not duplicate a tertiary column's value into another cell, and do not hide columns yourself.

### `decide-grids-choose-columns` — Column counts, shell shape and dialog shape are decided

`Grid` and `Form` compute columns from width and item count; `App` picks sidebar vs bar; `Dialog` picks card vs sheet; `Table` pages at 60; `Bars` sizes its label column; `Columns` thins its axis. These are proven in `layout.test.ts`, `form.test.ts`, `table.test.ts`. Do not build two versions of a screen for two widths.

```typescript
// ❌ WRONG — a width fork in app code
children: computed(() => (narrow.value ? [ListVersion()] : [Grid({ children: cards })]))

// ✅ CORRECT
children: [Grid({ children: cards })]
```

### `decide-dont-control` — What NOT to try to control

No app word exists for: pixel widths, breakpoints, column counts, sticky/fixed, overflow order beyond `priority`, segmented-vs-select (the count decides), skeleton shape, notice placement or timing, dialog size, focus management, roles and live-region politeness, numeric alignment. If a screen seems to need one, it is a gap: `intent-new-need-home`, then `dogfood-issue-then-engine`.

### `decide-data-never-reshapes` — A decision never depends on the data shown (ADR 0044)

A layout decision is a function of viewport width and declared intent, never of which data is currently shown; data fits into the decided structure — it truncates, folds, or wraps — and never reshapes it (the tenet: 0034 §The contract rule 1; `packages/ledger/TENETS.md` §13; born of sorting Transactions by Amount widening Payee and folding two columns, issue 0028). Table column widths are budgets — pure functions of `kind`, the header label and `metrics.layout` (`columnBudgets`, `engine/space.ts`) — never measured from cells; Bars' label column and Columns' axis skipping are char budgets (`labelChars`, `axisChars`), never the longest label. So sorting, filtering, paging and "Show 60 more" can never move a column, a fold, a section or an action. A figure wider than its budget truncates and files `FIGURE_TRUNCATED`: the fix is a shorter format, or one metric raised once — never a wider column, never a re-plan. For app code the rule means: declare one structure and let the data live inside it, and keep data out of `title` — a data-bearing title is measured as intent, and because `fit()` pays lowest priority first it can evict secondary actions into the overflow menu before it truncates to `minTitle`.

```typescript
// ❌ WRONG — structure chosen from the data currently loaded
const columns = computed(() => (rows.value.some((r) => r.note) ? withNote : withoutNote)); // a filter reshapes the table
Toolbar({ title: computed(() => selected.value?.payee ?? '') });  // data as intent: a long payee can push actions into the menu

// ✅ CORRECT — packages/ledger/src/screens/transactions.ts: one declared column set; a long payee truncates, never widens
const columns: Column<Transaction>[] = [
  { id: 'date', label: 'Date', kind: 'date', cell: (t) => shortDate(t.date), priority: 'primary', sortable: true },
  { id: 'payee', label: 'Payee', cell: (t) => t.payee, priority: 'primary' },
  { id: 'amount', label: 'Amount', kind: 'money', cell: (t) => money(t.amount, { sign: true }), priority: 'primary', sortable: true },
];
```

### `decide-axes-move-rhythm-not-floors` — An axis moves rhythm, never a floor (ADR 0046 §3)

`metricsFor({ density, input }): Metrics` (`metrics.ts`) is pure, and `{ comfortable, pointer }` is the 0.9.0 constant number for number. What moves: **density** scales `space` (4 8 12 16 24 32 → 4 6 8 12 16 24; the steps stay distinct so a checkbox↔label gap and a label↔field gap never collapse into one) and `control` (`height` 32 → 28, `padX` 12 → 8), and nothing else; **input** floors `control` through `max` (`height` ≥ 44, `check` 24, `hit` 44), so compact + touch is 44 px controls with compact spacing — explicit arithmetic, never a derivation. What never moves: `layout` (every threshold and char budget — `minTextColumn`, `minField`, `sidebarWidth`, `dialogMin`, `tablePage`, `dateChars` …), `charWidth` (calibrated to the skin's 14 px body; every glyph table depends on it) and `layer`. The lesson is F9 from the north-star prototype: a compact context that lowered its floors would be the one context that overflows. `control.hit` (24 at pointer — WCAG 2.5.8; 44 at touch) is the floor blocks give targets that are not controls: `height: hit` on a table row and a sortable `th`, `minHeight: hit` on nav links and menu items, `height` + `minWidth: hit` on the notice dismiss. For an app the rule means: on the phone a Table shows fewer rows and the bar grows — that is the intended trade, not a thing to counter with a prop; and a compact screen is not a place to expect narrower columns.

```typescript
// ❌ WRONG — expecting a floor to move with an axis, or a threshold from a flag
expect(metricsFor({ density: 'compact', input: 'pointer' }).layout.minTextColumn).toBeLessThan(96);   // it is 96 in every context

// ✅ CORRECT — packages/engine/src/engine/axes.test.ts: rhythm and controls move, floors do not
expect(metricsFor({ density: 'comfortable', input: 'pointer' })).toEqual(COMFORTABLE);
expect(metricsFor({ density: 'compact', input: 'touch' }).control).toEqual({ height: 44, padX: 8, check: 24, hit: 44 });
expect(metricsFor({ density: 'compact', input: 'touch' }).layout).toEqual(COMFORTABLE.layout);
```

### `decide-floats-are-layers` — Anything that floats is a layer

Dialog, `confirm()`, the Toolbar menu, the App bar-mode menu and notices are all layers on the one overlay stack (`engine/overlay.ts`, driven only by `blocks/kernel.ts`; ADR 0040, 0042). The stack gives each Escape, outside-pointer dismiss, focus in and focus return, z-order and inertness — and treats a pointer on a layer's *anchor* as inside, so a real tap on an open menu's trigger closes it once rather than dismissing on pointerdown and reopening on click. Never hand-roll a sheet, a focus trap or a third focus model; an app never sees any of it.

```typescript
// ❌ WRONG — a screen rolling its own floating panel
const open = signal(false);
html`<div style="position:fixed;bottom:0" hidden=${() => !open.value}>…</div>`;   // no Escape, no focus, pushes nothing back

// ✅ CORRECT — packages/ledger/src/main.ts: the App decides; at 360 its menu is a popover layer with no app line
const app = App({ brand: 'Ledger', nav, location: computed(() => router.url.value.pathname), children: AppRouter({}) });
```

### `decide-reachable-by-keyboard` — Every decision is reachable by keyboard and named for AT

If the engine draws something a person can act on, a keyboard reaches it and a reader can name it, with no app line (ADR 0042): a `sortable` header is a real `<button>` (Enter/Space sort, `aria-sort` on the `th`); an `onOpen` row is a tab stop named by its primary cell; every notice has a Dismiss in the tab order and answers Escape; every Form control is labelled by a `<label for>` or `aria-labelledby`; a keyboard dismiss never drops focus to `<body>`. Ledger's Transactions screen gains keyboard sorting and named rows without a change.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/transactions.ts: `sortable` and `onOpen` are the whole intent
{ id: 'date', label: 'Date', kind: 'date', cell: (t) => shortDate(t.date), priority: 'primary', sortable: true },
…
Table<Transaction>({ columns, rows, rowKey: (t) => t.id, sort, onSort: (s) => { sort.value = s; }, onOpen: (t) => { editing.value = t; open.value = true; } })
```

### `decide-tone-is-urgency` — A notice's tone is its urgency

`notify(text, 'negative')` interrupts: an assertive `role="alert"`, 8 s, spoken as "Error"; `positive`/`warning`/`neutral` wait their turn in the polite `status`, 4 s, spoken as Success/Warning/Note. Choose the tone for what happened, never to make a message louder; the `LIVE_TONE` claim fails a notice in the wrong container or in none.

```typescript
// ❌ WRONG — negative to make "Saved" stand out
notify('Saved', 'negative');

// ✅ CORRECT — packages/ledger/src/screens/transaction-dialog.ts (a busy action's rejection is filed 'negative' for you)
notify(existing ? 'Transaction saved' : 'Transaction added', 'positive');
notify('Transaction deleted');
```

---

## 7. Proof at Width (MEDIUM)

Verification is by test, not eye (ADR 0034, *Consequences*; NORTH-STAR: *correct in every context, verified without looking*). Proof is a bounded context that observes Decision: it reads the inline styles and reports the engine wrote and says, in data, what does not hold. The measurer is the seam — in tests every `measure()` is answered without a browser — so a block is arithmetic under `textMeasurer()` and a whole screen is provable in happy-dom under the calibrated `estimator()`. The public test surface is `@nisli/engine/test` (`src/test/prove.ts`); the browser half is `@nisli/engine/verify` and the `nisli-verify` CLI. Issue 0024 is no longer parked: every Ledger screen is proven in `packages/ledger/src/screens/screens.proof.test.ts`.

### `prove-screens-with-prove` — `prove()` is how a screen is proven

`prove(make: () => Content, { widths, axes?, viewport?, scheme?, turns?, variants? }): Promise<Proof>` mounts the screen at each width **× each axes context** over `mount()` with the estimating measurer, flushes, turns to a fixed point (each turn ends in `remeasure()`, the ResizeObserver pass), `settle()`s core's async work so the data is in, turns again, then runs every checker. `axes` is a list of partial `{ density?, input? }` contexts, the rest `'system'`; default `[{}]`, the default context only (ADR 0046 §5). `Proof { claims, reports, byWidth[{ width, axes, claims, reports, turns }] }` — every claim carries its `width` and its resolved `axes`, `formatClaim()` prints the context when it is not the default, and an empty `claims` is the proof; a screen still moving at `turns` (default 12) is claimed `UNSETTLED`. One `it` per screen, five widths, `scheme: 'light'` so text is sized as the skin dresses it, and the Ledger convention for contexts: `[{}, { density: 'compact' }, { input: 'touch' }]` — the default, the tighter rhythm, and the floor.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/screens.proof.test.ts
import { prove, type Claim } from '@nisli/engine/test';
const WIDTHS = [1280, 1024, 768, 480, 360] as const;
const AXES = [{}, { density: 'compact' }, { input: 'touch' }] as const;
for (const [name, make] of Object.entries(screens)) {
  it(name, async () => {
    const proof = await prove(make, { widths: WIDTHS, axes: AXES, scheme: 'light' });
    expect([...found].filter((f) => !expected.has(f))).toEqual([]);   // everything not a recorded finding must hold
    expect(proof.byWidth.length).toBe(WIDTHS.length * AXES.length);
    for (const w of proof.byWidth) expect(w.turns, `${name} at ${w.width} ${w.axes.density}+${w.axes.input} settled`).toBeLessThan(12);
  });
}
```

### `prove-claims-are-failures` — A claim is a failing test, never noise

A `Claim { code, block, detail, severity, width?, axes? }` is the engine saying something a person would otherwise catch by eye or keyboard is wrong. Codes (`src/test/claims.ts`, each checker unit-tested on a positive and a negative fixture): the fit reports `FIT_ROW` / `FIT_COLUMNS` / `FIT_CELL` (a plan still unsatisfied once the screen settled), `OVERFLOW_TEXT` (a one-line text wider than its box with no ellipsis), `FIGURE_TRUNCATED` (a `tabular-nums` figure — money, date, a Stat's value — under an ellipsis narrower than it: a text may truncate, a number may not), `DECISION_UNSTABLE` (the same width and intent produced two structural plans for two datasets — ADR 0044), `UNSETTLED`, `NAME_MISSING`, `ID_DUPLICATE`, `LABEL_MISSING`, `DIALOG_ARIA`, `MENU_ITEM_ROLE`, `BLOCK_ERROR`, `UNREACHABLE`, `SORT_UNREACHABLE` (a sortable header a keyboard cannot reach), `POPUP_ARIA` (`aria-expanded` without a shown/hidden controlled element), `LIVE_TONE` (a negative notice outside an assertive container, or any notice outside a live container), `TARGET_SMALL` (under touch, an interactive target under `control.hit` on a side — `prove-touch-targets`), `AXIS_STALE` (an inline style that did not follow a live axis flip — `prove-live-flip-equals-fresh-mount`). Fix the intent (a `tertiary`? a shorter header?) or the engine (Settings @360 filed `FIGURE_TRUNCATED` on a folded backup name — the bug was `table.ts` inheriting `tabular-nums` into the fold, fixed there). Never loosen the proof: not by dropping a width, not by dropping a context, not by filtering a code.

```typescript
// ❌ WRONG — silencing a claim by widening the width list, dropping a context, or filtering codes
const proof = await prove(make, { widths: [1280, 1024] });          // 360 is where the claim was
const proof = await prove(make, { widths: WIDTHS, axes: [{}] });   // touch is where TARGET_SMALL was
expect(proof.claims.filter((c) => c.code !== 'FIGURE_TRUNCATED')).toEqual([]);

// ✅ CORRECT — screens.proof.test.ts: a claim a screen legitimately makes today is a recorded finding,
// keyed by width and axes, asserted STILL present (a fix retires its line), and everything else must hold
const KNOWN: Record<string, { code: Claim['code']; detail: string; widths: readonly number[]; axes?: readonly AxesContext[] }[]> = {};
expect([...expected].filter((e) => !found.has(e))).toEqual([]);
```

### `prove-reports-are-failures` — A layout report is a failed plan

`LayoutReport { code: 'FIT_ROW' | 'FIT_COLUMNS' | 'FIT_CELL'; block; width; deficit; detail }` (`engine/report.ts`) is a plan the engine could not satisfy after every concession. In dev the block's host is stamped `data-nisli-report="CODE"` while the plan fails (cleared when it passes) and the report lands in the `window.__nisli.reports` ring; with no listener it is also a `console.error`. `prove()` keeps only the reports still standing after settle (`Proof.reports`) and folds them into `claims`; `verify()` reads the stamp and ring as `LAYOUT_REPORT`. In a block test, subscribe with `onReport()` and expect `[]`.

```typescript
// ❌ WRONG — treating the console line as noise
// [nisli engine FIT_COLUMNS] <nisli-table> columns Date, Payee, Amount cannot fit even truncated (7px short at 294px)

// ✅ CORRECT — a report is a test failure; fix the intent or the engine
const reports: LayoutReport[] = [];
const stop = onReport((r) => reports.push(r));
// … mount at 294 …
expect(reports).toEqual([]);
stop();
```

### `prove-decision-unstable` — The determinism tenet is proven by diffing stamped plans (ADR 0044)

In dev every decided block stamps its structural decisions on its host as `data-nisli-plan` (`PLAN_ATTR`, `engine/report.ts`): a `fitRow` block (Table, Toolbar) stamps the canonical plan (`id:action:width`, `>target` for folds), Bars `label:W`, Columns `every:N`, Grid and Form `columns:N`. After the base mount reaches its fixed point, `prove()` advances every table's page once — the one data perturbation it can make with no knowledge of the screen — and mounts each `ProveOptions.variants` factory to its own fixed point, then diffs the stamps in document order. Any structural difference is a `DECISION_UNSTABLE` claim (severity `error`) naming the block and both plans. A `variants` factory must present the *same intent over perturbed data* — a sorted copy of the rows, a reversed series; the caller owns the perturbation, no block prop names data. A variant whose stamped blocks differ in count or tag is named too: that is a changed intent, a misuse of `variants`.

```typescript
// ✅ CORRECT — same intent, perturbed data: the variant boots the store with the rows pre-sorted
const proof = await prove(() => TransactionsScreen({}), {
  widths: WIDTHS, scheme: 'light',
  variants: [() => TransactionsScreen({})],   // mounted over the perturbed store state
});
expect(proof.claims).toEqual([]);             // any plan drift is DECISION_UNSTABLE, naming the block

// ❌ WRONG — "fixing" instability by dropping the variant or filtering the code
expect(proof.claims.filter((c) => c.code !== 'DECISION_UNSTABLE')).toEqual([]);
```

### `prove-real-content` — Prove over real data, and prove that you did

An empty screen proves nothing: a table with no rows never truncates a figure. Boot the store from a stubbed server (`vi.stubGlobal('fetch', …)` for every `/api/*` shape the data layer reads), import the store and screens *after* the stub, `await store.ready`, and assert the fixture reached the DOM before the proof runs — the Ledger fixture has 19 transactions, 3 accounts, budgets, rules, a bank connection and backups, and a sanity test checks the rows and `$12,345.67` at 360.

```typescript
// ✅ CORRECT — screens.proof.test.ts
const store = await import('../data/store.js');
await store.ready;
const { TransactionsScreen } = await import('./transactions.js');
it('the transactions table holds every row, with figures, at 360', () => {
  const t = mount(() => TransactionsScreen({}), {}, { width: 360, scheme: 'light', measure: estimator(360) });
  try {
    expect(t.frame.querySelectorAll('tbody tr').length).toBeGreaterThanOrEqual(transactions.length);
    expect(t.frame.textContent).toContain('$12,345.67');
  } finally { t.unmount(); }
});
```

### `prove-mount-at-width` — `mount()` a block at a width and assert the DOM

`mount(target: tag | factory, props, { width = 800, viewport = width, scheme?, density?, input?, text?, measure? }): Mounted { el; frame; styleOf(selector?); resize(width, viewport?); unmount() }` (`test/mount.ts`). `text` sizes text-shaped elements, `measure` answers everything else (the estimator, in `prove()`), the frame answers the rest. `density` and `input` set the axes through `setDensity`/`setInput` before the mount (`'system'` when omitted — `pointer` in happy-dom, which evaluates `(pointer: coarse)` from `navigator.maxTouchPoints`); `resize()` is the frame changing; `unmount()` restores the measurer, skin and document, and resets density and input to `'system'` **unconditionally**, because a test may flip the axes live after a mount that set neither. Mounts nest (a proof mounts a fresh tree beside a live one); the inner unmount hands the outer its measurer and skin back. Assert on inline styles (`display`, `width`, `textOverflow`) and DOM (`[role=menuitem]`, `thead th`).

```typescript
// ✅ CORRECT — packages/engine/src/blocks/toolbar.test.ts
import { mount as mountBlock, textMeasurer, type Mounted } from '@nisli/engine/test';
const text = textMeasurer(8);
mounted = mountBlock('nisli-toolbar', { title, actions }, { width: 480, text });
const shown = [...mounted.el.querySelectorAll<HTMLElement>('[data-nisli-action]')].filter((b) => b.style.display !== 'none').map((b) => b.getAttribute('data-nisli-action'));
expect(shown).toEqual(['save']);

// ✅ CORRECT — a block under touch: the row carries the floor by name
const t = mountBlock('nisli-table', { columns, rows, rowKey, onOpen }, { width: 800, input: 'touch' });
expect(t.styleOf('tbody tr').height).toBe(`${metrics.control.hit}px`);   // 44px; 24px under pointer
t.unmount();
```

(`data-nisli-action` is an engine-internal test hook the block writes on its own buttons — not app vocabulary.)

### `prove-live-flip-equals-fresh-mount` — A live axis flip must equal a fresh mount (ADR 0046 §5)

`AXIS_STALE` (severity `error`) is the general instrument that makes a frozen number a test failure in any block, screen-wide, with no scan: after the base mount reaches its fixed point and `settle()`s at axes A — and *before* the page-advance perturbation, which changes the row count — `prove()` flips the live axes to B (compact + touch when A is the default, else the default), settles again, and diffs the live tree against a fresh mount taken at B through the same `fixedPoint` + `settle()`. Pairing is by document order and valid only when both trees have the same length and tag sequence (a mismatch is filed once, naming the first differing position); any inline `style` difference names the block: "did not follow the axes: `<button>` at *…* has `padding:8px 12px` live and `padding:4px 8px` fresh". The cause is always a read of `metrics` outside a reactive scope (`block-part-structure-is-a-thunk`); the fix is in the block, never in the proof. `axisStale(live: Mounted, make, { width, viewport?, scheme?, measure?, text?, run?, to? })` (`@nisli/engine/test`) is the same check for one block — the fresh tree is mounted the way the live one was — and `axes-flip.test.ts` runs it over every block as the round's gate; the live axes are restored to A afterwards.

```typescript
// ❌ WRONG — treating a stale claim as flakiness, or "fixing" it by proving the default context only
expect(proof.claims.filter((c) => c.code !== 'AXIS_STALE')).toEqual([]);
const proof = await prove(make, { widths: WIDTHS, axes: [{}] });   // the flip still runs, and still finds the frozen read

// ✅ CORRECT — packages/engine/src/axes-flip.test.ts: every block, flipped live, byte-identical to a fresh mount
const t = mount(make, {}, { width: 800 });
try { expect(await axisStale(t, make, { width: 800 })).toEqual([]); } finally { t.unmount(); }
```

### `prove-touch-targets` — Every target is `hit` on both sides under touch (ADR 0046 §5)

`TARGET_SMALL` (severity `error`, checked only when the resolved `input` is `touch`): an interactive element (`INTERACTIVE` — `a[href]`, `button`, `input`, `select`, `textarea`, a non-negative `tabindex` — visible, not inert) whose target box is under `metrics.control.hit` (44) on either side. **Height** is the element's own inline `height`/`minHeight`, else the nearest ancestor's that sets one and contains no other interactive element (a sort button inside its `th`, a link inside a `tr`); **width** is an inline `width`/`minWidth`, else the estimator's text width plus inline horizontal padding (what `OVERFLOW_TEXT` already computes), and a block-level element with no width set is as wide as its box and passes. An element with **no inline height anywhere** fails — it has no floor — unless it sits inline in flowing text (`display` unset or `inline`, e.g. a `Link` inside a `Text`), which WCAG 2.5.8 exempts and the claim skips; a native control is never text. The engine writes every size inline, so this is decidable with no browser. A `tr` carries `height: hit` rather than `min-height` because CSS ignores `min-height` on table rows and treats `height` as a minimum; the claim reads both. Chart bars carry a `title`, not a role, and are out of scope. In app code the rule needs nothing: the blocks carry the floors, and a claim here is an engine gap to file (`dogfood-issue-then-engine`).

```typescript
// ❌ WRONG — a claim under touch answered by a smaller floor, or by a context dropped from the list
const proof = await prove(make, { widths: WIDTHS, axes: [{}, { density: 'compact' }] });   // no touch, no TARGET_SMALL

// ✅ CORRECT — packages/engine/src/test/claims.test.ts: fires on a 24 px control under touch, not under pointer
const small = '<button style="display:inline-flex;height:24px;padding:0 12px">Save</button>';
expect(codes(targetSmall, fixture(small))).toEqual([]);                         // pointer: not checked
setInput('touch');
expect(targetSmall.check(fixture(`<nisli-page>${small}</nisli-page>`), estimator(400))[0])
  .toMatchObject({ block: 'nisli-page', severity: 'error', detail: '<button> "Save" is 24px tall; the touch floor is 44px' });
expect(codes(targetSmall, fixture('<table><thead><tr><th style="height:24px"><button style="display:inline-flex;padding:0 12px">Date</button></th></tr></thead></table>'))).toEqual(['TARGET_SMALL']);   // the th is the floor
```

### `prove-text-measurer` — Two measurers: arithmetic for blocks, calibrated for screens

`textMeasurer(charWidth)` sizes H1–H3/TH/TD/BUTTON/SPAN/A/LABEL/OPTION at `charWidth` per character (+ button padding) so a block plan is arithmetic — write the expected widths as a comment. `estimator(frame)` (`test/estimate.ts`) is what `prove()` uses: it sums per-glyph advances measured in real Chromium (`test/glyphs.ts`, `pnpm calibrate`) at the `font-size`, `font-weight`, `font-family`, `text-transform`, `letter-spacing` and `font-variant-numeric` the skin wrote inline — uppercase labels as uppercase plus spacing, tabular digits at the tabular advance, monospace from the `code` table; a measuring table's column is its widest cell (`columnWidth`), a cell's own line excludes folded values (`ownText`). `glyphs.test.ts` holds every style within 3% of the browser. Do not hand a screen `textMeasurer`; do not hand a block test the estimator when the numbers should be checkable by hand.

```typescript
// ✅ CORRECT — toolbar.test.ts: "available 328 = title + 8 + 112 + 8 + 32 → title 168"
expect(t.title.style.width).toBe('168px');
// ✅ CORRECT — screens.proof.test.ts: the estimator answers a screen
mount(() => OverviewScreen({}), {}, { width: 1280, scheme: 'light', measure: estimator(1280) });
```

### `prove-five-widths` — Prove at the widths that matter

Screens are proven at 1280/1024/768/480/360; blocks at those or at their own thresholds (`sidebarWidth + contentMin` and one pixel less; `dialogMin`). The app's bar (Ledger tenet 10): every screen holds every claim at five widths in `screens.proof.test.ts`, and `nisli-verify` reports no finding across every route at those widths.

```typescript
// ✅ CORRECT — packages/engine/src/blocks/layout.test.ts
expect(sidebarAt(metrics.layout.sidebarWidth + metrics.layout.contentMin)).toBe(true);
expect(sidebarAt(metrics.layout.sidebarWidth + metrics.layout.contentMin - 1)).toBe(false);
```

### `prove-verify-routes` — `verify()` reads the running app's evidence per route

`verify({ baseUrl, routes, widths, ignore?, open?, height?, timeout?, settle? }): Promise<Result { ok, findings, checked, table }>` from `@nisli/engine/verify` (`src/verify/index.ts`; Playwright is an optional peer, loaded on demand) loads each route × width in Chromium and files `Finding { route, width, code, detail }`: `NO_EVIDENCE` (no `window.__nisli` — a production build cannot pass by saying nothing), `STILL_LOADING` (a skeleton or `aria-busy` never cleared within `timeout`), `LOAD_FAILED`, `CONSOLE_ERROR` / `PAGE_ERROR` (through the keyboard pass, minus `ignore`), `BLOCK_ERROR`, `LAYOUT_REPORT` (a stamped host, with the latest ring entry), `HORIZONTAL_SCROLL`, `NAME_MISSING`, `TAB_UNREACHABLE`, `TAB_ESCAPED_DIALOG` (a dialog open at load or opened by `open: [{ route, selector }]`). It is read-only against a dev server and complements `prove()` — it proves the built app in a real browser, `prove()` proves the screen's decisions without one; a route needs both.

```sh
# ✅ CORRECT — the Ledger dev server on :5200, eight routes, three widths, the add-transaction dialog opened
nisli-verify --base http://localhost:5200 --routes / /accounts /transactions /budgets /import /rules /connections /settings \
  --widths 1280 768 360 --open '/transactions=[data-nisli-action=add]'
# ok: 24 loads, no findings   (exit 0; 1 with findings; 2 on usage)
```


### `prove-keyboard-path` — A reachability proof drives the path a person takes

A proof of a keyboard or AT guarantee exercises it: `focus()` the control, dispatch the `keydown` with its `key`, dispatch `pointerdown` then `click()` for a real tap, and assert what a person would feel — `document.activeElement`, `__layers`, `aria-expanded`/`aria-sort`, `e.defaultPrevented`, the callback count. Asserting that an element exists or carries a role proves nothing about reachability and is not a proof (review gate of ADR 0042). happy-dom does not synthesise a button's Enter/Space click: send the key, then `click()` the active element, and pin that it is a real `<button>` via `focusables()`.

```typescript
// ❌ WRONG — vacuous: the header could be an unfocusable div with the attribute
expect(th.getAttribute('aria-sort')).toBe('ascending');

// ✅ CORRECT — packages/engine/src/blocks/overlay.test.ts: the App menu, a real tap on the open toggle
await open();
pointer(toggle);                       // the anchor is inside the layer: nothing dismissed yet
expect(__layers.value.map((l) => l.kind)).toEqual(['popover']);
toggle.click(); flushEffects(); await tick();
expect(__layers.value.length).toBe(0);
expect(toggle.getAttribute('aria-expanded')).toBe('false');
expect(document.activeElement).toBe(toggle);
```

### `prove-screenshots-not-proof` — Screenshots are for looking

A screenshot or a Playwright sweep is looked at because one wants to, not because correctness depends on it (ADR 0034; Ledger tenet 10). `prove()`'s empty `claims` and `verify()`'s `ok` are the sources of truth; a sweep that passes does not excuse a missing screen proof, and a screenshot that "looks right" does not retire a claim.

---

## 8. Dogfooding — Ledger (MEDIUM)

### `dogfood-issue-then-engine` — A gap is filed and solved in the engine

Ledger tenet 9: when Ledger needs something the engine cannot express, the gap is recorded in `docs/issues/NNNN-*.md` and solved in the engine — never worked around with app-side styling. Issue 0022 (conditional fields, file reset) became ADR 0037; the app then deleted its workaround.

```typescript
// ❌ WRONG — issue 0022 item 2: remounting a Form by bumping a key inside a children computed to reset a file input
children: computed(() => { fileKey.value; return [Form({ /* … */ })]; })

// ✅ CORRECT — packages/ledger/src/screens/import.ts, after 0037: the engine resets on a new key
Form<FileStep>({ fields: fileFields, mode: 'live', initial: { file: undefined, accountId: untrack(() => accountId.value) }, key: fileKey.value, onChange: (v) => { accountId.value = v.accountId; void loadFile(v.file); }, onSubmit: () => {} })
// … and after import: fileKey.value++;
```

### `dogfood-no-fake-intent` — Do not bend a block to mean something else

Issue 0023 was the example: a dialog whose purpose is a decision had no action row, so a screen mounted `Form<Record<string, never>>({ fields: [] })` to obtain buttons — "a form" said to mean "some actions". ADR 0043 resolved it with `Dialog.actions`; the fieldless Form is now the wrong word and a compile-clean lie. When a block does not fit, file the gap and solve it in the engine; never bend a block silently.

### `dogfood-keep-tenets` — `TENETS.md` is the app-side contract

`packages/ledger/TENETS.md` is measured against every change and kept in sync with the ADRs it references. Tenet 9 (built on the engine, the engine learns from it), 10 (verified before believed: width tests, zero console errors at five widths, screenshots are for looking) and 12 (intent is captured visually — text fields hold data, not instructions) are this skill in app terms. Update a tenet when it changes, and say why.

---

## Common mistakes (from this repo's history)

### Mixing imperative and reactive style writes

The engine's own lesson (`engine/use-fit.ts` header, `blocks/kernel.ts` header): if a reactive style is a computed string and something also writes that style imperatively, the computed string does not change on the next solve and the imperative write wins — the plan silently fails to re-apply. Blocks now style an element in exactly one reactive way. App code never writes styles at all; if you are reaching for `el.style` in a screen, you are outside the contract.

### Selecting through `each()` wrappers

`each()` wraps every item in a `display: contents` `<each-item>` element. A grid or list's laid-out child is the wrapper's `firstElementChild`, and `:scope > *` selectors land on the wrappers (`form.test.ts` rule 6; `extras.test.ts` uses `each-item > div`).

```typescript
// ❌ WRONG
[...grid.children].map((c) => c.querySelector('label'))       // c is <each-item>

// ✅ CORRECT
[...grid.children].map((w) => w.firstElementChild!).map((c) => c.querySelector('label'))
```

### Expecting a `<select>` for a field with ≤ 3 options

A field with `options` is a choice: 2–3 options render a segmented `role="radiogroup"` of `role="radio"` buttons; 4+ render a native `<select>` with a leading "Choose…" (`form.test.ts` rule 4). A test that queries `select#f-kind` for a 2-option field finds nothing. Query `#f-<name>` and branch on `getAttribute('role')`; a `placeholder` on a choice is the empty option's text only in the native case.

### Writing the pre-0.8.0 words

`header`, `key` on a field, `key`/`onSelect` on a Table, `dir`, `kind: 'select' | 'textarea' | 'checkbox'`, `role: 'muted' | 'heading'`, `Empty.action`, `Form.destructive`, `confirmLabel`/`message`, `Meter.detail`, `Series.name`, `Columns.text`, `App.content` — each is a compile error (ADR 0043, `actions.test.ts`). The fix is the vocabulary (`intent-one-word-one-meaning`), never a cast; and a `'positive' as const` on a tone means a computed that should be annotated `Delta` or `Action[]`.

### Freezing the door

`metrics` has been a live object since 0.10.0 (ADR 0046): its groups are getters over the table for the current density and input. A block that holds `const gap = metrics.space[2]` at setup, passes an object literal (or a `buttonBox()` result) as `ctx.part()`'s structure, or gives `fitRow` a plain `gap` number renders correctly at the default and wrong after a density or input change — and kernel scan rule 5 or `AXIS_STALE` names it. Read the number where it is used: inside the thunk, the computed or the `host` effect; `untrack` a read that must not re-run (Table's page reset). App code never reads `metrics` at all.

### Reading `children` lazily

Core diagnoses a prop that is never read (N202). A block or screen wrapper that only reads `props.children` inside a lazy computed that has not run yet trips it; `blocks/page.ts` reads `props.children.value` eagerly with the comment "the content computed is lazy, and an unread prop is diagnosed (N202)". Same for any wrapper component you write around a block.

### Vite in the TypeScript workspace: `--configLoader runner`

`packages/ledger` and `packages/www` run `vite --configLoader runner` (`package.json` scripts) because `vite.config.ts` imports the app's TS router (`nisliRoutes(AppRouter)`). A plain `vite` invocation may fail to load the config; use the package scripts (`pnpm --filter @nisli/ledger dev:all`).

---

## Rule index

`intent-say-what-not-how` · `intent-one-word-one-meaning` · `intent-no-appearance-vocabulary` · `intent-new-need-home` · `intent-app-imports-blocks-only` · `intent-no-per-block-density` · `intent-structure-is-the-decision`
`block-app` · `block-page` · `block-toolbar` · `block-section` · `block-grid` · `block-stat` · `block-table` · `block-form` · `block-dialog` · `block-meter` · `block-bars` · `block-columns` · `block-empty` · `block-text` · `block-link` · `block-notify` · `block-confirm` · `block-part-structure-is-a-thunk`
`form-capture-derived` · `form-when-presence` · `form-options-draft` · `form-validate-reason` · `form-owned-initial-key` · `form-controlled-value` · `form-live-mode` · `form-group` · `form-long` · `form-bounds-readonly` · `form-submit-async`
`status-pass-result` · `status-async-actions-busy` · `status-no-loading-flags` · `status-stale-stays`
`skin-use-once-root` · `skin-scheme-preference` · `skin-write-parts` · `skin-no-layout` · `skin-bare-proves`
`decide-priority-lever` · `decide-kind-lever` · `decide-tone-lever` · `decide-one-action-rule` · `decide-destructive-lever` · `decide-text-truncates` · `decide-columns-fold` · `decide-grids-choose-columns` · `decide-dont-control` · `decide-data-never-reshapes` · `decide-axes-move-rhythm-not-floors` · `decide-floats-are-layers` · `decide-reachable-by-keyboard` · `decide-tone-is-urgency`
`prove-screens-with-prove` · `prove-claims-are-failures` · `prove-reports-are-failures` · `prove-decision-unstable` · `prove-real-content` · `prove-mount-at-width` · `prove-live-flip-equals-fresh-mount` · `prove-touch-targets` · `prove-text-measurer` · `prove-five-widths` · `prove-verify-routes` · `prove-keyboard-path` · `prove-screenshots-not-proof`
`dogfood-issue-then-engine` · `dogfood-no-fake-intent` · `dogfood-keep-tenets`
