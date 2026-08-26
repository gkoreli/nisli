# Agent-Native and Generative UI — how agents actually emit and reason about UI (Aug 2026)

**Date**: 2026-08-25 · **Kind**: prior-art evidence, captured verbatim
**Slice**: how agents actually emit and reason about UI today, what every shipping agent-UI protocol constrains the model's output vocabulary to, and whether constraining that vocabulary has any measured effect on quality or velocity.
**Parent**: [`NEXTGEN-SCRATCHPAD.md`](../NEXTGEN-SCRATCHPAD.md) — new package `@nisli/next`

> Predecessor: ADR [`0029-agent-native-ui-strategy.md`](../../../adr/0029-agent-native-ui-strategy.md)
> surveyed this landscape in Aug 2026 from the *ecosystem* side (where nisli UI runs,
> how it is distributed). This artifact goes at the *authoring* side: what the model
> literally emits, how large the legal vocabulary is, and who checks the result.

---

## Verdict in five bullets

1. **The industry has converged on a closed component catalog for model-emitted UI, and the number is 18.** Google's A2UI reached **v1.0** with a `basic` catalog of exactly **18 components**, stable across v0.9 -> v0.9.1 -> v1.0, containing **zero** styling properties — no colour, no padding, no width, no font-size, no class name anywhere in the 1,346-line schema. The only sizing primitive in the entire catalog is `weight` (flex-grow); the only typographic control on `Text` is `variant: "caption" | "body"`. That is nisli's C10 thesis, arrived at independently, by Google, shipped at 1.0, 16.2k stars, 80k dl/wk on `@a2ui/react`. **§7.13's "is ~30 attributes enough?" now has an external answer: someone shipped 18 components at ~4 props each and called it 1.0.**

2. **But — and this is the hit — nobody applies that constraint to the case we care about.** A2UI constrains the model at *inference time*, emitting a runtime JSON payload into a chat surface. It does **not** constrain a coding agent writing a component file. Every system that constrains *authoring* went the other way: OpenAI's own `@openai/apps-sdk-ui` (540k dl/wk, shipped by the lab with the strongest incentive to make agents good at UI) is a **Tailwind + CSS-variable + `className`-open variant library** whose `Button` exposes `color` (8) x `variant` (4) x `size` (9, documented as literal pixels `22px…48px`) x `iconSize` (6) x `gutterSize` (7) ~= **12,096 visual combinations for one button**, plus `className?: string` (present in **27 of 29** components) and an `opticallyAlign: "start" | "end"` prop that exists purely so a human can nudge a negative margin by eye. **This is precisely the "mapping, not resolving" pattern `C11-EXCLUSIVITY-AND-DERIVATION.md` §3.1 names as the failure — shipped in Aug 2026 by OpenAI.**

3. **The one shipping "constrained component vocabulary over the wire" content type was deleted.** MCP-UI's `remoteDom` content type — a script constructing `<ui-button>`-style elements from a host-provided catalog — was **removed in `@mcp-ui/server` v6.0.0 (2026-01-26)** when MCP-UI folded into MCP Apps: *"BREAKING CHANGES: removed discarded content types."* What survived is `{ type: 'rawHtml' } | { type: 'externalUrl' }` — arbitrary HTML in a sandboxed iframe. MCP Apps (SEP-1865) allows exactly one MIME type, `text/html;profile=mcp-app`, and explicitly deferred everything else. **The standards body considered a constrained vocabulary and chose raw HTML.**

4. **Vercel measured the retreat and it is 225x.** `streamUI` / AI SDK RSC — the flagship "the model streams React components" API — is documented as *"currently experimental… not suitable for stable production use"* with five named engineering defects (unabortable streams, remount flicker, suspense crashes, quadratic data transfer, closed-stream update bugs). `@ai-sdk/rsc` runs **102,864 dl/wk**; the recommended replacement (`ai`: model emits tool calls, developer renders client-side) runs **22,962,178 dl/wk**. The pattern that lost was *not* "constrained vocabulary" — it was "the model emits UI at all."

5. **Nobody's UI is checked by a machine, and everyone already knows the rules.** OpenAI's UI guidelines are a page of prose constraints that read like nisli's resolution table written for a human: *"Limit primary actions per card… up to two maximum"*, *"No nested scrolling. Cards should auto fit their content and prevent internal scrolling"*, *"Keep to 3–8 items per carousel"*, *"Limit variation in font size as much as possible, preferring body and body-small sizes."* There is **no linter, no schema, no CI gate** for any of it — the enforcement mechanism named in the docs is *"the plugin review process"*, i.e. a human. The industry has the rules and no oracle. That is the gap `@nisli/next` claims, and it is real.

---

## Systems surveyed

"What the model emits" is the crux column. Read it as: *when an LLM produces
UI in this system, what token sequence does it actually generate?* Adoption is
npm weekly downloads for the week 2026-08-18 → 2026-08-24 (npm registry API),
stars/pushed via GitHub API on 2026-08-26.

| system | what the model emits | vocabulary size | styling constrained? | adoption (dl/wk · stars · last push) | status |
|---|---|---|---|---|---|
| **A2UI v1.0** (Google + CopilotKit) | **Declarative JSON component tree** (JSONL stream: `createSurface` / `updateComponents` / `updateDataModel` / `deleteSurface`), validated against a client-held catalog with `additionalProperties: false` | **18 components**, 3–6 props each; `minimal` catalog = **5** | **Total.** Zero colour / size / spacing / class props in the whole catalog. v1.0 changelog: *"Decoupled Branding: Removes rigid theme properties (removing hardcoded brand colors) to defer visual styling entirely to the target framework's native theme."* Escape hatch = namespaced `metadata.extensions` bag | `@a2ui/react` **80,289** · 16,206★ · 2026-08-26 | **v1.0, active**, multi-runtime (Flutter/Android/Swift/React), has its own eval suite |
| **MCP Apps** (SEP-1865, Anthropic+OpenAI, MCP org) | **Nothing UI-shaped.** The model emits a *tool call*; the **server** pre-declares a static HTML resource under `ui://`, prefetched and reviewed by the host at connect time | n/a — arbitrary HTML5, one MIME type (`text/html;profile=mcp-app`) | **Inverted**: the *host* pushes a **76-key** CSS-variable palette (`--color-*`, `--font-*`, `--border-radius-*`, `--shadow-*`) that the widget opts into. **No spacing/density variable exists in the standard** | `@modelcontextprotocol/ext-apps` **3,090,377** · 2,761★ · 2026-08-12 | **Spec final**, SDK v1.7.5 |
| **MCP-UI** (`MCP-UI-Org/mcp-ui`) | Same as MCP Apps since v6.0.0. Previously also `remoteDom`: a script building elements from a host component catalog | `rawHtml` / `externalUrl` — **2 content types**, was 3 | Not constrained | `@mcp-ui/client` **294,159**, `@mcp-ui/server` **123,585** · 5,103★ · 2026-07-08 | **Merged into MCP Apps**; `remoteDom` **deleted** in v6.0.0 (2026-01-26) |
| **OpenAI Apps SDK** (`window.openai` + `@openai/apps-sdk-ui`) | **Nothing UI-shaped.** Model emits tool-call args; developer ships a bundled React iframe. UI guidance is **prose in docs** | `@openai/apps-sdk-ui`: **28 components**; `Button` alone has ~15 props / ≈12,096 visual combinations | **No.** Tailwind + 877 CSS custom properties (235 primitive + 482 semantic + 160 component); `className?: string` on **27 of 29** components; `size` scale documented as literal `22px…48px` | `@openai/apps-sdk-ui` **540,081** · v0.2.2 (2026-08-13) | Live, optional, ChatGPT-native |
| **AG-UI** (`ag-ui-protocol/ag-ui`) | **Transcript events, not UI**: 36 event types (5 deprecated) (`TEXT_MESSAGE_*`, `TOOL_CALL_*`, `REASONING_*`, `STATE_SNAPSHOT`/`DELTA`, `RUN_*`, `SUBAGENT_*`). Generative UI = tool name → app-registered component | 0 UI components; vocabulary = the app's registered tool names | n/a | `@ag-ui/core` **1,778,530** · 15,546★ · 2026-08-26 | Active, pre-1.0 |
| **CopilotKit** | **Tool call with schema-validated JSON args.** `FrontendAction.render(props)` maps the call to a React component the *developer* wrote | app-defined (typically <10 registered actions) | **No** — developer's React, unconstrained | `@copilotkit/react-core` **437,851** · 37,044★ · 2026-08-26 | Active; A2UI co-author |
| **Vercel AI SDK — RSC / `streamUI`** | **Tool call**; the tool's `generate` yields React nodes server-side and streams them | app-defined tools | **No** | `@ai-sdk/rsc` **102,864** · (vercel/ai 26,415★) | **Experimental, not recommended for production**; migration guide to AI SDK UI shipped |
| **Vercel AI SDK — UI** (the survivor) | **Tool call**; client renders. Model never emits markup | app-defined | **No** | `ai` **22,962,178** | The volume default |
| **Thesys C1 / Crayon** (`thesysdev`) | Model emits a **component-tree JSON** against Crayon's registry (commercial GenUI API) | **47 components** in `@crayonai/react-ui` | Themed via `ThemeProvider`; author-extensible | `@crayonai/react-ui` **7,501**, `@thesysai/genui-sdk` **3,854** · `thesysdev/openui` 8,457★ · 2026-08-25 | Live but **~2,000× below** the AI SDK; niche |
| **assistant-ui** | n/a (renders agents; does not constrain model UI output) | — | — | `@assistant-ui/react` **1,673,620** · 11,846★ | Reference point for "React copilot market is decided" |

**Reference points for scale** (why the numbers above matter): `playwright`
**85,045,685** dl/wk, `axe-core` **67,615,388** dl/wk,
`@custom-elements-manifest/analyzer` **141,236** dl/wk, `web-types` **0** dl/wk.

---

## What each one actually does

### 1. A2UI v1.0 — the closest thing to our thesis that exists, shipped by Google

**Mechanism.** The agent streams JSONL messages; the renderer holds a *catalog*
and validates every component against it. The catalog is the vocabulary, and
the schema is closed:

> In A2UI v1.0, strict schema validation (`additionalProperties: false`) protects
> components and wire messages from unrecognized fields.
> — `a2ui-project/a2ui` `specification/v1_0/docs/a2ui_protocol.md:1496`

> Defining your own catalog allows you to restrict the agent to using exactly the
> components and visual language that exist in your application.
> — same file, `:155`

**The vocabulary, counted from source** (`specification/v1_0/catalogs/basic/catalog.json`,
1,346 lines):

```
AudioPlayer  Button  Card  CheckBox  ChoicePicker  Column  DateTimeInput
Divider  Icon  Image  List  Modal  Row  Slider  Tabs  Text  TextField  Video
```

Eighteen. Per-component declared property counts: `Text` 4, `Image` 6, `Icon` 3,
`Row`/`Column`/`List` 5, `Card` 3, `Tabs` 3, `Modal` 4, `Divider` 3; the
interactive six (`Button`, `TextField`, `CheckBox`, `ChoicePicker`, `Slider`,
`DateTimeInput`) compose a shared `Checkable` base. A grep for
`"color"|"backgroundColor"|"padding"|"margin"|"fontSize"|"width"|"height"|"style"|"className"|"css"`
over the whole catalog returns **zero matches**.

The only two appearance affordances in the entire catalog:

```jsonc
// Text
"variant": { "type": "string", "description": "A hint for the base text style.",
             "enum": ["caption", "body"], "default": "body" },
"weight":  { "type": "number", "description": "The relative weight of this component
             within a Row or Column. This is similar to the CSS 'flex-grow' property.
             Note: this may ONLY be set when the component is a direct descendant
             of a Row or Column." }
```
— `specification/v1_0/catalogs/basic/catalog.json`, `components.Text`

`Button.variant` is `"default" | "primary" | "borderless"` with the semantics
spelled out in prose *inside the schema* (`"'primary' indicates this is the main
call-to-action button"`). That is `data-role` with a docstring.

**Direction of travel.** v0.9 → v1.0 **removed** theming:

> **Decoupled Branding**: Removes rigid theme properties (removing hardcoded brand
> colors) to defer visual styling entirely to the target framework's native theme.
> — `specification/v1_0/docs/a2ui_protocol.md:39`

**What it cannot express.** No data table, no split pane, no virtualised list, no
custom component the catalog has never seen. The answer to "what about my
bespoke message row?" is *write your own catalog and re-prompt the agent* — i.e.
A2UI does not solve §7.17. It solves the chat-surface subset, and it is honest
about that: the catalog is per-application, not universal.

**Escape hatch design (relevant to §7.15).** Because `additionalProperties: false`,
arbitrary props are impossible. Instead there is one namespaced bag:

> **Component Scope** (`ComponentCommon.metadata.extensions`): Attach
> component-instance styling overrides, telemetry markers, or custom validation
> rules. […] Conformant renderers MUST NOT reject payloads containing extension
> keys within an `extensions` object […] and MUST ignore unrecognized extension
> keys without error.
> — `specification/v1_0/docs/a2ui_protocol.md:1502–1513`

So: closed by default, one named, prefixed, ignorable escape. Not a `className`.

### 2. MCP Apps (SEP-1865) — the model emits nothing, the host owns the tokens

The most-adopted agent-UI standard by download volume constrains the model's UI
vocabulary to **the empty set**. The model calls a tool; the *server* has already
registered an HTML resource:

> - URI MUST start with `ui://` scheme
> - `mimeType` MUST be `text/html;profile=mcp-app` (other types reserved for future extensions)
> - Content MUST be provided via either `text` (string) or `blob` (base64-encoded)
> - Content MUST be valid HTML5 document
> — `modelcontextprotocol/ext-apps` `specification/draft/apps.mdx:276–279`

The design rationale is explicitly about **auditability, not about model output
quality**:

> - **Performance:** Host can preload templates before tool execution
> - **Security:** Host can review UI templates during connection setup
> - **Caching:** Separate template (static) from data (dynamic)
> - **Auditability:** All UI resources are enumerable and inspectable
> — `specification/draft/apps.mdx:425–428`

**Where the constraint went instead: a 76-key host palette.** `McpUiStyleVariableKey`
(`src/spec.types.ts:44–133`) is a closed union of exactly **76** CSS custom
properties the host may push into the widget:

- 37 colour roles — `--color-background-{primary,secondary,tertiary,inverse,ghost,info,danger,success,warning,disabled}`, the same ten for `text` and `border`, seven `ring`
- 28 typography — 2 families, 4 weights, 4 text sizes + 4 line-heights, 7 heading sizes + 7 heading line-heights
- 6 radii, 1 border width, 4 shadows

**The gap that matters for us: there is no spacing, gap, density, or hit-target
variable in the standard.** Colour, type, radius and shadow are standardised;
*rhythm* is not. Every MCP App picks its own padding by hand. That is exactly
the axis nisli's `--ui-unit` derivation owns, and the industry's own theming
contract leaves it empty.

Also notable: `window.openai.notifyIntrinsicHeight(...)` — *"Report dynamic widget
heights to avoid scroll clipping."* The host refuses to measure; the author must.
A fit decision, handed back to the author, in the newest UI platform on earth.

### 3. MCP-UI — the constrained-vocabulary content type that was deleted

`remoteDom` let a server ship a *script* that constructed elements from a host
component registry — the closest thing in the ecosystem to "the model/server
speaks a closed component vocabulary and the host renders it natively." It is
gone:

```
# [6.0.0](…/compare/server/v5.17.0...server/v6.0.0) (2026-01-26)
### Features
* mcp-ui -> mcp apps! (#172)
### BREAKING CHANGES
* removed discarded content types, changed mimetype, updated docs, etc.
```
— `MCP-UI-Org/mcp-ui` `sdks/typescript/server/CHANGELOG.md:15–24`

What remains, verbatim:

```ts
export type ResourceContentPayload =
  | { type: 'rawHtml'; htmlString: string }
  | { type: 'externalUrl'; iframeUrl: string };
```
— `sdks/typescript/server/src/types.ts:29–31`

### 4. OpenAI Apps SDK — prose rules, Tailwind reality

**What the model emits: nothing.** The developer bundles React with esbuild and
inlines it into one HTML resource. `window.openai` is a *host bridge*, not a UI
vocabulary: `toolInput`, `toolOutput`, `widgetState`, `setWidgetState`,
`callTool`, `sendFollowUpMessage`, `requestDisplayMode`, `requestModal`,
`requestClose`, `notifyIntrinsicHeight`, `uploadFile`, `selectFiles`,
`getFileDownloadUrl`, `openExternal`, `setOpenInAppUrl`, plus context signals
(`theme`, `displayMode`, `maxHeight`, `safeArea`, `view`, `userAgent`, `locale`).

**The design system is prose.** From the UI guidelines page, verbatim:

> - **Limit primary actions per card**: Support up to two actions maximum, with one primary CTA and one optional secondary CTA.
> - **No deep navigation or multiple views within a card.**
> - **No nested scrolling**. Cards should auto fit their content and prevent internal scrolling.
> - Keep to **3–8 items per carousel** for readability.
> - Limit variation in font size as much as possible, preferring body and body-small sizes.
> - Text and background must maintain a minimum contrast ratio (WCAG AA).

Every one of those is a machine-checkable predicate. None of them is checked by
a machine. The stated enforcement is *"The plugin review process checks the
declared policy against the UI behavior."*

**And the component library contradicts the prose.** `@openai/apps-sdk-ui@0.2.2`
`Button`:

```ts
type CommonProps = {
    color: SemanticColors<"primary"|"secondary"|"danger"|"success"|"info"|"discovery"|"caution"|"warning">;
    variant?: Variants<"solid" | "soft" | "outline" | "ghost">;
    pill?: boolean;
    disabled?: boolean;
    disabledTone?: "relaxed";
    block?: boolean;
    /** Applies a negative margin using the current gutter to optically align the button
     * with surrounding content. */
    opticallyAlign?: "start" | "end";
    /** | 3xs | 2xs | xs | sm | md | lg | xl | 2xl | 3xl |
     *  | 22px| 24px| 26px| 28px| 32px| 36px| 40px| 44px| 48px| */
    size?: ControlSize;
    iconSize?: Sizes<"sm"|"md"|"lg"|"xl"|"2xl">;
    gutterSize?: Sizes<"3xs"|"2xs"|"xs"|"sm"|"md"|"lg"|"xl">;
    /** Custom class applied to the Button element */
    className?: string;
    children: React.ReactNode;
};
```
— `@openai/apps-sdk-ui@0.2.2` `dist/types/components/Button/Button.d.ts:3–64`

Read that as `C11-EXCLUSIVITY-AND-DERIVATION.md` §1 reads our own button: the
**caller** decides the size, the values are **hand-written pixels transcribed
into a scale**, and `className` is a hole in the floor. `opticallyAlign` is the
purest possible artefact of an eyes-decision: a prop whose only job is to let a
human apply a negative margin because it *looked* off. Token counts:
235 primitive + 482 semantic + 160 component = **877 CSS custom properties**
across three files.

### 5. AG-UI / CopilotKit / Vercel AI SDK — "generative UI" is tool-call dispatch

All three have the same shape, and it is not a UI vocabulary at all. AG-UI's
wire format is a transcript event enum with **no visual vocabulary whatsoever**
(`events.ts:13–64`). CopilotKit's generative UI is:

```ts
export type FrontendAction<T extends Parameter[] | [] = [], N extends string = string> = Action<T> & {
  …
  | { render?: string | ((props: ActionRenderProps<T>) => string | React.ReactElement); … }
  | { renderAndWaitForResponse?: (props: ActionRenderPropsWait<T>) => React.ReactElement; … }
}
```
— `CopilotKit/CopilotKit` `packages/react-core/src/v1-deprecated/types/frontend-action.ts:211–245`

Vercel's `streamUI` is the same, one layer down:

```ts
type RenderTool<INPUT_SCHEMA…> = {
  description?: string;
  inputSchema: INPUT_SCHEMA;
  generate?: Renderer<[InferSchema<INPUT_SCHEMA>, { toolName: string; toolCallId: string }]>;
};
```
— `vercel/ai` `packages/rsc/src/stream-ui/stream-ui.tsx:50–64`

**In every case the model's UI vocabulary is the set of tool names the developer
registered — typically under ten — and the pixels are 100% author-written React.**
The constraint on the model is total (it can only pick a name and fill a JSON
schema); the constraint on the *author* is zero. That is the precise inverse of
what `@nisli/next` proposes.

And the flagship version of this pattern is in retreat, in Vercel's own words:

> However, given we're pushing the boundaries of this technology, AI SDK RSC
> currently faces significant limitations that make it unsuitable for stable
> production use. […] Due to these limitations, AI SDK RSC is marked as
> experimental, and we do not recommend using it for stable production
> environments.
> — `vercel/ai` `content/docs/05-ai-sdk-rsc/10-migrating-to-ui.mdx:17–25`

---
### 6. How the generation platforms actually verify their own UI — they don't

This is the single most important section for the bet, because it is the market
answer to "who checks appearance?" **Nobody does. Everybody checks compilation.**

**v0 (Vercel), the market leader, published its pipeline in Jan 2026.** The
optimisation target, verbatim:

> The primary metric we optimize for is the percentage of successful generations.
> A successful generation is one that produces a working website in v0's preview
> instead of an error or blank screen.
> — [How we made v0 an effective coding agent](https://vercel.com/blog/how-we-made-v0-an-effective-coding-agent), 2026-01-07

Not "looks right". **"Not an error or blank screen."** The whole three-stage
pipeline is syntactic:

- **Dynamic system prompt** — inject the current AI SDK version's API surface so the model doesn't use a stale one.
- **LLM Suspense** — rewrite the token stream mid-flight. The showcase example is a *closed-vocabulary snap*: every `lucide-react` icon name is embedded in a vector DB, the real exports are read at runtime, and a hallucinated `VercelLogo` is rewritten to `Triangle as VercelLogo` in under 100 ms.
- **Autofixers** — AST checks for a missing `QueryClientProvider`, missing `package.json` deps, "repairing common JSX or TypeScript errors."

> In our experience, code generated by LLMs can have errors as often as 10% of the time.

And the earlier composite-model post reports the eval as an *error* rate:

| Model | Error-free generation rate |
|---|---|
| v0-1.5-md | 93.87 |
| v0-1.5-lg | 89.80 |
| claude-4-opus | 78.43 |
| claude-4-sonnet | 64.71 |
| o3 | 58.82 |
| gpt-4.1 | 58.82 |

— [Introducing the v0 composite model family](https://vercel.com/blog/v0-composite-model-family), 2025-06-01

**There is not one geometric, contrast, overflow, alignment, or hit-target check
anywhere in either post.** The most-invested AI-UI pipeline on the market has a
compile oracle and no visual oracle.

**shadcn — the distribution channel coding agents actually use — ships its
verification advice as an MCP tool.** Verbatim, the complete text returned by
`get_audit_checklist`:

```
## Component Audit Checklist
After adding or generating components, check the following common issues:
- [ ] Ensure imports are correct i.e named vs default imports
- [ ] If using next/image, ensure images.remotePatterns next.config.js is configured correctly.
- [ ] Ensure all dependencies are installed.
- [ ] Check for linting errors or warnings
- [ ] Check for TypeScript errors
- [ ] Use the Playwright MCP if available.
```
— `shadcn-ui/ui` `packages/shadcn/src/mcp/index.ts:524–540`

Five compile-time items and one *"look at it if you can."* That is the published
state of the art for agent self-verification of UI, from the registry that
defines the idiom.

**The only working appearance oracle in the industry is a panel of humans.**
UI-Bench (arXiv 2508.20410) ranks ten text-to-app tools — Orchids, Figma Make,
Lovable, Anything, Bolt, Magic Patterns, Base44, Same.new, v0, Replit — using
**4,000+ expert pairwise judgments** over 300 generated sites, scored with a
TrueSkill-derived model. Top rating 30.12 / 67.5% win rate (Orchids); the
bottom cluster (including **v0** and **Replit**) sits below 24 with win rates
under 48%. The spread between best and worst is large and **entirely invisible
to every automated check any of those products runs.**

### 7. Machine legibility — what a model actually reads when it looks at UI

The question "which artefact does a coding agent consume TODAY?" has a
surprisingly sharp answer from source.

**`class` is explicitly excluded from what the model sees.** browser-use
(110,537★, the most-used browser agent) serialises the DOM for the model through
an attribute allowlist. The list is 40+ entries long. `class` is in it — commented out:

```python
DEFAULT_INCLUDE_ATTRIBUTES = [
	'title',
	'type',
	'checked',
	# 'class',
	'id',
	'name',
	'role',
	'value',
	'placeholder',
	…
	'aria-label',
	'aria-expanded',
	'data-state',
	'aria-checked',
	…
]
```
— `browser-use/browser-use` `browser_use/dom/views.py:18–24, :30–33`

Two things fall out. (a) **Tailwind class strings are noise to a model reading a
page** — the highest-volume agent in the world pays tokens for `role`, `aria-*`
and `data-state` and deliberately drops `class`. (b) **`data-state` is in the
allowlist**, which is ADR 0022's invariant, unmarketed, already being consumed.

**Playwright is the format.** `ariaSnapshot` has a first-class AI mode:

```ts
export type AriaTreeOptions = {
  mode: 'ai' | 'default' | 'codegen' | 'autoexpect';
  refPrefix?: string;
  doNotRenderActive?: boolean;
  depth?: number;
  boxes?: boolean;
};
…
if (options.mode === 'ai') {
    // For AI consumption.
    return { visibility: 'ariaOrVisible', refs: 'interactable', …,
             renderActive: …, renderCursorPointer: true, renderBoxes };
}
```
— `microsoft/playwright` `packages/injected/src/ariaSnapshot.ts:40–72` (v1.63.0-next)

and geometry is already there:

> New `boxes` option on `Locator.ariaSnapshot` / `Page.ariaSnapshot` appends each
> element's bounding box as `[box=x,y,width,height]`, useful for AI consumption.
> — `docs/src/release-notes-js.md:248` (Playwright 1.60)

This confirms the round-3 ruling in `NEXTGEN-SCRATCHPAD.md` §5.2: **the snapshot
format is not a moat.** Playwright ships an AI-tuned accessibility tree with
optional pixel boxes, at 85M downloads/week, and the assertion matcher still
does nothing with the geometry.

**Semantics beat pixels, measurably.** The benchmark literature is a natural
experiment on which representation a model can act on:

| representation | benchmark | best reported |
|---|---|---|
| DOM/accessibility tree + refs | WebVoyager (643 tasks) | 93.9% (Magnitude), 90.4% (Browserable), 89.1% (browser-use) |
| **pixels only**, dense professional UI | **ScreenSpot-Pro** | **18.9%** at introduction; 72.9% for a purpose-trained 32B GUI model, 80.3% with a two-stage crop-and-zoom refinement |
| pixels + OS, long-horizon | OSWorld-Verified | 86.1% (Qwen3.8 Max, 2026-08-21) |
| pixels + OS, long-horizon (hard) | OSWorld 2.0 | **20.6%** |

The gap between ~90% on a semantic tree and 18.9% on raw pixels for *the same
underlying interfaces* is the strongest available evidence that **a UI's
legibility to a model is a property of its declared semantics, not its
appearance**. That is the same claim as C11 seen from the consumption side, and
it is the one part of the thesis with unambiguous external support.

**Component manifests are not consumed.** `@custom-elements-manifest/analyzer`
is **141,236 dl/wk** (321★, last push 2026-07-03); JetBrains' `web-types` npm
package reports **0 dl/wk**. Neither appears in any coding-agent tool surface I
could find in source. What *is* consumed is the shadcn MCP server's registry
tools — `list_items_in_registries`, `search_items_in_registries`,
`view_items_in_registries`, `get_item_examples_from_registries`,
`get_add_command_for_items`, `get_audit_checklist`
(`packages/shadcn/src/mcp/index.ts:58–184`). **The winning machine interface for
components is "search a registry and read the source of an example", not a typed
manifest.** ADR 0029 §4's manifest is the right artefact aimed at the wrong
consumer unless it is served through that channel.

---
### 8. **Does constraining the vocabulary help or hurt model output quality?** — the direct answer

**Short answer: constraining the *shape* is free; constraining *against the
model's defaults* is expensive; compressing the vocabulary's *descriptions* is
actively harmful. There is no published evidence that a constrained UI
vocabulary improves quality, and there is direct published evidence that
telling a frontier model "do not style the way you normally style" fails
81–90% of the time.**

#### 8a. The damaging evidence — arXiv 2604.07192 (Tencent, Apr 2026)

*Compact Constraint Encoding for LLM Code Generation: An Empirical Study of
Token Economics and Constraint Compliance.* 6 rounds, 11 models, 16 tasks,
830+ invocations, deterministic rule-based Constraint Satisfaction Rate.

The result that hits us squarely:

> The largest observed sources of compliance variance are constraint type
> (Δ = 9 percentage points between normal and counter-intuitive constraints) and
> task domain: **counter-intuitive constraints opposing model defaults fail at
> rates of 10–100% (dominated by CSS-related styling constraints in the frontend
> domain** […]), while conventional constraints achieve 99%+ compliance
> regardless of encoding.

The per-task table, verbatim:

| Task | Constraint | Failures | Default pattern | Required pattern |
|---|---|---|---|---|
| MC-FE-01 | C2: CSS Modules | **17/21 (81%)** | Inline style objects | CSS Modules import |
| MC-FE-02 | C3: No inline style | **19/21 (90%)** | **Inline styles + Tailwind** | CSS Modules import |

> Category 1: **Default Bias (36/47 failures, 77%)**. The model generates code
> following its default implementation preference despite an explicit constraint
> to the contrary. […] **all 36 default-bias failures come from C2/C3 in FE-01
> and FE-02 tasks (CSS Modules and inline-style prohibitions).**

Three corollaries, all bad for a prompt-enforced version of our bet:

1. **Styling is the single worst domain for constraint compliance in the study.** Not a coincidence — it is where the model's priors are densest.
2. **Encoding form is irrelevant.** H (compact header) vs NLc vs NLf: Δ ≈ 0.3 pp, Cliff's δ < 0.01, 95% CI [−2.6, +2.1] pp. C2 failure by encoding: H 8.5%, NLc 13.6%, NLf 9.6% — no consistent winner. **"Our vocabulary is small so it fits in context" buys tokens, not compliance.** Measured saving: 71% of the constraint block, ~25–30% of the prompt.
3. **The model's self-report is not an oracle.** *"Model self-assessments systematically overestimate compliance relative to rule-based scoring, revealing a gap between constraint understanding and execution."* An agent will tell you it obeyed the vocabulary while emitting `style={{…}}`.

The authors' own conclusion: *"engineering effort toward constraint compliance
is better directed at constraint design than prompt formatting."*

#### 8b. The supporting evidence — Google's own format bake-off on A2UI

A2UI ships an Inspect-AI eval harness with four competing *inference formats*
for the same 18-component catalog — `direct` (JSON), `express` (XML-ish DSL with
an ANTLR grammar at `specification/inference_formats/express/Express.g4`),
`elemental` (DSL) and `atom` (S-expressions) — plus an automated
"iterative format optimizer" that keeps or reverts each change against a
composite score:

> To test across different inference formats (`direct` JSON, `express` XML tags,
> `elemental` DSL):
> `uv run main.py --dataset multi_turn_conversation_dataset --strategies direct,express,elemental`
> — `a2ui-project/a2ui` `eval/README.md:80–86`

52 recorded `atom` runs and 27 `express` runs
(`eval/iterative_format_optimizer/history_summary.md`). The recurring failure
mode across them is the one that matters for §7.13:

> **Run 014** — "Streamline catalog component signature property detail descriptions
> to minimize input token overhead." → *Input Tokens reduced by −46.3% (2,389 vs
> 4,447) and Reasoning Tokens by −32.4%, **but Schema Acc and Quality Score
> regressed from 100.0% to 75.0% (−25.0%) due to missing property context.**
> Reverted."*
>
> **Run 030** — "Compact catalog schema parameter formatting for boolean/enum flags."
> → *"Schema Acc regressed to 83.3% and Quality Score regressed to 83.3%
> **because omitting description lines for short enums/booleans created search
> space ambiguity in multi-attribute components.** […] Score dropped −0.165."*
>
> **Run 019** — trimming single-string property descriptions cut input tokens
> −16.8% but *"reasoning tokens and latency slightly increased due to property
> description absence causing LLM ambiguity."*

Read together: **the vocabulary can be tiny; its documentation cannot.** An
18-component catalog still costs ~4,400 input tokens because each enum value
needs prose telling the model *when* to choose it. Deleting that prose is a
−25 pp quality regression. Google also found the format itself matters for cost
(`express` ≈ 5,936 input tokens vs `atom` ≈ 4,440 for the same catalog) but
never for correctness once descriptions are present — both plateau at 100%
schema accuracy.

Notable also: A2UI **encrypts its eval datasets at rest** with Transcrypt
specifically *"to prevent base model contamination"* (`eval/README.md:14–22`) —
Google considers corpus leakage a first-order threat to measuring this.

#### 8c. The one place constraint demonstrably helps

Schema-constrained decoding against a closed catalog turns "did the model emit
something renderable?" from a probability into a validation. A2UI's harness
reports **100% algorithmic schema accuracy** as the *maintained baseline* across
dozens of optimizer runs, with the failure budget spent on semantic quality
rather than on well-formedness. Compare v0, which must run a vector-DB icon-name
snap, an AST pass and a fine-tuned repair model to reach a 93.87% *error-free*
rate against free-form React. **The closed vocabulary does not make the design
better; it makes the artefact always renderable.** That is a real and
underrated win — it is the "Potemkin interface" class (0030.1 A4 / 0030.2 T4)
deleted by construction — but it is a *different* win from the one C10/C11
claims.

---

## Ideas worth stealing

1. **`additionalProperties: false` as the exclusivity mechanism, and one named
   escape bag as the hatch.** *(A2UI v1.0, `a2ui_protocol.md:1496–1513`.)* This
   is the cleanest existing answer to §7.15. Google closed the schema totally and
   then defined exactly one prefixed, optional, renderer-ignorable
   `metadata.extensions` container per scope, with reserved namespaces. Applied
   to us: the `escape` attribute should be a **single reserved, namespaced,
   countable field with a `MUST NOT reject / MUST ignore unrecognised` contract**,
   not a free `className`. It also gives the manifest a natural place to record
   the escape ratio.

2. **Ship prose semantics *inside* the schema, per enum value.** *(A2UI catalog:
   every `variant` enum carries a description saying when to use it; the eval
   proves deleting them costs −25 pp.)* nisli's `p.enum()` / T3 schema should
   carry a one-line "choose this when…" per legal value, and the agent-facing
   surface (skill / llms.txt / manifest) should emit those strings. **§7.13's
   budget is not "~30 attributes" — it is "~30 attributes × one sentence each ≈
   4,400 tokens", which is what A2UI actually costs.** That still fits in
   context and is 10× smaller than a Tailwind config, but "fits on one page" is
   the wrong claim to market.

3. **Separate the *data* tool from the *render* tool.** *(OpenAI Apps SDK,
   "Separate data processing from UI rendering".)* The model fetches, reasons,
   *then* calls a render tool with final data — so the UI is composed once from
   model-checked context instead of re-rendered per tool call. The analogue for
   an appearance resolver: **resolve once from settled data, not per signal
   tick** — it is an argument for `settle()` (0030.2 T2) being a prerequisite of
   the fit pass, which the round-8 prototype already found empirically.

4. **The host owns the palette; the app owns nothing.** *(MCP Apps'
   `McpUiStyleVariableKey`, 76 keys, pushed in at `ui/initialize`.)* A widget
   that reads `var(--color-background-primary)` is *derived from context* in
   exactly nisli's sense — and nisli's light-DOM token layer already reads that
   shape (ADR 0029 §3). **The standard's blank spot is spacing/density; there is
   no `--spacing-*` or `--density` key in the union.** Publishing a proposed
   spacing/density extension to `io.modelcontextprotocol/ui` is a cheap, high-
   visibility move that is *literally our thesis* in someone else's spec.

5. **Closed-vocabulary snap-and-rewrite at the boundary.** *(v0's LLM Suspense:
   embed every legal `lucide-react` icon name, read the real exports at runtime,
   rewrite a hallucinated name to the nearest legal one in <100 ms.)* Generalise:
   when the model emits `data-appearance="cta"` and the legal set is
   `action | quiet | danger | link`, **snap it rather than fail it**, and record
   the snap as a diagnostic. This is the difference between a closed vocabulary
   that is hostile to agents and one that is forgiving; v0 shipped it and it is
   the single most agent-friendly engineering idea in this whole survey.

6. **`weight` as the only sizing primitive.** *(A2UI.)* One relative number
   (flex-grow), legal only on direct children of a `Row`/`Column`, with the
   constraint stated in the property description. No `width`, no `flex-basis`,
   no `min-width`. It is a smaller layout vocabulary than `data-priority` +
   `grow` and it shipped at 1.0 — evidence that the expressiveness floor is
   lower than we fear for the *chat-surface* subset.

7. **Drop `class` from anything a model reads.** *(browser-use
   `DEFAULT_INCLUDE_ATTRIBUTES`.)* If the manifest / snapshot / diagnostic
   surface ever serialises a nisli tree for a model, the evidence says emit
   `data-appearance`, `data-role`, `data-state`, `role`, `aria-*` and drop class
   lists entirely. It also means **our attributes are already in the allowlist
   of the world's most-used browser agent**, which is a marketing fact ADR 0029
   §4 should be using.

8. **Publish the eval, encrypt the dataset.** *(A2UI `eval/`.)* If the demo is
   "same prompt, same agent, nisli vs React+Tailwind, rounds until correct"
   (§5.4), then the prompt set is the artefact and it will be trained on. Google
   uses Transcrypt so the repo stays readable to contributors and opaque to
   crawlers. Copy that verbatim.

---

## Where the prior art says we are wrong

### 1. The training-corpus argument is not a hand-wave; it is measured, and styling is its worst case

This is the head-on engagement the brief asks for.

`NEXTGEN-SCRATCHPAD.md` §1 already concedes *"corpus mass, not design, decides
today's leaderboard"* (Web-Bench: React 65% vs Svelte 25%, same model). The new
evidence is worse than that, because it is not about an unfamiliar *framework* —
it is about an unfamiliar *styling channel*, specifically:

> MC-FE-01 C2 (use CSS Modules): **17/21 failures (81%)** — model produced inline style objects.
> MC-FE-02 C3 (no inline style): **19/21 failures (90%)** — model produced inline styles + Tailwind.
> — arXiv 2604.07192 §4.5

Those are not obscure models. The study's two primary models are Claude Opus
(CSR 0.944) and DeepSeek (0.967) — both near-perfect on *conventional*
constraints, both catastrophic when told to abandon their default styling. And
the failure is **encoding-invariant**: compact tag headers, compact prose and
verbose prose all fail at the same rate. You cannot prompt your way out.

The honest nisli counter-argument is real but narrower than it looks:
**exclusivity is a type constraint, not a prompt constraint.** `className` does
not exist on the component, so the model *cannot* pass it and typecheck; the
round-8 exclusivity guard mechanically rejects length and colour literals
outside the theme. Compliance therefore becomes *detectable* rather than
*hoped for*. But three things survive that counter:

- **The failure just relocates to the escape hatch.** The model's default is
  inline styles; if `escape` exists, the measured prior says it will be reached
  for on the majority of first attempts at any bespoke surface. Our own
  round-6 prototype already reported exactly one finding — *the intentional
  escape hatch reporting itself*. That was a hand-built fixture, not an agent's
  first draft.
- **Velocity, not correctness, is the claim under threat.** If the loop is
  "agent writes `style={{}}` → guard rejects → agent retries", the number of
  rounds to correct goes **up**, not down, until the model has priors. The
  §5.4 demo ("counted rounds until actually correct, nisli vs React+Tailwind")
  is therefore a genuinely risky bet, and it is the right bet to run *early*,
  because it can falsify the thesis cheaply.
- **The models know the rules and violate them anyway.** The paper's
  self-assessment gap means an agent will report compliance it did not achieve.
  Any "agent-verifiable UI" story must be externally scored — which nisli has
  (the derived checker) and which is, on this evidence, the load-bearing half.

### 2. Everyone who tried to constrain UI *authoring* for models retreated; only *runtime emission* stayed constrained

Line them up:

- MCP-UI built `remoteDom` (constrained component vocabulary over the wire) and **deleted it** at v6.0.0.
- MCP Apps considered non-HTML content types and **explicitly deferred them** (*"MVP supports only `text/html;profile=mcp-app` (rawHtml), with other types explicitly deferred"*, `apps.mdx:2395`).
- Vercel built `streamUI` and **marked it experimental / not for production**; the surviving path has the model emit tool calls only.
- OpenAI — the lab with the most to gain from agents authoring good UI — shipped **Tailwind, 877 CSS variables, `className` on 27 of 29 components, and a 9-step pixel size scale**, and put its actual design constraints in **prose that nothing enforces**.

The only survivors of the constrained-vocabulary pattern (A2UI, Crayon) constrain
**what a model emits at inference time into a chat surface**, never what a
developer writes into a file. `@nisli/next` proposes the thing four organisations
tried and abandoned, in the harder direction. That is not disqualifying — every
one of those retreats has a *stated* cause that is about streaming mechanics,
security review or ecosystem interop, and **none of them is "the constrained
vocabulary produced worse UI"** — but the base rate is against us and the artifact
should say so.

### 3. "Fewer ways to be wrong" is asserted, never measured — and the one adjacent measurement is a null result

§0.1 consequence 1 ("an AI has far fewer ways to be wrong… it chooses from about
ten roles instead of tens of thousands of utility combinations") is the load-
bearing adoption claim, and **no published study measures it.** The nearest
measurement is 2604.07192's encoding experiment, and it is a *null*: compressing
the constraint surface by 71% changed compliance by 0.3 pp. Choice-set size was
not the variable that moved. **We should stop asserting the search-space
argument until we have run it ourselves**, because the only relevant published
number says surface size does not predict compliance — constraint *conventionality*
does.

### 4. Vocabulary size: the industry number is 18–47 components, and it is per-application, not universal

§7.13 asks whether ~30 attributes is enough. The external data:

| system | components | note |
|---|---|---|
| A2UI `minimal` | 5 | Button, Column, Row, Text, TextField |
| **A2UI `basic` v1.0** | **18** | stable across three versions, zero style props |
| `@openai/apps-sdk-ui` | 28 | but `className`-open, so not a closed vocabulary |
| `@crayonai/react-ui` | 47 | commercial GenUI, 7.5k dl/wk |
| `@nisli/ui` today | 58 | shadcn parity |

The number is achievable. But **A2UI's own docs say the basic catalog is a
starting point and that applications define their own** (`a2ui_protocol.md:155`).
Nobody has shipped a universal closed vocabulary that expresses a data table, a
docs nav, a transcript *and* a marketing hero — which is precisely the four
surfaces §7.13 demands. The prior art gives us confidence about the *order of
magnitude* and none about *universality*.

### 5. Our "context economics" advantage is smaller than claimed

§4 C10 argues *"three words per component instead of forty tokens of classes."*
Two measurements say the saving is real but not decisive: A2UI's 18-component
catalog still costs **~4,400 input tokens** because the descriptions are
load-bearing (and deleting them costs 25 pp of quality); and 2604.07192 measured
a 71% constraint-block saving translating to only **~25–30% of the full prompt**,
scaling down further in realistic contexts — *"For a 4,000-token prompt where
constraints occupy 200 tokens (~5%), this yields ~3.5% total savings rather than
25%."* Token economy is a nice-to-have, not a differentiator.

### 6. The industry already ships our rules — as prose — and nobody complains

Every constraint in OpenAI's UI guidelines is a rule nisli would derive: two
primary actions max, no nested scrolling, auto-fit content, 3–8 carousel items,
minimise font-size variation, WCAG AA contrast, enforced image aspect ratios.
They are *published*, *read*, and *unenforced*, and the platform is thriving. The
uncomfortable reading: **the market's revealed preference is that prose rules +
human review is good enough**, and the delta a resolver adds is invisible to
everyone except the person who has to fix a 3px misalignment. That is the same
demand problem §7.12 flags for Galen, arriving from a different direction —
and it is why the §7.10 regime question is still the highest-leverage open
question in the whole scratchpad.

### 7. The "agent-native" framing has a known failure mode in this exact market

ADR 0029 already recorded that WebMCP renamed its entry point three times in a
year with no shipping consumer, and that A2UI at v0.9 had no web renderer. In
the seven months since, A2UI went to v1.0 with 16.2k stars and a React package
at 80k dl/wk — so *that* one moved. But the pattern the scratchpad names for
MoonBit ("maximally AI-native by design and stayed niche") is visible here too:
Thesys C1/Crayon is a well-engineered, model-first, closed-catalog GenUI product
at **3,854 dl/wk for its SDK** against the AI SDK's 22.9M. Being the most
model-native design in the category has, so far, correlated with the smallest
distribution.

---

## Open questions for the maintainer

1. **Do we test the corpus objection before or after we build the vocabulary?**
   The cheapest falsification of the whole bet is one experiment: give a frontier
   model the round-8 prototype's vocabulary and a bespoke surface brief, and count
   (a) how many first drafts reach for `style=`/raw CSS, (b) rounds-to-correct
   versus React+Tailwind. arXiv 2604.07192 predicts 81–90% first-draft violation.
   **Tradeoff**: running it first risks killing the project in a week; running it
   later risks building the resolution table (40% of the work, per §5.4) on a
   falsified premise. My read: run it first, on the prototype we already have.

2. **Is `@nisli/next` aimed at authoring, at runtime emission, or both?** The
   surface where a closed vocabulary is *proven* (A2UI, 16.2k stars, v1.0) is
   model-emits-JSON-into-a-chat-surface. The surface we want is agent-writes-a-
   component-file. **Tradeoff**: an A2UI *catalog* built from nisli primitives is
   a real, small, shippable artefact with an existing consumer and would make
   nisli the first web-component A2UI renderer — but it is a different product
   from C11, and doing it first would spend the vocabulary design on someone
   else's spec. Doing C11 first means the vocabulary has no external consumer at
   launch.

3. **Do we contribute the missing spacing/density axis to MCP Apps?** The
   `McpUiStyleVariableKey` union has 76 keys and **no spacing, gap, density or
   hit-target variable**. That is our thesis's home turf, unclaimed, in an
   Anthropic+OpenAI-governed spec with 3.1M dl/wk. **Tradeoff**: standards work
   is slow and public, and it hands the idea to everyone — but it is the single
   highest-leverage distribution move in this entire survey and it costs one PR
   plus an argument, not a product.

4. **What is the escape hatch's shape: `className`-like, or A2UI-like?** A2UI's
   answer (`additionalProperties: false` plus one reserved, prefixed, ignorable
   `metadata.extensions` bag) is stricter than anything we sketched and is
   already validated in a 1.0 spec. **Tradeoff**: strict-plus-one-bag makes the
   escape ratio exactly countable and the guarantees crisp, but it makes ported
   code and third-party CSS genuinely painful in a way `escape="mt-[7px]"` is
   not. §7.15 should be decided against A2UI's design, not in a vacuum.

5. **Is "the vocabulary fits on one page" a claim we can keep?** Google's
   18-component catalog costs ~4,400 input tokens *because* every enum value
   carries prose, and deleting the prose cost 25 pp of quality. **Tradeoff**:
   marketing "one page" is punchy and false; marketing "one skill file, ~4k
   tokens, complete and enumerable" is accurate and still a 10x win over a
   Tailwind config. Pick one before the README exists.

6. **What regime compels anyone to run the checker?** (§7.10 restated with new
   evidence.) The candidates the market actually rewards are now visible:
   `axe-core` won on WCAG (67.6M dl/wk); MCP Apps' host review is a *human*
   gate; OpenAI's plugin review is a *human* gate; UI-Bench's oracle is 4,000
   *human* judgments. **The only automated gate anyone is required to pass in
   this whole survey is schema validation.** If our checker is not a schema
   validation — i.e. if it is not the thing that decides whether the artefact is
   *acceptable* rather than *good* — it has no regime. **Tradeoff**: making the
   check a hard build gate is the only way it gets run, and it is also the
   fastest way to make the framework feel hostile.

7. **Do we snap or fail on an out-of-vocabulary value?** v0 snaps (embedding
   search over legal icon names, <100 ms, no model call) and reports a 93.87%
   error-free rate; A2UI fails (schema rejection) and reports 100% schema
   accuracy with the failures pushed into semantic quality. **Tradeoff**:
   snapping is forgiving and hides drift; failing is honest and costs rounds.
   The prototype's diagnostics layer can do either; the decision is policy, not
   code.

---

## Belongs to another slice

- **Visual-oracle prior art** (`VisualOraclePriorArt`): UI-Bench (arXiv 2508.20410,
  4,000+ expert pairwise judgments, TrueSkill), DesignBench (arXiv 2506.06251),
  Interaction2Code (arXiv 2411.03292), Cookie-Bench (arXiv 2605.30000),
  I-WebGenBench (arXiv 2606.00750) are all appearance-oracle evidence I hit while
  chasing "how do generation platforms verify their output". I cite UI-Bench above
  only as evidence that the industry's working oracle is human; the oracle-design
  implications are yours.
- **Semantic vocabulary** (`SemanticVocab`): A2UI's per-enum prose descriptions and
  its `Button.variant: default|primary|borderless` / `Text.variant: caption|body`
  choices are direct vocabulary evidence; full catalog at
  `specification/v1_0/catalogs/basic/catalog.json` in `a2ui-project/a2ui`.
- **Constraint layout** (`ConstraintLayout`): A2UI's `weight` (flex-grow, legal only
  on direct `Row`/`Column` children) is the entire sizing algebra of a shipped 1.0
  protocol — relevant to the intrinsic-tier argument.
- **Attention / adaptive** (`AttentionAdaptive`, `AttentionResearch`): OpenAI's UI
  guidelines encode an explicit *attention budget* — "limit to two primary actions",
  "3–8 carousel items", "avoid content that is redundant with the card", "reduce
  metadata to the most relevant details, three lines max". That is `data-priority`
  written as editorial policy, and it is the closest thing to a published attention
  vocabulary I found.

---

## Sources

### Repositories read, at these commits

| repo | commit / version | what was read |
|---|---|---|
| `a2ui-project/a2ui` (redirect from `google/A2UI`) | `2bb8423` 2026-08-26 | `specification/v1_0/catalogs/basic/catalog.json`; `specification/v0_9/catalogs/{basic,minimal}/catalog.json`; `specification/v1_0/docs/a2ui_protocol.md`; `specification/v1_0/docs/basic_catalog_implementation_guide.md`; `specification/inference_formats/express/Express.g4`; `eval/README.md`; `eval/DESIGN.md`; `eval/iterative_format_optimizer/history_summary.md` |
| `modelcontextprotocol/ext-apps` | `10195ad` 2026-08-12, pkg v1.7.5 | `specification/draft/apps.mdx`; `src/spec.types.ts`; `src/styles.ts`; `src/types.ts` |
| `MCP-UI-Org/mcp-ui` | `2b10490` 2026-07-08; server v6.1.0, client v7.1.1 | `sdks/typescript/server/src/types.ts`; `sdks/typescript/server/src/index.ts`; `sdks/typescript/server/CHANGELOG.md`; `sdks/typescript/client/CHANGELOG.md` |
| `ag-ui-protocol/ag-ui` | 2026-08-25 | `sdks/typescript/packages/core/src/events.ts` |
| `CopilotKit/CopilotKit` | 2026-08-25 | `packages/react-core/src/v1-deprecated/types/frontend-action.ts` |
| `vercel/ai` | 2026-08-26 | `packages/rsc/src/stream-ui/stream-ui.tsx`; `content/docs/05-ai-sdk-rsc/01-overview.mdx`; `content/docs/05-ai-sdk-rsc/10-migrating-to-ui.mdx` |
| `browser-use/browser-use` | 2026-08-25 | `browser_use/dom/views.py`; `browser_use/dom/serializer/serializer.py` |
| `microsoft/playwright` | 2026-08-25, v1.63.0-next | `packages/injected/src/ariaSnapshot.ts`; `docs/src/release-notes-js.md`; `docs/src/aria-snapshots.md` |
| `shadcn-ui/ui` | 2026-08-25 | `packages/shadcn/src/mcp/index.ts` |
| `@openai/apps-sdk-ui` (npm tarball) | 0.2.2, published 2026-08-13 | `dist/types/components/**/*.d.ts`; `dist/types/types.d.ts`; `dist/es/styles/variables-{primitive,semantic,components}.css` |
| `@crayonai/react-ui` (npm tarball) | 0.9.16 | `dist/components/` |

### Key file:line anchors

- `a2ui-project/a2ui` `specification/v1_0/docs/a2ui_protocol.md:39` — "Decoupled Branding: Removes rigid theme properties…"
- same `:155` — "Defining your own catalog allows you to restrict the agent…"
- same `:1496` — "`additionalProperties: false` protects components and wire messages…"
- same `:1502–1513` — extensions: MUST NOT reject / MUST ignore; `a2ui_` prefix reserved
- same `specification/v1_0/catalogs/basic/catalog.json` — 18 components; `components.Text` (`variant: caption|body`, `weight`); `components.Button` (`variant: default|primary|borderless`)
- `a2ui-project/a2ui` `eval/README.md:80–86` — `--strategies direct,express,elemental`; `:14–22` — Transcrypt encryption to prevent contamination
- `a2ui-project/a2ui` `eval/iterative_format_optimizer/history_summary.md` — atom runs 014, 019, 030 (description-trimming regressions)
- `modelcontextprotocol/ext-apps` `specification/draft/apps.mdx:49` — HTML-only initial content type; `:276–279` — MUST rules; `:425–428` — predeclaration rationale; `:2395` — "MVP supports only `text/html;profile=mcp-app` (rawHtml), with other types explicitly deferred"
- `modelcontextprotocol/ext-apps` `src/spec.types.ts:44–133` — `McpUiStyleVariableKey`, 76 keys, zero spacing keys
- `MCP-UI-Org/mcp-ui` `sdks/typescript/server/CHANGELOG.md:15–25` — v6.0.0 "removed discarded content types"; `sdks/typescript/server/src/types.ts:29–31` — surviving `ResourceContentPayload`
- `ag-ui-protocol/ag-ui` `sdks/typescript/packages/core/src/events.ts:13–65` — 36 `EventType` members (5 deprecated), zero UI vocabulary
- `CopilotKit/CopilotKit` `packages/react-core/src/v1-deprecated/types/frontend-action.ts:211–245` — `render` / `renderAndWaitForResponse`
- `vercel/ai` `packages/rsc/src/stream-ui/stream-ui.tsx:50–64` — `RenderTool`; `content/docs/05-ai-sdk-rsc/10-migrating-to-ui.mdx:17–25` — the five limitations and the "do not recommend" ruling; `content/docs/05-ai-sdk-rsc/01-overview.mdx:8–12` — experimental warning
- `@openai/apps-sdk-ui@0.2.2` `dist/types/components/Button/Button.d.ts:3–64` — `color`/`variant`/`size`/`iconSize`/`gutterSize`/`opticallyAlign`/`className`; `dist/types/types.d.ts:1–15` — `Size`, `ControlSize`, `SemanticColor`, `Variant`
- `browser-use/browser-use` `browser_use/dom/views.py:18–24` — `# 'class',` commented out; `:30–33` — `role`, `data-state`, `aria-*` included
- `microsoft/playwright` `packages/injected/src/ariaSnapshot.ts:40–72` — `mode: 'ai'`, `boxes?: boolean`; `docs/src/release-notes-js.md:248` — `[box=x,y,width,height]` "useful for AI consumption" (1.60)
- `shadcn-ui/ui` `packages/shadcn/src/mcp/index.ts:58–184` — six registry tools; `:524–540` — the complete Component Audit Checklist

### Official documentation

- MCP Apps / SEP-1865, extension id `io.modelcontextprotocol/ui` — spec text read in-repo at `specification/draft/apps.mdx` and `specification/2026-01-26/apps.mdx`
- OpenAI — [`window.openai` component bridge reference](https://developers.openai.com/plugins/reference#windowopenai-component-bridge)
- OpenAI — [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)
- OpenAI — [UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines)
- `@openai/apps-sdk-ui` docs: https://openai.github.io/apps-sdk-ui/

### Published engineering write-ups

- Vercel — [How we made v0 an effective coding agent](https://vercel.com/blog/how-we-made-v0-an-effective-coding-agent), 2026-01-07 (Max Leiter)
- Vercel — [Introducing the v0 composite model family](https://vercel.com/blog/v0-composite-model-family), 2025-06-01

### Papers

- Hanzhang Tang (Tencent), *Compact Constraint Encoding for LLM Code Generation: An Empirical Study of Token Economics and Constraint Compliance*, arXiv:[2604.07192](https://arxiv.org/abs/2604.07192), 2026-04-08. **The load-bearing adversarial source.**
- Jung, Garcinuno, Mateega, *UI-Bench: A Benchmark for Evaluating Design Capabilities of AI Text-to-App Tools*, arXiv:[2508.20410](https://arxiv.org/abs/2508.20410)
- Li et al., *ScreenSpot-Pro: GUI Grounding for Professional High-Resolution Computer Use*, arXiv:[2504.07981](https://arxiv.org/abs/2504.07981) — best-at-introduction 18.9%
- He et al., *WebVoyager: Building an End-to-End Web Agent with Large Multimodal Models*, arXiv:[2401.13919](https://arxiv.org/abs/2401.13919) — original 59.1%
- Xiao et al., *DesignBench*, arXiv:[2506.06251](https://arxiv.org/abs/2506.06251) — noted, not read in full; visual-oracle slice

### Adoption figures

npm registry downloads API, `last-week` point, window **2026-08-18 → 2026-08-24**:
`ai` 22,962,178 · `@modelcontextprotocol/ext-apps` 3,090,377 · `@ag-ui/core` 1,778,530 ·
`@assistant-ui/react` 1,673,620 · `@ag-ui/client` 1,214,693 · `@openai/apps-sdk-ui` 540,081 ·
`@copilotkit/react-core` 437,851 · `@mcp-ui/client` 294,159 ·
`@custom-elements-manifest/analyzer` 141,236 · `@mcp-ui/server` 123,585 · `@ai-sdk/rsc` 102,864 ·
`@openai/chatkit` 93,392 · `@a2ui/react` 80,289 · `@crayonai/react-ui` 7,501 ·
`@thesysai/genui-sdk` 3,854 · `web-types` 0.
Reference: `playwright` 85,045,685 · `axe-core` 67,615,388.

GitHub REST API, fetched **2026-08-26**: `browser-use/browser-use` 110,537 stars ·
`CopilotKit/CopilotKit` 37,044 · `vercel/ai` 26,415 · `Skyvern-AI/skyvern` 22,849 ·
`a2ui-project/a2ui` 16,206 · `ag-ui-protocol/ag-ui` 15,546 · `assistant-ui/assistant-ui` 11,846 ·
`thesysdev/openui` 8,457 · `MCP-UI-Org/mcp-ui` 5,103 · `xlang-ai/OSWorld` 3,106 ·
`modelcontextprotocol/ext-apps` 2,761 · `web-arena-x/webarena` 1,587 (last push 2025-11-26) ·
`open-wc/custom-elements-manifest` 321.

### Marked `[UNVERIFIED]`

- **Lovable / Bolt / Replit self-verification.** No published engineering detail on
  visual self-checking exists for any of the three that I could locate. The only
  primary engineering source in the category is Vercel's two v0 posts, and neither
  mentions any visual check. `[UNVERIFIED]` — this is absence of evidence, stated as
  such rather than asserted as absence of the practice.
- **OSWorld / WebVoyager leaderboard figures** come from secondary leaderboard
  aggregators; the ScreenSpot-Pro 18.9% and WebVoyager 59.1% figures come from the
  papers directly. The argument rests on the *shape* of the gap (semantic tree ≈90%
  vs raw pixels 18.9% at introduction), which is primary-sourced.
- **Anthropic artifact / skill surfaces.** I found no public component-contract or
  vocabulary specification for Claude Artifacts comparable to A2UI's catalog or MCP
  Apps' `ui://` resource. MCP Apps *is* Anthropic's published answer (co-authored,
  shipped in Claude web and desktop). `[UNVERIFIED]` that any separate constrained
  artifact vocabulary exists.
