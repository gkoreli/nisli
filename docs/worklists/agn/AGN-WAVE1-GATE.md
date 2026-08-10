# AGN Wave 1+2 — Design-Gate Packet

**Date**: 2026-08-10 · **Status**: awaiting gate review (arch)
**Spec**: [ADR 0030.2](../../adr/0030.2-agent-native-core-ergonomics.md) —
§2/§3 as amended by §8 (binding). Four prototypes built in parallel
isolated worktrees on disjoint file domains; none pushed, none merged.
All four completed with full suites green.

## The four branches

| Prototype | Branch (worktree) | Commits | Suites | Headline |
|---|---|---|---|---|
| **T5 scheduler** | `feat/agn-t5-scheduler` | 2 (`0f5a934`, `88b70ab`) | core 330/330; core+ui typecheck clean | MaybeDirty completed (~130 lines, in §8's range); deterministic flush; clock-free loop guard (exactly-101-runs pinned); **zero pre-existing test edits** (suite pins values, not run counts) |
| **T4 template** | `worktree-agent-a251ed1233f2ac8aa` | 1 (`e5b0bca`) | core 341/341, ssg 36/36, ui 1110/1110, router 62/62; typecheck ×4 clean | Parse-once measured **~2.3× faster mounts** (1 parse/callsite); **N105 caught a real registry corruption on day one** (sidebar double-live mount) |
| **T6 containment** | `worktree-agent-a7497c35b22dcb977` | 4 (`c00dc7a`→`e4e56dd`) | core 340/340; both tsconfigs clean | Dev-gate designed (layered probe, loud-by-default); diagnostics leaf + B2 code table landed; phase move **fixed a latent form-field misordering** |
| **T1/T2 query+settle** | `worktree-agent-ad53256aff115dcfe` | 1 (`6473723`) | core 327/327; typecheck clean | Issues 0005–0009 each a named regression test; settle() proven; **size claim falsified: +≈1.7KB min+gzip, not net-negative** |

All four report reading §8 from the main checkout (worktree bases predate
it); all left working trees clean; T4's throwaway benchmark and T1's size
scratch files were deleted before commit — the committed instruments are
the parse-count regression test and the report's measured numbers.

## Findings the gate must rule on

### 1. Budget (blocking): the +1.7KB query delta

Measured (esbuild, isolated modules, min+gzip): old query 960 B → new
query 2,164 B, settle +512 B, resource +~40 B ≈ **+1.7 KB**. Against
0030.2 §6's 10KB ceiling (8.8KB today), Wave 1+2 as prototyped lands at
or above the line before dev-string stripping. Options, combinable:
strip N-code message strings behind the Wave-1 dev-gate (recovers part);
raise the ceiling with the reasoning recorded; slim the record store.
The ADR's "net-negative" sentence must be corrected either way.

### 2. Semantics rulings queued per prototype

**T5**: per-effect lastRunEpoch vs per-edge versions (end-of-run snapshot
covers all §8 cases — ratify or require per-edge); nested-effect N302
attribution to the inner frame; N302 for `subscribe()` callbacks (currently
yes); tick-cap boundary semantics; poll-throw implemented as
transition-epoch decision (tighter than "throw = changed" — ratify).

**T4**: suppression directive design (`<!-- nisli-audit off -->` /
`allow-undefined: tag…`) — ratify shape + whether parse strips it from
output; SSG audit gating (ssg calls `setTemplateAuditEnabled(false)` now
vs wait for the build-time define); the **residual double-live window**
(deferred component teardown after synchronous slot swap — real fix is
holder-wrapping factory-children in projection.ts, cross-worktree with
T6's projection phase; schedule as a Wave-1 follow-up item); N104 surface
check against a www sweep.

**T6**: dev-gate probe order + loud-when-unsignaled default — ratify;
`setDevMode` public (barrel +1) vs `@nisli/core/devtools` entry; N201/N501
dev-throw-vs-prod-silent splits; N202 exemption for declared-but-unread
attrs keys; `nisli-error` `composed: true`; packaging for build-time
stripping of dev-only bytes.

**T1/T2**: fetcher context argument (key/signal object, TanStack-style —
the prototype's own race test motivates it); invalidate-during-flight =
supersede (abort + rerun) — bless or complete-then-rerun; key-switch
shows new-record truth immediately (no placeholder carry) — bless or add
carry; `initialData` seeding scope; loop-guard vs settle-cap layering.

### 3. Cross-worktree merge items (mechanical, ordered)

1. Merge T6 first (owns `diagnostics.ts` + dev-gate); then T5/T4/T1
   replace their local `diag` shims with the leaf (three `TODO(diagnostics)`
   markers dissolve); register N1xx/N3xx/N6xx codes in the B2 table.
2. Wire `__resetPending()` into `resetInjector()` (T1 ↔ T6 files).
3. Projection follow-up from T4's finding (holder-wrap factory children) —
   touches T6's projection phase; single owner after merge.
4. www docs + framework-skill sweep for the query surface
   (`snippets/query.ts`, `pages/docs.ts`, `sections/framework.ts`) +
   changelog note for `onSuccess`/`onError` removal.
5. Rebase all branches onto current main (3 docs-only commits behind —
   zero source-conflict surface).
6. ADR 0030.2 post-gate amendments: correct the net-negative sentence
   (§2 T1); record the sidebar corruption catch as N105's acceptance
   evidence; record the form-field ordering fix under the projection item.

## Recommended gate order

T6 (foundation: dev-gate + diagnostics) → T5 (no API change, invariant
pins) → T4 (one behavioral migration already proven across suites) →
T1/T2 (budget ruling required) — one gate at a time per the 0025 process.

## Gate rulings and landing record (2026-08-10)

All four gates were run and landed at the maintainer's direction; merge
order T6 → T5 → T4 → T1/T2 held. Main:
`b9b6b76` (T6 + N202 gate fix) → `6623030` (T5) → `dac7ebd` (T4) →
`2cea443` (T1/T2) → `aa70aa6` (N601 retirement) → `f41a8a2` (diagnostics
unification). Core 421/421, ssg 36/36 post-unification; ui 1110/1110 and
router 62/62 at T4's landing point. All pushed.

**Rulings.**

- **T6**: dev-gate probe + loud-when-unsignaled **ratified**; `setDevMode`
  stays internal pending the devtools entry; dev-throw/prod-silent splits
  ratified; **N202 exempts declared attrs keys** — the forward-key false
  positive was found empirically at the gate (core owns the read; fixed +
  regression-pinned in `b9b6b76`); `composed: true` ratified; byte
  packaging → F3.
- **T5**: end-of-run epoch ratified (per-edge deferred to an exotic
  consumer); inner-frame N302 attribution accepted; subscribe-callback
  N302 kept; tick-cap boundary accepted; the transition-epoch poll-throw
  implementation ratified as the tighter correct reading of §8.
- **T4**: suppression directive ratified as designed and **not stripped**
  from output (inert, greppable); SSG gating resolved by unification (the
  audit defaults to the leaf's dev probe — production builds are silent;
  SSG may additionally call `setTemplateAuditEnabled(false)`); the
  residual double-live window → F1; N104 surface check folded into F2.
- **T1/T2**: supersede-on-invalidate blessed; no-carry key-switch
  blessed; `initialData` idle-seeding blessed; guard layering accepted;
  fetcher context argument → F4. **Integration finding: N601 retired** —
  T6's N501 throws at the exact `provide()` that created the mixed-client
  state, making it unrepresentable at its cause (`aa70aa6`); the
  symptom-side warning died with its class.
- **Budget (was blocking) — ruled.** Whole-bundle measured:
  **12,389 B min+gzip** vs the 8,793 B baseline (+3.6KB; the isolated
  +1.7KB estimate missed the audit/diagnostics/containment layers). The
  **10KB ceiling stands as the prod-path target**: ~2.7KB of the delta is
  the dev/diagnostics layer alone (template-audit 1,642 B + diagnostics
  leaf 1,105 B gzip), whose extraction behind a build define / devtools
  subpath is F3. Interim overage is accepted and recorded here;
  re-measure at F3. The ADR's net-negative sentence is corrected in
  place.

**Follow-ups (the train's residue, owned):**

- **F1** — projection holder-wrap for factory children: kills the
  residual double-live window T4 found (`projection.ts`, interacts with
  T6's phase move — single owner now that both are on main).
- **F2** — www docs refresh for the new query surface + the N104
  template-attr sweep (grep found zero `onSuccess`/`onError` teaching in
  www — the staleness is semantic, not breakage).
- **F3** — dev-weight packaging: build-define stripping / `devtools`
  subpath per §7's vite-hmr precedent; recovers ≥2.7KB; re-measure
  against the 10KB ceiling.
- **F4** — fetcher context argument (key + signal object), motivated by
  the prototype's own supersession race test.
- **F5** — release: everything rides `CHANGELOG.md → Unreleased`; version
  bump and publish happen at the next checkpoint per ADR 0022 (this train
  deliberately bumped nothing — pushes do not publish).

## Evidence quality notes for the reviewer

- The wave validated 0030.2's thesis twice over: N105 caught a real
  corruption the suite had never exercised, and the projection phase move
  fixed comments that had been lying (`form-field`'s "after the projection
  sweep" microtasks ran before it).
- It also falsified one claim (query size) — recorded above, not buried.
- T5's zero-edit result revises 0030.2 §8's ~15–30 estimate: the suite
  pins values and DOM state, not incidental run counts; the new invariants
  are discriminated by 24 new tests instead.
