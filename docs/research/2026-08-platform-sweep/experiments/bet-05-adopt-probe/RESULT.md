# BET05 falsification probe — `adopt()` cannot reconstruct SSG setup inputs

Throwaway experiment for the sweep. Implements the cheapest decisive experiment
specified at `docs/research/2026-08-platform-sweep/reviews/bet-05-adopt-islands.review.md:163-175`,
against the brief at `docs/research/2026-08-platform-sweep/briefs/bet-05-adopt-islands.md`
(governing principle "recompute, don't serialize", `briefs/bet-05-adopt-islands.md:34-38`).

**Result: the falsification fires. 16 of 24 assertions FAIL. Exit code 1.**

## Command

```
node docs/research/2026-08-platform-sweep/experiments/bet-05-adopt-probe/adopt-probe.mjs
```

No dependency was added: Playwright 1.61.1 and Vite are resolved out of
`@nisli/www`'s devDependencies (`packages/www/package.json:31-33`) by the runner
(`adopt-probe.mjs:24-29`), following the `packages/www/scripts/movebefore-proof.mjs`
harness convention (in-memory Vite bundle of real sources + Playwright +
`node:assert/strict`). Chromium only, as the review specifies.

## Files

| file | role |
| --- | --- |
| `adopt-probe.mjs` | runner: real SSG render, two browser bundles, the probe, the assertion table |
| `probe-component.ts` | the component under test — `Probe({ label, children, id, name })` |
| `ssg-pages.ts` | two routes rendered sequentially in one module process by real `renderToHtml()` |
| `ssg-env.ts` | installs `@nisli/ssg`'s happy-dom globals before any component module evaluates |
| `adopt-probe-fixture.ts` | the minimal P1-style adopt branch, loaded *before* the component module |

## What the probe does

1. **SSG-render with the real pipeline.** `renderToHtml()`
   (`packages/ssg/src/core-render.ts:59-94`) renders two routes in order from one
   module process, exactly as `buildStaticSite()` walks routes
   (`packages/ssg/src/build.ts:174-179`). A decoy route goes first so it consumes
   generated id `probe-1`; the page under test therefore ships `probe-2`/`probe-3`.
   The page under test holds **two** islands (the review's spec says one; two plus
   the decoy is what makes the generated-ID divergence a deterministic build-order
   fact rather than an adoption-order guess).
2. **Fresh Chromium realm, module not loaded.** The snapshot is set as the page
   content and asserted inert: `customElements.get('probe-island') === false`,
   two hosts present. The island flag `data-nisli-adopt="1"` is stamped onto the
   snapshot by the runner (`adopt-probe.mjs:59-62`) because SSG has no islands
   mode yet.
3. **Focus and type.** Real keystrokes into both prerendered inner inputs, plus
   an explicit `setSelectionRange(6, 10)` on each; focus is left on island B.
4. **Minimal P1 adopt branch, then the module.** `adopt-probe-fixture.ts` imports
   nothing from `@nisli/core`; it snapshots interactive state by `data-slot` path,
   clears the host, and only then is `probe-component.ts` delivered as a
   *separate* bundle — an independently loaded component module. State is restored
   onto the fresh nodes and the host is stamped `data-nisli-adopted="replace"`.
   The original factory call is never rerun.
5. **Control.** The same snapshot in a second page with **no** adopt branch — the
   naive upgrade path.

## Per-assertion result

`generated id`, `aria-labelledby`, and `aria-describedby` are the review's single
"generated ARIA IDs" assertion, split so the mechanism is visible.

| island | assertion | expected (server) | actual (adopted) | result |
| --- | --- | --- | --- | --- |
| A | factory children survive | `<em data-authored="a">factory child A</em>` | `<!--slot-start--><!--slot-end-->` | **FAIL** |
| A | factory label survives | `Server-rendered label A` | `""` | **FAIL** |
| A | forwarded id survives | `probe-a` | `null` | **FAIL** |
| A | forwarded name survives | `field-a` | `null` | **FAIL** |
| A | generated id matches server | `probe-2` | `probe-1` | **FAIL** |
| A | aria-labelledby matches server | `probe-2-label` | `probe-1-label` | **FAIL** |
| A | aria-describedby matches server | `probe-2-hint` | `probe-1-hint` | **FAIL** |
| A | typed input value survives | `typed into A` | `typed into A` | PASS |
| A | input selection survives | `6,10` | `6,10` | PASS |
| A | component signal matches DOM | `typed into A` | `""` | **FAIL** |
| A | focus retained | `false` | `false` | PASS |
| A | no duplicate root | `1` | `1` | PASS |
| B | factory children survive | `<em data-authored="b">factory child B</em>` | `<!--slot-start--><!--slot-end-->` | **FAIL** |
| B | factory label survives | `Server-rendered label B` | `""` | **FAIL** |
| B | forwarded id survives | `probe-b` | `null` | **FAIL** |
| B | forwarded name survives | `field-b` | `null` | **FAIL** |
| B | generated id matches server | `probe-3` | `probe-2` | **FAIL** |
| B | aria-labelledby matches server | `probe-3-label` | `probe-2-label` | **FAIL** |
| B | aria-describedby matches server | `probe-3-hint` | `probe-2-hint` | **FAIL** |
| B | typed input value survives | `typed into B` | `typed into B` | PASS |
| B | input selection survives | `6,10` | `6,10` | PASS |
| B | component signal matches DOM | `typed into B` | `""` | **FAIL** |
| B | focus retained | `true` | `true` | PASS |
| B | no duplicate root | `1` | `1` | PASS |

**8/24 passed.** Every failure is identical on both islands, so the partition is
a property of the information class, not of an island's position.

### The four passes are all carried, not recomputed

- **input value / selection** passed only because the harness snapshotted and
  reimposed them. Nothing in the prerendered DOM would have produced them.
- **focus retained** is *focus re-acquired*: `blur events fired during adoption: 1`.
  Anything listening for `blur`/`focusout`, an in-flight IME composition, or a
  native autofill/undo stack observes the discontinuity.
- **no duplicate root** passed only because the harness cleared the host *before*
  `customElements.define()`. The control page proves the alternative:
  `[{"roots":2,"nestedRoots":1},{"roots":2,"nestedRoots":1}]` — the naive upgrade
  captured the prior render output as author content
  (`packages/core/src/component.ts:491-494`) and projected it *inside* the fresh
  tree (`packages/core/src/projection.ts:95`). WWW-14 confirmed in a real browser.

## Verdict

### Does the review's falsification fire?

Yes, on every claim it named. The review's finding 1 (CRITICAL — "provenance is
not the only irrecoverable information") is now an experimental result, not an
argument: factory props, forwarded identity, and generated-ID seeds are all
unrecoverable from the prerendered DOM, and a fifth class (DOM state → component
signal) is unrecoverable even *with* perfect serialization.

### Which setup inputs are unreconstructable, and by what mechanism

1. **Factory-only projected `children`** — the value was a `TemplateResult` living
   inside the caller's factory call. SSG delivers it through `_setProp` before
   connect (`packages/core/src/template.ts:556-566`) and `children()` folds it
   into the projection slot (`packages/core/src/projection.ts:95`); the published
   HTML carries only the *rendered* nodes, with every runtime marker stripped
   (`packages/ssg/src/core-render.ts:15-19`). The adopting module has no caller,
   so `props.children` is `undefined` and the slot renders empty —
   `<!--slot-start--><!--slot-end-->` in the observed output.
   *Minimal serialization:* the brief's own `<!--nisli:ch-->…<!--/nisli:ch-->`
   provenance pair — but note the brief explicitly exempts factory/template
   children from needing it (`briefs/bet-05-adopt-islands.md:42`). That exemption
   is backwards: those children need the pair **most**, because without it they
   have no client source at all.
2. **Factory-only `label`** — same `_setProp` path. The value only ever existed as
   a text node in the output; `labelText` is `""` after adoption.
   *Minimal serialization:* either a versioned per-island prop payload, or an
   `attrs: { label: 'string' }` declaration so the value round-trips as a real
   attribute. The second option is a **component-authoring** change, not a
   pipeline change — every factory-only prop in the corpus would have to be
   redeclared — the www corpus is factory-driven throughout
   (`packages/www/src/examples.ts:175-178`, `packages/www/src/examples.ts:410-413`).
3. **Forwarded `id`/`name`** — core deliberately removes them from the host during
   SEED and relocates them onto the inner control
   (`packages/core/src/component.ts:432-451`). The adopting module re-seeds from
   host attributes, finds nothing, and the fresh template writes no `id`/`name` at
   all (`null` observed where the server had `probe-a`/`field-a`). Native form
   participation — `form.elements.namedItem()`, `<label for>` — is silently lost.
   *Minimal serialization:* re-emit forwarded values on the host under a
   namespaced attribute (`data-nisli-fwd-id`), or teach the adopt branch to read
   them back off the prerendered control. The latter needs both the declared attrs
   schema (queued T3) *and* a way to locate the control — and `data-slot` is an
   ADR 0022 UI convention, not a core contract.
4. **Generated ARIA ids from a module-scoped counter** — a deterministic
   build-order offset, not a race. SSG rendered the decoy route first in the same
   module process (`packages/ssg/src/build.ts:174-179`), so the counter reached 1
   before the page under test and shipped `probe-2`/`probe-3`. The browser's
   freshly imported module restarted at 0 and produced `probe-1`/`probe-2`. Every
   `aria-labelledby`/`aria-describedby` relationship shifted by one; the labels
   and hints they point at still exist, so nothing throws — the accessibility tree
   is just quietly wrong.
   *Minimal serialization:* carry the seed in the island payload, or make the id
   source build-stable (derive from route + island index instead of a process
   counter). Again a component change, since the counter lives in component
   modules (`packages/www/src/nisli-ui/ui/accordion.ts:65`).
5. **DOM state → component signal** — not a serialization problem at all. `typed`
   initializes to `''` and the only DOM→signal bridge is the `@input` listener.
   P1 restores `input.value` imperatively, which fires no `input` event, so the
   signal reads `""` while the visible field reads `typed into A`. This is review
   finding 5 (`AcpChat`'s `draft`) reproduced exactly.
   *Minimal serialization:* none can fix it. It requires an adoption lifecycle —
   `onAdopt(existingRoot)` or state adapters invoked **before** the normal mount
   initializers — so components reconcile preserved DOM into their signals.

### One further mechanism the probe surfaced

P1's transactional promise ("everything before the swap leaves the prerendered
baseline untouched", `briefs/bet-05-adopt-islands.md:57`) is **not implementable
as consumer wiring**. `customElements.define()` synchronously upgrades every
connected instance, and core's `connectedCallback` captures existing children
immediately (`packages/core/src/component.ts:466-516`), so the only way an
external adopt branch can prevent the WWW-14 capture is to clear the host
*before* the module loads — destroying the baseline before setup has run. The
adopt branch must live inside core, and even there the baseline survives only if
projection lifting is made non-destructive. Independent support for review
finding 6.

### Does the 'marker-free adopt' principle survive?

**No, not as stated.** "Recompute, don't serialize"
(`briefs/bet-05-adopt-islands.md:34-38`) rests on three claims. Two are refuted
here — factory props are not recomputable (nothing on the client holds them) and
generated-ID seeds are not recomputable (the counter is process state, and the
build offsets it) — and a third is worse than not-recomputable: forwarded
attribute values are *deliberately destroyed* by core before the snapshot is
taken. The one input class that did recompute correctly is attribute-derived
state, and the probe host carried no attributes at all — which is exactly the
shape of the real www corpus.

The principle survives only in a narrow, honest form: **a component whose
complete setup inputs are declared attributes can adopt marker-free.** Nothing
else can. Everything else needs the serialization/replay contract the review
asked for (`reviews/bet-05-adopt-islands.review.md:21-27`), and the signal
reconciliation case needs an adoption lifecycle on top of that.

Note the scope of what "markers" means here. The brief's marker debate was about
*binding positions* (P2's question). This probe never reached that question: it
failed on *state*, one layer earlier. P1 cannot ship the Astro minimum on the
current corpus, so P2's marker-free lockstep is not the gating risk.

### What this probe does NOT test

P2's claim walk; happy-dom → browser serialization round-trip fidelity; nested
islands and upgrade order; portals; context provider readiness; the
prepare/commit/rollback transaction; non-Chromium engines. Those remain open per
the review.

## Full output

```
--- SSG output (decoy route, rendered first) ---
<div id="decoy-route"><probe-island><div data-slot="root" data-local-id="probe-1">
    <span data-slot="label" id="probe-1-label">Decoy route label</span>
    <input data-slot="input" id="decoy-input" name="decoy-field" aria-labelledby="probe-1-label" aria-describedby="probe-1-hint">
    <p data-slot="hint" id="probe-1-hint">Describes the control.</p>
    <div data-slot="children">decoy child</div>
  </div></probe-island></div>
--- SSG output (page under test) ---
<div id="app"><probe-island><div data-slot="root" data-local-id="probe-2">
    <span data-slot="label" id="probe-2-label">Server-rendered label A</span>
    <input data-slot="input" id="probe-a" name="field-a" aria-labelledby="probe-2-label" aria-describedby="probe-2-hint">
    <p data-slot="hint" id="probe-2-hint">Describes the control.</p>
    <div data-slot="children"><em data-authored="a">factory child A</em></div>
  </div></probe-island><probe-island><div data-slot="root" data-local-id="probe-3">
    <span data-slot="label" id="probe-3-label">Server-rendered label B</span>
    <input data-slot="input" id="probe-b" name="field-b" aria-labelledby="probe-3-label" aria-describedby="probe-3-hint">
    <p data-slot="hint" id="probe-3-hint">Describes the control.</p>
    <div data-slot="children"><em data-authored="b">factory child B</em></div>
  </div></probe-island></div>

--- pre-adopt (server) facts ---
[
  {
    "localId": "probe-2",
    "labelText": "Server-rendered label A",
    "labelId": "probe-2-label",
    "hintId": "probe-2-hint",
    "ariaLabelledBy": "probe-2-label",
    "ariaDescribedBy": "probe-2-hint",
    "inputId": "probe-a",
    "inputName": "field-a",
    "childrenHtml": "<em data-authored=\"a\">factory child A</em>",
    "rootCount": 1,
    "inputValue": "typed into A",
    "selection": [
      6,
      10
    ],
    "focused": false,
    "signalValue": null,
    "stamp": null
  },
  {
    "localId": "probe-3",
    "labelText": "Server-rendered label B",
    "labelId": "probe-3-label",
    "hintId": "probe-3-hint",
    "ariaLabelledBy": "probe-3-label",
    "ariaDescribedBy": "probe-3-hint",
    "inputId": "probe-b",
    "inputName": "field-b",
    "childrenHtml": "<em data-authored=\"b\">factory child B</em>",
    "rootCount": 1,
    "inputValue": "typed into B",
    "selection": [
      6,
      10
    ],
    "focused": true,
    "signalValue": null,
    "stamp": null
  }
]

--- post-adopt (client) facts ---
[
  {
    "localId": "probe-1",
    "labelText": "",
    "labelId": "probe-1-label",
    "hintId": "probe-1-hint",
    "ariaLabelledBy": "probe-1-label",
    "ariaDescribedBy": "probe-1-hint",
    "inputId": null,
    "inputName": null,
    "childrenHtml": "<!--slot-start--><!--slot-end-->",
    "rootCount": 1,
    "inputValue": "typed into A",
    "selection": [
      6,
      10
    ],
    "focused": false,
    "signalValue": "",
    "stamp": "replace"
  },
  {
    "localId": "probe-2",
    "labelText": "",
    "labelId": "probe-2-label",
    "hintId": "probe-2-hint",
    "ariaLabelledBy": "probe-2-label",
    "ariaDescribedBy": "probe-2-hint",
    "inputId": null,
    "inputName": null,
    "childrenHtml": "<!--slot-start--><!--slot-end-->",
    "rootCount": 1,
    "inputValue": "typed into B",
    "selection": [
      6,
      10
    ],
    "focused": true,
    "signalValue": "",
    "stamp": "replace"
  }
]

blur events fired during adoption: 1

--- control: naive upgrade, no adopt branch (WWW-14) ---
[{"roots":2,"nestedRoots":1},{"roots":2,"nestedRoots":1}]

| island | assertion | expected (server) | actual (adopted) | result |
| --- | --- | --- | --- | --- |
| A | factory children survive | "<em data-authored=\"a\">factory child A</em>" | "<!--slot-start--><!--slot-end-->" | FAIL |
| A | factory label survives | "Server-rendered label A" | "" | FAIL |
| A | forwarded id survives | "probe-a" | null | FAIL |
| A | forwarded name survives | "field-a" | null | FAIL |
| A | generated id matches server | "probe-2" | "probe-1" | FAIL |
| A | aria-labelledby matches server | "probe-2-label" | "probe-1-label" | FAIL |
| A | aria-describedby matches server | "probe-2-hint" | "probe-1-hint" | FAIL |
| A | typed input value survives | "typed into A" | "typed into A" | PASS |
| A | input selection survives | "6,10" | "6,10" | PASS |
| A | component signal matches DOM | "typed into A" | "" | FAIL |
| A | focus retained | false | false | PASS |
| A | no duplicate root | 1 | 1 | PASS |
| B | factory children survive | "<em data-authored=\"b\">factory child B</em>" | "<!--slot-start--><!--slot-end-->" | FAIL |
| B | factory label survives | "Server-rendered label B" | "" | FAIL |
| B | forwarded id survives | "probe-b" | null | FAIL |
| B | forwarded name survives | "field-b" | null | FAIL |
| B | generated id matches server | "probe-3" | "probe-2" | FAIL |
| B | aria-labelledby matches server | "probe-3-label" | "probe-2-label" | FAIL |
| B | aria-describedby matches server | "probe-3-hint" | "probe-2-hint" | FAIL |
| B | typed input value survives | "typed into B" | "typed into B" | PASS |
| B | input selection survives | "6,10" | "6,10" | PASS |
| B | component signal matches DOM | "typed into B" | "" | FAIL |
| B | focus retained | true | true | PASS |
| B | no duplicate root | 1 | 1 | PASS |

8/24 assertions passed.
FALSIFIED: 16 assertion(s) failed — an independently loaded component module cannot reconstruct the setup inputs that produced the SSG host.
```
