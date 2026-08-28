# Gaps — where the vocabulary ran out

Every entry is a moment when building this app needed something the
`@nisli/intent` capability list does not name, or names badly. Numbered,
append-only. Each one is a candidate for the next capability iteration in
[`CAPABILITIES.md`](../intent/CAPABILITIES.md) — not a bug list.

| id | needed | what exists | proposed |
|---|---|---|---|
| G1 | the `menu` strategy to *work* | the solver reveals `[data-overflow][data-shown]` and the theme paints `data-overflow-anchor` / `data-overflow-menu` — but the panel, its contents, top-layer placement, focus and keyboard behaviour are ~200 lines the package does not ship. This app carries `src/ui/patterns/overflow-menu.ts`, ported from the prototype. | ship the pattern (`ActionGroup`, `OverflowMenu`, `ActionScope`) as a capability, E8, or `menu` is a strategy with no implementation |
| G2 | to know which attributes are legal | `AXIS_ATTRS` names 10; the theme answers to 26. `data-grow`, `data-flush`, `data-table`, `data-component`, `data-fit`, `data-overflow*` and `data-priority` are all authored here and none is contracted. The guard had to carry its own list of them. | the `CAPABILITIES` table, with these named |
| G3 | a link that is prose | `data-role="link"` is an emphasis of `action`: nowrap, centred, control-shaped. A recipe title in a card is text that navigates, and painting it as an action crushed six cards. Fixed here by rendering `<a data-text="title">`, which works but is uncontracted. | either `text` on an anchor is a named capability, or `link` stops being an action emphasis |
| G4 | a row that stacks when narrow | `row` cannot shrink, `wrap` wraps whole items, `stack` is always vertical. The header settings needed "row if it fits, stack otherwise"; the nearest honest answer was `wrap` per axis. | a layout value, or `data-collapse="stack"` on a `row` as a measured strategy |
| G5 | lists | `<ul>`/`<ol>` keep the browser's default indent and markers; nothing in the vocabulary addresses them, so the ingredients list carries an undeclared value (UA padding). | a `list` appearance, or `structure.css` resolving list boxes like any other |
| G6 | a disabled control | `aria-disabled` paints as opacity, and the contrast rule then reports *undecidable* (N680/N640) — correctly, since composited text has no measurable contrast. Disabled is a state with no contract. | a disabled state resolved by colour rather than opacity, so it stays checkable |
| G7 | a table column that gives way | the shopping list's "For" column wraps a long recipe title into a six-line cell on a phone. `data-collapse` acts on flex candidates in a fit container; a table cell is neither. | column-level priority on `table`, or an admission that tables degrade by their own rules |
| G8 | a selected/pressed toggle | the tag filter and the axis switches are buttons whose "selected" state is expressed by swapping `primary`/`quiet` emphasis. That is a role change standing in for a state. | `aria-pressed` resolved by the theme as a state on `action` |
| G9 | a page's own context | worked: `Region` with `input="touch" density="comfortable"` on the cook page overrides the app's settings for its subtree. Recorded as a capability that held, not a gap. | name it — C-axes nest — in `CAPABILITIES.md` |

## Not the vocabulary's fault, but met on the way

- **N401 under HMR** — hot-updating the shell throws `Router already has a root
  application definition connected`, because core defers nested teardown one
  microtask (ADR 0023) while HMR re-runs setup in the same tick. Core issue;
  repro script in the session scratchpad; plain loads unaffected.
- **N105 under HMR** — `mount() on an already-mounted TemplateResult` after a
  hot update, from a template passed as a `children` prop being projected a
  second time by the remounted parent. Same family as N401: plain loads have
  zero console errors on every page; only the HMR remount path hits it. It
  is also an argument for children as factory arrays rather than `html`
  templates — a descriptor can be mounted afresh, a template object cannot.
- **`each()` rejects `readonly` arrays** — every computed list had to be spread.
  Sibling of `docs/issues/0021`.
- **`vite.config.ts` needs `--configLoader runner`** — workspace packages point
  at TypeScript source; same flag `www` carries.
- **The router outlet is the `main` landmark** — wrapping `AppRouter({})` in
  `<main>` makes two. Not documented where a first-time consumer would see it.
