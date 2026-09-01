# Ledger: run the screen proof over the axes contexts (ADR 0046)

**For**: the session that owns `packages/ledger` (its `screens.proof.test.ts`
was dirty when the engine round landed, so the engine round did not edit it).
**From**: the engine 0.10.0 round, 2026-08-31. **Size**: ~10 lines.

The engine's `prove()` now takes `axes` (widths × contexts) and files
`TARGET_SMALL` (touch) and `AXIS_STALE`. Every Ledger screen was proven
through a scratch copy of the file at five widths × four contexts, three
identical runs: one standing finding (below), nothing else.

## The edit

In `packages/ledger/src/screens/screens.proof.test.ts`:

1. The proof call:
   ```ts
   const AXES = [{}, { density: 'compact' }, { input: 'touch' }, { density: 'compact', input: 'touch' }] as const;
   const proof = await prove(make, { widths: WIDTHS, scheme: 'light', variants, axes: AXES });
   ```
2. Key `KNOWN` by width **and** axes (today it is keyed by width only), and
   the assertions accordingly — e.g. `${c.width} ${c.axes?.density}+${c.axes?.input} ${key(c)}`.
3. `expect(proof.byWidth.map((w) => w.width))` → length `WIDTHS.length * AXES.length`;
   the turns bound per entry stays `< 12` (the axis flip adds ~5 turns to
   `proof.byWidth[i].turns` in total, not per fixed point).
4. The one finding, recorded:
   ```ts
   OverviewScreen: [{ code: 'FIT_COLUMNS', detail: 'columns Category, Amount cannot fit even truncated (0px short at 198px)', at: [[480, 'compact+pointer'], [480, 'compact+touch']] }],
   ```
   Why it stands: under compact the rollup `Grid` takes two columns at 480
   (222 px cells clear `minColumn` 220) and a money + primary-text table
   needs 198.4 px in 198 — `layout.minColumn` does not cover a card's padding
   plus the narrowest two-primary table in any context (ADR 0046 §What the
   review and the Ledger proof changed). The consistent fix is
   `layout.minColumn` 220 → 240 in the engine, which changes Grid decisions
   at the default and is the owner's call.

## Optional, one line each (ADR 0046 §Consequences)

- `main.ts`: `setDensity(settings.density ?? 'system')` beside `setScheme`,
  and a `?density=compact` query beside `?bare`.
- Settings: a Density field (`system` / `comfortable` / `compact`) shaped
  like Appearance.
