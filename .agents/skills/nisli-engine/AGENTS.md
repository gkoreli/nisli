# Nisli Engine — Complete Agent Guide

Every rule for writing and reviewing application UI built from `@nisli/engine`. Each rule gives the invariant, the bug it prevents, and an incorrect/correct pair. Correct examples are lifted from Ledger (`packages/ledger/src/screens/*.ts`) wherever one exists.

**Engine source**: `packages/engine/src` — public surface is exactly what `src/index.ts` exports
**Test surface**: `@nisli/engine/test` → `packages/engine/src/test/prove.ts` (`prove`, `estimator`, `mount`, `textMeasurer`)
**ADRs**: `docs/adr/0034-engine-typed-blocks-decided-by-an-engine.md` (contract, language, decision rules), `0035-engine-appearance-layer.md` (skins, parts, axes), `0037-engine-form-intent-capture-domain.md` (the ten Form rules)
**Worked example**: `packages/ledger` — nine screens, `TENETS.md`

The engine's block kernel (`src/blocks/kernel.ts`, `src/engine/space.ts`) is being refactored; nothing below depends on it. Only the public intent API and the rules are documented.

---

## 1. The Intent Contract (CRITICAL)

### `intent-say-what-not-how` — Props state what a thing is

The public prop types (`blocks/types.ts`, each `blocks/*.ts`) offer only meaning: `priority` (survival order), `kind` (what a cell holds), `tone` (whether a number is good news), `role` (what a run of text is), `destructive`, `sortable`, `required`, and structure — what contains what. "These are the actions" is intent; where they sit is the engine's (ADR 0034, *The contract*).

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

### `intent-no-appearance-vocabulary` — The banned spelling of appearance

Banned in app code: `className`, `style`, `data-*`, pixels, rem, colours, fonts, `flex-end`, `sticky`, breakpoints, "what collapses at 360". The types do not offer any of it; `blocks/toolbar.test.ts` › *the public type offers no visual escape hatch* proves `className`, `style` and `align` are compile errors. If it typechecks, it is laid out right.

```typescript
// ❌ WRONG — will not typecheck, and must not be worked around with a cast
Toolbar({ title: 't', actions: [], className: 'x' });
Section({ title: 'S', children, style: 'padding: 0' });

// ✅ CORRECT — say the structure; the engine pads, pins, and truncates
Section({ title: 'Recent transactions', children: [Table<Transaction>({ columns, rows: recent, key: (t) => t.id })] });
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

Dependency direction is Intent → Decision → Appearance (ADR 0034, *Bounded contexts*). An app imports blocks, `notify`, `confirm`, `useSkin`/`setScheme`/`defaultSkin`, and types. `metrics`, `look`, `fit`, `columnsFor`, `block` are exported for skin authors and engine tooling — an app that uses them for its own layout has re-entered the decision layer.

```typescript
// ❌ WRONG — app code deciding layout with engine internals
import { metrics, fit, look } from '@nisli/engine';
const cols = width > metrics.layout.contentMin ? 2 : 1;

// ✅ CORRECT — packages/ledger/src/main.ts
import { App, useSkin, setScheme, defaultSkin } from '@nisli/engine';
useSkin(bare ? null : defaultSkin, { scheme: settings.value.appearance ?? 'system' });
```

### `intent-structure-is-the-decision` — Nesting and counts are already intent

A `Stat` inside a `Section` is a nested surface; a `select` with three options is a segmented control; a form with six visible fields at 800 px is three columns. The engine reads these from structure. Do not restate them as props.

```typescript
// ❌ WRONG — restating what the schema already carries
{ key: 'amountShape', kind: 'select', segmented: true, options: [/* 2 */] }

// ✅ CORRECT — packages/ledger/src/screens/import.ts: a plain 2-option select; the engine makes it segmented
{ key: 'amountShape', label: 'Amounts are', kind: 'select', required: true,
  options: [{ value: 'signed', label: 'One signed column' }, { value: 'split', label: 'Money out / money in' }] }
```

---

## 2. Blocks (CRITICAL)

Fifteen blocks plus `notify()` and `confirm()` — the whole vocabulary (`src/index.ts`). Each entry: props (from the exported prop type), the decisions the engine makes, one Ledger example.

### `block-app` — `App` is the shell; sidebar vs bar is the engine's

`AppProps { brand; nav: NavItem[]; location; content }` (`blocks/app.ts`). Sidebar iff `width ≥ sidebarWidth + contentMin` (232 + 560), else a sticky top bar with a menu sheet that closes on navigation. The matching nav item gets `aria-current="page"`; `/` matches exactly, others by prefix.

```typescript
// ❌ WRONG — the app choosing the shell shape
App({ brand: 'Ledger', nav, location, content, layout: window.innerWidth > 900 ? 'sidebar' : 'bar' });

// ✅ CORRECT — packages/ledger/src/main.ts
const app = App({
  brand: 'Ledger',
  nav,
  location: computed(() => router.url.value.pathname),
  content: AppRouter({}),
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

`ToolbarProps { title; actions? }`; `Action { id; label; priority?; destructive?; onSelect? }` (`blocks/toolbar.ts`, `blocks/types.ts`). Rank `tertiary 1 < secondary 2 < title 10 < primary 20`: tertiaries overflow into the "More actions" menu first (later ones first), then secondaries, then the title truncates to `minTitle` (80). A primary never leaves. A busy action is `aria-busy` and disabled. Reports `FIT_ROW` when even that fails.

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

`GridProps { children }` (`blocks/grid.ts`). `columnsFor(width, count, minColumn 220, gap)`; reports `FIT_CELL` when a single column is narrower than the minimum. Children may be a computed list.

```typescript
// ❌ WRONG — asking for a column count
Grid({ columns: 3, children: cards });

// ✅ CORRECT — packages/ledger/src/screens/accounts.ts
Grid({ children: cards })   // cards: computed(() => accounts.value.map((a) => Section({ … })))
```

### `block-stat` — `Stat` is a labelled figure with a toned delta

`StatProps { label; value; delta?: { text; tone }; hint?; status? }` (`blocks/stat.ts`). The value truncates; `delta.tone` colours the change through the skin's `tone.*` part; nested in a surface it draws no card; pending shows a one-bone skeleton.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/overview.ts
Stat({ label: 'Spending', value: computed(() => money(spendNow.value)), delta: spendDelta })
// spendDelta: { text: '+12% vs Jul', tone: pct > 0 ? 'negative' : 'positive' }
```

### `block-table` — `Table` drops, truncates and folds by column meaning

`TableProps<T> { columns: Column<T>[]; rows; key; onSelect?; sort?; onSort?; empty?; status? }`; `Column<T> { id; header; cell; kind?; priority?; sortable? }`; `Sort { by; dir }` (`blocks/table.ts`). Decisions: text columns truncate to `minTextColumn` (96), figures and dates never; non-primary columns leave by priority (tertiary first, later first) and **fold under the first primary text column** as a muted line (numeric ones as "Header value"; empties earn no slot); primaries never leave (`FIT_COLUMNS` if they cannot fit); `kind: 'number' | 'money'` aligns right with tabular numerals; 60 rows then "Show N more of M"; `onSelect` makes rows focusable and Enter-selectable; `sortable` headers toggle `onSort` with `aria-sort`.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/transactions.ts
const columns: Column<Transaction>[] = [
  { id: 'date', header: 'Date', kind: 'date', cell: (t) => shortDate(t.date), priority: 'primary', sortable: true },
  { id: 'payee', header: 'Payee', cell: (t) => t.payee, priority: 'primary', sortable: true },
  { id: 'category', header: 'Category', cell: (t) => categoryName(t.categoryId), sortable: true },
  { id: 'account', header: 'Account', cell: (t) => accountName(t.accountId), priority: 'tertiary' },
  { id: 'note', header: 'Note', cell: (t) => t.note ?? '', priority: 'tertiary' },
  { id: 'amount', header: 'Amount', kind: 'money', cell: (t) => Text({ text: money(t.amount, { sign: true }), tone: t.amount > 0 ? 'positive' : 'neutral' }), priority: 'primary', sortable: true },
];
Table<Transaction>({ columns, rows, key: (t) => t.id, sort, onSort: (s) => { sort.value = s; }, onSelect: (t) => { editing.value = t; open.value = true; }, empty: 'No transactions match these filters.' });
```

### `block-form` — `Form` is a schema; the engine decides the rest

`FormProps<T> { fields; value? | initial? + key?; onChange?; onSubmit; submitLabel?; onCancel?; destructive?; mode?; ref? }`; `FormHandle { reset(); submit() }` (`blocks/form.ts`, `blocks/form/schema.ts`). The ten rules are section 3. Columns from the visible field count (`minField` 240); `FIT_CELL` below it.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/accounts.ts (owned draft in a dialog)
Form<Draft>({
  fields, initial: empty, key: opens.value,
  onSubmit: (d) => { addAccount({ name: d.name, institution: d.institution, kind: d.kind, opening: Math.round((d.opening ?? 0) * 100) }); adding.value = false; },
  submitLabel: 'Add account', onCancel: () => { adding.value = false; },
})
```

### `block-dialog` — `Dialog` is a card with room and a sheet on a phone

`DialogProps { title; open; onClose; children }` (`blocks/dialog.ts`). Below `dialogMin` (640) viewport it is a full-height sheet; otherwise a centred card of `dialogWidth` (520). The engine locks body scroll, closes on Escape and overlay click, focuses the first control on open, and restores focus on close. Dialogs have no action row yet (issue 0023) — see `dogfood-no-fake-intent`.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/transaction-dialog.ts
return Dialog({
  title: computed(() => (props.transaction.value ? 'Edit transaction' : 'Add transaction')),
  open: props.open,
  onClose: props.onClose,
  children: computed(() => [Form<Draft>({ fields, initial: toDraft(props.transaction.value, props.accountId.value), key: draftKey.value, onSubmit: submit, /* … */ })]),
});
```

### `block-meter` — `Meter` tones itself by ratio

`MeterProps { label; value; max; detail? }` (`blocks/meter.ts`). `value/max > 1` → negative, `> 0.85` → warning, else neutral; `role="meter"` with `aria-valuenow/min/max`. The app supplies numbers and the formatted `detail`.

```typescript
// ❌ WRONG — the app picking the tone
Meter({ label, value, max, tone: spent > limit ? 'negative' : 'neutral' });

// ✅ CORRECT — packages/ledger/src/screens/budgets.ts
Meter({ label: r.category, value: r.spent, max: r.limit, detail: `${money(r.spent)} of ${money(r.limit)}` })
```

### `block-bars` — `Bars` sizes its label column

`BarsProps { items: BarItem[] }`; `BarItem { label; value; text }` (`blocks/bars.ts`). Labels take their natural width up to a third of the block (never under `minLabel` 64) and truncate; bars scale to the largest value; `text` is the app's formatted value — the app knows its units.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/overview.ts
Bars({ items: byCategory })   // [{ label: c.name, value: cents, text: money(cents) }, …] sorted by the app
```

### `block-columns` — `Columns` is grouped bars over an ordered axis

`ColumnsProps { labels; series: Series[]; text }`; `Series { name; tone?; values }` (`blocks/columns.ts`). The engine sizes bars to width and shows every nth axis label so none overlap; the legend is drawn from `series`; `tone` picks `chart.bar.*`.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/overview.ts
Columns({ labels: trendLabels, series: trendSeries, text: (v) => money(v) })
// trendSeries: [{ name: 'Income', tone: 'positive', values }, { name: 'Spending', tone: 'negative', values }]
```

### `block-empty` — `Empty` is the call to action when there is nothing

`EmptyProps { title; hint?; action? }` (`blocks/empty.ts`). Centred title, optional hint, one primary action that goes busy on a promise. Use it for a whole-screen or whole-section nothing; `Table.empty` covers an empty list inside a table.

```typescript
// ✅ CORRECT
Empty({ title: 'No banks connected', hint: 'Link a bank to sync transactions automatically.', action: { id: 'link', label: 'Connect a bank', onSelect: link } })
```

### `block-text` — `Text` names a role and a tone

`TextProps { text; role?: 'body' | 'muted' | 'heading' | 'code'; tone? }` (`blocks/text.ts`). Role maps to a `text.*` part, tone to a `tone.*` part; long text wraps anywhere. Also valid as a table `CellValue`.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/budgets.ts (inside a column cell)
Text({ text: money(r.remaining, { sign: true }), tone: r.remaining < 0 ? 'negative' : r.remaining < r.limit * 0.15 ? 'warning' : 'positive' })
```

### `block-link` — `Link` is a dressed anchor

`LinkProps { href; label }` (`blocks/text.ts`). Route hrefs come from the router; the skin's `link` part dresses it.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/accounts.ts
Link({ href: AppRouter.routes.account.href({ params: { id: a.id } }), label: 'View transactions →' })
```

### `block-notify` — `notify()` tells the person something happened

`notify(text, tone = 'neutral')` (`blocks/notice.ts`). A polite live region at the bottom; 4 s, 8 s for negative; click dismisses. Busy actions call it on rejection for you.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/transaction-dialog.ts
notify(existing ? 'Transaction saved' : 'Transaction added', 'positive');
```

### `block-confirm` — `confirm()` asks before the irreversible

`confirm({ title, message, confirmLabel?, destructive? }): Promise<boolean>` (`blocks/confirm.ts`). Renders a `Dialog` with Cancel and a primary or danger confirm; resolves the answer. Pair with `destructive: true` actions (Ledger tenet 3: deletions ask first and say what they delete).

```typescript
// ✅ CORRECT — packages/ledger/src/screens/budgets.ts
destructive: editing.value ? { id: 'delete', label: 'Delete budget', destructive: true, onSelect: async () => {
  const b = editing.value!;
  if (!(await confirm({ title: 'Delete budget?', message: `${categoryName(b.categoryId)} · ${money(b.limit)} per month`, confirmLabel: 'Delete', destructive: true }))) return;
  removeBudget(b.id); open.value = false; notify('Budget deleted');
} } : undefined,
```

---

## 3. Form Schema (HIGH) — ADR 0037

`Field<T> { key; label; kind: FieldKind; required?; placeholder?; hint?; accept?; options?; when?; readOnly?; validate?; min?; max?; step?; group?; long? }`; `FieldKind = 'text' | 'number' | 'money' | 'date' | 'select' | 'textarea' | 'file' | 'checkbox'` (`blocks/form/schema.ts`). Each rule below is one place in `form/*` and one named test in `form.test.ts`.

### `form-when-presence` — Presence is `when(draft)`, never hint prose (rule 1)

A field whose `when` is false is not rendered, carries no error, and leaves the submitted object. A rule stated as hint text is an instruction to the user, not a control (Ledger tenet 12).

```typescript
// ❌ WRONG — issue 0022: the rule lives in prose and is validated after the fact
{ key: 'amount', label: 'Amount column', kind: 'select', hint: 'One signed column — or leave blank and use debit/credit below' }

// ✅ CORRECT — packages/ledger/src/screens/import.ts
const signed = (d: Partial<Mapping>) => d.amountShape === 'signed';
const split = (d: Partial<Mapping>) => d.amountShape === 'split';
{ key: 'amount', label: 'Amount column', kind: 'select', required: true, options: colOptions.value, when: signed, validate: differsFrom('date', 'date') },
{ key: 'debit',  label: 'Money out column', kind: 'select', options: colOptions.value, placeholder: 'None', when: split, validate: differsFrom('credit', 'money in') },
{ key: 'credit', label: 'Money in column',  kind: 'select', options: colOptions.value, placeholder: 'None', when: split, validate: differsFrom('debit', 'money out') },
```

### `form-options-draft` — Dependent choices are `options(draft)` (rule 2)

`options` may be a function of the draft; it is re-evaluated on every change and a value no longer offered is cleared to a fixpoint. Do not filter options in `onChange` or clear the dependent value by hand.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/transaction-dialog.ts
{ key: 'categoryId', label: 'Category', kind: 'select',
  options: (d) => categories.value.filter((c) => c.id === 'transfer' || !!c.income === (d.kind === 'income')).map((c) => ({ value: c.id, label: c.name })),
  hint: 'Left blank, a matching rule decides; otherwise Uncategorized.' }
```

### `form-validate-reason` — `validate` returns the reason; the engine owns timing (rule 3)

`validate: (value, draft) => string | undefined`. `required`, bounds and choice membership run first, then `validate`. Errors never show on a first keystroke; they show on blur for that field and on a submit attempt for every visible field, with `aria-invalid`/`aria-describedby`, a `role="alert"` "N fields need attention." summary for 2+, and focus on the first invalid control. Do not validate in `onChange`, and do not render your own error text.

```typescript
// ❌ WRONG — app-side validation and announcement
onChange: (v) => { error.value = v.opening > 0 && v.kind === 'credit' ? 'Enter as negative' : ''; }

// ✅ CORRECT — packages/ledger/src/screens/accounts.ts
{ key: 'opening', label: 'Opening balance', kind: 'money', required: true, step: 0.01, hint: 'Negative for money owed',
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
{ key: 'street', label: 'Street', kind: 'text', group: 'Shipping', long: true },
{ key: 'city',   label: 'City',   kind: 'text', group: 'Shipping' },
{ key: 'zip',    label: 'Postcode', kind: 'text', group: 'Shipping' },
```

### `form-long` — `long` spans the row; there is no width word (rule 6, non-goals)

`long: true` or `kind: 'textarea'` takes the full row. `Field` has no `width`, `inline`, `columns`, or `segmented` — by the 0034 rule.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/transaction-dialog.ts
{ key: 'note', label: 'Note', kind: 'textarea', placeholder: 'Optional', long: true }
```

### `form-bounds-readonly` — Bounds reach the control; read-only follows the draft (rules 7, 8)

`min`/`max`/`step` reach the native input (money steps 0.01, number `any`, dates take ISO strings; money/number get `inputmode="decimal"`). `readOnly: boolean | (draft) => boolean` renders `readonly`/`disabled` plus the `input.readonly` part, reactively. There is no `disabled` prop.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/budgets.ts
{ key: 'limit', label: 'Monthly limit', kind: 'money', required: true, min: 0 }
```

### `form-submit-async` — A promise from `onSubmit` goes busy on its own (rule 10)

Return the promise; the submit button is `aria-busy` and disabled until it settles, a rejection becomes a negative notice, and the draft commits on success. Same for `destructive.onSelect`.

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
Table<ServerBackup>({ columns: backupColumns, rows: backupRows, key: (b) => b.name, status: backups, onSelect: (b) => { chosen.value = b; restoring.value = true; }, empty: 'No backups yet. The first one is written tonight.' })
```

### `status-async-actions-busy` — Return the promise from `onSelect`

`Action.onSelect` may return a promise; every block that renders an `Action` (Toolbar/Page, Empty, Form's destructive) shows it busy until it settles and notifies on rejection.

```typescript
// ❌ WRONG — a hand-rolled busy flag and swallowed error
{ id: 'sync', label: 'Sync now', onSelect: () => { busy.value = true; sync().catch(() => {}).finally(() => { busy.value = false; }); } }

// ✅ CORRECT — packages/ledger/src/screens/settings.ts
{ id: 'reset', label: 'Reset demo data', priority: 'tertiary', destructive: true, onSelect: async () => {
  if (!(await confirm({ title: 'Reset all data?', message: 'This replaces everything with the demo data. Export a backup first if you need it.', confirmLabel: 'Reset', destructive: true }))) return;
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

## 5. Skin & Scheme (MEDIUM-HIGH) — ADR 0035

### `skin-use-once-root` — Install the skin once, before the App

`useSkin(skin: Skin | null, { scheme? })` (`skin.ts`). It is the one visual decision an app makes; blocks re-style live. Call it at the entry, not per screen.

```typescript
// ✅ CORRECT — packages/ledger/src/main.ts
const bare = new URLSearchParams(location.search).has('bare');
useSkin(bare ? null : defaultSkin, { scheme: settings.value.appearance ?? 'system' });
effect(() => { setScheme(settings.value.appearance ?? 'system'); });
```

### `skin-scheme-preference` — Scheme is the one preference an app forwards

`Scheme = 'light' | 'dark'`; the preference is `Scheme | 'system'` (default). `setScheme()` changes it without reinstalling; `'system'` follows `prefers-color-scheme` live and the engine sets `color-scheme` on the document so native controls agree. The app never reads `matchMedia` itself.

```typescript
// ❌ WRONG
const dark = matchMedia('(prefers-color-scheme: dark)').matches;
useSkin(dark ? darkSkin : lightSkin);

// ✅ CORRECT — packages/ledger/src/screens/settings.ts offers it as a select; main.ts forwards it
{ key: 'appearance', label: 'Appearance', kind: 'select', required: true, options: [{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] }
```

### `skin-write-parts` — A skin is a map of parts, or a function of the axes

`Skin = SkinParts | ((axes: SkinAxes) => SkinParts)`; `SkinParts = Partial<Record<Part, StyleRecord>>`; `PARTS` lists every part in family order (Surface, Text, Control, Navigation, Data, Feedback). A complete skin defines every part in both schemes; `skin.test.ts` enforces completeness for the default. `lightPalette`, `darkPalette`, `partsOf` (`skin/default.ts`) are exported to build one.

```typescript
// ✅ CORRECT — a skin as a function of the scheme
import { type Skin, type SkinAxes, partsOf, lightPalette, darkPalette } from '@nisli/engine';
const brand: Skin = ({ scheme }: SkinAxes) => partsOf(scheme === 'dark' ? { ...darkPalette, accent: '#7c5cff' } : { ...lightPalette, accent: '#4b2ee0' });
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

The levers an author holds are `priority`, `kind`, `tone`, `destructive`, `role`, `required`, `sortable`, and structure. Everything else is the engine's (ADR 0034, *Decision rules that exist today*).

### `decide-priority-lever` — `priority` is survival order

On `Action` and `Column`: `primary` survives longest, `tertiary` leaves first; equal priority gives ground from the end (document order). Order your tertiaries so the least valuable is last.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/overview.ts: cadence is the first to fold
const recurringColumns: Column<RecurringItem>[] = [
  { id: 'payee', header: 'Payee', cell: (r) => r.payee, priority: 'primary' },
  { id: 'cadence', header: 'Cadence', cell: (r) => r.cadence, priority: 'tertiary' },
  { id: 'typical', header: 'Typical', kind: 'money', cell: (r) => money(r.typicalAmount, { sign: true }) },
  { id: 'next', header: 'Next expected', kind: 'date', cell: (r) => shortDate(r.nextExpected) },
];
```

### `decide-kind-lever` — `kind` says what a cell holds

`number`/`money` align right with tabular numerals and never truncate; `date` uses tabular numerals and never truncates; `text` (default) truncates to `minTextColumn`. Mark every figure column — an unmarked amount column will be truncated as text.

```typescript
// ❌ WRONG — a money column left as text: it may truncate and aligns left
{ id: 'amount', header: 'Amount', cell: (t) => money(t.amount) }

// ✅ CORRECT
{ id: 'amount', header: 'Amount', kind: 'money', cell: (t) => money(t.amount), priority: 'primary' }
```

### `decide-tone-lever` — `tone` names meaning, once

`Tone = 'neutral' | 'positive' | 'negative' | 'warning'` (`blocks/types.ts`) on `Stat.delta`, `Text`, `Series`, `notify`. The skin decides what "negative" looks like in each scheme; the app decides only whether a number is good news.

```typescript
// ✅ CORRECT — packages/ledger/src/screens/import.ts
Text({ text: c.status, tone: c.ok ? 'positive' : 'negative' })
```

### `decide-destructive-lever` — `destructive` is danger, never primary

`Action.destructive: true` renders as danger (`button.danger`, `menu.item.danger`) and is never treated as primary. It is a word about consequence; pair it with `confirm()`.

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

No app word exists for: pixel widths, breakpoints, column counts, sticky/fixed, overflow order beyond `priority`, segmented-vs-select (the count decides), skeleton shape, notice placement or timing, dialog size, focus management, numeric alignment. If a screen seems to need one, it is a gap: `intent-new-need-home`, then `dogfood-issue-then-engine`.

---

## 7. Proof at Width (MEDIUM)

Verification is by test, not eye (ADR 0034, *Consequences*). The measurer is a seam: in tests every `measure()` is answered by a deterministic function, so a plan is arithmetic and a block is proven in happy-dom with no browser. The public test surface is `@nisli/engine/test`.

### `prove-mount-at-width` — `mount()` a block at a width and assert the DOM

`mount(target: tag | factory, props, { width = 800, viewport = width, scheme?, text? }): Mounted { el; styleOf(selector?); unmount() }` (`test/mount.ts`). `unmount()` restores the measurer, skin and document. Assert on inline styles (`display`, `width`, `textOverflow`) and DOM (`[role=menuitem]`, `thead th`).

```typescript
// ✅ CORRECT — packages/engine/src/blocks/toolbar.test.ts
import { mount as mountBlock, textMeasurer, type Mounted } from '@nisli/engine/test';
const text = textMeasurer(8);
mounted = mountBlock('nisli-toolbar', { title, actions }, { width: 480, text });
const shown = [...mounted.el.querySelectorAll<HTMLElement>('[data-nisli-action]')].filter((b) => b.style.display !== 'none').map((b) => b.getAttribute('data-nisli-action'));
expect(shown).toEqual(['save']);
```

(`data-nisli-action` is an engine-internal test hook the block writes on its own buttons — not app vocabulary.)

### `prove-text-measurer` — Deterministic text widths make a plan arithmetic

`textMeasurer(charWidth)` sizes H1–H3/TH/TD/BUTTON/SPAN/A/LABEL/OPTION at `charWidth` per character (+ button padding). Write the expected widths as a comment so the assertion is checkable by hand.

```typescript
// ✅ CORRECT — toolbar.test.ts: "available 328 = title + 8 + 112 + 8 + 32 → title 168"
expect(t.title.style.width).toBe('168px');
```

### `prove-five-widths` — Prove at the widths that matter

Blocks are proven at 1280/1024/768/480/360 or at their own thresholds (`sidebarWidth + contentMin` and one pixel less; `dialogMin`). An app's bar (Ledger tenet 10): zero console errors across every route at five widths.

```typescript
// ✅ CORRECT — packages/engine/src/blocks/layout.test.ts
expect(sidebarAt(metrics.layout.sidebarWidth + metrics.layout.contentMin)).toBe(true);
expect(sidebarAt(metrics.layout.sidebarWidth + metrics.layout.contentMin - 1)).toBe(false);
```

### `prove-reports-are-failures` — A layout report is a failed plan

`LayoutReport { code: 'FIT_ROW' | 'FIT_COLUMNS' | 'FIT_CELL'; block; width; deficit; detail }` (`engine/report.ts`). Silence means every plan was satisfied. With no listener a report is a `console.error` in dev — which is why "zero console errors at five widths" catches them. Subscribe with `onReport()`; in a test, collect and expect `[]`.

```typescript
// ❌ WRONG — treating the console line as noise
// [nisli engine FIT_COLUMNS] <nisli-table> columns Date, Payee, Amount cannot fit even truncated (7px short at 294px)

// ✅ CORRECT — a report is a test failure; fix the intent (a tertiary? a shorter header?) or the engine
const reports: LayoutReport[] = [];
const stop = onReport((r) => reports.push(r));
// … mount at 294 …
expect(reports).toEqual([]);
stop();
```

### `prove-screens-with-prove` — `prove()` is the screen-level shape

`prove(make: () => Content, { widths, turns? }): Promise<Proof[]>` (`test/prove.ts`) mounts a screen at each width under `estimator(frame)` — widths from the engine's own inline styles and text length × `metrics.charWidth` — and returns every report with its `frame`. `[]` is the proof. Parked for Ledger by decision (issue 0024) until the vocabulary settles; when un-parked, one test per route.

```typescript
// ✅ CORRECT — the target shape (issue 0024, "Un-parking requires")
import { prove } from '@nisli/engine/test';
it('lays out at five widths', async () => {
  expect(await prove(() => OverviewScreen({}), { widths: [1280, 1024, 768, 480, 360] })).toEqual([]);
});
```

### `prove-screenshots-not-proof` — Screenshots are for looking

A screenshot or a Playwright sweep is looked at because one wants to, not because correctness depends on it (ADR 0034; Ledger tenet 10). A width test that asserts the plan is the source of truth; a sweep that passes does not excuse a missing one.

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

Issue 0023: a dialog whose purpose is a decision has no action row, so screens mount `Form<Record<string, never>>({ fields: [] })` to obtain buttons. It works and it is the wrong intent — "a form" said to mean "some actions". Tolerated as a filed gap; never introduce a new one silently.

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

Intent stays `kind: 'select'`, but 2–3 options render a segmented `role="radiogroup"` of `role="radio"` buttons; 4+ render a native `<select>` with a leading "Choose…" (`form.test.ts` rule 4). A test that queries `select#f-kind` for a 2-option field finds nothing. Query `#f-<key>` and branch on `getAttribute('role')`; a `placeholder` on a select field is the first option's text only in the native case.

### Reading `children` lazily

Core diagnoses a prop that is never read (N202). A block or screen wrapper that only reads `props.children` inside a lazy computed that has not run yet trips it; `blocks/page.ts` reads `props.children.value` eagerly with the comment "the content computed is lazy, and an unread prop is diagnosed (N202)". Same for any wrapper component you write around a block.

### Vite in the TypeScript workspace: `--configLoader runner`

`packages/ledger` and `packages/www` run `vite --configLoader runner` (`package.json` scripts) because `vite.config.ts` imports the app's TS router (`nisliRoutes(AppRouter)`). A plain `vite` invocation may fail to load the config; use the package scripts (`pnpm --filter @nisli/ledger dev:all`).

---

## Rule index

`intent-say-what-not-how` · `intent-no-appearance-vocabulary` · `intent-new-need-home` · `intent-app-imports-blocks-only` · `intent-structure-is-the-decision`
`block-app` · `block-page` · `block-toolbar` · `block-section` · `block-grid` · `block-stat` · `block-table` · `block-form` · `block-dialog` · `block-meter` · `block-bars` · `block-columns` · `block-empty` · `block-text` · `block-link` · `block-notify` · `block-confirm`
`form-when-presence` · `form-options-draft` · `form-validate-reason` · `form-owned-initial-key` · `form-controlled-value` · `form-live-mode` · `form-group` · `form-long` · `form-bounds-readonly` · `form-submit-async`
`status-pass-result` · `status-async-actions-busy` · `status-no-loading-flags` · `status-stale-stays`
`skin-use-once-root` · `skin-scheme-preference` · `skin-write-parts` · `skin-no-layout` · `skin-bare-proves`
`decide-priority-lever` · `decide-kind-lever` · `decide-tone-lever` · `decide-destructive-lever` · `decide-text-truncates` · `decide-columns-fold` · `decide-grids-choose-columns` · `decide-dont-control`
`prove-mount-at-width` · `prove-text-measurer` · `prove-five-widths` · `prove-reports-are-failures` · `prove-screens-with-prove` · `prove-screenshots-not-proof`
`dogfood-issue-then-engine` · `dogfood-no-fake-intent` · `dogfood-keep-tenets`
