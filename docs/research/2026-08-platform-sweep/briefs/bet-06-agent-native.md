# Bet 06 — Agent-Native: Graduate 0029/0030.x While the Window Is Open

**Status**: Draft investment brief (2026-08-21, research sweep follow-up)
**Scope**: Ship plans for the next three agent-native deliverables — registry `manifest.json`, `buildAppResource()` for MCP Apps, and `@nisli/mcp` — plus the WebMCP posture and the honest version of the CHI marketing claim.

## Context

The August research sweep validated the two-ADR strategy: ADR 0029 (where nisli UI runs: ACP flagship, MCP Apps embeds, machine-legible components) and ADR 0030/0030.1/0030.2 (why the core is the right authoring substrate for agents). All four ADRs are still **Status: Proposed** — but Wave 1+2 of 0030.2 has already landed on main and survived contact (N105 caught a real registry corruption on day one; the projection phase move fixed a latent form-field ordering bug — `docs/worklists/agn/AGN-WAVE1-GATE.md:146-155`). The thesis is no longer speculative; it is partially shipped and under-graduated.

The window is real and external. MCP Apps became the first official MCP extension on 2026-01-26 (SEP-1865: `ui://` resources, `text/html;profile=mcp-app`, tools declare a UI via `_meta.ui.resourceUri`, sandboxed-iframe rendering, postMessage carrying MCP JSON-RPC) and was folded into the extensions framework in the 2026-07-28 spec RC, which also made MCP stateless — a spec property that *favors* nisli's self-contained single-file emit. Hosts shipping today: ChatGPT (fully compatible Feb 2026), Claude web/desktop, VS Code Copilot, Goose, Postman. The `ext-apps` examples directory still has no web-components/zero-dependency starter; the ChatGPT app directory is self-serve. These are first-mover slots that expire. Meanwhile shadcn's MCP server made agent-mediated registry install the default distribution path, and Svelte's AI-docs playbook (sized llms.txt bundles + an MCP server that serves docs *and* statically analyzes generated code) is the proven template for a small framework earning "written by agents" at inference time. The three deliverables below are the concrete graduation plan.

## Current state — built vs planned

**Built and on main:**

- **Diagnostics leaf + dev gate** — `packages/core/src/diagnostics.ts:44-70` holds the B2 code registry (N101–N106 template, N201/N202 props, N301–N310 reactivity, N401/N402 lifecycle, N501 DI, N602/N603 async; N601 retired, never reused). This is 0030.1's B1+B2 slot, landed.
- **T4 first-parse audit** — `packages/core/src/template-audit.ts` (N101 undefined dash-tag, N104 undeclared attribute — gated today on non-empty `static observedAttributes`, `template-audit.ts:17-19`).
- **T5 deterministic scheduler, T6 failure-as-DOM-fact** (`data-nisli-error` stamps), **T1 keyed query store + T2 `settle()`** (`packages/core/src/query.ts`, `settle.ts`) — the verify loop's determinism primitive exists.
- **Size ruling** — whole-bundle core measured **12,389 B min+gzip** vs the 8,793 B pre-wave baseline; the 10KB ceiling stands as the *prod-path* target with F3 (dev-weight extraction: template-audit 1,642 B + diagnostics leaf 1,105 B gzip) as the recovery (`AGN-WAVE1-GATE.md:119-127`). Re-measured for this brief: 12,375 B — confirmed.
- **ACP flagship** — 8 components in `packages/ui/registry/default/ui/acp/`, structural wire types in `lib/acp-protocol.ts` (304 lines, zero SDK imports), entry model + reducer in `lib/acp-session.ts` (`createTranscript()` at :297).
- **Registry** — `packages/ui/registry/registry.json`: **77 items** (66 ui, 10 lib, 1 style), shadcn-shaped (`name/type/description/files/registryDependencies`). 36 of 66 ui items declare `attrs` via `satisfies ComponentAttrs`; **333 unique `data-slot` values**; event vocabulary is small and regular (`ui-open-change` ×11, `ui-value-change` ×9, `ui-select` ×6, `ui-pressed-change`, `ui-resize`, plus native events).
- **CLI** — `packages/ui/src/add.ts` / `registry.ts`: registry ships inside the `@nisli/ui` package, items copied verbatim, integrity-tested.

**Planned, not started:** `lib/transcript.ts` seam extraction (AUI-1), `manifest.json`, `buildAppResource()` (`@nisli/ssg` has `buildStaticSite` at `src/build.ts:144` and `renderToString` at `src/render.ts:73`, no widget emit), `lib/app-bridge.ts`, `lib/model-context.ts`, `@nisli/verify`, `@nisli/mcp`, llms.txt (nothing in `packages/www`). **T3 schema-as-single-truth is Wave 3, not landed** — the compiling prototype is preserved at `docs/adr/materials/0030.2-schema-proto.ts`.

---

## Deliverable 1 — Registry `manifest.json`

### The source-of-truth decision

Two candidate sources: (a) static scan of registry source, (b) T3 schema declarations read at import time. **Decision: T3 is the *eventual* single truth for attrs and events, but the manifest does not wait for Wave 3.** Ship v1 as a **committed-snapshot artifact generated from three extractors**, each reading the strongest truth available today:

1. **Attrs** — define each component in the SSG happy-dom environment (`packages/ssg/src/environment.ts` already builds this sandbox) and read the runtime decl map. Today only `observedAttributes` (names) is class-visible; expose the full `AttrEntry` map (`component.ts:385-396` — key, attrName, type, default) as a dev-gated static on the element class (a few bytes, stripped with F3). This is the same upgrade N104 wants. When T3 lands, this section re-sources from the schema object with **zero manifest-schema change** — that continuity is the design constraint.
2. **Semantics** — mount each item's canonical states under happy-dom and walk the DOM: `data-slot` inventory, `data-state`/`data-*` value sets, ARIA role/name/states per slot. Rendered truth, not source guesses.
3. **Events** — source scan for `new CustomEvent('ui-…')` dispatches (5 event names registry-wide; trivially regular) plus a hand-maintained payload sketch per event, because payload *shapes* are type-space until T3's `p.event<D>()` (0030.2 §8 T3 amendment).

The drift guard is the generated-artifact pattern 0029 §4 already names: manifest is committed; CI regenerates and diffs; a component whose markup drifts from its published machine interface fails CI.

### Schema sketch (per item)

```jsonc
{
  "$schema": "https://nisli.dev/schema/manifest.v1.json",
  "manifestVersion": 1,
  "style": "default",
  "generatedFrom": { "@nisli/ui": "0.4.1", "@nisli/core": "0.54.1" },
  "items": [{
    "name": "switch",
    "tag": "ui-switch",
    "kind": "ui",
    "description": "A native toggle switch styled with pure CSS.",
    "files": ["ui/switch.ts"],
    "registryDependencies": ["utils"],
    "attrs": {
      "checked":  { "type": "boolean", "default": false, "reflects": "data-state" },
      "size":     { "type": "string", "enum": ["default", "sm"], "default": "default" },
      "disabled": { "type": "boolean" },
      "name":     { "type": "forward" }          // forwarded to the native input
    },
    "events": [
      { "name": "change", "native": true, "bubbles": true },
      { "name": "ui-open-change", "detail": { "open": "boolean" } }  // (dialog example)
    ],
    "slots":  { "dataSlots": ["switch", "switch-thumb"], "children": "none" },
    "states": { "data-state": ["checked", "unchecked"], "data-disabled": "presence" },
    "aria":   { "pattern": "switch", "role": "switch",
                "keyboard": { "Space": "toggle" } },
    "commands": []   // reserved: populated iff bet 02 lands CommandEvent — do not block on it
  }]
}
```

`aria.keyboard` is deliberately verify's level-4 contract (0030 §2: "a component that declares `"keyboard": {"Escape": "close"}` gets that check for free"). `commands` is a reserved empty array so the schema doesn't rev when bet 02 decides. One artifact, three consumers, unchanged from 0029 §4: coding agents composing UIs, A4's static lint, WebMCP/A2UI descriptors later.

Coverage honesty: 36/66 items have declared attrs today. v1 emits partial entries (`"attrs": null` means "props not attribute-declared yet") rather than fake completeness; backfilling the remaining 30 declarations is mechanical and can ride the T3 migration wave instead of duplicating it now.

## Deliverable 2 — `buildAppResource()`: the MCP Apps target

### Pipeline (in `@nisli/ssg`)

```ts
buildAppResource({
  entry: './widgets/rate-meal.ts',   // module whose default export is a component factory call
  props?: Record<string, unknown>,   // initial props for the static shell
  name: 'rate-meal',                 // → ui://<server>/rate-meal.html
  budget?: { warnGzip?: number, failGzip?: number },  // defaults: 32 KB / 64 KB
}): Promise<{ html: string, bytes: { raw: number, gzip: number }, resourceUri: string }>
```

1. **Bundle** — esbuild (already a transitive workspace tool; becomes an optional peer of `@nisli/ssg`, same posture as the vite-hmr entry: build tooling may depend on bundlers, the runtime never does) bundles entry + tree-shaken core + registry libs, minified ESM. Measured floor: button + full core tree-shakes to **26.7 KB min / 9.4 KB min+gzip**.
2. **Static shell** — `renderToString` the entry with initial props so the iframe paints before JS executes. This is the SSG differentiator: React starters ship a blank div; nisli ships the reviewed markup, and attributes-as-truth means the runtime adopts it without hydration protocol.
3. **Inline everything** — `<style>` = `styles/theme.css` (1.4 KB gzip) + a Tailwind v4 subset compiled over the widget's import graph only; `<script type="module">` = the bundle; zero external URLs (build fails if any `http(s)://` src/href survives — hosts security-review these files, and self-contained is the pitch).
4. **Budget gate** — fail the build over `failGzip`, warn over `warnGzip`, print the number every build so 0029 §8's payload-comparison page is never stale.
5. **Emit** — one HTML file + a serving snippet: register as resource `ui://…` with `mimeType: "text/html;profile=mcp-app"`, referenced from the tool's `_meta.ui.resourceUri`. Statelessness in the 07-28 RC means the file must carry everything — it already does by construction.

### `lib/app-bridge.ts` — the registry lib item (copy-in, ~1.5–2 KB gzip budget)

All spec churn lands in this one copied file (the tool-input lifecycle moved May 2026; visibility metadata moved July 2026 — 0029 §3's absorption list). Sketch:

```ts
export interface AppBridge {
  // host → widget, as signals (render them; they update live)
  toolInput:     ReadonlySignal<unknown>;          // streaming partials included
  toolResult:    ReadonlySignal<unknown | null>;
  theme:         ReadonlySignal<'light' | 'dark'>;
  displayMode:   ReadonlySignal<string>;
  connected:     ReadonlySignal<boolean>;
  // widget → host, JSON-RPC over postMessage
  callTool(name: string, args: unknown): Promise<unknown>;
  sendMessage(text: string): Promise<void>;
  openLink(url: string): Promise<void>;
  requestDisplayMode(mode: string): Promise<void>;
  // lifecycle bus for anything not signal-shaped
  events: Emitter<{ 'tool-result': unknown; teardown: void }>;
}
export function connectAppBridge(opts?: { autoTheme?: boolean }): AppBridge;
```

`connectAppBridge()` performs the `ui/initialize` handshake, then maps `hostContext.styles.variables` onto the shadcn token layer (`--background`, `--primary`, …) that every registry component already reads — host theming for free, the thing shadow-DOM libraries structurally fight. `window.openai` extras (widget state, file APIs) are feature-detected on top, never load-bearing. Wiring nisli events to tool calls stays explicit and auditable — `host.addEventListener('ui-value-change', e => bridge.callTool('save_rating', e.detail))` — with a declarative `commands` mapping reserved for bet 02's CommandEvent rather than invented here.

### Hello-world, end to end

Three files. `widget.ts`: a ~40-line nisli component (`ui-card` + `ui-button` + `ui-slider`) that reads `bridge.toolInput`, renders a rating card, and calls `bridge.callTool('save_rating', {stars})` on submit. `build.ts`: one `buildAppResource()` call emitting `dist/rate-meal.html`. `server.ts`: a stateless MCP server exposing a `rate_meal` tool with `_meta.ui.resourceUri: "ui://rate-meal/rate-meal.html"` and the resource returning the emitted file. User says "rate my dinner" in ChatGPT or Claude → host calls the tool → fetches the `ui://` resource → renders the sandboxed iframe → the card paints from static markup instantly, themes itself from host variables → user drags, taps, the tool call round-trips, the transcript continues. Estimated total payload: **~14–17 KB gzip** (9.4 core+component + ~1.4 theme + ~2 utility CSS + ~1.5 bridge + shell) against the 100–300 KB React baseline. This becomes the starter template, the ChatGPT/Claude directory submission, and the `ext-apps` upstream PR — three distribution assets from one artifact.

## Deliverable 3 — `@nisli/mcp`: docs + analyze server

A new workspace package (stdio server, `npx @nisli/mcp`; zero runtime deps beyond the MCP SDK — decide at gate whether even that is replaced by structural JSON-RPC types per the 0029 §1 policy). Docs and manifest ship *inside* the package, so answers are version-matched and offline — an improvement on Svelte's site-fetch model. Four tools:

```jsonc
// 1. search_docs — lexical over the B3 artifacts; no embeddings (0030.1 §4)
{ "name": "search_docs",
  "inputSchema": { "query": "string", "limit?": "number" },
  "output": [{ "id": "docs/query-store", "title": "…", "tokens": 812, "excerpt": "…" }] }

// 2. get_component — manifest entry + source + docs twin
{ "name": "get_component",
  "inputSchema": { "name": "string" },       // registry item name
  "output": { "manifest": { /* D1 entry */ },
              "files": [{ "path": "ui/switch.ts", "content": "…" }],
              "docs": "…markdown…" } }

// 3. add_component — mirrors shadcn's MCP install; wraps packages/ui/src/add.ts
{ "name": "add_component",
  "inputSchema": { "name": "string", "cwd": "string" },
  "output": { "written": ["src/ui/switch.ts", "src/lib/utils.ts"],
              "dependenciesToInstall": [], "alreadyPresent": ["lib/utils.ts"] } }

// 4. analyze_code — A4 static lint + A5 drift rules as autofix suggestions
{ "name": "analyze_code",
  "inputSchema": { "files": [{ "path": "string", "content": "string" }] },
  "output": [{ "code": "N104", "category": "template/undeclared-attr",
               "path": "app.ts", "span": { "line": 12, "col": 18, "len": 7 },
               "message": "unknown \"varian\" on <ui-button>",
               "fix": { "replacement": "variant", "applicability": "machine-applicable" },
               "docs": "https://nisli.dev/e/N104" }] }
```

`analyze_code` is the A4 editor/CI twin of the landed runtime audit — same N1xx codes, same manifest truth source, rustc's `suggested_replacement` + applicability model — plus the A5 drift pack (`className` → `class`, `onClick=` → `@click=${…}`, `useEffect` → `effect`, JSX prop syntax), each rule named after a mistake observed in the fleet's review history. **Phased honestly**: v1 ships tools 1–3 plus `analyze_code` limited to A4 checks (manifest-derived, buildable the week D1 lands); A5 rules accrete as the corpus documents them. This ordering means `@nisli/mcp` does not wait for slot 7 of 0030.1 to *start* — it waits only to be *called done*.

## WebMCP posture — `lib/model-context.ts` scope guard

One page, one file, one rule: **components never touch the browser API; applications curate.**

- **Feature-detect both names**: prefer `document.modelContext` (moved from `navigator` ~Aug 2026), fall back to the deprecated `navigator.modelContext` (removal signaled in Chrome 150), else no-op. The file is the *only* place either name appears in a nisli tree — three renames in a year is exactly why.
- **Never auto-register.** Components export tool-descriptor *factories* (a dialog's open/close, a form's typed submit derived from its real native fields — the manifest's attrs/events section is the descriptor's raw material); the app calls `registerTools(ctx, [...])` explicitly. Per-name uniqueness in the spec forbids tool-per-instance anyway. Registration passes `{ signal }` and aborts on disconnect — cleanup is structural, not conventional.
- **Churn-absorbing seam**: structural types for `registerTool({name, description, inputSchema, execute}, {signal})`; unknown host shapes degrade to no-op, never throw. The declarative annotated-forms path is the one to watch closely — nisli's real-native-forms invariant (0022 §5) means that path could cost us *nothing* to support.
- **Graduation gate unchanged** (0029 §5): promote when a mainstream agent calls WebMCP tools in the wild or the API exits origin trial; drop without ceremony if the trial dies. Today the registration side is real (Chrome 149 public origin trial June 2026, Edge 147 native, Expedia/Booking/Shopify/Target/Instacart pilots) and the consumption side is still zero. Build the ~0.6 KB adapter, demo it on one www page, market nothing.

**The CHI claim, stated honestly.** CHI 2026 measured agent task success falling 78%→42% when the accessibility tree degrades. The claimable sentence is: *"nisli components are accessible-by-construction light DOM — the a11y-tree quality that published research shows agent success depends on, and `nisli verify` measures it per component."* The unclaimable sentence is any causal "nisli makes agents X% more successful" — the CHI data is correlational to a11y-tree quality and was not measured on nisli. "Measured agent operability" is defensible only as *our* measurement (verify's semantics/interaction levels, published per 0029 §8), with the study cited as motivation, never as our result. Marketing copy gets reviewed against this paragraph.

## Sequencing vs 0030.1's priority order

0030.1 §6 rules: B1+B2 → B3 → A1+A2 → A4 → B4 → A5 → B5 → B6. B1+B2 landed with Wave 1. This brief's deliverables slot in without reordering anything:

1. **D1 manifest** is A4's named dependency ("needs the manifest, 0029 §4") and B4's semantics fixture source — it must land before slot 4 and is cheap now; it also shares extraction machinery with B3's `apilist.txt`. Land first.
2. **D2 buildAppResource** is 0029's AUI-3, an *ecosystem-track* item that 0030.1 never sequenced — it touches only `@nisli/ssg` + one new lib item, disjoint from the core track, and the host-directory window is the one external clock. Run it in parallel with B3/A1 on a second lane.
3. **D3 @nisli/mcp** is B5 (slot 7) but phases early as described: tools 1–3 the week D1 + B3 exist; `analyze_code` completes with A4/A5.

One 0030.2 §7 correction to record when the ADRs graduate: it declared `@nisli/verify` "the only new workspace package this program creates" — B5's `@nisli/mcp` supersedes that sentence, and both first-publishes must be deliberate (the push-triggered auto-tag flow means an accidental publish is one push away; sequence with arch per F5).

## Risks and open questions

- **MCP Apps churn.** The extension moved twice in 2026 and was refolded on 07-28; `_meta.ui.resourceUri`, the profile string, or the handshake could rename again. Mitigation is already policy: every wire detail lives in `lib/app-bridge.ts` (widget side) and the emit function (server side); structural types, no SDK import. Residual risk: a *semantic* change (e.g., resource splitting under statelessness) that a one-file seam can't absorb — accept, this is the same bounded tax ACP 0.4→1.3 already proved survivable.
- **Size-budget realism.** Core sits at 12.4 KB min+gzip against a 10 KB ceiling; the "smallest reviewable MCP App" pitch depends on F3 (dev-weight extraction, ≥2.7 KB recovery) landing *before* the payload-comparison page goes public — otherwise the headline number carries dev-only diagnostics bytes a production widget shouldn't pay. F3 is hereby a named dependency of D2's marketing, not just a core follow-up. Note the widget path is already better than the headline: tree-shaken button+core measures 9.4 KB gzip today.
- **Manifest circularity.** Verify's semantics level checks renders against the manifest, and the manifest is generated from renders. The guard is the committed-snapshot diff (regeneration drift fails CI) plus human review of manifest diffs — the same discipline as any generated artifact. State it in the manifest doc so nobody mistakes level-3 green for an independent oracle.
- **T3 timing.** Manifest v1 carries 36/66 full attr entries. Decide at gate: backfill the 30 missing `attrs` declarations now (mechanical, ~1 batch) or ship partial entries until the T3 wave. Recommendation: ship partial, backfill with T3 — one migration, not two.
- **Event payload schemas** are hand-authored until T3's `p.event<D>()`; drift risk is bounded by the 5-name event vocabulary.
- **Host review opacity.** ChatGPT/Claude directory review timelines are unknown; the mitigation is that the artifact is genuinely reviewable (single file, no external fetches) — and the `ext-apps` PR is distribution that needs no approval queue.
- **A2UI** stays watch-then-spike: v1.0 candidate now, but v0.9 was a breaking rework; the gate remains "1.0 shipped or a concrete consumer exists." D1's manifest is the prerequisite either way — no new work.
- **Ordering hygiene**: per 0029, `lib/transcript.ts` (AUI-1) is still the seam extraction ahead of ACP v2 work; nothing in this brief touches it, but graduation of 0029 to Accepted should not imply AUI-1 happened.

## Verification plan

- **D1**: CI job regenerates the manifest and fails on diff; A4's acceptance test doubles as the manifest's (misspelled tag/attr/event/slot in a fixture app → one coded diagnostic, zero false positives across the 66-item corpus); verify's level-3/4 checks consume it as contract; N104's truth source upgrades from `observedAttributes` to the manifest decl map with a regression pin.
- **D2**: unit tests in ssg (`build.test.ts` precedent): emitted file has zero external URLs, budget gate trips at threshold, static shell parses; happy-dom smoke with a mocked postMessage host (handshake, theme-variable mapping, callTool round-trip); one Playwright e2e against the `ext-apps` basic-host harness. Any committed harness/E2E carries the cleanup-checklist attestation in the review request (house rule); the payload-comparison number (nisli emit vs React starter) is CI-produced per 0029 §8 before it appears on nisli.dev.
- **D3**: contract tests spawn the stdio server and golden-test each tool's JSON (the `pack-e2e.mjs`/`npm-e2e.mjs` precedent in `packages/ui/scripts/`); `add_component` e2e into a temp dir diffed against CLI output; `analyze_code` golden corpus seeded with the A5 mistake list.
- **Graduation**: when all three land green, 0029 and 0030.x move Proposed → Accepted with the §8/§7 amendments recorded above — graduation is a docs commit gated on shipped evidence, not a ceremony.

## Size estimate

| Item | Engineering | Byte cost |
|---|---|---|
| D1 manifest (generator scripts + schema doc + CI guard + attr-map static) | **M** — ~1 batch generator + 1 review sweep of 66 entries | 0 runtime; dev-gated static stripped by F3; ~60–80 KB JSON artifact (not shipped in widgets) |
| D2 buildAppResource + app-bridge + starter + ext-apps PR | **M/L** — ssg emit ~1 batch; bridge ~1 batch; template + e2e harness + submissions ~1 batch | app-bridge ≤2 KB gzip (budgeted); hello-world widget ~14–17 KB gzip total |
| D3 @nisli/mcp v1 (tools 1–3 + A4-only analyze) | **M** — package scaffold + 4 contracts ~1 batch; A5 rules accrete later | n/a (dev tool); docs payload rides B3's CI-enforced token budgets |
| model-context.ts adapter | **S** — 1 session | ~0.6 KB, opt-in copy only |

Total: roughly five to six worklist batches across two parallel lanes, no core API additions (the barrel stays within the ≤15-statement ceiling — nothing here exports from core), and the one hard external dependency is F3 landing before the size claims go public.
