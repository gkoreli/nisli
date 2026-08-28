# Round-2 Evidence A — Fleet Defect Corpus (repo-internal)

**Date**: 2026-08-25 · **Kind**: evidence artifact, captured verbatim
**Feeds**: [`NEXTGEN-SCRATCHPAD.md`](./NEXTGEN-SCRATCHPAD.md) §3, §5, §6, §7.4
**Produced by**: read-only pass over `docs/worklists/ui/`, `docs/adr/`,
`docs/issues/`, `packages/ui/`, and 395 de-duplicated commits.

Findings are captured as produced. Rulings on them belong in the scratchpad,
not in this file.

---

## Round-2 evidence — fleet defect corpus (repo-internal)

**Method.** Unit = a *recorded defect* (named ticket, ADR item, or `docs/issues/` entry that documents something found broken and fixed/open) — not a feature, port, or migration commit. Sources: `docs/worklists/ui/UI-36A|36B-WORKLIST.md`, `docs/adr/0025`, `docs/issues/0001–0020`, `packages/ui/NORTH-STAR.md`, and 395 unique commits (`git log --all`, de-duplicated by subject; rebase twins collapsed). Ticket churn measured by unique-subject commit count per ticket ID.

---

### 1. Ranked defect classes

| rank | defect class | observed count | representative evidence | relational layout assertion catches it? |
|---|---|---|---|---|
| 1 | **Transparent-host (`display:contents`) box-model + native-relationship breakage** — upstream direct-child / positional / `space-*` / `ring` selectors are DEAD through a boxless host | **10 tickets, ~30 component surfaces** (UI-36A#1, UI-36A#A, UI-44, UI-52, UI-54, UI-57, UI-58, UI-59 *open*, UI-60, UI-61) | `docs/worklists/ui/UI-36A-WORKLIST.md:136-139` (the cross-cutting rule, categories A+B); census table `docs/worklists/ui/UI-36B-WORKLIST.md:184-219`; commits `ebfe0c0`, `19d751f`, `83fa141`, `b6203a5`, `b6fe18f`, `36be20a` | **partial** — the geometric half (avatar overlap 8px, button-group corner collapse, toggle-group shared borders, toast row) is a pure box relation, but the a11y half (UI-44 `aria-invalid` delivery, UI-52 `fieldset`→`legend` naming) has *zero geometric signature* at rest |
| 2 | **Potemkin / inert island** — unregistered tag, empty auto-default shell, childless `display:contents` host = zero painted box | **5 arcs, 58-page blast radius** (WWW-11 RC1–RC4, WWW-13, WWW-14, WWW-15 attachment, WWW-15 drawer double-render) | `bf4a4e3` ("demos rendering as bare static triggers… root-caused four classes"); `06dd062` ("toggle: auto-default was an invisible button"; guard extension because "toast passed 67/67 while dead"); `797e10e` ("childless `<ui-attachment>` — display:contents host with empty children() = zero painted box") | **yes** — an empty/zero-box node in a token-normalized box tree is the most trivially detectable signal in the whole corpus; this is the class the bet closes best |
| 3 | **Class-list drift from the pinned upstream** — ported from model memory, wrong token, wrong default | **~6 tickets / 19 component surfaces** | `42f5991` ("first 13 components were ported from model memory… 8 heavily drifted, 5 drifted"); `ec08e8c` UI-24 calendar (whole DOM restructure + `size-9`/`size-auto` conflict from clsx-vs-tailwind-merge); `a360479` (tooltip delay 700→0); UI-36A rows 18/29 | **partial** — a *snapshot diff against a reference snapshot* catches it; a relation (`aligned`, `no-overlap`, `gap ∈ scale`) does not, because drifted-but-self-consistent geometry satisfies every relation |
| 4 | **Interaction / gesture / hydration-timing (LOGIC)** | **7 tickets** (UI-42, UI-63, UI-64, UI-65, UI-66, UI-36B tooltip self-close, UI-33-R/R2) | `c4487ef` UI-64: "pointerenter opened the panel, the trailing click toggled it back shut — net 0→0 on touch and mouse-click alike (real-Chromium-390 product defect)"; `d81e3ee` UI-65 ("cumulative 16px drift"); `41e7906` UI-66 | **no** — see §4; the repo's own verdict is `2f43da1`: *"a static preview screenshots identically to a hydrated one… Screenshots prove paint; only interaction proves the component"* |
| 5 | **Overlay / floating / stacking / portal geometry** | **6 tickets** (UI-25/UI-40 portal adoption, UI-45, UI-46, UI-56, UI-62, sidebar app-shell escape) | `d853682` UI-56 (popover right-shifted; measured before visible layout — verified fixed to 0.008px, `UI-36B-WORKLIST.md:315-317`); `a685a70` UI-62 (toast icon stacked *above* the title instead of in a `gap-2` row, `:328-332`); sidebar "fixed-positions to the VIEWPORT (x0 y0 256×900), painting over the site's own docs nav" (`:353-360`) | **yes** — `contains`, `no-overlap`, `aligned`, `centered-under-anchor` are exactly the assertions; UI-56 and UI-62 were *in fact* closed by rect geometry, manually |
| 6 | **Responsive breakage / overflow-clipping** | **5 tickets** (WWW-15 C, UI-68, UI-36A#B form-field, WWW-14 sidebar preview inflation, GUARD-GAP) | `825c429` UI-68: a 55-char unbreakable slash-chain "forced the paragraph's min-content width to 656px, ballooning documentElement.scrollWidth to 704px at a 390px phone viewport"; `5250612` ("Home hero/install grids… pushed the whole page ~90px past the viewport"; header overflowed ~35px on *every* page) | **yes** — and UI-68 is the sharpest argument in the corpus for **absolute** viewport-fit alongside relations: the relative check passed at 704≤704 and had to be rewritten (`4f06747`) |
| 7 | **Core reactivity / lifecycle / wiring (LOGIC)** | **20 issues + 4 ADR failure modes** | `docs/issues/README.md` (0001–0020, all core/router/ssg, zero appearance); ADR `0007` (class attr wipes `class:name`), `0008.1` (leaked mount-time dep detaches the scroll container → scroll reset to 0), `0023` (append-move re-runs setup → duplicated DOM "ghosts") | **no** — root cause is dependency/lifecycle; *but note 0007/0008.1/0023 all manifest visually* (lost class, reset scroll, duplicated boxes), so a snapshot would flag the symptom without naming the cause |
| 8 | **A11y semantic reachability (`aria-*`)** | **4 tickets** (UI-43, UI-44, UI-51, UI-36A#C) | `b43b266` (command lacked ALL `aria-activedescendant` wiring + item ids); `b6fe18f` UI-44 (9 components); ADR 0025 item 14 | **no** — this is `ariaSnapshot`'s plane, already solved upstream; a geometry snapshot is blind to it |
| 9 | **Misalignment / off-scale spacing** | **3 tickets** | `af949ea` UI-67 (`MessageHeader` name/timestamp **0px gap** — "flex swallows whitespace"; inline `<code>` computed `display:block`, orphaning a period, `UI-36B-WORKLIST.md:377-381`); UI-62 icon/title row; UI-24 calendar `size-9`/`size-auto` | **yes** — `gap > 0`, `gap ∈ scale`, `same-baseline` are direct hits; UI-67's fix was verified by "a nonzero computed header gap" |
| 10 | **Unrendered / undesigned states** | **6 surfaces**, all curation-class | `UI-36B-WORKLIST.md:251-258`: toggle "renders empty/invisible", marker + message + message-scroller "render bare/undesigned — human call: needs a designed example, not a component fix" | **partial** — "renders as nothing" is detectable; "renders as something ugly" is not decidable without a referent (this is the C5 argument, from the record) |
| 11 | **Contrast & state-color** | **1**, and it is not a contrast-ratio failure | `fd6f475` UI-55 — missing base-layer `* { border-border; outline-ring/50 }` made bare borders resolve to near-black `currentColor` instead of the token; UI-36A row 15 explicitly *rejects* a color delta as a defect ("black vs shadcn.com blue = neutral theme token, not drift") | **partial** — a token-name assertion (`border-color ∈ tokens`) catches UI-55 exactly; a `contrast ≥ 4.5` assertion has **no demand evidence anywhere in this repo** |
| 12 | **Invisible focus** | **0 recorded** | no evidence found — `focus-visible` rings ship in the copied theme (`NORTH-STAR.md:69`); UI-24's focus work was *keyboard-navigation* correctness (`ec08e8c` finding 3), not ring visibility | n/a |
| 13 | **Off-scale spacing / raw pixel values (`13px`, `gap-[7px]`)** | **0 recorded** | no evidence found — the registry is a byte-verbatim class-string port against a pinned checkout; agents never invented a value. See §4(f): this is a *port* corpus, not a green-field authoring corpus | n/a |
| 14 | *(discovered class)* **The oracle itself was wrong** | **3** | `39a8d36` (preview sweep's open-check fooled by trigger `data-state`, by flat node-count, and by `checkVisibility` on `display:contents` hosts); `4f06747` (704/704 relative-fit passed a zoomed-out page); `06dd062` (paint+overlay checks missed inert islands) | **meta** — three independent instances of a headless geometric guard producing a false PASS. Directly relevant to kill-criterion #3 |

---

### 2. APPEARANCE vs LOGIC/WIRING split

**The answer flips with the denominator, and that is the finding.**

| denominator | appearance | Potemkin (renders as nothing) | logic/wiring | mixed |
|---|---|---|---|---|
| **D1 = 48 UI-layer product defects** (the 53 enumerated UI/WWW defects minus 5 tooling/process/docs items) | **26 (54%)** | 5 (10%) | 16 (33%) | 1 (2%) |
| **D2 = 68** (D1 + the 20 `docs/issues/` core-framework issues, which are **100% logic**) | **26 (38%)** | 5 (7%) | 36 (53%) | 1 (2%) |

Appearance-family (appearance + Potemkin + half of mixed): **≈65% of D1**, **≈46% of D2**.

**How counted.** Each ticket = 1, regardless of blast radius. Rebase-duplicate commits collapsed by subject. Classification rule: *appearance* = the rendered box tree / paint is wrong; *Potemkin* = nothing renders; *logic/wiring* = state, event, lifecycle, or dependency is wrong (even if the symptom is visible).

**Undercounting risks — flagged honestly:**
- **Appearance is undercounted by ticket-granularity.** UI-44 is one ticket covering 9 components; `42f5991` is one commit covering 13. Counted per *component surface*, appearance goes from 26 tickets to ~60 surfaces while logic stays near 20.
- **Known-open appearance debt is excluded.** The UI-36B census (`:184-219`) ticketed DEAD families rather than fixing them; **UI-59 (table) is still open**, and BET08 (`docs/research/2026-08-platform-sweep/briefs/bet-08-modern-css.md:16,44`) still calls the census "the key liability."
- **The audit rubric systematically missed a whole class until late.** `2f43da1`: interaction was never in the manual-pass rubric, so every interaction defect (UI-63/64/65/66) was invisible to waves A and B and only surfaced in WWW-15. Logic is therefore *also* undercounted, in the opposite direction.
- **Logic is overcounted relative to authoring reality.** The 20 `docs/issues/` entries came from a single 2026-07-16 architect sweep of the *framework core*, not from agents building UI. Including them answers a different question than the bet asks.

---

### 3. Three most expensive recorded defects

**① The transparent-host class** — ~11 fix commits (UI-36A#1, UI-36A#A, UI-44, UI-52, UI-54, UI-57, UI-58, UI-60, UI-61, + UI-59 open), a dedicated skill rule (`767116b` "comp-transparent-host-hazards — both port categories in one rule"), a formal census table, a cross-cutting rules section in the wave-A worklist, and **two** ADR 0025 items (14, 16). Root cause is a single substrate fact: `display:contents` generates no box and inserts a DOM level.
> **Earliest catch:** a **selector-reachability check** at build time — for every selector in a class list, resolve whether it matches a node that paints a box. Not a layout snapshot; a *dead-CSS* diagnostic. Note the repo's own eventual answer (`bd90728`, BET08) is different again: container **style queries**, which cross `display:contents` by name and delete the problem rather than check for it.

**② The preview-inertness / hydration arc** — WWW-10 (5) + WWW-11 (4) + WWW-13 (2) + WWW-14 (5) + WWW-15 (10) = **26 commits across 5 waves**, opened by a human (`bf4a4e3`: "Goga's nisli.dev/ui check showed demos rendering as bare static triggers"), with four independent root causes at WWW-11 alone, a guard that was wrong twice, a rubric amendment, one "Goga's empty-drawer P0", and a terminal fix that **deleted the hydrate-set allowlist entirely** (`0665e89`: "an interactive component is interactive by derivation; the toast-inert class is structurally impossible").
> **Earliest catch:** auto-enumerated state space (C4) + a **liveness+paint** assertion — every `ui-*` in a rendered surface must be `customElements.get()`-defined *and* produce a painted box. This is exactly the guard the repo eventually built (`06dd062`), arrived at after 26 commits.

**③ UI-68 — the 704px phone viewport** — 4 commits (`825c429` fix, `81aebf5` classification, `4f06747` guard repair, plus `abda1cd`/`95872ee` ledger correctives), and it was **first misattributed to the wrong component** (the field family, exonerated at `81aebf5`), while the guard that should have caught it returned a false PASS (704≤704).
> **Earliest catch:** an **absolute** viewport-fit assertion (`documentElement.scrollWidth ≤ 390`) in an enumerated long-content state. Cheap, mechanical, would have fired on the first render — and its failure mode is the precise warning that pure *relational* checks need at least one absolute anchor.

*(For calibration: the highest raw churn in the repo is UI-30 at 18 commits and UI-39 at 10, but both are migration/ledger work, not defects. UI-39's 10 commits are almost entirely **accounting for a verification state that no artifact could hold** — three recheck rounds, a "closure equation", corrective truth passes. That is itself the strongest argument for the bet: the expensive thing was never a defect, it was the absence of a diffable oracle.)*

---

### 4. Kill-criterion evidence — frequent AND not caught headlessly by a relational layout check

Be adversarial; this is the section that should decide the bet.

**(a) Interaction / gesture / timing defects — the strongest counter-evidence.** 7 tickets (UI-42, UI-63, UI-64, UI-65, UI-66, UI-36B tooltip self-close, UI-33-R/R2), several rated product-P0, all found only by driving a real browser with CDP pointer/touch events. **A layout snapshot of any single state is identical before and after every one of them.** The repo states this in its own words at `2f43da1`: *"contact sheets are screenshots, and a static preview screenshots identically to a hydrated one — interaction was never in the rubric… Screenshots prove paint; only interaction proves the component."* **A textual layout snapshot inherits a screenshot's exact blind spot.** C4 state enumeration only helps if it emits *gestures* (tap, drag, long-press, scroll), and authoring the gesture per component is precisely kill-criterion #4 ("per-component authoring effort comparable to writing tests"). UI-64 in particular — a single tap that opens then immediately closes — requires *sequenced* observation, not a state enumeration.

**(b) Reachability defects with no geometric signature.** UI-44 (`aria-invalid` never reaches the class-bearing node) manifests only in an invalid state and only as a ring/border color; UI-52's `fieldset`→`legend` accessible-name break has **zero** geometry; UI-43/UI-51 are pure ARIA. These are ~4 tickets inside the #1-ranked class, and the geometry plane cannot see them. They need `ariaSnapshot` (which already exists, upstream, for free) — meaning **the #1 defect class is only ~half addressable by the proposed oracle.**

**(c) The headless harness is itself a defect source — three recorded false PASSes.** `39a8d36` (open-check fooled by trigger state, by node-count, and by `checkVisibility` on boxless hosts), `4f06747` (704/704), `06dd062` (paint+overlay checks missed inert islands). Plus two false NEGATIVES ruled *not* defects: scroll-area's "no at-rest thumb in headless macOS = overlay-scrollbar platform behavior, not a defect" (`UI-36B-WORKLIST.md:324-327`) and the sidebar disposition — "a full-viewport app-shell component cannot render honestly in a bounded box" (`:353-360`). **Five recorded instances of a headless geometric oracle being wrong** is live ammunition for kill-criterion #3 (a noisy oracle gets muted).

**(d) "Needs a designed example" — undecidable without a referent.** 6 wave-B surfaces (`UI-36B-WORKLIST.md:251-258`) were closed as *human call*, explicitly "not a component fix." No relational assertion can express "this renders correctly but looks unfinished." This is direct in-repo support for C5's premise (pixel-perfect is undefined without a referent) and direct evidence *against* C2 shipping alone.

**(e) The referent drifts.** Mid-audit, ui.shadcn.com switched its default style to Base UI/nova and the live site "is no longer our parity baseline"; truth had to be re-pinned to a checkout (`UI-36B-WORKLIST.md:236-241`). Any oracle with an external referent inherits this maintenance cost.

**(f) External-validity caveat — the biggest one, and it cuts both ways.** Three of the nine bug classes in scratchpad §3 have **essentially zero support in this corpus**: off-scale spacing / raw pixel values (0), invisible focus (0), contrast failure (0 — the one color defect, UI-55, was a *missing base-layer token default*, and a color delta was explicitly ruled *not* a defect at UI-36A row 15). The reason is structural: **this is a port corpus, not a green-field authoring corpus.** The fleet was transcribing a design that already existed, byte-verbatim, against a pinned checkout — so "agent invented a wrong value" defects are near-impossible by construction, while "the transcription didn't survive our substrate" defects (rank 1) dominate. A green-field agent-authoring corpus would very likely invert ranks 1 and 13. **Do not use this ranking to size the market for the oracle; use it only to size the oracle's value *to nisli's own fleet*.**

**Net verdict on the kill criterion.** §6's first criterion — *"failures are overwhelmingly logic and wiring"* — is **not met**: appearance-family is ~65% of the UI-layer corpus (54% strictly appearance). The bet survives. But the corpus adds a constraint the scratchpad does not yet carry: **the top defect class is only half-visible to geometry**, and the second-largest *logic* cluster (interaction/gesture) is fully invisible to it. A snapshot+relations oracle that ships without (i) a selector-reachability diagnostic and (ii) a gesture-sequenced enumeration would have caught roughly **half** of what this fleet actually shipped broken.


---

## Source map — where the evidence lives

### `docs/worklists/ui/UI-36A-WORKLIST.md`

Wave-A (a–l) visual-parity audit, 32 components. Key evidence: :136-139 the cross-cutting `display:contents` rule (categories A box-model / B native-relationship) — the origin of the #1 defect class; row 6 avatar (dead `-space-x-2`/`*:ring-2`, four-surface live verify); row 15 checkbox (a color delta explicitly ruled NOT a defect); row 25 form-field (FieldSet→FieldLegend `aria-labelledby` restoration); batch-1 section records the input-otp aria-invalid dead-token fix that became UI-44's reference mechanism.

### `docs/worklists/ui/UI-36B-WORKLIST.md`

Wave-B (m–z) audit + three recheck rounds. :184-219 the transparent-host child-selector census (20 files, REACHABLE/TRANSLATED/DEAD dispositions, tickets UI-57/58/59/60/61); :243-244 sheet UI-54 open defect; :251-258 the six curation/'needs a designed example' surfaces; :275,:313,:365 recheck rounds 1–3 with headless-Chromium computed-value evidence; :324-327 the scroll-area headless false-negative; :353-360 sidebar app-shell viewport escape; :383 final 24/26 equation.

### `docs/worklists/ui/UI-30-WORKLIST.md`

Migration plan (58 components off userland attr/children helpers), NOT a defect record. Highest raw commit churn in the repo (18) but contributes zero defects to the ledger — important for not mis-ranking churn as cost.

### `docs/adr/0025-core-proposals-from-ui.md`

Standing tracker of framework gaps surfaced by building @nisli/ui. 17 items. Appearance-relevant: item 6 (portal — inline `position:fixed` overlays clipped by transformed ancestors), item 13 (UI-45 floating transform-origin + exit visibility), item 14 (UI-44 aria-invalid reachability, full 9-component matrix), item 15 (UI-46 tooltip arrow), item 16 (UI-54 transparent-host style feedback), item 17 (UI-56 floating open-layout alignment). Items 1–12 are logic/ergonomics.

### `docs/issues/README.md`

Index of 20 framework issues from the 2026-07-16 architect sweep (core/router/ssg). 100% logic/wiring — query coordination, reactive-slot ownership, each() key corruption, router metadata, SSG factories. Zero appearance. This is the denominator that flips the APPEARANCE/LOGIC split from 54% to 38%.

### `docs/adr/0023-move-resilient-component-lifecycle.md`

Append-based DOM move fires disconnect+connect, re-running setup and mounting a second copy — 'ghost' duplicates under each() reorder and light-DOM projection. Logic root cause, visually-manifesting symptom (duplicated boxes) — the pattern that makes a snapshot a symptom-detector, not a cause-namer.

### `docs/adr/0008.1-mount-time-dependency-leak.md`

Leaked mount-time dependency caused a reactive slot to detach and replace the live scroll container → scroll reset to 0. Same shape as 0023: pure reactivity bug, purely visual symptom.

### `docs/adr/0007-class-attribute-classList-conflict.md`

Reactive `class` attribute binding used setAttribute, wiping classes toggled by `class:name` directives on signal change. Initially misdiagnosed as a happy-dom parser bug. A class-list-level appearance defect with a template-engine root cause; the fix is the `tmpl-class-attribute-safe` invariant.

### `packages/ui/NORTH-STAR.md`

v1-done audit. :131-171 records wave A/B closure state, the UI-68 root-classification (704px phone viewport = www typography defect, field family exonerated), and the named open items. :69 confirms focus-visible rings ship in the copied theme (context for the zero invisible-focus defects).

### `packages/ui/CHANGELOG.md`

Release ledger; :170-175 points at the UI-36A/36B worklists as the per-component audit record. Contains no independent defect evidence beyond the worklists.

### `docs/research/2026-08-platform-sweep/briefs/bet-08-modern-css.md`

August-2026 sweep brief. :16 names the UI-36B census 'the key liability'; :44-56 works UI-59 (still-open DEAD table rows) as an @scope example; :134-138 the adoption batches. Evidence that the #1 defect class is still live debt and that the repo's own preferred remedy (container style queries, landed at bd90728) DELETES the problem rather than checking for it.

---

## Corpus shape

Corpus shape and where the evidence lives.

This repo carries three structurally different defect records, and conflating them is the main analytic hazard:

1. `docs/issues/0001–0020` — a single 2026-07-16 architect sweep of @nisli/core, @nisli/router, @nisli/ssg. Twenty issues, 100% logic/wiring (query coordination, reactive-slot ownership, each() key corruption, lifecycle teardown). Zero appearance. These are framework-internal, not agent-authoring failures.

2. `docs/worklists/ui/UI-36A|36B-WORKLIST.md` — the real UI defect corpus: a two-wave, per-component parity audit of 58 registry components against a pinned shadcn `new-york-v4` checkout, carrying two verdicts per component (mechanical class-diff + human side-by-side) and closed by an explicit 'closure equation' that only a *performed recheck* could flip. This is where the appearance defects are recorded, at ticket granularity UI-42…UI-68.

3. `docs/adr/0025` — the standing gap tracker (17 items) that promotes recurring UI pain into framework proposals. Items 6/13/14/15/16/17 are the appearance items; 1–12 are ergonomics/logic.

The dominant causal structure: nisli's registry is a *port*, not an authoring corpus. Components are byte-verbatim class-string transcriptions of upstream React/Radix TSX, rendered into light DOM behind layout-transparent (`display:contents`) custom-element hosts. That single substrate choice produces the #1 defect class — every upstream direct-child, positional, or `space-*` selector is DEAD through a boxless host, in two distinct flavors (box-model and native parent↔child relationship). Ten tickets, ~30 component surfaces, a dedicated skill rule, a formal 20-file census, two ADR items, and one family still open (UI-59 table).

The second causal structure is the verification loop itself: `packages/www` renders every registry component as a live preview, and a headless-Chromium sweep guards it. That loop generated its own defect arc (WWW-10→WWW-15, 26 commits) where components rendered as inert nothing, and — critically — the guard produced false PASSes three separate times. Any proposal for a headless geometric oracle must budget for the fact that this repo has already built one twice and had it lie.

Cross-cutting caveat for round 2: because the corpus is a port, three of the nine bug classes the scratchpad enumerates (off-scale raw pixels, invisible focus, contrast) have zero recorded instances here. That is a property of the corpus, not of agents. Use this ranking to size the oracle's value to nisli's own fleet; do not use it to size the market.
