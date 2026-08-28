# Constraint and Intent Layout — what happens when the author declares and an engine derives

**Date**: 2026-08-25 · **Kind**: prior-art evidence, captured verbatim
**Slice**: Systems where the author declares intent or constraints and an engine derives the geometry — the direct ancestors of `@nisli/next`'s fit solver and resolution table.
**Parent**: [`NEXTGEN-SCRATCHPAD.md`](../NEXTGEN-SCRATCHPAD.md) — new package `@nisli/next`

---

## Verdict in five bullets

1. **The strongest form of our bet was specified in 1999, implemented in a W3C browser, and the CSS WG did not take it.** Borning/Badros/Stuckey/Marriott's *Constraint Cascading Style Sheets* already contains ordered declarative fallback (`@precondition` + ordered `@import`), constraint strengths that model the cascade, and — critically — the exact safety rule our prototype rediscovered as F11: **authors are forbidden from declaring `REQUIRED` constraints, because that "would admit the possibility of an unsatisfiable constraint system."** The authors' own closing sentence names the unanswered question as *scale*: "substantial work remains… especially useful for investigating the important issue of how well the constraint systems and solver scale to larger, more complicated designs." Twenty-seven years later nobody has answered it.
2. **The one general solver that shipped in a browser (GSS) is archived and does 3 downloads/week — and there is no maintainer post-mortem, at all.** `gss/gss` is *archived*, last commit 2014-02-02. `gss/engine` has 2,854 stars and 194 issues (~112 open). Its last commit is `be430ea` 2019-12-17 — *"Update README.md"*. **The last change to `src/` was 2015-02-04**; the last change to `lib/` was 2015-01-16. The engine itself has not been touched in eleven years. Issue #219 *"Is this project dead?"* (2017-10-02) and #216 *"Is this project still alive?"* (2016-08-29) were **never answered by a maintainer**. The death reason is therefore `[UNVERIFIED]` as a stated cause; what *is* verified is the failure mode users reported, and it is our failure mode: authors could not predict which constraints a rule would generate, scoped rules leaked across the tree, and layouts "totally broke" (gss/engine#117).
3. **Flutter — the largest greenfield UI framework of the last decade, 178,660 stars — explicitly rejected a constraint solver on complexity grounds, in its own architecture doc.** *"Some other toolkits use layout algorithms that are O(N²) or worse (for example, fixed-point iteration in some constraint domain). Flutter aims for linear performance."* This is the single most load-bearing adversarial fact in this file: the people who had a clean slate, unlimited budget, and no CSS legacy looked at Cassowary and chose one-pass constraints-down/sizes-up instead. And Flutter still pays for the *one* place it kept a speculative pass: `IntrinsicWidth`/`IntrinsicHeight` are documented as *"relatively expensive… O(N²) in the depth of the tree. Avoid using it where possible."*
4. **Priority-driven collapse is not novel and it is not dead — it is shipping at ~377k downloads/week in `@fluentui/react-overflow`, and the shipping implementation is full of the exact hacks our prototype hit.** Fluent's manager has a hand-tuned `padding: 10` fudge factor documented as being for "margins between items that are difficult to measure in JavaScript"; it runs its show/hide loop **twice** because "the first step might not be correct"; and it shows the last hidden item while "hoping it's size does not exceed overflow menu size." It also has `groupId`, `pinned`, and `minimumVisible` — i.e. Microsoft independently arrived at C11-PROOF's correction that *collapse must apply to a declared group*. Our `data-priority`/`data-collapse` is a **better-packaged** version of a solved problem, not an unsolved one.
5. **The philosophically closest live prior art is `every-layout.dev`, and it is a $69 book, not a package — which is the adoption warning.** Every Layout's thesis is verbatim ours ("Employing algorithmic layout design means doing away with `@media` breakpoints, 'magic numbers', and other hacks, to create context-independent layout components") and it is used at the BBC and W3C. But its npm footprint is *an unofficial third-party port at 11 downloads/week*, against `tailwindcss` at **126,443,545/week**. The idea wins arguments and loses distribution. Utopia (fluid scales, `utopia-core`, 7,811/wk) and Open Props (25,880/wk) sit in the same band. **Every declaration-first layout system in this survey is between 10 and 26 thousand downloads/week. Every imperative one is between 100 thousand and 126 million.**

---

## Systems surveyed

| system | what it does | adoption (dl/wk, stars, last commit) | status | relevance |
|---|---|---|---|---|
| **GSS** (`gss/engine`, `gss/gss`) | Cassowary solver in a Web Worker; CCSS + Apple VFL syntax replaces browser layout | npm `gss` **3/wk**; engine 2,854★, last commit 2019-12-17 (README only; **last `src/` change 2015-02-04**); `gss/gss` **archived**, last commit 2014-02-02 | **DEAD** | Our closest dead ancestor. General solver in the browser. |
| **CCSS** (Borning/Badros et al., UW TR 99-05-01) | Constraint-hierarchy semantics for CSS 2.0 + `@precondition`/ordered `@import` fallback | zero production adoption (research only; one Amaya 1.4a prototype) | superseded; never adopted by CSS WG | Specifies declared ordered fallback and the "no author-REQUIRED" rule 27 years before we rediscovered them. |
| **Cassowary** (Borning/Marriott/Stuckey/Xiao, UIST '97) | Incremental simplex over linear equalities/inequalities with constraint strengths | `unknown` as a library; shipped as the macOS layout engine from Lion, July 2011 (UW project page) | alive inside Apple | The algorithm every constraint-layout system descends from. |
| **`nucleic/kiwi`** (C++ Cassowary) | Efficient C++ Cassowary implementation | 782★, last push **2026-08-22** (active) | alive | Live boring solver; used from Python (matplotlib), not from web UI. |
| **`IjzerenHein/kiwi.js`** | TypeScript Cassowary port | npm **3,824/wk**; 256★; **archived**, last push 2021-12-02 | archived → forked | The canonical JS Cassowary. Archived by its author. |
| **`@lume/kiwi`** (the live fork) | Same solver, maintained under Lume | npm **54,167/wk**; 212★; last push 2025-06-28; **12 direct / 33 total dependents** | alive, niche | Adoption is *canvas/WebGL/scene-graph*, not DOM layout — see below. |
| **`autolayout` / `@lume/autolayout`** | Apple VFL parser on top of kiwi.js | npm **169/wk** | moribund | Auto Layout's *syntax* on the web: near-zero demand. |
| **`cassowary.js`** (Slightly Off) | Earlier JS Cassowary, used by GSS-era experiments | npm **1/wk** | dead | Quantifies the collapse. |
| **Apple Auto Layout** (`NSLayoutConstraint.priority`, `UIStackView`) | Cassowary with per-constraint priorities + content hugging / compression resistance | ships on every Apple device; developer-adoption count `unknown` (no public metric exists) | alive, mandatory | One of only two mass-deployed constraint layouts (with Android's). Also the one developers complain about most — see HN evidence. |
| **`NSToolbarItem.VisibilityPriority`** | Declared per-item priority; toolbar pushes low-priority items into an overflow menu | ships in AppKit (and UIKit from iOS 13.0 / macCatalyst 13.1); usage count `unknown` | alive | **Exactly `data-priority` + `data-collapse`**, shipped by a platform vendor. |
| **Flutter** | One-pass "constraints down, sizes up"; `Flex`/`Expanded`; `Intrinsic*` as an explicitly discouraged escape | 178,660★; last push 2026-08-26 | alive, huge | Deliberately rejected constraint solving. Documented rationale. |
| **Android `ConstraintLayout`** | XML-declared constraints + chains + barriers + `layout_constraintHorizontal_bias` | `androidx/constraintlayout` **archived** 2023-10-24, 1,085★ (dev moved into AOSP/androidx) | alive upstream, mirror archived | Constraint layout that *did* win at scale — on a platform with a visual editor. |
| **Jetpack Compose** | `Modifier` chains, `weight`, `IntrinsicSize`; single-pass measure/layout like Flutter | ships with androidx (`androidx/androidx` mirror 6,071★, pushed 2026-08-26); standalone count `unknown` | alive | Google's *second* clean-slate framework also declined a solver. |
| **CSS flex/grid/`clamp()`/`minmax()`/`fr`** | Intrinsic + fractional distribution; the browser's own intent solver | universal (Baseline widely available); per-package count n/a | alive | Tier 2 of our design. Already does the continuous work. |
| **CSS `position-try-fallbacks` / `position-try-order`** | Declared ordered position options; first that doesn't overflow wins; `most-height` re-sorts by available space | `position-try-fallbacks` Chrome 128 / Firefox 147 / Safari 26; `position-try-order` Chrome 125 / Firefox 148 / Safari 26 (MDN BCD) | **shipping, all three engines** | All three browser engines shipped *declared-priority fallback*. Our `data-collapse` idea, in the platform. |
| **`@container style()`** (CSS Conditional 5) | Query an ancestor container's custom-property value by name | `@container` Chrome 105 / Firefox 110 / Safari 16; `style()` for custom properties Chrome 111 / Firefox 151 / Safari 18; already adopted in this repo (`bd90728`) | shipping | The mechanism our resolution table already uses. |
| **`text-wrap-style: balance \| pretty`** | UA re-selects among existing soft wrap opportunities for quality | Chrome 130 / Firefox 124 / Safari 17.5 | shipping | Precedent for "engine optimises typography globally", TeX-style. |
| **`field-sizing: content`** (CSS Forms 1) | Form controls size to content instead of a UA default | Chrome 123 / Firefox 152 / Safari 26.2 | shipping | The platform deleting a hand-picked width. |
| **`contain-intrinsic-size`** (CSS Sizing 4) | Author-declared placeholder size under size containment | Chrome 83 (2020); all engines | shipping | The platform's answer to "measurement is expensive": declare it. |
| **`@fluentui/react-overflow` / `priority-overflow`** | `ResizeObserver` + priority queue + groups + pinning + overflow menu | **377,315/wk** (`@fluentui/react-components` 394,167/wk); repo 20,226★, pushed 2026-08-26 | **alive, industrial** | The real, shipped implementation of C11's fit tier. Read its hacks. |
| **`@vaadin/menu-bar`** | Enterprise overflow menu bar | **70,017/wk** | alive | Second industrial implementation. |
| **`react-overflow-list`** | React "render until overflow, then menu" | **113,720/wk** | alive | Third. The pattern is commoditised. |
| **`priority-nav`** | The original "priority+ navigation" jQuery-era plugin | **1,154/wk** | moribund | The toy tier. |
| **Every Layout** (`every-layout.dev`) | 12 algorithmic layout primitives as custom elements; explicitly anti-breakpoint, anti-magic-number | $69 book; unofficial npm `every-layout` **11/wk**; used by BBC, W3C, web.dev | alive as a book | **Most philosophically aligned prior art on the web.** Also the adoption warning. |
| **Utopia** (`utopia-core`) | Generates `clamp()` fluid type/space scales from two viewport anchors | **7,811/wk**; last publish 2024-09-19 | alive | Derivation-from-a-scale, in production, without JS. |
| **Open Props** | CSS custom properties as a design-token supply | **25,880/wk**; 5,501★; pushed 2026-08-11 | alive | Tokens without derivation — the level below us. |
| **`fluid-tailwind` / `tailwindcss-fluid-type`** | Fluid scales retro-fitted onto Tailwind | **20,096/wk** / **5,620/wk** vs `tailwindcss` **126,443,545/wk** | alive, marginal | Quantifies demand for derivation *inside* the dominant ecosystem: ≈0.016%. |
| **Subform** (`subformapp.com`, `lynaghk/subform-layout`) | Visual design tool on a bespoke declared-layout engine (space-before/size/space-after, stretch units) | shut down **2018-07-06**; repo 196★, last push 2018-03-09, non-commercial licence | **DEAD** | The best-articulated rejection of both flexbox *and* Cassowary, by someone who shipped a third thing. |
| **`facebook/yoga`** | Flexbox as an embeddable engine (React Native's layout) | 18,888★; pushed 2026-08-24 | alive, huge | The system that beat Cassowary in the one head-to-head that mattered. |

---

## What each one actually does

### 1. Cassowary — the algorithm, and what "priority" actually buys

Primary source: Borning, Marriott, Stuckey & Xiao, *Solving Linear Arithmetic Constraints for User Interface Applications*, UIST '97, pp. 87–96:

> "Linear equality and inequality constraints arise naturally in specifying many aspects of user interfaces… **Current constraint solvers designed for UI applications cannot efficiently handle simultaneous linear equations and inequalities. This is a major limitation.** We describe incremental algorithms based on the dual simplex and active set methods that can solve such systems of constraints efficiently."
> — <https://constraints.cs.washington.edu/solvers/uist97.html>

The load-bearing part for us is not the simplex; it is the **constraint hierarchy**. From the CCSS paper (UW TR 99-05-01, "CONSTRAINT CASCADING STYLE SHEETS" section):

> "A constraint hierarchy consists of a collection of constraints, each labeled with a strength. There is a distinguished strength labeled REQUIRED: such constraints must be satisfied. The other strengths denote preferences… **the constraint solver must find a solution to the variables that satisfies the required constraints exactly, and that satisfies the preferred constraints as well as possible, giving priority to those more strongly preferred.**"

**What it can express:** any linear relation between any two boxes anywhere in the tree, with a total order of preference between conflicting wishes.
**What it cannot express — stated by the people who tried to ship it on the web:** text. From the HN thread on GSS, `masklinn` summarising @vjeux's (Christopher Chedeau's) reasons for choosing flexbox over Cassowary for React Native:

> "* **you can't express text wrapping which is a huge issue.** You've got to do workarounds in order to support it
> * the api is very reference based. You need to say that the right of this element is left of this other one… the best api with react is one based on containers. `<HorizontalLayout>`… **you could use cassowary as an implementation detail of flexbox but that doesn't give you much**
> * also, when i tested cassowary, the js version, it was extremely slow. The version that we have in react native barely appears in traces for real code that we have"
> — <https://news.ycombinator.com/item?id=9677306> (2015-06-08)

That decision produced `facebook/yoga` (18,888★, actively developed 2026-08-24). The counterfactual is settled: **the largest cross-platform layout engine of the era evaluated Cassowary and shipped flexbox.**

**Adoption of the JS ports, precisely.** `IjzerenHein/kiwi.js` — the canonical TypeScript Cassowary — is **archived** (256★, last push 2021-12-02) at 3,824 dl/wk. Its live fork `@lume/kiwi` does 54,167 dl/wk but has only **12 direct dependents / 33 total** (deps.dev). Sampling those dependents: `lume` (a WebGL/3D scene-graph framework), `@lume/autolayout`, `laymur` ("Constraint-based UI library for **Three.js mobile advertisements**"). `autolayout` (Apple VFL on the web) does **169/wk**; `cassowary.js` does **1/wk**.

> **The pattern that matters: JS Cassowary survives in canvas/WebGL/diagram contexts — places with no browser layout engine to compete with. Where CSS exists, it lost.**

### 2. Apple Auto Layout and `NSToolbar` — the mass-deployed version

`NSLayoutConstraint.priority` is Cassowary's strength, exposed. `UIStackView.distribution` and content hugging / compression resistance priorities are the per-axis intent knobs. But the piece that is *literally our design* is toolbar overflow:

> "When a toolbar doesn't have enough space to fit all its items, it pushes items into the overflow menu to make space. Use these constants to suggest a priority for individual toolbar items. **The toolbar pushes low-priority items to the overflow menu first**, followed by standard items and high-priority items. **When two or more items share the same priority, the toolbar pushes the one closest to the trailing edge first.**"
> — `NSToolbarItem.VisibilityPriority`, <https://developer.apple.com/documentation/appkit/nstoolbaritem/visibilitypriority-swift.struct>

Note the tie-break rule: *closest to the trailing edge first*. C11-PROOF recorded the same problem ("ties broke by DOM order and hid the wrong action") and answered it by requiring a declared **group**. Apple answered it with a positional rule. Both are admissions that **priority alone under-determines the answer.**

**Vocabulary size:** four values (`user`, `high`, `standard`, `low`). That is a real datapoint for §7.13: a platform vendor shipping this in production settled on **four** priority levels, not a numeric scale. (`[UNVERIFIED]`: the exact AppKit version that introduced it — the current docs page carries availability annotations only for iOS 13.0 / macCatalyst 13.1, with macOS listed as `-`.)

**The honest cost, from practitioners.** HN, 2015, top comment (199 points on the story), `hamstergene`, "GUI dev who worked with Apple's AutoLayout extensively":

> "constraint-based layout is a trap. It looks like more intuitive way to go on simple examples, but **complexity spikes quickly as number of controls goes up**. It's more complicated, more resilient to changes (harder to maintain), easy to get wrong, hard to understand and debug, **bugs generally look uglier (what would be minor misplacement in CSS often becomes overlapping or clipping)**. **It does not support word wrapping without hacks** and restrictive assumptions about width. It is a real mess to insert/remove controls dynamically."

And `thewarrior`:

> "there's a certain impedance mismatch between how you want your elements to be laid out and what constraints are required to achieve the same result. **Humans beings aren't wired to intuitively think like a constraint solver.**"

### 3. GSS — the dead ancestor, in detail

**What it was.** From the repo README (`gss/engine README.md:6`):

> "Compiles and runs Grid Style Sheet (GSS) rules. GSS is an implementation of **Badros & Borning's Constraint Cascading Style Sheets**, enabling far better layout control through building relational rules between different elements."

Two syntaxes: **CCSS** (direct constraints on position/size) and **VFL** (Apple's Visual Format Language). The solver ran in a Web Worker.

**API shape**, from the demo quoted on HN:

```
@h |-(#message)~-~(#follow)~-~(#following)-(#followers)-|
in(#profile-card)
gap($sgap)
   !strong {
     &[top] == &:next[top];
   }
```

**Status, verified.** `gss/gss` is **archived**; `git log -1` on a fresh clone gives `6240c33 Sun Feb 2 11:44:33 2014 Henri Bergius — Remove CNAME from old site`. `gss/engine` is not archived, but its entire remaining history is documentation: the last five commits are `2019-12-17 Update README.md`, `2016-09-01 Merge pull request #209`, `2016-05-31 fix link in readme`, `2015-06-11 Merge pull request #195`, `2015-06-11 Remove moot version property from bower.json`. **The last change to `src/` was 2015-02-04 ("Fix failure when scripts is undefined") and the last change to `lib/` was 2015-01-16.** 194 issues total, ~112 open per issue #219. npm `gss`: **3 downloads/week**.

**The recorded death reason: there isn't one.** Two issues asked directly and **received no maintainer reply**:

- `gss/engine#216` "Is this project still alive?" (2016-08-29, closed with 1 comment): *"I haven't seen much activity in this project for months or even years. Travis checking is also broken."*
- `gss/engine#219` "Is this project dead?" (2017-10-02, **still open**, 2 comments): *"112 open issues, last commit was a year ago, and gridstylesheets.org has a new owner."*

There is no archive notice, no blog post, no maintainer statement. **Mark the *stated* cause `[UNVERIFIED]`.** This is the same evidentiary hole as Galen (§7.12 of the scratchpad) and it should be recorded the same way.

**What IS verified is the failure mode**, from users, in the repo. `gss/engine#117`, "Grid Layout Example (and beef report)" (2014-09-09), from a sympathetic user who wanted it to work:

> "I wanted to use CSS class selectors instead of calling out each object individually, but I had to do that in the end just to make my constraints more explicit and have in control. **With shared class selectors I ended up with very weird circular references that totally messed up my layout.** Most frustrating was that at some point a new VFL statement (even if it's contained with a `in(#group2)` attribute) **still totally breaks my layout**."
>
> "…it's not transparent **why**: It makes all three columns the same height *and* the cushion before `.endLine` makes the line move to the bottom of the column. That's exactly what I needed, but **it's unclear to me why**… I am afraid this is an unintended result at this point"
>
> "At this point, today I felt like »**there should be a better way than trial-and-error'ing this!**«"

His own resolution, four months later: *"I stayed away from VFL for the most part and used clearer CCSS. I think the issue was that I was using a vfl statement `in(.column)` that created too many constraints."*

**This is the single most important paragraph in this file for us.** The user's complaint is not performance. It is that **a rule that applies to a class generates one constraint per matched element, and the author cannot predict the resulting system.** Our `data-layout` / `data-priority` attributes are per-element and our resolution table is per-role — so we generate constraints the same way GSS did: *by rule, over a matched set*. F9 in the C11 prototype (*"the resolution table stating an impossible constraint"*) is the same class of failure, found from the other end.

Secondary confirmations from the same era: `gss/engine#182` "GSS Hangs using VFL", `#129` "Conditional creates infinite loop", `#199` "Order of members in constraint declaration matters. Why?", `#198` "Constraint ignored in ruleset, but respected as standalone."

And from the 2015 HN thread, three independent reports that the *demo site itself* was broken:

- `freyr`: *"I go to the demo, resize the browser window, and the layout falls apart."*
- `weego`: *"Demos were all slightly wrong on Android chrome until I rotated screen at which point they completely broke."*
- `Otik` / `AdamTReineke`: unusable in IE, with screenshots.

### 4. CCSS (1999) — the paper GSS implemented, and what it already contains

`Constraint Cascading Style Sheets for the Web`, UW TR 99-05-01 (rev. 1999-08-03). Read this one properly; it is not a summary of our idea, it *is* our idea, with a solver.

**It already has declared ordered fallback**, which is `position-try-fallbacks` twenty-five years early:

```css
@precondition Browser[frame-width] >= 800px;
@precondition ColorMonitor = True;
@import "wide.css", "tall.css", "small.css";
```

> "the first applicable sheet is used (the others are ignored)… If `wide.css`'s preconditions fail, but `tall.css`'s succeed, the layout uses `tall.css`. **If, through the course of the user resizing the top-level browser frame, `wide.css`'s preconditions later become satisfied, the layout does not switch to that style sheet unless `tall.css`'s preconditions are no longer satisfied.**"

That last sentence is **hysteresis, specified**. Our fit solver needs exactly this and the prototype does not have it. (Chromium's anchor-positioning implementation needed it too — the spec has a whole subsection, §6.5.1.1 *"record the last successful position option"*.)

**It already forbids author-declared hard constraints** — the rule C11-PROOF derived independently as F11:

> "**the style sheet author is not allowed to explicitly specify a constraint to be REQUIRED as this would admit the possibility of an unsatisfiable constraint system.** Instead, REQUIRED constraints are generated implicitly for capturing relationships inherent in the structure of the layout, such as a table's width being the sum of the widths of its columns."

**It already identifies inheritance-as-derivation as the hard case**, and it needed a mechanism beyond constraints to fix it:

> "One possible weighted-sum-better solution to these constraints is that the heading is in 12 pt and the rest of the document (including the paragraph) is in 8 pt. **The problem is that the paragraph element #p has 'inherited' its value from its *child*.**… To capture the directionality of inheritance we use *read-only* annotations on variables"

A general solver run over a tree will happily propagate a leaf's constraint *upward*. Our design gets directionality for free because it uses CSS custom-property inheritance, which is one-way by construction. **That is a real structural advantage of the nisli design over GSS, and it is worth stating in those terms.**

**Their measured cost, and their stated open problem:**

> "The unmodified browser performed each re-load and re-render in 190 ms, while our prototype took only 250 ms even when sized to select the last alternative style sheet in each of three `@import` directives."

> "substantial work remains to develop an industrial-strength browser supporting full CCSS… A more complete implementation will be **especially useful for investigating the important issue of how well the constraint systems and solver scale to larger, more complicated designs** that further exploit our constraint extensions."

They never ran that experiment. GSS ran it and died. Nobody has run it since.

### 5. Subform — the tool that rejected flexbox *and* Cassowary, and shut down anyway

Kevin Lynagh's *Why Not Flexbox?* (2018-03-05, <https://subformapp.com/articles/why-not-flexbox/>):

> "**When we first launched on Kickstarter, we did! However, in working with our backers, we quickly realized that flexbox was too difficult to learn.** Flexbox introduces new concepts (`flex`, `justify-content`, `align-items`, etc.) on top of existing CSS concepts (margins, padding, absolute positioning, etc.), **all of which interact with in surprising and literally invisible ways.**"

The replacement engine, verbatim (`lynaghk/subform-layout README.md`, and the same list in the article):

> - "All elements have a horizontal and vertical axis, each of which consists of **space before, size, and space after**.
> - Elements either control their own position ("self-directed", akin to CSS absolute positioning) or are positioned by their parent ("parent-directed").
> - Parents can position their parent-directed children in a vertical stack, horizontal stack, or grid.
> - The same units — **pixels, percentages (of the parent size), and stretch** (akin to flex, proportionally dividing up available space) — are used everywhere, **with minimum and maximum constraints as part of the unit**."

Design principle worth stealing outright: *"Uniform stretch units. By allowing stretch units to be used everywhere (instead of just on an element's size in the flex direction), **we eliminate the flexbox trivia of `justify-content`, `align-items`, etc.** These values are just special cases of more general spacing rules." And: "**The layout engine is symmetric.** A stack child's cross axis and both axes of a self-directed child act the same as a main axis with only one element."*

**Why it died — primary source, the founder, verbatim** (<https://talk.subformapp.com/t/important-announcement-winding-down-subform/1839.html>, 2018-07-06):

> "As for why we're shutting down: **we just don't think there's a place in the market where Subform can compete.**"
>
> "For now, the brief explanation is that **we weren't able to find a place where Subform fits into most designers' workflows.**"
>
> "In testing and talking with a huge range of designers, **we found that the promise of Subform was different for everyone.** Many wanted a more efficent drawing tool, but only if it has full feature parity with Sketch. Some wanted complex conditional logic for prototyping, a la Axure. Others wanted a tool for visually composing React components, a WYSIWYG web editor, and so on."
>
> "**there isn't a single product scope that's achievable in the near-team—and is still useful and usable for the majority of testers.** Going forward, we suspect that we'll see more specialized tools for specialized tasks, rather than monoliths."

The promised full post-mortem was never published (checked `kevinlynagh.com`; the site describes Subform in the past tense and points at the "Choosing features" talk). **The death reason is verified as *market fit*, not as *the layout model was wrong*.** That distinction matters: Subform's engine is the closest thing in this survey to a working proof that a smaller, uniform, declared vocabulary beats flexbox on learnability — and it was never falsified. It was just unsellable as a design tool.

The companion article, *Dynamic Layout at Design Time* (Ryan Lucas, 2018-03-06), contains the diagnosis we should treat as the warning label on `@nisli/next`:

> "our primary theory is a simple one: **tools that surface production constraints often feel too restrictive to designers.** This is particularly true during the divergent phases of design… **Constraint-based tools can force you to formalize design decisions and wrestle with details before you're ready. It often feels like the tool is fighting you, rather than being a medium for thought.**"

And the footnote that saves us an experiment:

> "many drawing-based tools like Sketch have added basic 'pinning' or 'resizing' constraints (what Apple called 'springs & struts')… **while easy to use and understand, they don't really simulate most production layout systems—and tend to break with any sort of real-world layout complexity. (For this latter reason, Apple abandoned springs & struts in favor of the AutoLayout constraint solver.)**"

So the recorded arc is: springs & struts → too weak → Cassowary → too hard → flexbox (React Native/Yoga) / Subform's uniform model / Flutter's one-pass model. **Everybody who moved off Cassowary moved *down* in expressiveness, not up.**

### 6. Flutter — the explicit rejection, in the framework's own words

`docs.flutter.dev/resources/inside-flutter`, section "Sublinear layout", written by a founding engineer:

> "**Some other toolkits use layout algorithms that are O(N²) or worse (for example, fixed-point iteration in some constraint domain). Flutter aims for linear performance for initial layout**, and *sublinear layout performance* in the common case of subsequently updating an existing layout."
>
> "Flutter performs one layout per frame, and **the layout algorithm works in a single pass**… once a render object has returned from its layout method, that render object will not be visited again until the layout for the next frame. **This approach combines what might otherwise be separate measure and layout passes into a single pass** and, as a result, each render object is visited *at most twice* during layout."
>
> "**More generally, during layout, the *only* information that flows from parent to child are the constraints and the *only* information that flows from child to parent is the geometry.**"

The user-facing rule, from `docs.flutter.dev/ui/layout/constraints`:

> "**Constraints go down. Sizes go up. Parent sets position.**"

and, under "Limitations":

> "Flutter's layout engine is designed to be a one-pass process. This means that Flutter lays out its widgets very efficiently, **but does result in a few limitations:** A widget can decide its own size only within the constraints given to it by its parent… A widget **can't know and doesn't decide its own position in the screen**… **If a child wants a different size from its parent and the parent doesn't have enough information to align it, then the child's size might be ignored.**"

**The escape hatch, and its documented price.** `flutter/flutter packages/flutter/lib/src/widgets/basic.dart:3804-3807`:

```dart
/// This class is relatively expensive, because it adds a speculative layout
/// pass before the final layout phase. Avoid using it where possible. In the
/// worst case, this widget can result in a layout that is O(N²) in the depth of
/// the tree.
```

and `packages/flutter/lib/src/rendering/box.dart:1647`:

```dart
/// Calling this function is expensive as it can result in O(N^2) behavior.
```

(the same warning appears at `:1647`, `:1788`, `:1865`, `:1941`, `:2021` — once per intrinsic-dimension getter).

**What Flutter can express:** proportional distribution (`Expanded`/`Flexible` with `flex:`), tight/loose constraints, min/max on both axes.
**What it cannot express without paying the O(N²):** "make this as wide as its widest sibling", i.e. any relation *between* siblings — precisely the class our fit solver targets. Flutter's answer is: **don't, and if you must, know that it costs a speculative pass.**

### 7. Android `ConstraintLayout` and Jetpack Compose

`ConstraintLayout` is the one constraint-based layout that won at scale — and note the conditions under which it won: **XML markup, an offline compiler-free solve, and a WYSIWYG editor in Android Studio**. The GitHub mirror `androidx/constraintlayout` is **archived** (2023-10-24, 1,085★) with development folded into androidx/AOSP; the framework itself is standard on Android. `[UNVERIFIED]`: I could not locate a Cassowary attribution in the current androidx source via GitHub code search (`repo:androidx/constraintlayout Cassowary` → 0 results); the solver lives in `androidx.constraintlayout.core.LinearSystem` and is widely described as Cassowary-derived, but I did not verify that from source in this pass.

The relevant adversarial datapoint is what Google did *next*. Jetpack Compose — the clean-slate successor — uses `Modifier` chains, `weight`, and `IntrinsicSize`, i.e. **Flutter's model, not ConstraintLayout's**. `ConstraintLayout` for Compose exists but is not the default and is not what the docs lead with. **Two clean-slate framework designs at Google, both after ConstraintLayout shipped, both declined the solver.**

### 8. CSS's own solvers, as intent systems

These are tier 2 of the C11 design and it is worth being precise about what each one already decides for us.

- **`flex-grow` / `flex-shrink` / `flex-basis`** — proportional distribution of free space and of overflow. Expresses "who absorbs slack". Cannot express "who disappears".
- **`minmax()` / `auto-fit` / `fr` / `repeat(auto-fit, minmax(X, 1fr))`** — the closest thing CSS has to declared reflow: the track count is derived from available width. Cannot express *priority*: tracks are interchangeable.
- **`clamp(min, preferred, max)`** — the fluid-scale primitive. This is what Utopia generates.
- **`text-wrap-style: balance | pretty | stable | avoid-short-last-line`** (CSS Text 4, §5.4): *"this property selects between several approaches for wrapping lines, trading off between speed, quality and style of layout, or stability. **It does not change which soft wrap opportunity exist, but changes how the user agent selects among them.**"* — this is TeX-style global optimisation, shipped, with the tradeoff named in the spec. Precedent for the C11 thesis, in the platform.
- **`contain-intrinsic-size`** (CSS Sizing 4) — under size containment, the author *declares* the size the engine should assume rather than measuring. **The platform's own answer to "measurement is expensive" is "declare it instead."**
- **`field-sizing: content`** (CSS Forms 1, §7.1): *"`fixed` | `content`… For element with default preferred size, the UA must set the intrinsic size to the default preferred size defined by the host language"*. One keyword deletes a hand-picked width from every form control. Exactly our move, at one-property scale.
- **`@container style(--x: y)`** (CSS Conditional 5) — context legible by name. Already adopted in this repo at `bd90728`.

**And the one that is genuinely our design, shipped by a browser vendor:**

**`position-try-fallbacks` / `position-try-order`**, CSS Anchor Positioning L1 (W3C WD 2026-05-08, ED `86ff5dd`) — shipping in **all three engines** (`position-try-fallbacks`: Chrome 128, Firefox 147, Safari 26; `position-try-order`: Chrome 125, Firefox 148, Safari 26 — MDN browser-compat-data):

> "an absolutely positioned box can use the `position-try-fallbacks` property to specify additional *position options*… Each position option is applied to the box, **one by one in the order specified by `position-try-order`, and the first that doesn't cause the box to overflow its containing block is taken as the winner.**"

```css
position-try-fallbacks: flip-x, flip-y, flip-x flip-y, bottom, top;
position-try-order: most-height;
```

`<try-tactic> = flip-block || flip-inline || flip-start || flip-x || flip-y`
`<try-size> = most-width | most-height | most-block-size | most-inline-size`

> "`most-width` … For each entry in the position options list, apply that position option to the box, and find the inset-modified containing block size… **Because `position-try-order` uses a stable sort**, these pairs will each retain their relative positions in the list"

**Read that as a design review of our `data-collapse`.** The CSS WG's shipped model is: (a) a declared *ordered list* of discrete options, (b) an *objective function* (`most-*`) that may re-sort the list, (c) a **stable sort** so declaration order survives ties, (d) an explicit "last successful option" memory to prevent oscillation (§6.5.1.1), and (e) a separate `position-visibility` property for "give up and hide". Our prototype has (a) and needs (b)–(e).

### 9. Priority-driven collapse on the web — how real, and what breaks

The pattern ("priority+ navigation", coined by Michael Scharnagl / popularised by Brad Frost) exists at three tiers.

**Toy tier:** `priority-nav` — **1,154 dl/wk**.

**Real tier:** `react-overflow-list` (**113,720/wk**), `@vaadin/menu-bar` (**70,017/wk**).

**Industrial tier:** Microsoft's `@fluentui/react-overflow` (**377,315/wk**), built on the framework-agnostic `priority-overflow` package. Its declared vocabulary (`microsoft/fluentui packages/react-components/priority-overflow/src/types.ts`) is startlingly close to ours:

```ts
export interface OverflowItemEntry {
  element: HTMLElement;
  /** Lower-priority items become invisible first when the container overflows. @default 0 */
  priority: number;                       // ← data-priority
  id: string;
  /** Optional group id used to coordinate divider and grouped visibility states. */
  groupId?: string;                       // ← C11-PROOF's "collapse applies to a declared group"
  /** If true, the item will never overflow and will always be visible. @default false */
  pinned?: boolean;                       // ← we have no equivalent
}
export type OverflowGroupState = 'visible' | 'hidden' | 'overflow';
```

**Now the hacks — this is the part worth more than the API.** From `priority-overflow/src/overflowManager.ts`:

```ts
// :18-19
  padding: 10,
  minimumVisible: 0,
```
```ts
// :200
    const availableSize = getClientSize(container) - options.padding;
```

and the documented reason for that magic 10, from `types.ts:135-137`:

> "Padding in pixels reserved at the end of the container before overflow occurs. Useful for accounting for extra elements (for example an overflow menu button) **or margins between items that are difficult to measure in JavaScript.** @default 10"

Then the loop itself (`overflowManager.ts:210-222`):

```ts
    // Run the show/hide step twice - the first step might not be correct if
    // it was triggered by a new item being added - new items are always visible by default.
    for (let i = 0; i < 2; i++) {
      while (
        (occupiedSize() < availableSize && invisibleItemQueue.size() > 0) ||
        invisibleItemQueue.size() === 1 // attempt to show the last invisible item hoping it's size does not exceed overflow menu size
      ) {
        showItem();
      }
      while (occupiedSize() > availableSize && visibleItemQueue.size() > options.minimumVisible) {
```

and the update is debounced (`const update = debounce(forceUpdate);`), i.e. **there is a visible window in which the layout is wrong.**

Read the three comments together: a hand-tuned pixel constant *because margins are hard to measure*; a loop run twice *because one pass is not fixed*; and an item shown *hoping* its size fits. This is the most-deployed implementation of C11 tier 3 in the world, maintained by Microsoft, on a repo pushed today. **If our fit solver is ~35 lines and has none of these, the honest reading is that we have not yet met the cases that forced them.**

### 10. Fluid/derived scales — Every Layout, Utopia, Open Props

**Every Layout** (Heydon Pickering & Andy Bell, `every-layout.dev`) is the closest thing to our thesis in the web space and it is stated in almost our words:

> "If you find yourself wrestling with CSS layout, it's likely you're **making decisions for browsers they should be making themselves.** Through a series of simple, composable layouts, Every Layout will teach you how to better harness the built-in algorithms that power browsers and CSS."
>
> "**Employing algorithmic layout design means doing away with `@media` breakpoints, 'magic numbers', and other hacks, to create context-independent layout components.**"

The site's prose says "**12** specially designed, modular layout solutions"; its own index currently links **13**, and the list maps almost one-to-one onto a `data-layout` vocabulary: **Stack, Box, Center, Cluster, Sidebar, Switcher, Cover, Grid, Frame, Reel, Imposter, Icon, Container**. Shipped as "interoperable custom elements" to purchasers. Named users: BBC, W3C, web.dev, EMBL, FreeAgent. Testimonial from Josh Tumath (BBC): *"It's revolutionized our design system at the BBC."*

**Adoption, honestly:** the official artifacts are behind a $69 paywall and are not on npm. The npm package named `every-layout` is a **third-party port** (`aarohmankad/every-layout`, description "Composable layouts using CSS best practices", last modified 2022-05-01) doing **11 downloads/week**. Sales figures are `unknown`; the site claims "thousands of developers".

**Utopia** — `utopia-core` (`trys/utopia-core`, latest 1.6.0, 2024-09-19) at **7,811 dl/wk**. Mechanism: generate `clamp()` expressions interpolating a type/space scale between two viewport anchors. This is derivation-without-breakpoints in production CSS, zero runtime.

**Open Props** — 5,501★, pushed 2026-08-11, **25,880 dl/wk**. *"CSS custom properties to help accelerate adaptive and consistent design."* It is the tier below us: a *supply* of tokens, with no derivation from context.

**And the calibration number.** Fluid-scale plugins *inside* Tailwind: `fluid-tailwind` **20,096/wk**, `tailwindcss-fluid-type` **5,620/wk**, against `tailwindcss` itself at **126,443,545/wk**. That is **≈0.02%** of Tailwind users reaching for derived scales. Meanwhile `@tailwindcss/container-queries` does **2,319,634/wk** (≈1.8%) — so context-awareness has ~100× the demand of value-derivation.

---

## Ideas worth stealing

1. **Ordered discrete fallback with a stable sort and an objective-function override.** From CSS Anchor Positioning (`position-try-fallbacks` + `position-try-order`). Our `data-collapse` currently has a priority list only. Take the whole shape: a declared ordered list of *named strategies*, a `most-*`-style objective that may re-sort them, a stable sort so declaration order survives ties, and `position-visibility`-style "give up" semantics as a distinct declaration rather than an implicit outcome. This is not speculation — a browser shipped it, so the ergonomics are already validated against real authors.
2. **Hysteresis as a first-class rule, not an implementation detail.** CCSS 1999 spelled it out: *"the layout does not switch to that style sheet unless [the current one's] preconditions are no longer satisfied"*. Anchor positioning re-derives it as "record the last successful position option" (§6.5.1.1). A resize-driven fit solver without hysteresis oscillates at the boundary; C11-PROOF has not been tested at a boundary width.
3. **Forbid author-declared hard constraints.** CCSS: *"the style sheet author is not allowed to explicitly specify a constraint to be REQUIRED as this would admit the possibility of an unsatisfiable constraint system."* Our F9 (the resolution table stating an impossible constraint) is exactly the failure this rule prevents. The nisli form: **floors are declared by the table, never by a component**, and the table's floors are checked for satisfiability statically (§7.21).
4. **Four priority levels, not a number.** `NSToolbarItem.VisibilityPriority` = `{user, high, standard, low}` after 25 years of production. Fluent uses a numeric `priority` and immediately needed `pinned` and `minimumVisible` to bound it. A small enum is more agent-legible (it enumerates), and the escape from "I need finer control" is *declare a group*, not *invent a number*.
5. **Declared groups, and pinning.** Fluent's `groupId` + `OverflowGroupState = 'visible' | 'hidden' | 'overflow'` independently confirms C11-PROOF's correction. Steal `pinned` too: "this action never collapses" is a real product requirement that priority alone cannot express (it says *last*, not *never*).
6. **Subform's uniform axis model as the `data-layout` semantics.** *"space before, size, space after"* on both axes, with the same unit set (`px`, `%`, `stretch`) usable in every slot, and min/max as part of the unit. Consequence, in Lynagh's words: *"we eliminate the flexbox trivia of `justify-content`, `align-items`"* — one concept replaces four. For an agent-authored vocabulary that is worth more than it is worth for a human, because it shrinks the menu.
7. **`contain-intrinsic-size` as the pattern for tier-3 cost.** The platform's answer to "measurement is expensive" is *let the author declare the answer and skip the measurement*. The nisli analogue: a container may declare its expected collapse point so the static tier resolves it and the measured pass never runs. That directly attacks the flash-of-unfit risk, which the prototype lists as unquantified.
8. **Every Layout's primitive list as the starting `data-layout` vocabulary.** Stack / Box / Center / Cluster / Sidebar / Switcher / Cover / Grid / Frame / Reel / Imposter / Icon / Container. Twelve-to-thirteen names, adopted at the BBC and W3C, already proven expressible in pure CSS with no breakpoints. §7.13 asks for "the complete list on paper"; this is a validated draft of it, from people who shipped it.
9. **Utopia's two-anchor `clamp()` generation for the type/space scale.** It removes the `--unit`-shrinks-monotonically problem behind F9: a `clamp()`-based scale has a floor *built into the value*, so a floor cannot fail to propagate — it is not a separate `max()` a derivation can forget.
10. **Flutter's invariant, stated as a checkable rule.** *"the only information that flows from parent to child are the constraints and the only information that flows from child to parent is the geometry."* If `@nisli/next` adopts this literally, the class of bug where a leaf's floor propagates upward and silently resizes an ancestor becomes unrepresentable — and it is a rule a static checker can enforce over the resolution table.

---

## Where the prior art says we are wrong

**1. The two best-resourced clean-slate framework teams of the last decade both evaluated this and chose *less* power. That is the single strongest signal in the file.**
Flutter's own architecture document names the rejected alternative — *"fixed-point iteration in some constraint domain"* — and rejects it on complexity. React Native evaluated Cassowary and shipped flexbox (Yoga, 18,888★). Jetpack Compose, designed *after* ConstraintLayout shipped and won on Android, uses `Modifier`/`weight`/`IntrinsicSize` rather than a solver. Three independent teams, three rejections, zero reversals. The C11 defence is "we don't solve general constraints, only bounded discrete fit decisions" — which is correct, and which is *exactly the argument Flutter makes for `IntrinsicWidth`*, a widget it documents as "relatively expensive… avoid using it where possible… O(N²) in the depth of the tree." **Our tier 3 is Flutter's `IntrinsicWidth`, and Flutter's considered advice about it is: don't.**

**2. Our thesis is that authors get this wrong because they must think in pixels. The recorded evidence is that authors get it wrong because they must think about *interactions between rules* — and a resolution table has exactly that problem.**
The GSS beef report is not about pixels: *"With shared class selectors I ended up with very weird circular references that totally messed up my layout… it's not transparent **why**… I am afraid this is an unintended result."* The author had removed every pixel from his authoring surface and was *more* confused, not less. Our resolution table generates values by rule over a matched set — the same generative mechanism. **F9 is the first instance, found by us, of the exact class of bug that killed GSS.** The scratchpad already draws the right conclusion ("the framework checks the table") but under-rates it: if the table needs its own static consistency checker, then the checker we said would fall out for free (§5.4 item 4, ~10%) has just doubled in scope, and the C11-PROOF cost signal was already *five oracle bugs to four page bugs*.

**3. "Nobody makes an eyes-decision" is not the same as "the decisions get made well", and the prior art says the second is a design problem no engine solves.**
`pavlov` on HN: *"Constraint-based layout engines do a great job of fixing complex theoretical non-problems that nobody was asking to have fixed, while at the same time failing to address real-world issues that impede users' everyday workflows."* Subform's own post-mortem of the design experience: *"Constraint-based tools can force you to formalize design decisions and wrestle with details before you're ready. **It often feels like the tool is fighting you, rather than being a medium for thought.**"* The scratchpad concedes this ("a solver delivers consistency, never beauty") and then weights the resolution table at 40% of the bet — i.e. the largest single component of the bet is the part with **no prior art that succeeded**. Radix Themes ships a mapping table at 974,514 dl/wk. Nobody ships a *derivation* table. That is either a moat or an empty category, and the evidence in this file cannot distinguish them.

**4. Priority-driven collapse is already commoditised, and its real implementation is uglier than our 35 lines.**
`@fluentui/react-overflow` at 377,315 dl/wk + `@vaadin/menu-bar` at 70,017 + `react-overflow-list` at 113,720 ≈ **560k weekly downloads of shipping priority-overflow**, with `groupId`, `pinned`, `minimumVisible`, an `OverflowGroupState` enum, and a `getSnapshot`/`subscribe` store. Our demo is their `padding: 10`-less special case. Worse for the marketing story: **the fit solver is what makes the thesis visible in a screenshot** (§5.4) and it is the part a reviewer can immediately identify as "Fluent already does this." The genuinely uncopied parts — exclusivity and derivation — are the two that produce no screenshot.

**5. Declaration-first layout has a consistent, decade-long adoption ceiling, and it is two to four orders of magnitude below the imperative alternative.**
Every Layout: philosophically identical, BBC/W3C adoption, and an npm surface of 11 dl/wk (unofficial port only). `utopia-core` 7,811. `open-props` 25,880. `fluid-tailwind` 20,096. `autolayout` (Apple VFL on the web) 169. `gss` 3. `cassowary.js` 1. Against: `tailwindcss` 126,443,545, `@radix-ui/themes` 974,514, `@blueprintjs/core` 455,372. And the sharpest cut is *within* Tailwind: `@tailwindcss/container-queries` at 2,319,634/wk (context-awareness, ~1.8% of users) versus `fluid-tailwind` at 20,096/wk (value-derivation, ~0.016%). **Developers already buy "know where you are". They do not buy "don't write the number".** ADR 0030.1's calibration — corpus and distribution decide leaderboards — is confirmed again here.

**6. Subform is the cleanest natural experiment we have, and it says the layout model was never the bottleneck.**
Lynagh and Lucas built the better layout engine (fewer concepts, applied uniformly, symmetric axes, min/max in the unit), shipped it, open-sourced an embeddable WASM build, and shut down — and the stated reason is *"we just don't think there's a place in the market where Subform can compete"* and *"the promise of Subform was different for everyone."* Nobody said the engine was wrong. Nobody used it either: `lynaghk/subform-layout` is 196★, last push 2018-03-09. **A superior declared-layout model, freely available for eight years, attracted no ecosystem.** If `@nisli/next`'s value proposition is the model, this is the outcome to plan against; if it is the *loop* (declare → derive → check, all mandatory because the channel is closed), then Subform is not a counter-example — but that means the checker, not the resolver, is the product, and §5.4 currently weights the checker at 10%.

---

## Open questions for the maintainer

1. **Do we ship hysteresis, and where does it live?** CCSS put it in the `@import` semantics ("don't switch back until the current one fails"); anchor positioning put it in a "last successful option" memory. Tradeoff: hysteresis prevents oscillation at boundary widths but makes the rendered result **depend on resize history**, which breaks "the same intent always resolves to the same pixels" (§5's consistency claim) and makes the derived checker's expectations path-dependent. Pick one; both are defensible; the prototype currently has neither and has not been tested at a boundary.
2. **Priority: enum or number?** Apple's shipped answer is four names (`user`/`high`/`standard`/`low`). Fluent uses a number and needed `pinned` + `minimumVisible` to fence it. An enum enumerates (agent-legible, validatable against a menu, §5's "context economics"); a number composes (a designer can insert between two existing levels without a migration). Cost of the enum: the first time someone needs a fifth level, the vocabulary changes and every callsite is affected.
3. **Do we adopt `pinned`?** "This action never collapses" is not expressible as a priority. It is a *different kind* of declaration (a hard constraint on the fit pass) — and CCSS's rule says authors should not be allowed to state hard constraints. Tradeoff: allow `pinned` and accept that a narrow-enough container becomes unsatisfiable in a way the author caused; forbid it and accept that "Save must always be visible" cannot be said.
4. **Does the resolution table get a `clamp()`-native scale (Utopia) or a `--unit` + `max()` floor scale (current)?** `clamp()` makes floors intrinsic to the value, so F9's "a floor must propagate through every derivation that bounds it" becomes structurally impossible rather than statically checked. Cost: `clamp()` interpolates against the *viewport* by default, and making it interpolate against a *container* requires container query units — which reintroduces a dependency on `container-type`, which creates containment, which changes intrinsic sizing. That is a real coupling and it needs measuring, not reasoning.
5. **Is the checker the product?** The Subform evidence says a better layout model does not sell; the axe-core evidence in `ROUND2-EVIDENCE-visual-oracle-prior-art.md` says a zero-authoring conformance check with a regime behind it does. §5.4 weights the checker at 10% and the table at 40%. If the adoption argument runs through the loop rather than the model, that weighting is inverted and the roadmap changes.
6. **Who authors the resolution table, and is there any prior art we can start from that is not a *mapping* table?** This survey found none. Radix Themes, Material component tokens, Open Props, Spectrum — all mappings. Starting from a mapping table and mechanising it is the only path this evidence supports, and it means the first version's beauty is inherited, not designed. That is a strategic choice about what "our" design system is.
7. **What is the answer to "Fluent already does this"?** It will be the first question from any reviewer who has seen the screenshot. The honest answer is exclusivity — Fluent's overflow is opt-in per container, ours is the only channel — but that answer is invisible in a demo. Decide now whether the demo leads with collapse (visible, commoditised) or with *the same component in four contexts* (less visible, genuinely uncopied).

---

## Belongs to another slice

- **`galen-ts` / Galen** — the authored-relational-DSL lineage is already covered in `ROUND2-EVIDENCE-visual-oracle-prior-art.md` R2 and belongs to the oracle slice, not here.
- **Figma auto-layout hug/fill and Figma variables** — a design-tool vocabulary question; likely `SemanticVocab`'s slice. Noted only because Subform is its dead competitor and the two should be read together.
- **`text-wrap: balance/pretty` as a *typography quality* oracle** (rather than as a layout primitive) and TeX's `\badness` — belongs to whichever slice owns "what does the engine optimise for". I have cited the spec's own framing here ("trading off between speed, quality and style of layout") and left it there.
- **`@fluentui/react-overflow`'s `getSnapshot`/`subscribe` store shape** — a reactive-integration question for `FitDomain`; relevant because it is how an industrial implementation avoids re-rendering the whole toolbar on every resize tick.
- **WCAG 2.2 target-size and `axe-core`'s `getLargestUnobscuredArea`** — already owned by `VerificationDomain` / the round-3 evidence.

---

## Sources

**Repositories read (cloned or via GitHub API, 2026-08-25)**
- `gss/gss` — <https://github.com/gss/gss> — archived; `git log -1` → `6240c33fde00e368c458d2012386e9d6eadf1e2d Sun Feb 2 11:44:33 2014 +0100 Henri Bergius Remove CNAME from old site`; 2★
- `gss/engine` — <https://github.com/gss/engine> — `README.md:6`; `git log -1` → `be430ea249f8030e11c8e03a8e170dcc8b8cf5fb Mon Dec 16 16:22:15 2019 -0800 Update README.md`; `gh api repos/gss/engine/commits?path=src` → last `src/` change 2015-02-04; `?path=lib` → 2015-01-16; 2,854★; 194 issues
- `gss/engine#117` "Grid Layout Example (and beef report)" — <https://github.com/gss/engine/issues/117>
- `gss/engine#216` "Is this project still alive?" — <https://github.com/gss/engine/issues/216>
- `gss/engine#219` "Is this project dead?" — <https://github.com/gss/engine/issues/219>
- `gss/engine#182`, `#129`, `#198`, `#199` (titles only, via GitHub issue search)
- `microsoft/fluentui` `packages/react-components/priority-overflow/src/overflowManager.ts:18-19, :200, :207, :210-222` — <https://github.com/microsoft/fluentui/blob/master/packages/react-components/priority-overflow/src/overflowManager.ts>
- `microsoft/fluentui` `packages/react-components/priority-overflow/src/types.ts:25, :40, :135-137` — <https://github.com/microsoft/fluentui/blob/master/packages/react-components/priority-overflow/src/types.ts>
- `microsoft/fluentui` `packages/react-components/react-overflow/library/src/types.ts` — <https://github.com/microsoft/fluentui/tree/master/packages/react-components/react-overflow>
- `flutter/flutter` `packages/flutter/lib/src/widgets/basic.dart:3804-3807, :3879-3882` — <https://github.com/flutter/flutter/blob/master/packages/flutter/lib/src/widgets/basic.dart>
- `flutter/flutter` `packages/flutter/lib/src/rendering/box.dart:1647, :1788, :1865, :1941, :2021` — <https://github.com/flutter/flutter/blob/master/packages/flutter/lib/src/rendering/box.dart>
- `lynaghk/subform-layout` `README.md` — <https://github.com/lynaghk/subform-layout> — 196★, last push 2018-03-09
- `nucleic/kiwi` — <https://github.com/nucleic/kiwi> — 782★, pushed 2026-08-22
- `IjzerenHein/kiwi.js` — <https://github.com/IjzerenHein/kiwi.js> — 256★, **archived**, pushed 2021-12-02
- `lume/kiwi` — <https://github.com/lume/kiwi> — 212★, pushed 2025-06-28
- `androidx/constraintlayout` — <https://github.com/androidx/constraintlayout> — 1,085★, **archived**, pushed 2023-10-24
- `facebook/yoga` — <https://github.com/facebook/yoga> — 18,888★, pushed 2026-08-24
- `argyleink/open-props` — <https://github.com/argyleink/open-props> — 5,501★, pushed 2026-08-11
- `vaadin/web-components` — <https://github.com/vaadin/web-components> — 581★, pushed 2026-08-25

**Papers**
- Borning, Marriott, Stuckey & Xiao, *Solving Linear Arithmetic Constraints for User Interface Applications*, UIST '97, pp. 87–96 — <https://constraints.cs.washington.edu/solvers/uist97.html>
- Borning, Badros, Stuckey & Marriott, *Constraint Cascading Style Sheets for the Web*, UW TR 99-05-01 (rev. 1999-08-03) — <https://constraints.cs.washington.edu/web/ccss-uwtr.pdf>
- UW Cassowary project page (Auto Layout adoption note, July 2011) — <https://constraints.cs.washington.edu/cassowary/>

**Specs**
- CSS Anchor Positioning Module Level 1, W3C WD 2026-05-08 / ED rev. `86ff5dd`, §6.1 `position-try-fallbacks`, §6.2 `position-try-order`, §6.5.1.1, §6.6 `position-visibility` — <https://drafts.csswg.org/css-anchor-position-1/>
- CSS Text Module Level 4, §5.4 `text-wrap-style` — <https://drafts.csswg.org/css-text-4/>
- CSS Forms Module Level 1, §7.1 `field-sizing` — <https://drafts.csswg.org/css-forms-1/>
- CSS Box Sizing Module Level 4, `contain-intrinsic-size` — <https://drafts.csswg.org/css-sizing-4/>
- CSS Containment Module Level 3 (now a placeholder; container queries moved to CSS Conditional 5) — <https://drafts.csswg.org/css-contain-3/>

**Browser support data** (`mdn/browser-compat-data`, `main`, fetched 2026-08-25)
- `css/properties/position-try-fallbacks.json` — Chrome 128 (Chrome 125 under the removed name `position-try-options`), Firefox 147, Safari 26
- `css/properties/position-try-order.json` — Chrome 125, Firefox 148, Safari 26
- `css/properties/field-sizing.json` — Chrome 123, Firefox 152, Safari 26.2
- `css/properties/text-wrap-style.json` — Chrome 130, Firefox 124, Safari 17.5
- `css/properties/contain-intrinsic-size.json` — Chrome 83
- `css/at-rules/container.json` — `@container` Chrome 105 / Firefox 110 / Safari 16; `style_queries_for_custom_properties` Chrome 111 / Firefox 151 / Safari 18

**Vendor documentation**
- Flutter, *Inside Flutter*, "Sublinear layout" — <https://docs.flutter.dev/resources/inside-flutter>
- Flutter, *Understanding constraints* — <https://docs.flutter.dev/ui/layout/constraints>
- Apple, `NSToolbarItem.VisibilityPriority` — <https://developer.apple.com/documentation/appkit/nstoolbaritem/visibilitypriority-swift.struct>

**Post-mortems, articles, threads**
- Kevin Lynagh, *Winding down Subform* (2018-07-06) — <https://talk.subformapp.com/t/important-announcement-winding-down-subform/1839.html>
- Kevin Lynagh, *Why Not Flexbox?* (2018-03-05) — <https://subformapp.com/articles/why-not-flexbox/>
- Ryan Lucas, *Dynamic Layout at Design Time* (2018-03-06) — <https://subformapp.com/articles/dynamic-layout/>
- Hacker News, *Grid Style Sheets – Replace CSS with a Constraint-Solver* (2015-06-08, 199 points, 96 comments) — <https://news.ycombinator.com/item?id=9677306> — comments by `hamstergene`, `thewarrior`, `masklinn` (relaying @vjeux), `pavlov`, `cageface`, `freyr`, `weego`, `Otik`, `ux-app`
- Every Layout — <https://every-layout.dev/>

**Adoption figures (npm registry `downloads/point/last-week`, window 2026-08-18 → 2026-08-24)**
`tailwindcss` 126,443,545 · `@tailwindcss/container-queries` 2,319,634 · `@radix-ui/themes` 974,514 · `@blueprintjs/core` 455,372 · `@fluentui/react-components` 394,167 · `@fluentui/react-overflow` 377,315 · `@fluentui/react` 353,528 · `react-overflow-list` 113,720 · `flickity` 83,247 · `@vaadin/menu-bar` 70,017 · `@lume/kiwi` 54,167 · `open-props` 25,880 · `fluid-tailwind` 20,096 · `utopia-core` 7,811 · `tailwindcss-fluid-type` 5,620 · `kiwi.js` 3,824 · `priority-nav` 1,154 · `autolayout` 169 · `every-layout` (unofficial port) 11 · `gss` 3 · `cassowary.js` 1
Dependent counts via deps.dev: `@lume/kiwi@0.4.4` → 12 direct / 33 total; `kiwi.js@1.1.3` → 40 total.

**Explicitly `[UNVERIFIED]`**
- GSS's *stated* cause of death. No archive notice, no maintainer statement, no post-mortem exists; issues #216 and #219 asked directly and were never answered by a maintainer. Only the *user-reported failure mode* is verified.
- Subform's promised "full post-mortem" — announced 2018-07-06, not found on `kevinlynagh.com` or elsewhere. The shutdown announcement itself is a primary source and is quoted verbatim above; the deeper technical post-mortem does not appear to exist.
- Android `ConstraintLayout`'s solver being Cassowary-derived. GitHub code search `repo:androidx/constraintlayout Cassowary` returns 0 results; I did not read `androidx.constraintlayout.core.LinearSystem` in this pass.
- Every Layout's unit sales / number of teams using it. The site claims "thousands of developers and companies"; no verifiable number exists.
