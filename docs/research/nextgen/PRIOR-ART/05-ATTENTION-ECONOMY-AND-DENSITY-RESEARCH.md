# Attention Economy and Density — which parts of good design are rules, and which are taste

**Date**: 2026-08-25 · **Kind**: prior-art evidence, captured verbatim
**Slice**: the science and the craft of spending a reader's attention, converted into candidate machine-checkable rules — and an honest boundary marking where the machine has to stop.
**Parent**: [`NEXTGEN-SCRATCHPAD.md`](../NEXTGEN-SCRATCHPAD.md) — new package `@nisli/next`

---

## Verdict in five bullets

1. **"Attention" is not measurable to a useful tolerance, and the numbers are public.** The best published predictors of how a person will judge a UI explain **48–49% of the variance** in human ratings (Reinecke et al., CHI 2013, adj. *R²* = .48; Miniukovich & De Angeli, CHI 2015, "up to 49% of variance in webpage aesthetics"). Worse, in Reinecke's own data the *Webby Award winners* — the supposedly-agreed-good set — drew mean ratings spanning **4.21 to 6.57** on a 9-point scale with an average per-site **SD of 1.69**. Humans do not converge on "good", so no oracle can be trained to it. **Any `@nisli/next` claim of the form "the framework knows this looks good" is falsified before it is made.** What survives is narrower and much stronger: the framework can know a design is *broken*, *inconsistent with its own declaration*, or *self-contradictory*.
2. **The single most valuable finding is not a metric — it is one sentence in the GNOME HIG.** *"Each view should only ever include a single button using either the suggested or destructive styles."* That is a **normative, exact, machine-decidable attention rule that no linter on earth can evaluate against a Tailwind class string** — and it becomes a two-line check the moment the author declares `data-role="primary"`. It is the existence proof for the entire declaration-enabled-check thesis. The same page yields a second: *"Do not use more than one or two different widths of button in the same window, and ensure that buttons placed next to each other have the same width."*
3. **WCAG is a bigger untapped seam than we are using, and its own vendor publishes the ceiling.** axe-core — **67,615,388 npm downloads in the week ending 2026-08-24**, 7.4k stars — states in its README: *"With axe-core, you can find **on average 57% of WCAG issues automatically**."* Four criteria that are **fully decidable as stress tests** (1.4.4 Resize Text 200%, 1.4.12 Text Spacing, 2.4.11 Focus Not Obscured, and the *spacing exception* of 2.5.8 Target Size) are **gaps in our current 10-rule set**, and each is cheap for us specifically because we already own the box tree and the 240-cell context matrix. Text Spacing in particular is nothing but "apply four CSS values, then re-run N660/N670/N690".
4. **APCA — the contrast successor everyone assumes is coming — is not adoptable.** `apca-w3` does 82,583 downloads/week against axe-core's 67.6M (a ratio of **1:819**), WCAG 3.0 is still a **Working Draft** (latest 2026-03-03), and `SAPC-APCA/LICENSE.md` reads *"Patent(s) pending"*, *"Registered Beta Testers OR Personal use only is permitted"*, and *"Commercial use is prohibited without a written and signed commercial license agreement"*, plus a **right-to-audit clause** over any commercial integration. A zero-dependency framework cannot ship that. Stay on WCAG 2.x ratios; revisit only if WCAG 3 reaches CR with a royalty-free grant.
5. **Two celebrated "laws" must be deleted from the vocabulary, not encoded.** Hick's law is the check we could most trivially write — we literally know the number of choices in a declared container — and the CHI 2020 review *How Relevant is Hick's Law for HCI?* proves the check would be **backwards**: applied honestly the law *"actually suggests displaying as many items as possible, which is contrary to common sense"*, and measured slopes in real selection tasks are **32, 8 and 4 ms/bit** — noise. Tufte's data-ink ratio is genuinely computable in a declaration-only world (it is the one classic metric our substrate makes exact), but it has **no published validation against user outcomes** and its optimum is not 1. Neither is a rule. Both are taste wearing a formula.

---

## Systems surveyed

| system | what it does | adoption (dl/wk, stars, last activity) | status | relevance |
|---|---|---|---|---|
| **WCAG 2.2** (`w3c/wcag`) | 86 normative success criteria; the only *legally load-bearing* numeric rules in UI | the referent for a 67.6M/wk tool; W3C **Recommendation 2024-12-12** | live, stable | **highest** — 8 criteria carry numbers we can decide; 4 are gaps for us |
| **axe-core** (`dequelabs/axe-core`) | the WCAG checker that actually won; zero-false-positive design; three-valued results (pass / violation / **incomplete**) | **67,615,388 dl/wk** (w/e 2026-08-24), 7.4k ★, 5,527 commits | live, dominant | **highest** — proof a checker wins on *regime* + *no false positives*; publishes the 57% ceiling |
| **GNOME HIG + libadwaita style classes** | `suggested-action` / `destructive-action` as a *declared* prominence vocabulary, with a normative one-per-view rule | ships in every GNOME desktop; HIG actively maintained | live | **highest** — the cleanest existing declaration-enabled attention check |
| **APCA / SAPC** (`Myndex/SAPC-APCA`) | perceptually-uniform contrast successor intended for WCAG 3 | `apca-w3` **82,583 dl/wk**; 580 ★; patent pending, non-commercial licence | beta, **licence-blocked** | high (negative) — the successor we cannot adopt |
| **WCAG 3.0** (`w3c/silver`) | outcome-based model (Bronze/Silver/Gold) replacing binary success criteria | **Working Draft**, latest 2026-03-03 | draft, years out | medium — do not build against it; do borrow the *three-valued* grain |
| **AIM — Aalto Interface Metrics** (`aalto-ui/aim`) | 30 computational GUI metrics incl. **grid quality**, **white space**, clutter, colour harmony, saliency; MIT, runnable | 64 ★, 18 forks, MIT, branch `aim2` | live but research-grade | high — the only complete open implementation of "measure a UI's aesthetics", and the clearest demonstration of its limits |
| **Rosenholtz Feature Congestion / Subband Entropy** (Journal of Vision 7(2):17, 2007) | two validated measures of visual clutter, standing in for "set size" in visual-search models | canonical; vendored into AIM as `image_visual_clutter_utils.py` | live as a citation | medium — validated against *search performance*, never against *correctness* |
| **Reinecke et al., CHI 2013** | perceptual models of website complexity + colourfulness → first-impression appeal | 301+ citations; source released at iis.seas.harvard.edu | landmark, closed | **highest (adversarial)** — supplies the 48% ceiling and the Webby dispersion |
| **Miniukovich & De Angeli, CHI 2015** | 8 metrics incl. grid quality + white space; the definitions AIM implements | the citation in every relevant AIM module | landmark | high — supplies the ±2px alignment operationalization |
| **DeepGaze IIE** (`arXiv:2105.12441`) | SOTA saliency: where eyes land on an image | **93%** of explainable information gain on MIT1003; AUC 88.3%, sAUC 79.4%, CC 82.4% | live SOTA | medium — eye *position* is nearly solved; eye *judgement* is not |
| **UIED** (`MulongXie/UIED`) | CV-based GUI element detection from screenshots | 551 ★, 258 commits | maintained irregularly | medium — every pixel-side system needs this; **we don't** |
| **UI-Bench** (`arXiv:2508.20410`, 2025) | benchmark for AI text-to-app *visual excellence* | 10 tools, 30 prompts, 300 sites, **4,000+ expert human judgements**, TrueSkill | live leaderboard | **high (adversarial)** — in 2025 the people who most needed an automatic aesthetic oracle built a **human** one |
| **Hick's law** (Liu et al., CHI 2020) | the "fewer choices" law, reviewed and largely demolished | the definitive HCI review; ERC-funded | live critique | high (negative) — kills the cheapest check we could write |
| **Fitts's law → WCAG 2.5.5 / 2.5.8** | movement time ~ log(D/W), operationalized as target-size floors | 24×24 CSS px (AA), 44×44 (AAA) | normative | high — already half-implemented by us (N650) |
| **Butterick's Practical Typography** | craft rules carrying numbers: **45–90 characters** per line ("2–3 alphabets") | the most-cited free typography reference | live | medium — one defensible bound, several folklore ones |
| **Tufte, data-ink ratio** (1983) | ink devoted to non-redundant data ÷ total ink | canonical doctrine; never operationalized for UI | live | medium — computable *only* in a declaration-only world; unvalidated |
| **Simon, attention scarcity** (1971) | *"a wealth of information creates a poverty of attention"* | the origin of the maintainer's thesis | canonical | framing, not a rule |

---
## What each one actually does

### The centrepiece — 36 candidate rules, sorted by what each one *needs*

Read the split, not the rows. **Block A needs nothing but the declaration** — it runs without a browser, without a screenshot, sometimes without a page at all (A7 and A8 run over the resolution *table*). **Block B needs one render**, which we already do 240 times. **Block C is where taste starts**, and it is short — but three of its five entries are the ones people most want automated.

Status legend: **HAVE** = implemented in `experiments/c11-appearance` today · **PARTIAL** = a weaker form exists · **GAP** = not built, buildable · **NEVER** = decidable but should not be a gate.

#### Block A — DERIVABLE FROM DECLARATION (no pixel measurement)

| rule | source | machine-decidable? | declaration it requires | our current status |
|---|---|---|---|---|
| **A1. Exactly one primary (or destructive) action per view or region** | GNOME HIG, Buttons § Suggested & Destructive Actions: *"Each view should only ever include a single button using either the suggested or destructive styles."* | **yes** — an exact count over a declared subtree | `data-role="primary" or "danger"` plus a declared region boundary | **GAP** — vocabulary exists, rule does not. *This is the flagship.* |
| **A2. A destructive action is never also the default/confirming action** | GNOME HIG (destructive = *"a warning"*); Apple/Material prominence conventions | **partial** — exact once "default action" is declared, undecidable from markup alone | `data-role="danger"` + declared default action | **GAP** |
| **A3. No two candidates in one collapse group declare the same priority** | in-house: round-5 correction, *"ties broke by DOM order and hid the wrong action"* (`NEXTGEN-SCRATCHPAD.md` §8) | **yes** — a duplicate-key check | `data-priority` inside a `data-collapse` group | **GAP** — fixed by design, never enforced |
| **A4. Every declared value is in the vocabulary** | C10 closed-vocabulary premise | **yes** | the closed vocabulary itself | **HAVE** — N610 |
| **A5. Every appearance declaration sits on an element that owns a box** | in-house: the `display: contents` defect class (10 tickets, ~30 surfaces) | **yes** | any appearance declaration | **HAVE** — proof path `declared` |
| **A6. Escape ratio: escaped subtrees are counted and capped** | C11 §2.3 (`escapes`, `escapedProps` manifest fields) | **yes** | the explicit `data-escaped` opt-out | **HAVE** — N601; manifest field still a sketch |
| **A7. Table self-consistency: every unit-proportional container bound is floored by the content floors it must hold** | in-house F9 — *"the resolution table stating an impossible constraint"* | **yes**, and it needs **no page at all** — it is static over the table | the resolution table being the only source of values | **GAP** — scratchpad §7.21, unbuilt. Highest-leverage A-rule. |
| **A8. Emphasis monotonicity: declared emphasis order maps to non-increasing resolved salience** | Material emphasis hierarchy; GNOME/Apple prominence; no published formalization found | **yes** — static over the table (size × weight × contrast per role) | an ordered `data-role` emphasis axis | **GAP** — novel; no prior art implements this |
| **A9. Data-ink ratio** | Tufte, *The Visual Display of Quantitative Information* (1983) | **decidable exactly** in a declaration-only world (declared-content nodes ÷ all painted nodes) — but the *target value* is unknown and is not 1 | `data-text` / `data-appearance` distinguishing content from chrome | **NEVER gate** — report only. No published validation against user outcomes. |
| **A10. Choice count per container ("Hick's law")** | Hick 1952 via Card, Moran & Newell; **demolished** by Liu et al., CHI 2020 | **decidable and invalid** — the law argues for *more* items on one page, not fewer | none needed | **NEVER build.** See § Where the prior art says we are wrong, #1. |
| **A11. A collapsed group exposes a reachable, correctly-wired trigger** | WCAG 4.1.2 + in-house F10 (*"a solver must measure the world it creates"*) | **yes** | `data-collapse` on a declared group | **HAVE** — proof path `afford` |
| **A12. Two-dimensional-layout opt-out is declared, never inferred** | WCAG 1.4.10 exception: *"Except for parts of the content which require two-dimensional layout for usage or meaning."* | **yes once declared; undecidable otherwise** | an explicit `requires-2d` declaration on maps, diagrams, data tables | **GAP** — this is the exception that makes 1.4.10 human-only *for everyone else* and machine-decidable *for us* |

#### Block B — NEEDS PIXELS (one render; we already do 240)

| rule | source | machine-decidable? | declaration it requires | our current status |
|---|---|---|---|---|
| **B1. Text contrast ≥ 4.5:1 (3:1 large)** | WCAG 1.4.3 (AA) | **yes** | none — colours come from the table | **HAVE** — N640 |
| **B2. Non-text contrast ≥ 3:1 for components and states** | WCAG 1.4.11 (AA): *"Visual information required to identify user interface components and states"* | **partial for everyone else** — "required to identify" is an authoring judgement. **For us it is decidable**: `data-appearance` names which pixels identify the control | `data-appearance` + `data-state` | **GAP** |
| **B3. Target ≥ 24×24 CSS px, or the 24px-circle spacing exception** | WCAG 2.5.8 (AA): *"if a 24 CSS pixel diameter circle is centered on the bounding box of each, the circles do not intersect another target"* | **yes** — the spacing exception is pure geometry over sibling boxes | `data-appearance="action"`; `Inline` / `Essential` declared | **PARTIAL** — N650 enforces a *context* floor; the spacing exception is unbuilt and is free for us |
| **B4. Target ≥ 44×44 CSS px** | WCAG 2.5.5 (AAA) | **yes** | same | **HAVE** — N650 at the touch-context floor (we default *stricter than AA*) |
| **B5. Reflow: no two-dimensional scrolling at 320 CSS px** | WCAG 1.4.10 (AA) | **yes** for the scrolling half; the "loss of information" half needs A12 | A12's `requires-2d` | **HAVE** — N630 plus the 320px column of the 240-cell matrix |
| **B6. Text-spacing stress test (1.5× / 2× / 0.12× / 0.16×) with no loss of content** | WCAG 1.4.12 (AA) | **fully decidable for us**, because "loss of content" reduces to N660/N670/N690 firing | none — it is a stress axis, not a declaration | **GAP** — *cheapest high-value win on this page* |
| **B7. Resize text to 200% without loss of content or functionality** | WCAG 1.4.4 (AA) | **yes** — identical shape to B6 | none | **GAP** |
| **B8. Focused component is not entirely hidden by author content** | WCAG 2.4.11 (AA) | **yes** — focus each focusable, intersect with author-created overlays | none | **GAP** — closes scratchpad §3 bug class 7 (invisible focus) |
| **B9. Focus indicator ≥ a 2px perimeter in area, ≥ 3:1 focused-vs-unfocused** | WCAG 2.4.13 (AAA) | **yes** — both halves are arithmetic over two renders | none | **GAP** |
| **B10. Hover/focus content is hoverable, persistent, dismissible** | WCAG 1.4.13 (AA) | **partial** — hoverable and persistent by simulation; *dismissible* needs a declared mechanism | a declared dismiss affordance | **GAP** — pairs with the "gesture-sequenced enumeration" item in §5.1 |
| **B11. Nothing paints outside its own box** | in-house F8 (*"buttons visibly overlapped while the oracle reported success"*) | **yes** | none | **HAVE** — N660 |
| **B12. No two rendered siblings' boxes intersect** | in-house | **yes** | none | **HAVE** — N670 |
| **B13. No word is broken inside itself to fit** | in-house F9 / N690 | **yes** | none | **HAVE** — N690 |
| **B14. Truncation is not degenerate ("1…", "Y…")** | in-house round-6 finding | **yes** (heuristic threshold) | `data-collapse="truncate" vs "hide"` | **HAVE** — N621 |
| **B15. Body prose measure is bounded — normatively at ≤ 80 characters (40 CJK)** | WCAG 1.4.8 (AAA): *"Width is no more than 80 characters or glyphs (40 if CJK)."* Corroborated by Butterick, *Practical Typography*, "line length": *"Aim for an average line length of 45–90 characters, including spaces."* | **yes** — and, unusually for a typographic rule, the upper bound is **normative**, not folklore | `data-text="body"` to distinguish prose from labels | **GAP** — the ≤80 ceiling is defensible as `fail`; a *lower* bound is craft and should stay `warn` |
| **B16. Line-height ≥ 1.5× font size for blocks of text** | *Not* an author requirement. WCAG 1.4.8 asks only that *"a mechanism is available"*, and notes: *"Content is not required to use these values."* The author-side number lives in 1.4.12 as a **stress test** (B6) | **yes as a stress test, no as a value rule** — asserting a literal 1.5 line-height would enforce a bound no standard imposes | `data-text` | **GAP** — fold into B6; do not ship as a standalone value check |
| **B17. Alignment-point count / grid quality (±2 px tolerance)** | Miniukovich & De Angeli, CHI 2015, implemented as `aim/metrics/m21/m21_grid_quality.py` with `_G2_PIXEL_TOLERANCE_ROW = 2` | **computable exactly** — but it is a *correlate of ratings*, not a correctness rule | none | **GAP** — build as a report, never a gate |
| **B18. White-space proportion** | AIM `m22_white_space.py` ("The proportion of white space", range 0–1) | computable; **no defensible threshold exists** | none | **NEVER gate** |
| **B19. Visual clutter (feature congestion, subband entropy)** | Rosenholtz, Li & Nakano, *Journal of Vision* 7(2):17 (2007) | computable; validated against **visual-search performance**, never against correctness | none | **NEVER gate** |

#### Block C — NEEDS A HUMAN (the honest boundary)

| question | why no machine decides it | evidence |
|---|---|---|
| **C1. Is this the *right* primary action?** | requires product intent, which is not in the tree | — |
| **C2. Is it beautiful?** | best published models explain **48–49%** of rating variance; award-winning sites draw **SD 1.69** ratings | Reinecke CHI 2013; Miniukovich CHI 2015 |
| **C3. Is the copy right?** | GNOME HIG can only say *"Button labels should use imperative verbs"* — style, not correctness | GNOME HIG, Buttons |
| **C4. Art direction ("at this width it should look like *this*")** | a priority list expresses a preference order, never a specific composition | scratchpad §7.20 |
| **C5. Is this presentation "essential"?** | **WCAG itself concedes this**: the word `essential` is an author-asserted escape hatch written into 1.4.3, 1.4.10, 1.4.11, 2.5.5 and 2.5.8 | `w3c/wcag` SC sources |

**The count that matters: 12 rules need only a declaration, 19 need one render, 5 need a human.** And of the 19 render rules, we already run 8. The frontier is not "can a machine see" — it is **B6/B7/B8 (three WCAG stress tests we are simply not running) and A1/A7/A8 (three declaration checks nobody has ever been able to write).**

---
### WCAG 2.2 — the only numbers in UI that anyone is obliged to obey

W3C Recommendation, 2024-12-12. The normative text is short and startlingly mechanical. Verbatim, from `w3c/wcag`:

- **1.4.3 Contrast (Minimum), AA** — *"The visual presentation of text and images of text has a contrast ratio of at least 4.5:1"*, with `Large Text` at 3:1 and exemptions for `Incidental` and `Logotypes`. Fully decidable. **We implement it (N640).**
- **1.4.4 Resize Text, AA** — *"text can be resized without assistive technology up to 200 percent without loss of content or functionality."* One sentence. Fully decidable *as a differential test*: render at 100%, render at 200%, assert no new overflow/crush/overlap. **We do not run it.**
- **1.4.10 Reflow, AA** — *"Content can be presented without loss of information or functionality, and without requiring scrolling in two dimensions for: Vertical scrolling content at a width equivalent to 320 CSS pixels"*, with the exception *"for parts of the content which require two-dimensional layout for usage or meaning."* The 320px number our matrix already encodes comes from here. The scrolling clause is decidable; the exception is the reason nobody else can automate it — and it is exactly the kind of fact our declaration layer can carry (A12).
- **1.4.11 Non-text Contrast, AA** — 3:1 for *"Visual information required to identify user interface components and states"*. The phrase "required to identify" is why axe-core cannot fully automate it. In a system where `data-appearance="action"` names the control and `data-state` names the state, the identifying pixels are named too.
- **1.4.12 Text Spacing, AA** — *"no loss of content or functionality occurs by setting all of the following and by changing no other style property: Line height (line spacing) to at least 1.5 times the font size; Spacing following paragraphs to at least 2 times the font size; Letter spacing (tracking) to at least 0.12 times the font size; Word spacing to at least 0.16 times the font size."* Four numbers, one assertion. And the note is explicit that *"Content is not required to use these text spacing values"* — it is a **stress test**, not a style rule. For us "loss of content" is not a judgement call: it is N660 (crush), N670 (overlap) or N690 (shredded word) firing. **This is the single cheapest unclaimed win in the whole survey.**
- **1.4.13 Content on Hover or Focus, AA** — three named sub-conditions: `Dismissible`, `Hoverable`, `Persistent`. Two of the three are simulatable; the first needs a declared mechanism.
- **2.4.11 Focus Not Obscured (Minimum), AA** — *"When a user interface component receives keyboard focus, the component is not entirely hidden due to author-created content."* Note the word **entirely**: this is a box-intersection predicate, fully decidable, and it directly targets scratchpad §3 bug class 7.
- **2.4.13 Focus Appearance, AAA** — the indicator area must be *"at least as large as the area of a 2 CSS pixel thick perimeter of the unfocused component"* and have *"a contrast ratio of at least 3:1 between the same pixels in the focused and unfocused states."* Two renders and arithmetic.
- **2.5.8 Target Size (Minimum), AA** — *"at least 24 by 24 CSS pixels"*, with a **relational** exception worth quoting in full: *"Undersized targets … are positioned so that if a 24 CSS pixel diameter circle is centered on the bounding box of each, the circles do not intersect another target or the circle for another undersized target."* That is a sibling-geometry rule, i.e. precisely the class CSS cannot express and a tree-owning framework can. **2.5.5 (AAA) raises the floor to 44×44** — the number our `--min-target` already uses, meaning our default is stricter than legally required.

**Verdict on the standard**: of the ten criteria above, **eight are fully machine-decidable** and two (1.4.10, 1.4.11) are decidable *only* if an author declaration supplies the missing predicate — which is the whole `@nisli/next` bet, restated by the W3C without meaning to.

### axe-core — the checker that actually won, and the ceiling it publishes

`dequelabs/axe-core`, **67,615,388 downloads in the week ending 2026-08-24**, 7.4k stars, 5,527 commits. From the README, verbatim: *"With axe-core, you can find **on average 57% of WCAG issues automatically**. Additionally, axe-core will return elements as 'incomplete' where axe-core could not be certain, and manual review is needed."* And from its manifesto: *"It returns zero false positives (bugs notwithstanding)."*

Three transferable facts, none of them about accessibility:

1. **57% is the honest ceiling of an automated conformance checker**, published by the vendor with the most to gain from a higher number. Our own 10-rule set should expect a similar shape: a majority of the *mechanical* defect classes, none of the judgement ones.
2. **Zero false positives is the adoption gate, not coverage.** This matches our round-8 cost signal exactly — five of nine defects were in the oracle, not the page. axe-core's answer to the same problem is the same as ours: a third value.
3. **`incomplete` is a first-class result**, not a failure. Our N680 (`measurement impossible`, severity `incomplete`) is the same primitive, arrived at independently. That convergence is worth stating in the ADR: the dominant checker in the industry and our prototype both concluded that a two-valued verdict is a lie.

### GNOME HIG + libadwaita — the only shipping system that makes prominence a *declaration* and then states a rule over it

This is the find of the survey. GNOME's style classes are not visual descriptions; they are **named intents** (`suggested-action`, `destructive-action`, `pill`, `circular`), and the HIG then states rules **over the declarations**:

> *"The suggested action and destructive action styles give buttons a strong color which conveys meaning. … **Each view should only ever include a single button using either the suggested or destructive styles.**"*

> *"Do not use more than one or two different widths of button in the same window, and ensure that buttons placed next to each other have the same width."*

> *"Outside of header bars, buttons should contain either an icon or a label, and not both."*

> *"Make invalid buttons insensitive, rather than showing an error message when the user clicks them."*

Every one of those is exactly checkable — the first from the declaration alone, the second from the box tree, the third from the child structure, the fourth from a declared `disabled` state. **None of them is checkable on a class string like `bg-primary hover:bg-primary/90`,** because that string names a colour, not a role. This is the clearest evidence in the entire prior art that the maintainer's product is real: *the rule already exists in writing, in a shipping platform's guidelines, and has simply never been enforceable on the web.*

Note also what GNOME does **not** attempt: nowhere does the HIG state a numeric threshold for beauty, density, whitespace, or clutter. A 25-year-old, heavily-designed platform HIG confines itself to relational and countable rules. That is a strong prior on where the boundary sits.

### APCA / SAPC — beautiful science, unusable licence

`Myndex/SAPC-APCA`, 580 stars. The algorithm is real work derived from vision science, and it is the intended contrast method for WCAG 3. It is also, right now, **legally unusable by us**. From `LICENSE.md`, verbatim:

> *"Patent(s) pending."* … *"Registered Beta Testers OR Personal use only is permitted unless authorized in writing"* … *"Commercial use is prohibited without a written and signed commercial license agreement, except as provided by the W3 cooperative agreement for web content only."* … *"Any integration of APCA, SAPC, or SACAM which is in a commercial app or behind a paywall, free access must be provided to Myndex Research, or their assigns, on request, for the purpose of evaluating and verifying correct operations"* … *"license for use is revoked when any such asset is removed from this repository."*

A revocable, audit-bearing, patent-pending licence with a "keep current or lose the grant" clause is disqualifying for a framework whose entire pitch is *zero dependencies* and *one artifact*. The adoption numbers agree with the lawyers: **`apca-w3` 82,583 dl/wk vs `axe-core` 67,615,388 dl/wk — 1 : 819.**

And the standard it is waiting for has not arrived: **WCAG 3.0 remains a Working Draft** (latest published 2026-03-03). Its outcome-based Bronze/Silver/Gold model is directionally interesting — a scored outcome rather than a binary pass — and that grain is worth borrowing for our own report. The algorithm is not.

### AIM (Aalto Interface Metrics) — the complete implementation of the programme, and its own best refutation

`aalto-ui/aim`, MIT, Python, 64 stars, branch `aim2`. Thirty metrics, `m1`…`m30`, spanning PNG/JPEG file size as a complexity proxy, contour density, figure-ground contrast, colour harmony, colourfulness (Hasler & Süsstrunk), NIMA aesthetic prediction, colour-blindness simulation, UIED segmentation, and — the two that matter here — **`m21_grid_quality.py`** and **`m22_white_space.py`**.

`m21`'s own docstring states the mechanism plainly:

> *"Grid quality indicates the internal alignment of the various components or identifiable regions of the GUI with respect to each other. The code considers each GUI element as a visual block. … Category: Visual complexity > Information organization > Layout quality."*

and the operationalization is four ±2-pixel tolerances:

```python
_G2_PIXEL_TOLERANCE_ROW: int = 2
_G2_PIXEL_TOLERANCE_COLUMN: int = 2
_G3_PIXEL_TOLERANCE_WIDTH: int = 2
_G4_PIXEL_TOLERANCE_HEIGHT: int = 2
```

Two structural observations, and the second is the important one:

1. **AIM must reconstruct the box tree from pixels** — that is what `m24_aim_legacy_segmentation.py` and `m25_uied_segmentation.py` are for, and it is why AIM needs Chrome, Selenium and a screenshot pipeline to produce a number we would get for free. Every published "measure the UI" system pays this tax. **We do not.** A framework that owns the render already has ground-truth boxes, so the entire segmentation half of the field is inapplicable to us — both its cost and its error.
2. **AIM's outputs are scores with histograms, not verdicts.** The README's framing is *"displays a preview. As results are computed, they are presented along with detailed explanations, and histograms for comparison."* There is no pass/fail anywhere in the service, because there is no defensible threshold. That is the field's own verdict on gating aesthetics.

### Rosenholtz — clutter is real, and it measures the wrong thing for us

*Measuring visual clutter*, Rosenholtz, Li & Nakano, *Journal of Vision* 7(2):17 (2007). Two measures — **Feature Congestion** (colour, orientation, luminance contrast) and **Subband Entropy** (redundancy) — offered explicitly as *"stand-ins for set size in visual search models"*, on the argument that *"excess and/or disorganized display items can cause crowding, masking, decreased recognition performance due to occlusion, and greater difficulty at both segmenting a scene and performing visual search."*

Read the validation target carefully: these correlate with **search performance**, i.e. how long it takes to *find* something. They say nothing about whether the design is correct, whether the right thing is emphasised, or whether a user will like it. As a *density* metric this is the best-founded thing in the survey; as a *quality gate* it is a category error. Its natural home for us is a report line next to A9's data-ink ratio, not a diagnostic code.

### Reinecke et al. (CHI 2013) — the number that decides this slice

450 websites, 548 volunteers, 500 ms exposure. The intermediate models are strong and the final one is not:

- Perceived **colourfulness**: *r* = .88, ***R²* = .78** (adj. .77).
- Perceived **visual complexity**: *r* = .80, ***R²* = .65** (adj. .64).
- Perceived **visual appeal**, using both models plus demographics: *"The model accounts for 48% of the variation in aesthetic preferences (adj. R² = .48)"*.

So: a machine can tell you fairly precisely *what a page looks like* to people (complexity, colourfulness), and can then explain **under half** of whether they will like it. And two sub-findings sharpen the point for an agent-authored framework:

- **Structure metrics mostly failed.** *"Due to Zheng et al.'s work, we had additionally assumed that the spatial metrics computed with the help of the quadtree decomposition (balance, symmetry, and equilibrium) would contribute to the perception of orderliness and visual complexity. These metrics showed weak but significant correlations with the mean complexity ratings, but were ultimately pruned from the model."* Quadtree leaf count correlated **r = .28** with perceived complexity; the *space-based* decomposition (which recovers actual content regions) managed **r = .50**. Symmetry and balance — the Gestalt properties everyone assumes are the measurable core of "good layout" — did not survive backward elimination.
- **The reference class does not agree with itself.** *"the 20 Webby Award websites in our study received average ratings between 4.21 and 6.57 … A relatively high average standard deviation of 1.69 across all participants and Webby Award sites indicates a high dispersion of participants' preferences."* Restricting to US participants barely moved it (5.15–6.39, SD 1.65). The authors' own conclusion: *"aesthetic preferences at first sight differ even for supposedly well-designed websites."*

Miniukovich & De Angeli (CHI 2015) reproduce the ceiling from a different metric set — *"Our best-fit linear regression model accounted for 49% of variance in the ratings of immediate-first aesthetics"*, and only **32%** for iPhone apps even with app genre as a predictor.

**Two independent research programmes, twelve years of metric engineering, an open implementation, and the answer is ~half the variance.** That is the number to put in the ADR.

### DeepGaze IIE — where the eye goes is nearly solved; what the eye thinks is not

`arXiv:2105.12441` (Linardos, Kümmerer, Press, Bethge): *"a 15 percent point improvement over DeepGaze II to **93% on MIT1003**, marking a new state of the art on the MIT/Tuebingen Saliency Benchmark in all available metrics (AUC: 88.3%, sAUC: 79.4%, CC: 82.4%)"* — 93% of the *explainable information gain*, i.e. close to the human inter-observer ceiling.

This is genuinely relevant and genuinely narrow. It means a machine can predict, well, **where a first fixation lands on an image**. It cannot tell you whether that is the *right* place, because "right" is the product intent. The one honest use: a differential assertion of the form *"the declared primary action is among the top-k predicted fixation regions"* — a **consistency check between declaration and render**, not an aesthetic judgement. That framing is the only way saliency enters a checker without smuggling in taste. It also costs a model, which a 10KB runtime cannot host; it is tooling, not framework.

### UI-Bench (2025) — the most recent evidence, and it goes against automation

*"UI-Bench: A Benchmark for Evaluating Design Capabilities of AI Text-to-App Tools"* (`arXiv:2508.20410`): *"the first large-scale benchmark that evaluates visual excellence across competing AI text-to-app tools through **expert pairwise comparison**. Spanning 10 tools, 30 prompts, 300 generated sites, and **4,000+ expert judgments**, UI-Bench ranks systems with a TrueSkill-derived model."*

In 2025, the people with the strongest possible commercial incentive to automate "is this UI good" — the ones benchmarking AI app generators — built a **human** oracle with four thousand expert judgements and a chess-rating model. They did not use AIM, or NIMA, or a clutter metric, or a learned aesthetic predictor. That is the field voting with its budget.

### Hick's law and Fitts's law — one is a formula we should ignore, one is a floor we already ship

**Fitts** survives, but only in its operationalized form. Nobody ships `MT = a + b·log₂(2D/W)`; what ships is the target-size floor, and W3C already did the operationalizing for us (2.5.5 / 2.5.8). Our N650 is Fitts's law, correctly reduced to a constant.

**Hick does not survive.** Liu, Gori, Rioul, Beaudouin-Lafon & Guiard, *How Relevant is Hick's Law for HCI?* (CHI 2020), is the definitive review, and it is brutal in four directions:

- *"(1) Hick's law speaks against, not for, the popular principle that 'less is better'"*.
- The measured effect in real interfaces is negligible: reanalysing two command-selection studies, *"The slope of Hick's law is very small: 32ms/bit in the Glass condition, 8ms/bit in the Glass+Skin condition and 4ms/bit for command selection"*, against Hick's own ~200 ms/bit — because *"every HCI task has an extremely good S-R compatibility"*, and *"In practice, reaction time RT can usually be treated as a constant."*
- The 32-item worked example shows the design principle inverts: putting all items on one page costs `a + 5b`, splitting into 4 uncategorised pages costs `2.5a + 7.5b`, and splitting into 4 *categorised* pages costs `2a + 5b` — strictly worse than showing everything. *"the optimal strategy according to Hick's law consists of displaying all the items at once on the same page, contrary to the design principle that choices should be categorized."*
- *"logarithmic growth of observed temporal data is not necessarily interpretable in terms of Hick's law"* — the log curves people cite in menu studies come from visual search and divide-and-conquer, not from choice-reaction time.

Their constructive replacement is a convexity argument, and it is the part worth keeping: **if response latency is convex in item count, group; if concave, show everything.** That is a statement about the *content*, not about the UI, and it is therefore not something the framework can decide. Encoding "warn when a container has more than N children" would be worse than useless: it would be a confident, cited, wrong rule.

### Typography — one rule with a number, and a lot of folklore

Butterick, *Practical Typography*, "line length", verbatim: *"Aim for an average line length of **45–90 characters**, including spaces"*, with the memorable field test *"You should be able to fit between two and three alphabets on a line"*, and the aside that matters for us: *"The major flaw in many responsive web layouts? Insufficient attention to line length."*

Three honest caveats before this becomes a check:

1. **The number is not agreed.** Butterick says 45–90; the equally-cited Bringhurst figure is 45–75; the frequently-repeated "66 characters is ideal" is a *preference* in Bringhurst, not a finding. A checker that fails at 78 characters is enforcing one book over another.
2. **The empirical literature does not support a narrow optimum.** Reading-speed studies have repeatedly found longer measures to be *faster* while being *preferred less*. Calling this a rule overstates it. `[UNVERIFIED — I did not obtain the primary reading-rate studies within this pass; treat the direction, not the magnitude, as established.]`
3. **It only applies to prose.** Applying a measure bound to labels, table cells or nav items produces noise — which is exactly why it needs a `data-text="body"` declaration to be safe. That is another declaration-enabled check: the rule is not *"lines are 45–90 chars"*, it is *"lines **of declared prose** are 45–90 chars"*, and the second is the only one a machine can apply without false positives.

**The one number here that is actually normative is not Butterick's.** WCAG 1.4.8 (AAA) states: *"Width is no more than 80 characters or glyphs (40 if CJK)."* That is a W3C upper bound on measure, it sits inside Butterick's 45–90, and it is citable in a way no typography book is. Prefer it.

But read 1.4.8 carefully, because it is a trap that also corrects one of our own candidate rules. Its stem is *"a mechanism is available to achieve the following"*, and its note is explicit: *"Content is not required to use these values. The requirement is that a mechanism is available for users to change these presentation aspects. The mechanism can be provided by the browser or other user agent."* So 1.4.8's other bullet — *"Line spacing (leading) is at least space-and-a-half within paragraphs"* — **is not an author obligation to set `line-height: 1.5`**. It is a user-adjustability requirement, and on the web the browser already satisfies it. A checker that failed a design for having 1.4 line-height would be inventing a rule and citing a standard that does not say it. The author-side line-height number exists only in 1.4.12, and only as a *stress test*: the design must not break **when the user applies 1.5**.

The remaining defensible typographic numbers are all WCAG's, not the typographers': 0.12× tracking, 0.16× word spacing, 2× paragraph spacing, 1.5× line height *as a perturbation* (1.4.12), 200% zoom (1.4.4), ≤80 characters (1.4.8). Modular scale ratios, optical vs metric alignment and optical kerning have **no numeric bound in any primary source located in this pass** — they are craft, and they belong in the resolution table as authored taste, not in the checker.

### Tufte and Simon — doctrine, correctly classified

Tufte's **data-ink ratio** (*The Visual Display of Quantitative Information*, 1983) is `data-ink ÷ total ink used to print the graphic`. It is the only classic aesthetic metric that our substrate makes **exactly computable** — in a declaration-only world every node is either declared content (`data-text`) or declared chrome, so the ratio is a count, not an estimate. Nobody else can compute it on a real UI, because nobody else knows which pixels are data. That makes it a genuinely novel *metric*. It does not make it a *rule*: Tufte's own prescription ("maximise") is contested even in charts, has no established optimum for interfaces, and has no published validation against user outcomes that I could find.

Simon's formulation is the framing for the whole slice and should be quoted, not operationalized: *"In an information-rich world, the wealth of information means a dearth of something else: a scarcity of whatever it is that information consumes. What information consumes is rather obvious: it consumes the attention of its recipients. Hence a wealth of information creates a poverty of attention"* — *Designing Organizations for an Information-Rich World*, in Greenberger (ed.), *Computers, Communication, and the Public Interest*, Johns Hopkins Press, 1971, pp. 40–41. `[The primary PDF is a scan with no text layer; the transcription above is corroborated across multiple independent sources but I could not extract it from the scan itself.]`

**Sweller's cognitive load theory** belongs in the same box. It has an extensive experimental literature, but its operationalizations are *instructional* (worked examples, split attention, redundancy in learning materials) and its measurements are subjective rating scales and dual-task probes — not properties of a rendered tree. There is no published UI-level cognitive-load metric computable from a layout. Treat it as vocabulary for the docs, never as a check.

---
## Ideas worth stealing

1. **The one-primary-action rule, lifted verbatim from GNOME and made enforceable.** *"Each view should only ever include a single button using either the suggested or destructive styles."* GNOME can write this rule but can only enforce it socially; a framework that owns `data-role` and the tree enforces it in one pass. **Why it applies here:** it is the smallest possible demonstration that a declaration converts a *style guideline* into a *compile error*, and it is a rule every designer already agrees with, so it costs no persuasion. Ship it first; it is the README example.

2. **Sibling-relational geometry, taken from WCAG 2.5.8's spacing exception.** The 24px-circle clause is not a per-element threshold — it is a predicate over *pairs of siblings*. This is the exact shape the scratchpad identifies as CSS's blind spot (*"CSS decides one element at a time and never knows what its siblings need"*), written into a W3C Recommendation. **Why it applies:** it is free for us (we already build the box tree for N670) and it is a normative, citable rule, which answers §7.10's "what is the regime?" — conformance is the regime, and it is the same regime that took axe-core to 67.6M/wk.

3. **The stress-test pattern, taken from WCAG 1.4.12 and 1.4.4.** Both criteria are of the form *"apply this perturbation, then assert nothing was lost."* They need no new predicate — they reuse whatever overflow/crush/shred rules already exist. **Why it applies:** we already have a 240-cell context matrix (4 pages × 3 densities × 2 inputs × 2 themes × 5 widths). Adding *text-spacing* and *200% zoom* as two more axes multiplies coverage for the cost of two CSS overrides, and turns two AA criteria from "GAP" to "HAVE" without writing a single new rule.

4. **Three-valued verdicts, confirmed by the largest deployment in existence.** axe-core's `incomplete` and our N680 are the same invention. **Why it applies:** it is independent confirmation that our round-8 cost signal (five oracle bugs to four page bugs) is not a sign of a bad checker but of the only honest design. State the convergence in the ADR; it converts a weakness into a citation.

5. **Named-intent style classes, from libadwaita.** `suggested-action`, `destructive-action`, `pill`, `circular` — a tiny, closed, *semantic* set that the HIG then reasons over. **Why it applies:** it is direct prior art for the C10 vocabulary at platform scale, and it validates the sizing (four button intents, not forty). It also shows the shape of the escape: GNOME says *"It is also possible to create custom button styles"* and immediately loses the ability to state any rule about them — which is our `data-escaped` argument, already demonstrated by someone else.

6. **The ±2 pixel alignment tolerance, from `m21_grid_quality.py`.** If we ever report alignment, this is the published constant, from Miniukovich & De Angeli via a runnable MIT implementation. **Why it applies:** "misalignment" is scratchpad §3 bug class 2 and we have no rule for it. A *report* of alignment-point count at ±2px is defensible; a *gate* is not, and the same source tells us which.

7. **Segmentation is a tax we do not pay — say so out loud.** Every published system in this field (AIM, UIED, Rico-derived work, every screenshot-based aesthetic model) spends most of its engineering recovering a box tree from pixels, and inherits that recovery's error. **Why it applies:** this is a concrete, citable moat claim for the ADR. It is not "we have a better metric"; it is *"the entire measurement literature is downstream of a reconstruction step that a framework owning the render simply does not have."* That reframes our 240-cell matrix from "a test harness" to "ground truth the research field cannot obtain."

8. **Score-with-histogram instead of pass/fail, from AIM; and outcome-scoring from WCAG 3.** For the metrics that are real but thresholdless (clutter, whitespace, alignment, data-ink), AIM's answer is a distribution and a comparison, not a verdict. **Why it applies:** it gives us a second, non-gating output channel — call it a *density report* — so genuinely-interesting-but-unprovable numbers have somewhere to live that is not a diagnostic code. This is how we let the maintainer's attention thesis be *visible* without letting it become a false gate.

9. **A9's data-ink ratio, as the one metric only we can compute.** In a declaration-only tree, `declared-content nodes ÷ all painted nodes` is exact. **Why it applies:** it is a genuinely novel measurement — not because the idea is new (1983) but because the *substrate* that makes it computable is. It belongs in the density report of idea 8, and it is a strong demo artefact: "this dashboard spends 31% of its ink on data."

10. **The convexity replacement for Hick, from Liu et al.** *"If items are not categorized and f is convex … then grouping items will reduce RL. If f is concave … it is better to display all items at once."* **Why it applies:** it is the correct thing to put in the *docs* where a lesser framework would put "Hick's law says fewer choices". It teaches the agent the real tradeoff and explicitly refuses to make it a check — which is itself the discipline this whole slice is arguing for.

11. **Saliency as a *consistency* check, not a quality check.** Frame it strictly as: *does the declared primary action land in the top-k predicted fixation region?* **Why it applies:** it converts the only high-accuracy model in the field (DeepGaze IIE, 93%) from an aesthetic oracle (which it is not) into a declaration-vs-render agreement test (which it can be). Tooling only — it cannot live in a 10KB runtime.

12. **`requires-2d` as a declared exception, from WCAG 1.4.10's own carve-out.** The spec exempts *"images required for understanding (such as maps and diagrams), video, games, presentations, data tables (not individual cells)"*. **Why it applies:** every other tool must guess. We can require the author to say it — and the declaration then *also* tells the fit solver not to try, and tells the density report to exclude the subtree. One declaration, three consumers. That is the pattern the whole package is built on.

---

## Where the prior art says we are wrong

1. **Hick's law — the most attractive check in this slice — is invalid, and building it would be an own goal.** The task brief asks whether Hick's law can be checked from a declared vocabulary, noting "we literally know the number of choices in a container". We do, and we must not. Liu et al. (CHI 2020) demonstrate mathematically that Hick's law, taken seriously, **recommends the opposite of the design principle attributed to it**: for 32 items, one page costs `a + 5b`, four categorised pages cost `2a + 5b`, four uncategorised pages cost `2.5a + 7.5b`. Their conclusion: *"the optimal strategy according to Hick's law consists of displaying all the items at once on the same page, contrary to the design principle that choices should be categorized. Hence, the design principle cannot be justified by Hick's law, nor by any other logarithmic RL function."* And the effect size in real interfaces is 4–32 ms/bit — indistinguishable from zero. A framework that shipped `warn: too many choices in this container` would be shipping a **confident, cited, backwards rule**, which is strictly worse than shipping nothing.

2. **"Attention" is not measurable at the fidelity the thesis implies — and the ceiling is ~48%.** The maintainer's new axis is that `@nisli/next` should let agents *reason about* attention, hierarchy, density and salience. The evidence says reasoning about *hierarchy* is fine (it is declared) and reasoning about *attention* is not (it is not measurable). Reinecke et al.: adj. *R²* = **.48** for appeal, and that number **includes demographic predictors** — age and education interacted significantly with complexity and colourfulness, meaning *there is no single audience to optimise for*. Miniukovich & De Angeli independently: **49%** for webpages, **32%** for apps. Symmetry, balance and equilibrium — the Gestalt properties a designer would nominate first — were **pruned from the model** in Reinecke's backward elimination. Twelve years, two labs, an MIT-licensed implementation of thirty metrics, and half the variance is unexplained. **If the package's pitch is "an agent can reason about attention", it is overclaiming by roughly a factor of two.** The defensible pitch is narrower and still large: *an agent can reason about declared hierarchy, and the framework can prove the render is consistent with it.*

3. **Even the ground truth disagrees with itself, which forecloses "just train on good designs".** Reinecke's Webby Award subset — the canonical "these are good" reference class, used as best-practice examples by three prior papers she cites — was rated **4.21 to 6.57** with an average **SD of 1.69** on a 9-point scale, barely above the 4.73 overall mean. Her verdict: *"aesthetic preferences at first sight differ even for supposedly well-designed websites."* This kills the obvious escape route (train a model on award winners / shadcn / Linear / Stripe and use it as the oracle). **There is no consistent label.** It also makes the scratchpad's own risk #2 — *"the defaults must be genuinely beautiful"* — permanently a human's job, and permanently unverifiable. That should be stated in the ADR as a known, accepted, unclosable gap rather than a future work item.

4. **The most recent and most relevant benchmark chose humans over metrics, in 2025.** UI-Bench evaluates exactly our target population (AI text-to-app tools) on exactly our target property (visual excellence) — with **4,000+ expert pairwise judgements** and a TrueSkill model. If a computational aesthetic oracle were viable at benchmark quality, this is the team and the year that would have used one. They did not. Any roadmap item of the form "and then the framework scores the design" is arguing against the most recent evidence available.

5. **Our tap-target rule is calibrated to the wrong criterion, and our contrast rule is one standard behind — in opposite directions.** N650 enforces a 44px floor. That is WCAG **2.5.5 (AAA)**; the AA requirement is **24×24** *with a spacing exception we do not implement*. So we are simultaneously **stricter than required on size** (which will produce failures on legitimate dense UI — and dense mode is precisely where F9 already bit us) and **missing the relational rule that would actually catch the real defect** (crowded small targets, which the 24px-circle clause is designed for). Meanwhile N640 uses WCAG 2.x ratios, which APCA's authors argue are perceptually wrong — but APCA is licence-blocked, so that is a gap we must knowingly keep. **Both are calibration bugs in a checker we currently describe as clean at 240/240**; a matrix passing does not mean the thresholds are right.

6. **A "density" axis with numeric thresholds has no support in the literature, and the platform HIGs deliberately avoid one.** The AIM implementation exposes white space as *"The proportion of white space (float, [0, 1])"* and offers a histogram, not a bound. GNOME's HIG — a heavily-designed, 25-year-old platform guideline — states zero numeric density rules; its strongest quantitative statement is *"Do not use more than one or two different widths of button in the same window."* Rosenholtz's clutter measures are validated against *search time*, not quality. **Every serious source declines to threshold density.** Our `data-density` axis is fine as an *input* (it selects a row of the resolution table) and indefensible as a *judgement* (there is no rule that says this page is too dense). Do not let the attention framing turn a context axis into a quality gate.

7. **The typographic "rules with numbers" are weaker than they look.** Butterick says 45–90 characters; Bringhurst's widely-quoted figure is 45–75; the "66 characters" everyone repeats is a preference, not a measurement. The measure bound also only means anything for declared prose. Beyond measure, the classic craft rules — modular scale ratios, optical vs metric alignment, optical kerning — **carry no numeric bound in any primary source located in this pass**. They are authored taste and belong in the resolution table, not in a diagnostic code. Shipping a "typography linter" beyond WCAG's four spacing numbers would be shipping folklore with a citation.

8. **The checker's own truthfulness is the cost centre, and this survey adds rules faster than it adds confidence.** Round 8 recorded five oracle bugs to four page bugs, and the principle *"a check must measure the box its claim is about."* This document proposes ten new rules. On the observed ratio that implies roughly a dozen more oracle bugs to find. **The correct sequencing conclusion is therefore the opposite of "implement the table":** implement Block A first — the declaration-only rules — because they are the ones that *cannot* measure the wrong box. A1, A3, A4, A7 and A12 involve no geometry at all and so are immune to the entire defect class that has dominated our cost so far.

---

## Open questions for the maintainer

1. **Do we retarget N650 from 44px (AAA) to 24px + spacing (AA), or keep both?** *Tradeoff:* the AAA floor is a genuinely better touch experience and is what `--min-target` encodes today, but it will reject legitimate dense desktop UI — and F9 already showed dense mode is our fragile context. The AA form is relational, catches crowding that the AAA form misses, and is what conformance actually requires. Keeping both means two codes and a policy for which applies per context. My reading: **make 24px+spacing the universal floor (fail), and 44px the touch-context floor (fail only when `data-input="touch"`)** — but this is a product call about who we reject.

2. **Does the density report ship, and is it in the framework or the tooling?** *Tradeoff:* a non-gating report (data-ink ratio, alignment points at ±2px, whitespace proportion, clutter) is the only honest home for the attention thesis, and it is the artefact that makes the pitch *visible*. But a number with no threshold invites exactly the rubber-stamping failure recorded against screenshot baselines, and every metric in it needs pixels, so it cannot be in the 10KB core. If it lives only in tooling, does it still carry the story?

3. **How much WCAG do we claim?** *Tradeoff:* claiming conformance checking gives us axe-core's regime — legal obligation is the only force that has ever made anyone run a visual checker (§7.10), and it is the strongest adoption lever in this document. But it also puts us in a category with a 57% published ceiling, a mature 67.6M/wk incumbent, and a real support burden. The alternative is to use the criteria silently as *sources of good rules* and never say the word conformance. These produce very different README first paragraphs.

4. **Is A8 (emphasis monotonicity) real, or am I inventing a rule?** *Tradeoff:* I found **no prior art** implementing "declared emphasis order must map to non-increasing resolved salience". That is either a genuine gap only a resolution table can fill — the table is the only artefact where emphasis order and pixel salience coexist — or it is a rule nobody wants because real designs legitimately violate it (a quiet destructive action deliberately outranks a loud tertiary one). Deciding needs a designer looking at the table, not a researcher.

5. **Do we let saliency in at all?** *Tradeoff:* framed as a declaration-vs-render consistency check it is defensible and uses the field's one high-accuracy model (93%). But it imports a neural network into our tooling, makes results machine-dependent, and — most dangerously — is the single easiest thing for a reader to mistake for "the framework judges beauty". The reputational risk of that misreading may exceed the value.

6. **Does the ADR state the ~48% ceiling explicitly?** *Tradeoff:* publishing the number that says "aesthetics is not computable" inside the document arguing for an appearance framework looks like an own goal, and a competitor will quote it. Not publishing it leaves the project's central claim ungrounded and invites the same discovery later, by someone less friendly. My recommendation is to publish it and reframe around it — *consistency is derivable, beauty is authored* is already the project's own round-5 language — but it is the maintainer's call how loudly.

7. **Does `requires-2d` (A12) enter the vocabulary?** *Tradeoff:* it is one more entry against §7.13's ~30-entry budget, and it is a declaration about *content semantics* rather than appearance, which slightly widens the vocabulary's remit. Against that, it has three consumers (the 1.4.10 check, the fit solver, the density report) and it is the only way our reflow check becomes fully sound rather than approximately sound.

---

## Sources

### Standards (primary, normative)

- WCAG 2.2, W3C Recommendation 2024-12-12 — <https://www.w3.org/TR/2024/REC-WCAG22-20241212/>
- `w3c/wcag` `guidelines/sc/20/contrast-minimum.html` (1.4.3) — <https://raw.githubusercontent.com/w3c/wcag/main/guidelines/sc/20/contrast-minimum.html>
- `w3c/wcag` `guidelines/sc/20/resize-text.html` (1.4.4) — <https://raw.githubusercontent.com/w3c/wcag/main/guidelines/sc/20/resize-text.html>
- `w3c/wcag` `guidelines/sc/20/visual-presentation.html` (1.4.8 — ≤80 characters; and the "a mechanism is available" stem that makes its line-spacing bullet *not* an author rule) — <https://raw.githubusercontent.com/w3c/wcag/main/guidelines/sc/20/visual-presentation.html>
- `w3c/wcag` `guidelines/sc/21/reflow.html` (1.4.10) — <https://raw.githubusercontent.com/w3c/wcag/main/guidelines/sc/21/reflow.html>
- `w3c/wcag` `guidelines/sc/21/non-text-contrast.html` (1.4.11) — <https://raw.githubusercontent.com/w3c/wcag/main/guidelines/sc/21/non-text-contrast.html>
- `w3c/wcag` `guidelines/sc/21/text-spacing.html` (1.4.12) — <https://raw.githubusercontent.com/w3c/wcag/main/guidelines/sc/21/text-spacing.html>
- `w3c/wcag` `guidelines/sc/21/content-on-hover-or-focus.html` (1.4.13) — <https://raw.githubusercontent.com/w3c/wcag/main/guidelines/sc/21/content-on-hover-or-focus.html>
- `w3c/wcag` `guidelines/sc/21/target-size-enhanced.html` (2.5.5, 44×44) — <https://raw.githubusercontent.com/w3c/wcag/main/guidelines/sc/21/target-size-enhanced.html>
- `w3c/wcag` `guidelines/sc/22/target-size-minimum.html` (2.5.8, 24×24 + spacing) — <https://raw.githubusercontent.com/w3c/wcag/main/guidelines/sc/22/target-size-minimum.html>
- `w3c/wcag` `guidelines/sc/22/focus-not-obscured-minimum.html` (2.4.11) — <https://raw.githubusercontent.com/w3c/wcag/main/guidelines/sc/22/focus-not-obscured-minimum.html>
- `w3c/wcag` `guidelines/sc/22/focus-appearance.html` (2.4.13) — <https://raw.githubusercontent.com/w3c/wcag/main/guidelines/sc/22/focus-appearance.html>
- WCAG 3.0, W3C Working Draft 2026-03-03 — <https://www.w3.org/TR/2026/WD-wcag-3.0-20260303/>

### Implementations and their adoption

- `dequelabs/axe-core` README, "on average 57% of WCAG issues automatically" — <https://raw.githubusercontent.com/dequelabs/axe-core/develop/README.md>
- axe-core npm downloads, 67,615,388 for 2026-08-18 → 2026-08-24 — <https://api.npmjs.org/downloads/point/last-week/axe-core>
- `apca-w3` npm downloads, 82,583 for the same week — <https://api.npmjs.org/downloads/point/last-week/apca-w3>
- `Myndex/SAPC-APCA` `LICENSE.md` (patent pending, non-commercial, right-to-audit, revocation) — <https://raw.githubusercontent.com/Myndex/SAPC-APCA/master/LICENSE.md>
- `Myndex/SAPC-APCA` repository (580 stars) — <https://github.com/Myndex/SAPC-APCA>
- `aalto-ui/aim` (AIM, MIT, 64 stars, branch `aim2`) — <https://github.com/aalto-ui/aim>
- AIM `backend/aim/metrics/m21/m21_grid_quality.py` (grid quality, ±2px tolerances) — <https://raw.githubusercontent.com/aalto-ui/aim/aim2/backend/aim/metrics/m21/m21_grid_quality.py>
- AIM `backend/aim/metrics/m22/m22_white_space.py` (white space, float 0–1) — <https://raw.githubusercontent.com/aalto-ui/aim/aim2/backend/aim/metrics/m22/m22_white_space.py>
- `MulongXie/UIED` (551 stars, 258 commits) — <https://github.com/MulongXie/UIED>

### Design guidelines (primary)

- GNOME Human Interface Guidelines, Buttons — one-primary-per-view, button-width rule, icon-or-label rule, insensitive-not-error rule — <https://developer.gnome.org/hig/patterns/controls/buttons.html>
- libadwaita style classes (`suggested-action`, `destructive-action`, `pill`, `circular`) — <https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/style-classes.html#buttons>
- Material Web, button documentation (five common button types as an emphasis ladder) — <https://raw.githubusercontent.com/material-components/material-web/main/docs/components/button.md>
- Butterick, *Practical Typography*, "Line length" (45–90 characters, 2–3 alphabets) — <https://practicaltypography.com/line-length.html>

### Research (primary)

- Reinecke, Yeh, Miratrix, Mardiko, Zhao, Liu & Gajos, *Predicting Users' First Impressions of Website Aesthetics with a Quantification of Perceived Visual Complexity and Colorfulness*, CHI 2013 — R² .78 / .65 / adj. .48; Webby dispersion 4.21–6.57, SD 1.69 — <https://iis.seas.harvard.edu/papers/2013/reinecke13aesthetics.pdf> · DOI 10.1145/2470654.2481281
- Miniukovich & De Angeli, *Computation of Interface Aesthetics*, CHI 2015 — 49% webpage / 32% app variance; source of grid quality and white space — DOI 10.1145/2702123.2702575
- Rosenholtz, Li & Nakano, *Measuring visual clutter*, Journal of Vision 7(2):17 (2007) — Feature Congestion, Subband Entropy — DOI 10.1167/7.2.17 · <https://jov.arvojournals.org/article.aspx?articleid=2122001>
- Liu, Gori, Rioul, Beaudouin-Lafon & Guiard, *How Relevant is Hick's Law for HCI?*, CHI 2020 — 32/8/4 ms/bit; the 32-item counter-example; convexity replacement — <https://perso.telecom-paristech.fr/rioul/publis/202001liugoririoulbeaudouinlafonguiard.pdf> · DOI 10.1145/3313831.3376878
- Linardos, Kümmerer, Press & Bethge, *DeepGaze IIE*, 2021 — 93% on MIT1003; AUC 88.3% — <https://arxiv.org/abs/2105.12441>
- Jung, Garcinuno & Mateega, *UI-Bench: A Benchmark for Evaluating Design Capabilities of AI Text-to-App Tools*, 2025 — 4,000+ expert pairwise judgements, TrueSkill — <https://arxiv.org/abs/2508.20410>
- Simon, *Designing Organizations for an Information-Rich World*, in Greenberger (ed.), *Computers, Communication, and the Public Interest*, Johns Hopkins Press, 1971, pp. 40–41 — scanned PDF, no text layer — <https://veryinteractive.net/pdfs/simon_designing-organizations-for-an-information-rich-world.pdf>
- Tufte, *The Visual Display of Quantitative Information*, Graphics Press, 1983 — data-ink ratio (book; not machine-readable, cited from the standard definition)

### In-house (read-only, for the "our current status" column)

- `experiments/c11-appearance/src/appearance/diagnostics/codes.ts` — the live registry: N601, N610, N620, N621, N630, N640, N650, N660, N670, N680, N690
- `experiments/c11-appearance/README.md` — the seven proof assertion paths (`declared`, `fit`, `afford`, `crush`, `overlap`, `document`, `check`); F1–F11
- `docs/research/nextgen/NEXTGEN-SCRATCHPAD.md` — §3 bug classes, §5.4 weighting, §7.10 regime, §7.13 vocabulary, §7.20 art direction, §7.21 table consistency, §8 rounds 5–8

---

## Belongs to another slice

- **The `incomplete`/three-valued verdict grain and the "checker's own truthfulness" cost model** are treated here only as far as they bear on rule selection; the full oracle-design argument is verification-domain territory.
- **The `data-role` / `data-appearance` vocabulary sizing** (how many roles, whether `requires-2d` fits the ~30-entry budget) is the semantic-vocabulary slice's call; this document only shows which *checks* each declaration would unlock.
- **Container-query and constraint-solving mechanics** for the fit tier are the constraint-layout slice's; nothing here depends on how the solver works, only on what it declares.
- **The `escapes` / `escapedProps` manifest field** (idea 6, A6) touches the ADR 0029 registry manifest, which is not this slice's artefact.
