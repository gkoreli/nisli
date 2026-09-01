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
4. `KNOWN` stays empty. The one finding the first runs made (Overview
   `FIT_COLUMNS` at 480 under compact) retired when the engine derived the
   grid floor (`cellFloor()`, engine 0.10.0 — ADR 0046 §What the review and
   the Ledger proof changed). If the file already carries `KNOWN` rows for
   it, they now fail as "no longer made": delete them. Final engine-side
   runs: every screen, five widths × four contexts, zero claims.

## Optional, one line each (ADR 0046 §Consequences)

- `main.ts`: `setDensity(settings.density ?? 'system')` beside `setScheme`,
  and a `?density=compact` query beside `?bare`.
- Settings: a Density field (`system` / `comfortable` / `compact`) shaped
  like Appearance.
