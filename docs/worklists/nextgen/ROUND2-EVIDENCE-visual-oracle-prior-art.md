# Round-2 Evidence B — Visual-Oracle Prior Art (external)

**Date**: 2026-08-25 · **Kind**: evidence artifact, captured verbatim
**Feeds**: [`NEXTGEN-SCRATCHPAD.md`](./NEXTGEN-SCRATCHPAD.md) §5.1, §6, §7
**Scope**: relational / spec-based layout assertion tools, textual layout
baselines (incl. browser-engine layout-tree dumps), Playwright ariaSnapshot as
format precedent, and the 2026 state of vision-model geometry measurement.

Findings are captured as produced. Rulings on them belong in the scratchpad.

---

# Round‑2 Evidence: External Prior Art for the Visual Oracle Bet

## 1. Prior‑art tables

### Mechanism 1 — relational / spec‑based layout assertions

| project | what it asserts / emits | status + evidence | why it stalled or won |
|---|---|---|---|
| **Galen Framework** (`.gspec`) | Relational specs over Selenium‑resolved boxes: `inside`, `near`, `above/below/left-of/right-of`, `aligned`, `centered`, `width/height` (incl. `100% of screen/width`), `contains`, `count`, `color-scheme`, `text`, `css`, `image`, `ocr`. Every geometric spec extends `SpecObjectWithErrorRate` (integer px tolerance). Responsive via `@on desktop/mobile` tag sections. | Last master commit **2019‑03‑10** (`6c7dc1f1`, "[maven-release-plugin] prepare for next development iteration"); last repo push 2022‑07‑15 (dependabot only); **not** archived; 173 open issues; npm `galenframework-cli` 2.4.4-build43 published 2022‑05‑20, **29 downloads/week**. Author Ivan Shubin's active repos are `schemio` (pushed 2026‑08‑23) — no Galen work. https://github.com/galenframework/galen | **No recorded maintainer statement exists.** No archive notice, no post‑mortem issue, no blog post. Abandonment by silence: author moved to an unrelated project. Do **not** claim we know why it died. |
| **galen-ts** (2026 revival) | Full `.gspec` language on Playwright/TypeScript; "All spec types: width, height, above, below, inside, near, aligned, centered, text, css, image, count, component"; 491 tests passing. Announced on the original tracker. | Announced **2026‑04‑06** (galenframework/galen#669); repo `kushneryk/galen-ts` **2 stars**, last push 2026‑04‑15; npm `galen-ts@0.1.3` **0 downloads last week**. | **The cleanest natural experiment in this whole review.** Every stated reason Galen died ("hasn't been updated since 2017", "Selenium is being replaced by Playwright", "npm install instead of Java setup") was fixed. Adoption: zero. The mechanism is not gated on stack modernity. |
| **cypress-layout-inspector** | `should("be.rightOf", …)`, `be.leftOf` etc., over `getBoundingClientRect()`. | v1.7.0 published 2022‑12‑05, **260 downloads/week**; repo last push 2023‑07‑18, 14 stars. | Micro‑library, no state enumeration, no diagnostics. Same fate as Galen at 1/1000 the scale. |
| **axe-core `target-size` / `target-offset`** | **The relational geometry oracle that won.** `targetSizeEvaluate` computes `vNode.boundingClientRect`, `findNearbyElms`, `hasVisualOverlap`, `splitRects`, `getLargestUnobscuredArea`, min 24 CSS px; returns `true` / `false` / **`undefined`** with `messageKey` ∈ `large`, `contentOverflow`, `obscured`, `tooManyRects`. Plus `color-contrast`. | `axe-core` **66,526,881 downloads/week**; `@axe-core/playwright` 8,932,308/wk; `@storybook/addon-a11y` 10,483,865/wk. https://github.com/dequelabs/axe-core/blob/develop/lib/checks/mobile/target-size-evaluate.js | **Won because it rode a conformance regime (WCAG 2.2 SC 2.5.8), not a "visual testing" value prop — and because it needs zero per‑component authoring.** Universal rules, not specs you write. |
| **Applitools Layout match level** | Image‑derived structural comparison: identifies elements in checkpoint and baseline images and verifies relative positions are consistent; ignores text content, graphics, colors. Detects elements appeared / disappeared / moved. | `@applitools/eyes-playwright` 1.48.3 published 2026‑08‑23, 66,060/wk; `@applitools/dom-snapshot` 217,940/wk. https://applitools.com/docs/eyes/concepts/best-practices/match-levels | Won commercially. Note: assertion is **baseline‑relative, not spec‑relative** — there is no DSL to author, which is exactly the Galen tax it avoids. |
| **Percy** | `@percy/dom`: "Serializes a document's DOM into a DOM string suitable for re-rendering" (+ CSSOM rules, canvas, video, frames); cloud re‑render; pixel diff; **human approval**. | `@percy/cli` 1.32.7 published 2026‑08‑20, 476,503/wk; `percy/cli` pushed 2026‑08‑25. | Won as a product. The oracle is a person; the machine only proposes. |
| **Chromatic** | Pixel diff + human approve; TurboSnap change detection; **accessibility snapshots diffed against baseline** (non‑pixel structured diff). | `chromatic` 18.5.0 published 2026‑08‑19, **8,826,253/wk**. https://www.chromatic.com/docs/snapshots | Won on distribution (Storybook) + review workflow. Its docs sidebar is a taxonomy of flakiness mitigations: Animations, Font loading, Resource loading, Delay, Position sticky, Unstable tests, Flake filter, Ignore elements, Threshold, Page Shift Detection. |
| **BackstopJS** | Resemble.js pixel diff; `misMatchThreshold` (default **0.1%**), `requireSameDimensions` (default true), `ignoreAntialiasing`, `usePreciseMatching`; "Integrated Docker rendering — to eliminate cross-platform rendering shenanigans". | Last release **6.3.25, 2024‑09‑07**; repo pushed 2024‑09‑07, not archived, **578 open issues**; 82,162/wk. https://github.com/garris/BackstopJS | Maintenance‑mode drift. **No maintainer abandonment statement found** — searched the tracker; nothing. |
| **jest-image-snapshot** | Jest matcher, pixel diff. | 6.5.2 published 2026‑03‑09, **941,963/wk**; repo pushed 2026‑08‑05. | Alive. But it is a matcher, not a loop — it has no opinion about what "right" means. |
| **Gemini** (Yandex) | Screenshot diff. | **`"archived": true`**, description **"💀💀💀[DEPRECATED] Use hermione"**, last push 2021‑05‑20, 1506 stars, npm 2,428/wk (last publish 2019‑11‑25). | Superseded, not abandoned — the only project here with an explicit recorded death notice. |
| **hermione → Testplane** | `assertView` screenshot diff; "Visual Testing Redefined… let Testplane tackle flakiness". | `testplane@9.1.1` published 2026‑08‑21, 12,793/wk. README: renamed from Hermione due to "copyright and trademark issues", not technical failure. | Alive, still image‑based. |
| **Vitest browser `toMatchScreenshot`** | pixelmatch; `threshold`, `allowedMismatchedPixelRatio`; baselines named `test-name-{browser}-{platform}.png`. | `@vitest/browser` 4.1.11 published 2026‑08‑18, **9,713,847/wk**. https://main.vitest.dev/guide/browser/visual-regression-testing | **The newest visual‑testing API in the ecosystem (2026) is still image diffing.** Won by bundling. |
| **CSS / layout linters** | — | `stylelint` 10,731,598/wk but has no rendered‑geometry rules. | **No evidence found** of a mainstream linter that asserts over resolved layout geometry. The category is empty, not merely small. |

### Mechanism 2 — textual, diffable UI snapshots

| project | what it emits | status + evidence | why it stalled or won |
|---|---|---|---|
| **Playwright `ariaSnapshot` / `toMatchAriaSnapshot`** | YAML a11y tree: `- role "name" [attribute=value]`, `/url`, `/children: contain\|equal\|deep-equal`, regex names. Matching is case‑sensitive, whitespace‑collapsing, order‑sensitive, **partial by default**. | Introduced **v1.49, 2024‑11‑18**. `packages/isomorphic/ariaSnapshotRenderer.ts`. | **Won.** It became the agent‑facing page representation. Two design choices did it: partial‑match default (`containerMode` = `contain`) and a codegen/`--update-snapshots` authoring path. |
| **Playwright `[box=x,y,width,height]`** | Appends each element's bounding box to the snapshot key. `Math.round` of `getBoundingClientRect`, viewport‑relative CSS px. Release note: **"useful for AI consumption."** | Shipped **v1.60, 2026‑05‑11**. Exposed as `--snapshot-boxes` (MCP CLI), `snapshot.boxes` config, `boxes: true` on `page/locator.ariaSnapshot()`. **Off by default.** | **The single most important finding: geometry is emitted but not assertable.** `matchesNode()` compares role, checked, disabled, expanded, invalid, level, pressed, selected, name, `/url` — **and no box**. `AriaTemplateRoleNode` has no box field. Playwright gives agents eyes; it does not give them a contract. |
| **Playwright MCP `browser_verify_*`** | The complete agent‑facing assertion vocabulary: `browser_verify_element_visible` (role + accessible name), `browser_verify_text_visible`, `browser_verify_list_visible`, `browser_verify_value`. | `packages/playwright-core/src/tools/backend/verify.ts` @ 1.63.0-next. | **Entirely semantic. Zero geometry, zero appearance, zero color.** This is the gap, stated by the incumbent's own tool surface. |
| **Chrome DevTools MCP `take_snapshot`** | "Take a text snapshot of the target page based on the a11y tree… Prefer taking a snapshot over taking a screenshot." **No geometry.** `click_at(x,y)` exists only behind `--experimentalVision=true`. | Repo pushed 2026‑08‑25, 49,670 stars. https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md | Same conclusion from the other vendor: the agent's canonical page view is semantic text, and geometry is an experimental afterthought. |
| **CDP `DOMSnapshot.captureSnapshot`** | The geometry/style snapshot API **that already exists**: flattened DOM + `LayoutTreeSnapshot` + whitelisted computed styles + post‑layout `InlineTextBox`es + `includeDOMRects` (offset/client/scroll rects) + `includePaintOrder` + `includeBlendedBackgroundColors` + `includeTextColorOpacities`, all string‑interned. | Still marked **Experimental**. https://chromedevtools.github.io/devtools-protocol/tot/DOMSnapshot/ | **Nobody built a testing loop on it in ~8 years.** It is a data API with no canonical serialization, no normalization discipline, and no diff semantics. The hard 60% of C3's plumbing is already shipped; the unbuilt part is precisely format + normalization + assertion semantics. |
| **Blink / WebKit layout‑tree text baselines** | `testRunner.dumpAsLayout()` → `-expected.txt`. See §2. | Chromium `docs/testing/writing_web_tests.md`; WebKit `LayoutTests/platform/{mac,glib}/…-expected.txt`. | **The engine that invented it tells you not to use it.** See §2. |
| **WPT reftests** | No baseline artifact at all: compare test render vs a *reference page* render, `<link rel=match\|mismatch>`, with `<meta name=fuzzy content="maxDifference=15;totalPixels=300">`. | https://web-platform-tests.org/writing-tests/reftests.html; Chromium doc: "**The WPT is recommended today rather than test types mentioned below!**" | **Won** inside the standards process — by deleting the stored artifact entirely and making the oracle relational to a *second rendering*, not to a recorded number. |
| **DOM/CSSOM serializers** (`@percy/dom`, `@applitools/dom-snapshot`) | Serialize DOM + CSSOM for re‑rendering elsewhere. | `@applitools/dom-snapshot` 217,940/wk, published 2026‑08‑23. | Won as **transport**, never as an assertion artifact. Nobody diffs them; they get re‑rendered and pixel‑diffed. |

---

## 2. Browser‑engine layout‑tree baselines

**Does the technique work?** Yes — and the engines rank it *last*. Chromium lists four test types "in the order of preference" and puts text/layout‑tree dumps at the bottom: "*Text tests outputting internal data structures are used as a last resort to test the internal quirks of the implementation, and they should be avoided in favor of one of other options.*" (`docs/testing/writing_web_tests.md`)

**What the files look like** — real baselines, same source file, two platforms:

`WebKit/LayoutTests/platform/mac/fast/block/basic/001-expected.txt`
```
layer at (0,0) size 800x600
  RenderView at (0,0) size 800x600
layer at (0,0) size 800x600
  RenderBlock {HTML} at (0,0) size 800x600
    RenderBody {BODY} at (8,8) size 784x584
      RenderBlock {DIV} at (0,0) size 784x185 [border: (2px solid #FF0000)]
        RenderInline {I} at (2,2) size 780x163
          RenderText {#text} at (2,2) size 96x18
            text run at (2,2) width 96: "Start of a line. "
```
`WebKit/LayoutTests/platform/glib/fast/block/basic/001-expected.txt`
```
      RenderBlock {DIV} at (0,0) size 784x184 [border: (2px solid #FF0000)]
        RenderInline {I} at (2,2) size 780x162
          RenderText {#text} at (2,2) size 93x18
            text run at (2,2) width 93: "Start of a line. "
```
**Every text‑derived number diverges** — `185`/`184`, `163`/`162`, `96`/`93`, and the child inline's x origin shifts `97`→`95`. Identical markup, identical engine family, different platform text stack.

**What normalization makes them stable — fonts, and only fonts.** The Ahem font exists for exactly this. Its em‑square is exactly square; ascent+descent equals the em square so extent equals line‑height; baseline is 0.2em above the bottom; glyphs are `X` = 1em×1em solid, `p` = 0.2em, `É` = 0.8em, space = 1em transparent; most other US‑ASCII maps to `X`. WPT's usage rules: computed font‑size must be a **multiple of 5px** (min 20px suggested), an **explicit** line‑height with `(line-height − font-size)` divisible by 2, and use the `font` shorthand so weight/style don't inherit. Chromium's doc: "*Use the Ahem font to reduce the variance introduced by the platform's text rendering system.*" Plus a fixed 800×600 default viewport. The example layout‑tree test in Chromium's own docs sets `body { font: 10px Ahem; }` and the doc says outright: "*Had the test used another font, its text baseline would have depended on the fonts installed on the testing computer, and on the platform's font rendering system.*"

**And the exemption that matters most to us:** Chromium's Ahem guidance ends with — "*This does not apply when testing text, text flow, font selection, font fallback, font features, or other typographic information.*" I.e. the normalization trick is unavailable precisely for the cases where text measurement is the thing under test.

**What caused churn / flakiness — the engines' own words:**

1. **Per‑platform baseline explosion.** "*the output of layout tree tests may depend on platform-specific details, so layout tree tests often require per-platform baselines*"; and for pixel tests, baselines are "*quite cumbersome to manage*". Chromium had to build `blink_tool.py rebaseline-cl`, `optimize-baselines`, a baseline‑fallback system, and placeholder all‑PASS baselines to cope.
2. **Coupling to the implementation's data structure.** "*since the tests obviously depend on the layout tree structure, that means that if we change the layout tree you have to rebaseline each layout tree test to see if the results are still correct and whether the test is still meaningful.*"
3. **Baseline rot — the failure mode that should scare us most.** "*There are actually many cases where the layout tree output is misstated (i.e., wrong), because people didn't want to have to update existing baselines and tests. This is really unfortunate and confusing.*" This is the scratchpad's kill criterion #3 ("noisy oracles get muted") observed in production, in a codebase with a dedicated infra team.
4. **Unsoundness in both directions.** "*It is possible for multiple layout trees to produce the same pixel output, so it is important to make it clear in the test which outputs you really care about.*" A green text baseline is not a claim about appearance.
5. **Governance cost.** Chromium requires that any CL adding a text baseline include a crbug link tracking that baseline's *removal*.
6. **Irreducible cases.** WPT: "*there is no way to create a reference for underlining, since the position and thickness of the underline depends on the UA, the font, and/or the platform.*"

---

## 3. Three design lessons for a `layout snapshot` text format

**L1 — Never store a raw measurement; store the verdict of a tolerance‑carrying predicate.**
Source: the WebKit mac/glib baseline pair above (`784x185` vs `784x184`, `96x18` vs `93x18`, x‑origin `97` vs `95` for byte‑identical markup). Every geometric prior art that survived contact with reality put a tolerance somewhere: Galen's per‑spec `SpecObjectWithErrorRate` integer px error rate; WPT's `<meta name=fuzzy content="maxDifference=15;totalPixels=300">`; BackstopJS's `misMatchThreshold` default 0.1% plus `ignoreAntialiasing`; Vitest's `allowedMismatchedPixelRatio`. The tolerance is not optional — the only design choice is whether it lives in the *file* (where it churns) or in the *comparator* (where the file stays byte‑stable). Put it in the comparator. Concretely: numbers may appear in the snapshot only if they are exactly reproducible by construction (a token scale index, a child count, a breakpoint name) — never if they are a function of font metrics.

**L2 — Emit three‑valued results (pass / fail / needs‑review), not booleans.**
Source: `axe-core/lib/checks/mobile/target-size-evaluate.js`. The only geometric oracle in this review with real adoption (66.5M downloads/week) returns `true`, `false`, **or `undefined`** — with explicit `messageKey`s for `contentOverflow`, `obscured`, `tooManyRects`, and `large`, and it deliberately bails early (`rectHasMinimumSize(minSize * 10, …)`) to avoid expensive computation on obviously‑fine targets. Deque concluded, in shipped code, that a meaningful fraction of real page geometry is genuinely undecidable and must be routed to a human rather than guessed. A binary layout oracle will either false‑positive (and get muted, per §2 lesson 3) or false‑negative (and be worthless). The N6xx diagnostic taxonomy needs an `incomplete` severity from day one, not as a later addition.

**L3 — The snapshot must be a *distillation with its own stability contract*, not a dump of an internal structure — and it needs at least two presets.**
Source: Playwright's `packages/injected/src/ariaSnapshotDistiller.ts`. It runs a named, ordered, babel‑style visitor chain — `mergeStringChildren`, `removeNamelessImages`, `removeRedundantNames`, `inlineTextIntoGeneric`, `removeNameRepeatingChild`, `unwrapSingleChildGenerics` — each documented with *why* it fires and *when* (enter vs exit) it must fire, with two published presets: `normalizePlugins` ("*Structural normalization applies to all modes — it defines the canonical tree shape*") for assertions, and `aiPlugins` (compressed) for agent context. It is paired with a partial‑match‑by‑default matcher (`containerMode` defaults to `contain`; `equal` / `deep-equal` are opt‑in per node or globally), so adding an unrelated sibling does not break every stored snapshot. Contrast Blink, whose dump *is* the internal layout tree verbatim, and therefore must be rebaselined "*if we change the layout tree*". Lesson: the layout snapshot is a projection with a versioned, documented normalization pass list, decoupled from whatever the build‑time renderer's internal representation happens to be; matching is subset‑by‑default; and the assertion artifact and the agent‑context artifact are two renderings of one tree, not one file forced to serve both.

---

## 4. Can frontier vision models measure geometry? (≤6 sentences)

GUI *localization* has improved enormously — ScreenSpot‑Pro went from best‑specialist 18.9% and GPT‑4o under 2% in early 2025 to a July‑2026 public snapshot with Claude Opus 4.8 at 87.9% — but that benchmark tests *where a target is*, not *how far off it is*. On measurement the picture has not moved: BlindTest put four frontier VLMs at **58.12% mean** on tasks like "are these two circles touching", with accuracy recovering to near‑100% *only when the shapes are moved further apart* — i.e. the failure is specifically at small separations, which is exactly the 2‑px‑misalignment regime. The 2026 evidence on the UI task itself is worse, not better: **UI‑Lens (CVPR 2026)**, 4,759 expert‑annotated pages across 10 models, reports task‑average F1 of **20.36% on Text Overflow** and **31.21% on Container Overlap** — "near random" in the authors' words — and 10.61% on cross‑screen text consistency. Continuous‑value spatial regression is likewise weak in 2026: a frontier grounding audit reports GPT‑5 and o3 at **mean IoU 0.16 (Acc@0.5 7.9–9.1%)**, and SIRI‑Bench finds the best model puts **over 33% of dimension estimates above 100% error**, with the stated cause architectural — models emit discrete tokens while the spatial signal is continuous, and numeric box prediction requires arithmetic over tokenised numbers. Note the honest counter‑pressure: the industry is routing around the problem rather than waiting for it to be solved — Playwright shipped `[box=x,y,width,height]` into the *text* snapshot in v1.60 explicitly "useful for AI consumption", i.e. it feeds models numbers instead of asking them to look.

**Verdict: yes — a textual geometry oracle is very likely still valuable in 24 months, but not for the reason the scratchpad states.** The defensible value is *normalization + assertion semantics + tolerance policy*, not the exposure of numbers: exposing raw geometry to an agent is already a one‑line Playwright flag (`--snapshot-boxes`), so "agents get eyes that read" is a commodity by 2026‑05, and only "agents get a contract that fails" is not.

---

## 5. What the prior art says the bet is WRONG

**A. The natural experiment already ran — in 2026 — and the mechanism lost on its merits.** `galen-ts` is a complete, competent Playwright/TypeScript reimplementation of the exact relational DSL (all spec types, all directives, 491 tests), announced on the original tracker on 2026‑04‑06 with a "Why" list that fixes every plausible excuse for Galen's death (stale since 2017, Selenium, Java setup). Result four months later: **2 GitHub stars, 0 npm downloads in the last week.** `cypress-layout-inspector` (`be.rightOf`/`be.leftOf`): 260/wk, dead since 2023. The bet's staging (C3 → C2) assumes relational assertions fail for want of a good substrate. The evidence says they fail for want of *demand*, and the scratchpad does not name the mechanism that would change that.

**B. The scratchpad's premise that "the only wholly unbuilt oracle in the entire UI industry is the visual one" is false for two of its nine bug classes.** `axe-core` (66.5M/wk) already ships a full geometric relational oracle — bounding rects, `hasVisualOverlap`, obscuring‑element filtering, `getLargestUnobscuredArea`, `splitRects` — plus contrast checking, at an installed base three orders of magnitude beyond anything nisli will have. §3's bug class #4 (contrast) and #7 (invisible focus) and much of #2 (target size / overlap) are covered by a dependency you can `npm i` today. That's not a moat; that's an integration.

**C. The C4 "nobody has this because nobody else has a value‑level prop schema plus a browserless renderer" claim is not supported by the numbers.** Storybook has value‑level `argTypes`; Chromatic auto‑enumerates viewports/themes/modes; `storybook-addon-pseudo-states` (**1,187,997/wk**) enumerates hover/focus/active/visited without authoring; `@storybook/addon-vitest` (**4,499,862/wk**) runs it all headlessly; `@storybook/test-runner` 2.16M/wk. The genuinely uncovered part of C4 is content extremes and RTL — valuable, but a feature, not a generational shift.

**D. Playwright is already inside the format, and it owns the distribution.** `ariaSnapshot` (1.49, 2024‑11), `[box=…]` (1.60, 2026‑05, "useful for AI consumption"), `--snapshot-boxes` in the MCP CLI, an `autoexpect` mode whose in‑source comment is literally "*To auto-generate assertions on visible elements*", and `renderAriaTreeAsJSON` that already carries `box: {x,y,width,height}` on `AriaNodeJSON`. Adding box comparison to `matchesNode()` is a handful of lines against fields that already exist. If Microsoft ships that in one minor release, the format half of the bet is commoditized **framework‑agnostically** — which is worse than being copied, because it means nisli gains nothing while React gains the same oracle. The scratchpad's "Copyable? Format could be" badly understates the proximity.

**E. The token‑normalization premise leaks exactly where the bet needs it most.** Tokens normalize what tokens control. Every number that *text* produces — line box height, wrap point, intrinsic width, ellipsis position, optical baseline — is a font‑metric function, which is precisely why WebKit's mac and glib baselines for the same file disagree at `784x185`/`784x184` and `96x18`/`93x18`. Bug classes #1 (overflow/clipping) and #2 (misalignment) are the two most dependent on text measurement and the two the token layer normalizes *least*. The Ahem font exists because engine authors concluded you cannot have both real fonts and stable geometry — and Chromium explicitly exempts "*testing text, text flow, font selection, font fallback, font features, or other typographic information*" from the Ahem trick. "Relations, not pixels" helps, but a relation whose operands are font‑derived is still font‑derived.

**F. The engine that invented textual layout snapshots documents them as a mistake, including the exact failure the scratchpad lists as a kill criterion.** Chromium: last of four preferred test types; "*should be avoided in favor of one of other options*"; "*should only be used to cover aspects of the layout code that can only be tested by looking at the layout tree*"; and — "*There are actually many cases where the layout tree output is misstated (i.e., wrong), because people didn't want to have to update existing baselines and tests.*" Kill criterion #3 ("the artifact becomes noise, and noisy oracles get muted") is not a hypothetical risk; it is the recorded outcome for this exact artifact type, at Google scale, with a dedicated rebaselining toolchain. Also: "*It is possible for multiple layout trees to produce the same pixel output*" — the oracle can be simultaneously noisy **and** unsound.

**G. Revealed preference across a decade says teams would rather approve a picture than author a predicate.** Chromatic 8,826,253/wk · pixelmatch 9,461,959/wk · jest-image-snapshot 941,963/wk · @percy/cli 476,503/wk · @applitools/eyes-playwright 66,060/wk — versus galenframework-cli **29/wk**. And the newest visual‑testing API in the ecosystem, Vitest browser mode (2026), also shipped pixel diffing, with per‑browser‑per‑platform baseline filenames. Kill criterion #4 ("if it needs per‑component authoring effort comparable to writing tests, it is a chore") is the one with the *most* historical support in this record. That makes **C4 load‑bearing rather than a bonus layer**, and argues it should be sequenced before C2, not third.

**H. "Screenshot diffing never became a loop" is the wrong claim, and stating it weakens the thesis.** It *did* become a loop — a human‑gated one, and a large business. The accurate claim is that no *unattended* appearance oracle exists. And the reason Chromatic needs a human is documented on their own unstable‑tests page: animations caught mid‑frame, late font loading, image‑CDN recompression, `Date.now()`, RNG seeds, iframes below the viewport, 15‑second resource windows. **A relational oracle inherits most of that list** — it also has to decide when the page has settled before it reads a single rect. `settle()` (0030.2 T2) is therefore not adjacent to this bet; it is a prerequisite, and its coverage of these specific hazards should be audited before C3 is funded.

**I. Epistemic warning: we do not actually know why Galen died.** I searched the tracker, the org, the author's activity, and the web: there is **no archive notice, no maintainer post‑mortem, no "why I stopped" issue**. Ivan Shubin simply moved to `schemio` (active 2026‑08‑23). So the scratchpad's line — "*Font metrics, engine versions, and subpixel rounding destroy absolute geometry assertions — that is why screenshot diffing never became a loop*" — is an inference we cannot source. The only *recorded* diagnosis of Galen's failure is galen-ts's own, and galen-ts falsified it. Treat the cause of death as unknown, and treat that unknown as the largest open risk in the bet, above the vision‑model risk.

---

## Versions checked

Evidence collected 2026-08-25. Primary sources at: microsoft/playwright @ f46278a8 (package version 1.63.0-next; feature dates: ariaSnapshot v1.49 published 2024-11-18, `boxes` v1.60 published 2026-05-11); galenframework/galen @ 6c7dc1f1 (master HEAD, 2019-03-10; last release 2.4.4, 2019-03-15); kushneryk/galen-ts @ 0.1.3 (2026-04); dequelabs/axe-core `develop`; Chrome DevTools Protocol `tot`; ChromeDevTools/chrome-devtools-mcp `main` (pushed 2026-08-25); chromium/chromium docs `main`; WebKit/WebKit `main`; WPT docs (current); Vitest `main` docs; npm download figures are the week 2026-08-17..2026-08-23.

---

## Caveats and unsourced-inference warnings

- NO maintainer post-mortem exists for Galen Framework. I searched the issue tracker (title and body queries), the org's repos, the author's GitHub activity, and the web. There is no archive notice, no abandonment issue, no blog post. The repo is NOT archived. The only recorded diagnosis is galen-ts's own list ('not updated since 2017 / Selenium / Java setup') — and galen-ts fixed all three and got 0 npm downloads. Any claim in the scratchpad about WHY relational assertions failed is currently unsourced inference.
- NO maintainer statement exists for BackstopJS's stall either. Last release 6.3.25 (2024-09-07), 578 open issues, repo not archived, no deprecation notice found.
- ScreenSpot-Pro numbers measure LOCALIZATION (where is the target), not METROLOGY (how far off is it). The 87.9% July-2026 figure is from a public leaderboard aggregator (benchlm.ai), not the original paper; the paper's own numbers are the early-2025 ones (OS-Atlas-7B 18.9%, GPT-4o <2%).
- The BlindTest mean accuracy differs between the arXiv abstract revision (58.12%, Claude 3.5 Sonnet 74.94%) and some secondary summaries (58.07% / 77.84%). I cite the repo/arXiv abstract figures. Either way the conclusion is unchanged.
- Playwright's `computeBox()` in domUtils.ts returns only {visible, inline, cursor} — it does NOT carry a rect. Geometry is read separately via `element.getBoundingClientRect()` inside `renderA

---

## Breaking changes / version churn in the cited APIs

- Playwright 1.49 (2024-11-18) introduced `toMatchAriaSnapshot`; 1.50 added `/children` (contain|equal|deep-equal) and `/url` node properties, changing default subset-matching semantics when `expect.toMatchAriaSnapshot.children: 'equal'` is configured globally.
- Playwright 1.60 (2026-05-11) added the `boxes` option and `[box=x,y,width,height]` key suffix — snapshots captured with `boxes: true` are NOT comparable to snapshots captured without it, and geometry is emitted-only (the matcher ignores it), so a `[box=…]` in a stored template is silently unenforced.
- hermione was renamed to Testplane at v8.x for trademark reasons; `hermione` on npm is superseded by `testplane` (drop-in at the same version line).
- gemini (Yandex) is archived and hard-deprecated in favour of hermione/Testplane; the GitHub description is literally '💀💀💀[DEPRECATED] Use hermione'.
- Chromium web tests: `blink_tool.py optimize-baselines` and the baseline-fallback system mean the absence of a platform baseline is not equivalent to an all-PASS status (crbug.com/1324638); placeholder baselines are required in some cases.

---

## API surfaces cited

### A1

```
page.ariaSnapshot(options?: { mode?: 'ai' | 'default', depth?: number, boxes?: boolean }): Promise<string>
locator.ariaSnapshot(options?: { mode?: 'ai' | 'default', depth?: number, boxes?: boolean }): Promise<string>
locator.ariaSnapshotJSON(options?: same): Promise<AriaSnapshotJSON>
```

Playwright ≥1.60. `boxes: true` appends `[box=x,y,width,height]` (Math.round of getBoundingClientRect, viewport-relative CSS px) to each node's YAML key. Release note rationale: "useful for AI consumption". packages/playwright-core/src/client/page.ts:931, client/locator.ts:338.

### A2

```
await expect(page | locator).toMatchAriaSnapshot(`
  - role "name" [attribute=value]:
    - /children: contain | equal | deep-equal
    - /url: "..."
    - text: "..."
`)
```

Playwright ≥1.49 (2024-11-18). Case-sensitive, whitespace-collapsing, order-sensitive, subset-by-default matching. `expect.toMatchAriaSnapshot.children` sets the global container mode. GEOMETRY IS NOT MATCHABLE: `matchesNode()` compares role/checked/disabled/expanded/invalid/level/pressed/selected/name/url only; `AriaTemplateRoleNode` has no `box` field.

### A3

```
type AriaNodeJSON = { role; name?; checked?; disabled?; expanded?; active?; invalid?; level?; pressed?; selected?; ariaHidden?; ref?; cursor?: 'pointer'; box?: { x: number, y: number, width: number, height: number }; url?; placeholder?; text?; children? }
```

Playwright's emitted snapshot node shape — geometry is carried on the emitted JSON but has no counterpart on the template/assertion type. packages/isomorphic/ariaSnapshot.ts.

### A4

```
npx playwright-mcp --snapshot-boxes    # or config key `snapshot.boxes`
// tool param: boxes?: boolean — 'Include each element's bounding box as [box=x,y,width,height] in the snapshot. Coordinates are viewport-relative, in CSS pixels (Element.getBoundingClientRect)'
```

Playwright MCP flag exposing geometry to agents. Off by default (`snapshot?.boxes` is undefined unless set). packages/playwright-core/src/tools/mcp/program.ts:72, tools/backend/snapshot.ts:45.

### A5

```
browser_verify_element_visible({ role, accessibleName })
browser_verify_text_visible({ text })
browser_verify_list_visible({ element, target, items })
browser_verify_value({ type: 'textbox'|'checkbox'|'radio'|'combobox'|'slider', element, target, value })
```

The complete agent-facing assertion vocabulary in Playwright MCP as of 1.63.0-next. Entirely semantic; no geometry, spacing, color, or contrast assertion exists. packages/playwright-core/src/tools/backend/verify.ts.

### A6

```
DOMSnapshot.captureSnapshot({ computedStyles: string[], includePaintOrder?: boolean, includeDOMRects?: boolean, includeBlendedBackgroundColors?: boolean, includeTextColorOpacities?: boolean }) => { documents: DocumentSnapshot[], strings: string[] }
```

CDP (Experimental). DocumentSnapshot carries `nodes: NodeTreeSnapshot`, `layout: LayoutTreeSnapshot`, `textBoxes: TextBoxSnapshot` (post-layout inline text boxes), scrollOffsetX/Y, contentWidth/Height. The raw geometry+style snapshot substrate already exists in every Chromium; no textual serialization or diff semantics were ever built on it.

### A7

```
testRunner.dumpAsLayout()
testRunner.dumpAsLayoutWithPixelResults()
testRunner.dumpAsText() / dumpAsTextWithPixelResults() / dumpAsMarkup() / dumpChildFrames() / setCustomTextOutput(string)
```

Blink content_shell APIs producing `-expected.txt` layout-tree baselines. Chromium's own docs rank these last of four test types and say they 'should be avoided'.

### A8

```
targetSizeEvaluate(node, options: { minSize?: number /* default 24 */ }, vNode) => true | false | undefined
```

axe-core's shipped geometric relational oracle. Uses vNode.boundingClientRect, findNearbyElms, hasVisualOverlap, splitRects, getLargestUnobscuredArea. Returns three-valued results with messageKey ∈ {large, contentOverflow, obscured, tooManyRects}. 66.5M downloads/week.

### A9

```
# Galen .gspec
object:
    inside screen 0px top left right
    near otherObject 10px right
    aligned vertically all otherObject
    above footer 0px
    width 100% of screen/width
    height 30 to 50px
    text is "..."
    color scheme 20% #ff0000
@on mobile / @on desktop
# per-spec tolerance: `~` / errorRate (SpecObjectWithErrorRate.errorRate, default 0)
```

The closest known prior art to C2. Java classes SpecAbove/Below/LeftOf/RightOf/Near/Inside/Aligned/Centered/Contains/Count/Width/Height/ColorScheme/Text/Css/Image/Ocr/Visible. Dead: master HEAD 2019-03-10, npm CLI 29 downloads/week.

### A10

```
await expect(element).toMatchScreenshot(name?, { comparatorName: 'pixelmatch', comparatorOptions: { threshold, allowedMismatchedPixelRatio } })
```

Vitest browser mode (2026) — the ecosystem's newest visual-testing API, still image-diff-based, with per-browser-per-platform baseline filenames (`name-{browser}-{platform}.png`).

### A11

```
<link rel="match" href="foo-expected.html">
<meta name=fuzzy content="maxDifference=10-15;totalPixels=200-300">
<html class="reftest-wait">  <!-- + TestRendered event -->
```

WPT reftest contract: no stored baseline artifact at all — compare against a second live rendering, with explicit per-test fuzziness ranges. Chromium docs: 'The WPT is recommended today rather than test types mentioned below!'


---

## Primary sources

### S1. microsoft/playwright @ f46278a (1.63.0-next, 2026-08-24) · packages/isomorphic/ariaSnapshotRenderer.ts · L74-76

```
    if (node.box)
      key += ` [box=${node.box.x},${node.box.y},${node.box.width},${node.box.height}]`;
    return key;
```

### S2. microsoft/playwright @ f46278a · packages/injected/src/ariaSnapshot.ts · L413-428

```
function matchesNode(node, template, isDeepEqual): boolean {
  ...
  if (template.role !== 'fragment' && template.role !== node.role) return false;
  if (template.checked !== undefined && template.checked !== node.checked) return false;
  ... (disabled, expanded, invalid, level, pressed, selected, name, props.url) ...
  // NOTE: no comparison of node.box anywhere in the matcher.
```

### S3. microsoft/playwright @ f46278a · packages/injected/src/ariaSnapshot.ts · L494-500

```
    if (options.renderBoxes) {
      const element = ariaNodeElement(ariaNode);
      if (element) {
        const r = element.getBoundingClientRect();
        node.box = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
      }
    }
```

### S4. microsoft/playwright @ f46278a · packages/injected/src/ariaSnapshotDistiller.ts · L228-244

```
// Structural normalization applies to all modes - it defines the canonical tree shape.
const normalizePlugins: DistillerPlugin[] = [
  mergeStringChildren,
  unwrapSingleChildGenerics,
];

// The ai preset compresses the snapshot on top of normalization. ...
const aiPlugins: DistillerPlugin[] = [
  mergeStringChildren,
  removeNamelessImages,
  removeRedundantNames,
  inlineTextIntoGeneric,
  removeNameRepeatingChild,
  unwrapSingleChildGenerics,
];
```

### S5. microsoft/playwright @ f46278a · packages/playwright-core/src/tools/backend/verify.ts · L26-140

```
export default [
  verifyElement,   // browser_verify_element_visible  (role + accessibleName)
  verifyText,      // browser_verify_text_visible
  verifyList,      // browser_verify_list_visible
  verifyValue,     // browser_verify_value  (textbox|checkbox|radio|combobox|slider)
];  // -- no geometry, color, spacing, or contrast assertion exists
```

### S6. microsoft/playwright @ f46278a · docs/src/release-notes-js.md · L245-248

```
### 🎯 Aria snapshots

- `PageAssertions.toMatchAriaSnapshot` now works on a Page, in addition to a Locator ...
- New `boxes` option on `Locator.ariaSnapshot` / `Page.ariaSnapshot` appends each element's bounding box as `[box=x,y,width,height]`, useful for AI consumption.
```

### S7. microsoft/playwright @ f46278a · packages/injected/src/ariaSnapshot.ts · L72-75

```
  if (options.mode === 'autoexpect') {
    // To auto-generate assertions on visible elements.
    return { visibility: 'ariaAndVisible', refs: 'none', renderBoxes };
  }
```

### S8. chromium/chromium (docs, main) · https://raw.githubusercontent.com/chromium/chromium/main/docs/testing/writing_web_tests.md · L545-566

```
Like pixel tests, the output of layout tree tests may depend on platform-specific details, so layout tree tests often require per-platform baselines. Furthermore, since the tests obviously depend on the layout tree structure, that means that if we change the layout tree you have to rebaseline each layout tree test to see if the results are still correct and whether the test is still meaningful. There are actually many cases where the layout tree output is misstated (i.e., wrong), because people didn't want to have to update existing baselines and tests. This is really unfortunate and confusing.

For these reasons, layout tree tests should **only** be used to cover aspects of the layout code that can only be tested by looking at the layout tree. Any combination of the other test types is preferable to a layout tree test.
```

### S9. chromium/chromium (docs, main) · https://raw.githubusercontent.com/chromium/chromium/main/docs/testing/writing_web_tests.md · L57-66

```
* *Text Tests* output pure text which represents the DOM tree, the DOM inner text, internal data structure of Blink like layout tree or graphics layer tree ... Text tests outputting internal data structures are used as a last resort to test the internal quirks of the implementation, and they should be avoided in favor of one of other options.
```

### S10. chromium/chromium (docs, main) · https://raw.githubusercontent.com/chromium/chromium/main/docs/testing/writing_web_tests.md · L478-483

```
* Use the [Ahem font](https://www.w3.org/Style/CSS/Test/Fonts/Ahem/README) to reduce the variance introduced by the platform's text rendering system. This does not apply when testing text, text flow, font selection, font fallback, font features, or other typographic information.
```

### S11. WebKit/WebKit (main) · LayoutTests/platform/mac/fast/block/basic/001-expected.txt  vs  LayoutTests/platform/glib/fast/block/basic/001-expected.txt · L1-10

```
mac : RenderBlock {DIV} at (0,0) size 784x185 ... RenderText {#text} at (2,2) size 96x18 / text run at (2,2) width 96: "Start of a line. "
glib: RenderBlock {DIV} at (0,0) size 784x184 ... RenderText {#text} at (2,2) size 93x18 / text run at (2,2) width 93: "Start of a line. "
(identical source markup; every text-derived number diverges by platform)
```

### S12. web-platform-tests/wpt (docs) · https://web-platform-tests.org/writing-tests/ahem.html · L1-40

```
The font's em-square is exactly square. Its ascent and descent combined is exactly the size of the em square ... Its alphabetic baseline is 0.2em above its bottom ... If the test uses the Ahem font, make sure its computed font-size is a multiple of 5px, otherwise baseline alignment may be rendered inconsistently. A minimum computed font-size of 20px is suggested. An explicit (i.e., not `normal`) line-height should also always be used, with the difference between the computed line-height and font-size being divisible by 2.
```

### S13. web-platform-tests/wpt (docs) · https://web-platform-tests.org/writing-tests/reftests.html · L1-200

```
<meta name=fuzzy content="maxDifference=15;totalPixels=300">  ... Limitations: In some cases, a test cannot be a reftest. For example, there is no way to create a reference for underlining, since the position and thickness of the underline depends on the UA, the font, and/or the platform.
```

### S14. dequelabs/axe-core (develop) · lib/checks/mobile/target-size-evaluate.js · L1-60

```
import { findNearbyElms, isFocusable, isInTabOrder } from '../../commons/dom';
import { splitRects, rectHasMinimumSize, hasVisualOverlap } from '../../commons/math';
...
const minSize = options?.minSize || 24;
const nodeRect = vNode.boundingClientRect;
if (rectHasMinimumSize(minSize * 10, nodeRect)) { this.data({ messageKey: 'large', minSize }); return true; }
...
  this.data({ minSize, messageKey: 'contentOverflow' }); return undefined;   // three-valued result
...
  this.data({ messageKey: 'obscured' }); return true;
```

### S15. galenframework/galen @ 6c7dc1f (master HEAD, 2019-03-10) · galen-core/src/main/java/com/galenframework/specs/  +  README.md · L1-50

```
SpecAbove SpecAligned SpecBelow SpecCentered SpecColorScheme SpecContains SpecCount SpecCss SpecHeight SpecImage SpecInside SpecLeftOf SpecNear SpecOcr SpecRightOf SpecText SpecVisible SpecWidth SpecObjectWithErrorRate(private int errorRate = 0)
-- README example --
side-panel:
    below menu 0px
    inside screen 0px right
    width 300px
    near content 0px right
```

### S16. galenframework/galen (issue tracker) · https://github.com/galenframework/galen/issues/669 · L1-30

```
Galen Framework ported to TypeScript with Playwright support — opened 2026-04-06 by @kushneryk. "Full implementation of the Galen Spec Language (.gspec files) ... 491 tests passing. Why: Galen Framework hasn't been updated since 2017; Selenium is being replaced by Playwright in most projects..."  [kushneryk/galen-ts: 2 stars, last push 2026-04-15; npm galen-ts@0.1.3 = 0 downloads last week]
```

### S17. gemini-testing/gemini (GitHub API) · https://api.github.com/repos/gemini-testing/gemini · L1-1

```
"description": "💀💀💀[DEPRECATED] Use hermione", "archived": true, "pushed_at": "2021-05-20T15:49:32Z", "stargazers_count": 1506, "open_issues_count": 127
```

### S18. garris/BackstopJS (master) · README.md · L197-502

```
| `misMatchThreshold` | Percentage of different pixels allowed to pass the test |
| `requireSameDimensions` | If set to true -- any change in selector size will trigger a test failure. |
... The default setting is `0.1` ... "Integrated Docker rendering -- to eliminate cross-platform rendering shenanigans"  [last release 6.3.25, 2024-09-07; 578 open issues; 82,162 downloads/week]
```

### S19. vitest-dev/vitest (docs, 2026) · https://main.vitest.dev/guide/browser/visual-regression-testing · L1-60

```
Visual regression tests are **sensitive to environmental differences** because rendering is not perfectly deterministic across environments and depends on multiple factors: GPU, drivers, and hardware acceleration; Operating System; Font rendering pipelines; Browser, browser versions, and settings; Whether the browser is running headless or headed; Screen scaling, color profiles, and display settings ... **visual testing doesn't tell you why something renders the way it does**.
```

### S20. chromaui/chromatic-docs (main) · src/content/snapshot/unstable-tests.md · L10-40

```
An unstable test renders differently across repeated runs even when your code hasn't changed. ... Randomness in tests ... Animations ... Unpredictable resource hosts ... Image CDNs and compression algorithms ... Web font loading ... Iframes rendering out of the viewport ... Use of the current date and time ... UI takes time to render
```

### S21. ChromeDevTools/chrome-devtools-mcp (main) · docs/tool-reference.md · L453-457

```
### `take_snapshot` — Take a text snapshot of the target page based on the a11y tree. The snapshot lists page elements along with a unique identifier (uid). Always use the latest snapshot. Prefer taking a snapshot over taking a screenshot.  [no geometry; `click_at(x,y)` requires flag --experimentalVision=true]
```

### S22. ChromeDevTools/devtools-protocol (tot) · https://chromedevtools.github.io/devtools-protocol/tot/DOMSnapshot/ · L1-120

```
DOMSnapshot Domain — This domain facilitates obtaining document snapshots with DOM, layout, and style information. [Experimental]. captureSnapshot(computedStyles, includePaintOrder, includeDOMRects, includeBlendedBackgroundColors, includeTextColorOpacities) → documents[{ nodes, layout: LayoutTreeSnapshot, textBoxes: TextBoxSnapshot, contentWidth, contentHeight }], strings[]
```

### S23. Applitools (official docs) · https://applitools.com/docs/eyes/concepts/best-practices/match-levels · L1-1

```
The Layout match level focuses on the structure and layout of the page, ignoring content changes ... identifies the various screen elements in the checkpoint and baseline images, such as text, images, buttons, and columns, and verifies that the relative positions of these elements are consistent ... Layout: Check only the layout and ignore actual text and graphics.
```

### S24. percy/cli (master) · packages/dom/README.md · L1-3

```
# @percy/dom

Serializes a document's DOM into a DOM string suitable for re-rendering.
```

### S25. Xiang et al., CVPR 2026 · https://openaccess.thecvf.com/content/CVPR2026/html/Xiang_UI-Lens_Assessing_General_MLLMs_Potential_to_Automate_UI_Display_Quality_CVPR_2026_paper.html · L1-1

```
The dataset comprises 4,759 pages meticulously annotated by design experts, covering six core display defect categories. We conduct a systematic evaluation of 10 mainstream models (8 closed-source, 2 open-source). Results show clear shortcomings in current models: for tasks requiring fine-grained element boundary understanding, performance is near random, with task-average F1 scores of 20.36% and 31.21% on Text Overflow and Container Overlap, respectively; for sequential interface semantic consistency (e.g., Text Inconsistency), the task-average F1 score is only 10.61%
```

### S26. Rahmanzadehgervi et al., ACCV 2024 (Oral) · https://arxiv.org/abs/2407.06581 · L1-1

```
on BlindTest, our suite of 7 very simple tasks such as identifying (a) whether two circles overlap; (b) whether two lines intersect ... four state-of-the-art VLMs are only 58.12% accurate on average. Claude 3.5 Sonnet performs the best at 74.94% accuracy ... Across different image resolutions and line widths, VLMs consistently struggle with tasks that require precise spatial information and recognizing geometric primitives that overlap or are close together. [journal ver.: "VLMs perform at near-100% accuracy when much more space is added to separate shapes and letters"]
```

### S27. Li et al., ScreenSpot-Pro (arXiv 2504.07981) + public leaderboard · https://arxiv.org/abs/2504.07981 ; https://benchlm.ai/benchmarks/screenspot-pro · L1-1

```
Even specialist GUI grounding models achieve low accuracy (best: OS-Atlas-7B at 18.9%) ... Generalist MLLMs such as Qwen2-VL-7B and GPT-4o perform below 2%. [July 2026 snapshot] Claude Opus 4.8 first at 87.9%, ahead of GPT-5.4 (85.4%) and Gemini 3.1 Pro (84.4%) among 15 tested models. "It tests where a target is, not whether an agent can finish the surrounding workflow."
```

### S28. arXiv 2604.27720 (frontier VLM grounding audit) + SIRI-Bench (arXiv 2506.14512) + IDEAL-Bench (arXiv 2607.03614) · https://arxiv.org/pdf/2604.27720 ; https://arxiv.org/pdf/2506.14512 ; https://arxiv.org/html/2607.03614v1 · L1-1

```
"GPT-5 and o3 attain near-identical IoU 0.16 (Acc@0.5 7.9-9.1%); Gemini 2.5 Pro trails at IoU 0.09." / "The best method, Doubao-1.6-Vision, achieves only 31% of predictions within a 0-40% error margin ... over 33% of its predictions exceed 100% error." / "current VLMs generate predictions as discrete token sequences, while the spatial signal is continuous; how to bridge this mismatch remains an open problem."
```

### S29. npm registry + downloads API (measured 2026-08-25, week 2026-08-17..23) · https://registry.npmjs.org ; https://api.npmjs.org/downloads/point/last-week/ · L1-1

```
axe-core 66,526,881/wk · @storybook/addon-a11y 10,483,865 · stylelint 10,731,598 · @vitest/browser 9,713,847 · pixelmatch 9,461,959 · @axe-core/playwright 8,932,308 · chromatic 8,826,253 (18.5.0, 2026-08-19) · @storybook/addon-vitest 4,499,862 · @storybook/test-runner 2,157,820 · storybook-addon-pseudo-states 1,187,997 · jest-image-snapshot 941,963 (6.5.2, 2026-03-09) · @percy/cli 476,503 · reg-cli 240,678 · @applitools/dom-snapshot 217,940 · backstopjs 82,162 (6.3.25, 2024-09-07) · @applitools/eyes-playwright 66,060 · happo.io 37,366 · testplane 12,793 · gemini 2,428 (7.5.2, 2019-11-25) · cypress-layout-inspector 260 (1.7.0, 2022-12-05) · galenframework-cli 29 (2022-05-20) · galen-ts 0 (0.1.3)
```

