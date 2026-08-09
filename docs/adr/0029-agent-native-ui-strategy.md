# 0029. Agent-Native UI — Neutral Transcript Core, Agent-Host Widgets, and Machine-Legible Components

**Date**: 2026-08-09
**Status**: Proposed
**Depends on**: [0019-minimal-runtime-and-native-platform-alignment](./0019-minimal-runtime-and-native-platform-alignment.md), [0022-nisli-ui-component-library](./0022-nisli-ui-component-library.md), [0024-showcase-site](./0024-showcase-site.md)

## Context

Nisli has a runtime whose entire surface — signals, components, templates, DI,
query, resource — measures **25.2 KB minified / 8.8 KB min+gzip**
(`@nisli/core@0.54.1` dist, esbuild bundle+minify), a 58-component
shadcn-parity registry (`@nisli/ui@0.4.1`), an SSG that renders templates to
static HTML, and one agentic asset: the `acp` component family speaking Zed's
Agent Client Protocol, released in 0.4.0/0.4.1. The question this ADR answers:
**what agentic bet makes nisli a high-adoption UI framework in 2026–2027 —
WebMCP, AG-UI, MCP Apps, or none of them?**

### The three surfaces of agentic UI

"Agentic UI" is three distinct surfaces that are routinely conflated. They
have different protocols, different competitors, and different economics:

1. **Apps that render agents.** Transcript, chat, approval, and plan UI inside
   your product. Protocols: ACP (coding agents), AG-UI (app agents), Vercel
   AI SDK streams, per-vendor session formats.
2. **App UI that renders inside agents.** Widgets embedded in ChatGPT, Claude,
   VS Code, Cursor — sandboxed iframes speaking postMessage JSON-RPC.
   Protocol: MCP Apps (with `window.openai` extras in ChatGPT).
3. **Apps operated by agents.** Browser agents driving pages — today via
   DOM/accessibility trees and screenshots, tomorrow via page-declared tools.
   Protocol: WebMCP.

### The protocol landscape, verified August 2026

| Protocol | Surface | Status (Aug 2026) | Governance | Web-component client/kit exists? |
|---|---|---|---|---|
| [ACP](https://agentclientprotocol.com) | 1 | **v1 stable, won its layer**: [~60-agent registry](https://zed.dev/blog/acp-registry), 5.16M weekly SDK downloads, JetBrains native, Zed 1.0 headline; [v2 draft 2026-07-20](https://agentclientprotocol.com/announcements/acp-v2-draft) | Zed + JetBrains, foundation planned | **Only nisli's acp set.** Apps exist (acp-ui, Toad); no component library |
| [MCP Apps](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) | 2 | **Final** (SEP-1865, first official MCP extension, 2026-01-26; in the 2026-07-28 spec); 11 shipping hosts incl. ChatGPT, Claude web/desktop, VS Code, Cursor, M365 Copilot; [self-serve ChatGPT submission](https://openai.com/index/developers-can-now-submit-apps-to-chatgpt/) | Anthropic + OpenAI + MCP-UI authors, MCP org | **No.** [Official starters](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples): React/Vue/Svelte/vanilla; MCP-UI's "Support Web Components" roadmap item unbuilt |
| [AG-UI](https://docs.ag-ui.com) | 1 | Pre-1.0 (`@ag-ui/client` 0.0.57) but real: 11 first-party framework integrations (LangGraph, CrewAI, MS Agent Framework, Google ADK, AWS, Mastra, Pydantic AI…), `@ag-ui/core` 1.47M dl/wk, [$27M Series A](https://ai2.work/blog/copilotkit-raises-27m-to-make-ag-ui-the-standard-for-in-app-ai-agents) to "make it the standard" | **CopilotKit (single vendor)** | **No.** React, Angular, .NET, Slack/Teams |
| [A2UI](https://a2ui.org) (Google) | 1+2 | v0.9 (Jul 2026); declarative component-tree generative UI rendered from a **trusted catalog**; transports: A2A and AG-UI | Google, open project | **No shipped web renderer** — spec [names web components as a render target](https://a2ui.org/introduction/what-is-a2ui/) |
| [WebMCP](https://webmachinelearning.github.io/webmcp/) | 3 | W3C Community Group draft; [Chrome origin trial 149+](https://developer.chrome.com/blog/ai-webmcp-origin-trial); API renamed 3× in a year (now `document.modelContext`); **[no mainstream agent consumes it yet](https://www.spronta.com/blog/state-of-webmcp-july-2026/)** | W3C WebML CG (Google+Microsoft editors) | **No.** React hooks only ([@mcp-b/react-webmcp](https://www.npmjs.com/package/@mcp-b/react-webmcp)) |

Context on the adjacent players: Vercel AI SDK's stream protocol remains the
volume default for simple chat (via `useChat`); OpenAI ChatKit ships as a
closed-bundle web component whose Agent Builder backend is
[deprecated Nov 30 2026](https://mcp.directory/blog/openai-agentkit-deprecation-2026);
IBM's identically-named "Agent Communication Protocol"
[merged into A2A](https://lfaidata.foundation/communityblog/2025/08/29/acp-joins-forces-with-a2a-under-the-linux-foundations-lf-ai-data/)
(Aug 2025), so "ACP" now unambiguously means the agent↔client protocol nisli
already targets.

### The competitive reality

- **The React in-app-copilot market is decided.**
  [assistant-ui](https://github.com/assistant-ui/assistant-ui) at 1.61M
  downloads/week, CopilotKit at 36.6k stars,
  [Vercel AI Elements](https://github.com/vercel/ai-elements) riding the
  20.8k-star ai-chatbot template. Entering it with a web-component clone loses
  to distribution.
- **Every React kit is architecturally locked out of surface 2.** An MCP Apps
  widget is *one self-contained HTML file* in a sandboxed iframe, prefetched,
  cached, and **security-reviewed by hosts**; theming arrives as
  [host CSS variables](https://developers.openai.com/apps-sdk/build/chatgpt-ui).
  React starters exist precisely to paper over bundling React into that file.
  A [2026 survey of AI chat UI libraries](https://dev.to/alexander_lukashov/i-evaluated-every-ai-chat-ui-library-in-2026-heres-what-i-found-and-what-i-built-4p10)
  names the unsolved gaps: framework lock-in and composable agent-specific
  patterns (approval flows, reasoning traces, tool-call displays).
- **The web-component agentic niche is empty but has a failure mode.**
  deep-chat (monolithic config-object widget, 3.7k stars, ~20k dl/wk) shows
  where "widget vendor" ends. The kits that won paired **new surface area with
  a new distribution mechanic** (shadcn: code ownership + registry; CopilotKit:
  protocol ownership).
- **Distribution now routes through coding agents.**
  [shadcn CLI v4](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) is
  explicitly "built for you and your coding agents" (skills, MCP server,
  namespaced registries); libraries ship llms.txt and AGENTS.md; agent-mediated
  installs let a small library be chosen without years of training-data
  presence.

### What nisli already holds, and where it is thin

The acp set made the right architectural move before this ADR named it:
`lib/acp-protocol.ts` declares **structural wire types instead of importing
the ACP SDK** (which broke 0.4 → 0.22 → 1.3 in months), and
`lib/acp-session.ts` folds the wire stream through a **pure reducer into a
neutral entry vocabulary** — `message | thought | tool-call | plan | unknown`
— held in signals. Components render entries, never wire frames. Unknown
variants become visible `unknown` entries instead of vanishing.

Fidelity gaps against the ACP v1 surface, confirmed in source: terminal
content renders a placeholder row (`acp-tool-call.ts`), `availableCommands`
and `currentModeId` sit in reducer state with no component consuming them,
and elicitation is absent from `acp-protocol.ts` entirely. ACP v2's draft
changes stream semantics (stable-ID patching; prompt-ack + idle lifecycle
replacing prompt-turns), which a v1-shaped reducer does not survive unchanged.

## Decision

Nisli's agentic strategy is **agent-native UI**: one zero-dependency,
copy-in, custom-element registry whose components **render agents**
(surface 1), **embed in agents** (surface 2), and are **legible to agents**
(surface 3 and coding-agent distribution). No protocol becomes the identity;
protocols are folds and bridges at the edges of a neutral core. The moats are
the ones the landscape can't cheaply copy: an 8.8 KB runtime, light-DOM
components that inherit host theming, SSG to a single reviewable file, and
source ownership.

This ADR is the **ecosystem half** of that identity — where nisli UI runs and
how it is distributed. The framework half — why `@nisli/core` itself is the
right authoring substrate for the agent era — is
[ADR 0030](./0030-agent-native-authoring.md) (agent-native authoring); the
surfaces decided here are its demonstrations.

### 1. The transcript entry model is the public seam

The entry vocabulary (`TranscriptEntry` and its reducer contract) is promoted
from an acp implementation detail to **the** protocol-neutral contract of the
chat/agent family:

- Extract the entry types, `createTranscript()`, and the settle/coalesce
  machinery into `lib/transcript.ts`. `lib/acp-session.ts` becomes the ACP
  fold and **keeps re-exporting today's names** — copied registry files in
  user trees must not break, and the `acp-*` component names stay (they are
  earning recognition; the seam is the model, not a rebrand).
- **Policy, graduated from precedent**: protocol adapters declare structural
  wire types and never import protocol SDKs. `acp-protocol.ts`'s rationale —
  wire JSON is versioned by the protocol, not by anyone's npm range — is now
  the rule for every fold. Zero runtime npm dependencies stays absolute
  (no rxjs, no zod, no protobuf).
- Every fold preserves the reducer's three guarantees: nothing dropped
  (unknown variants surface as entries), chunks coalesce under stable keys,
  updates merge by id and may arrive update-first.

### 2. ACP stays the flagship; complete fidelity and absorb v2

The research verdict is that the original bet was right and early: ACP won
the coding-agent↔client layer, and nisli ships the only component-library UI
for it. The claimable position is no longer "first web ACP UI" (apps exist —
acp-ui, Shellular, Toad) but **"the embeddable ACP UI with full fidelity"** —
acp-ui, the nearest web competitor, renders neither diffs nor terminals; we
render diffs today.

Work this decides:

- **v2 readiness.** Support v1 prompt-turn semantics and v2 stable-ID
  patching (append/replace/clear, idle signaling) behind the same entry
  model, validated against the published `/schema/v1` and `/schema/v2` JSON
  Schemas. The reducer grows a v2 fold; components don't change.
- **Fidelity completion**: live terminal output (v1 `terminal/output`
  polling now, v2 patch streams later), elicitation, session-mode and
  slash-command affordances in `acp-chat` (the reducer already carries both).
- **Transport seam**: one connection interface with `stdio-over-WebSocket`
  today and ACP's experimental Streamable HTTP when it lands, so remote/cloud
  agents are a config change, not a rewrite.
- **Distribution**: submit the set to the official
  [ACP clients page](https://agentclientprotocol.com/get-started/clients)
  (it lists libraries, not just apps), and keep the nisli.dev replay demo as
  the live proof.

### 3. Agent-host widgets: target MCP Apps with an SSG emit and a signals bridge

MCP Apps is the strongest new surface on the evidence: a **Final**
Anthropic+OpenAI-governed spec, 11 shipping hosts, a self-serve ChatGPT app
store — and its unit of deployment is exactly nisli's native artifact. The
identity to market there is **"the smallest reviewable MCP App"**, not "web
components" (inside a sandboxed iframe, framework interop is irrelevant;
size, auditability, and theming fidelity are everything):

- **`lib/app-bridge.ts`** (registry): the `ui/initialize` handshake and
  JSON-RPC-over-postMessage surface exposed as signals —
  `toolInput`, `toolResult` (streaming partials included), `theme`,
  `displayMode`, `hostVariables`, plus `callTool()`, `sendMessage()`,
  `openLink()`, `requestDisplayMode()`. `window.openai` extras
  (`setWidgetState`, file APIs) are feature-detected on top. All spec churn
  (the tool-input lifecycle moved in May 2026; visibility metadata moved in
  July 2026) is absorbed in this one copied file.
- **Host theming for free**: map `hostContext.styles.variables` onto the
  shadcn token layer (`--background`, `--primary`, …) that every nisli
  component already reads. Light-DOM components inherit host look natively —
  the thing shadow-DOM libraries structurally fight.
- **`@nisli/ssg` single-file emit**: `buildAppResource()` renders a widget
  entry to one self-contained HTML resource (inlined JS + compiled Tailwind
  subset, `text/html;profile=mcp-app`), with a **build-failing size budget**.
  Target: complete interactive widgets in the tens of KB against the
  100–300 KB React baseline.
- **Starter + upstream contribution**: a `nisli` MCP App template
  (server + widget + manifest) and a PR contributing the missing
  web-components/zero-dependency example to
  [`modelcontextprotocol/ext-apps`](https://github.com/modelcontextprotocol/ext-apps)
  — first-party visibility in the ecosystem's own examples directory.
- **Convergence with the flagship**: acp tool-call cards learn to host MCP
  Apps resources when an ACP agent surfaces them — surface 1 rendering
  surface 2 is the combination no one else can assemble from one registry.

### 4. Machine-legible components: publish the machine interface, distribute through agents

ADR 0022's invariants (`data-slot` on every rendered element,
`data-state`/`data-*` interaction state, ARIA contracts, namespaced `ui-*`
events, real native elements in light DOM) are, unmarketed, **an agent
interface**: they are exactly what browser-driving agents read today and what
tool-registering pages will describe tomorrow. This ADR makes that a product:

- **Registry manifest**: generate `manifest.json` at build time from
  component source — per item: tag, typed attributes, events with payloads,
  `data-slot`/`data-state` vocabulary, ARIA pattern. One artifact, three
  consumers: coding agents composing UIs, future trusted-catalog renderers
  (§6), and WebMCP descriptors (§5).
- **Agent-facing docs surface**: `llms.txt` on nisli.dev, an installable
  skill (the in-repo `.agents/skills/nisli-framework` graduates to a
  published artifact), and an investigation into serving the registry through
  shadcn v4's namespaced-registry protocol so `@nisli/*` resolves in the
  tooling coding agents already use.
- **Invariants stay testable**: the manifest is generated, so a component
  whose markup drifts from its published machine interface fails CI, the same
  way registry integrity already fails on a bare npm dependency.

### 5. WebMCP: opt-in adapter on the experiment track

WebMCP is directionally aligned with nisli (light DOM, real forms, the
declarative `<form toolname>` exploration favors standards-based markup) but
has renamed its entry point three times in a year and **has no shipping
consumer**. So: build the cheap version, gate the investment.

- **`lib/model-context.ts`** (registry, opt-in): feature-detects
  `document.modelContext`, registers on connect with `AbortSignal` cleanup on
  disconnect, and is the only file that touches the browser API. Components
  never auto-register; they **export tool descriptor factories**
  (a dialog's open/close, a form's typed submit derived from its fields, a
  table's query) and the *application* curates what one page exposes —
  tool-per-component-instance is context spam, and the spec's per-name
  uniqueness forbids it anyway.
- Copy-in distribution is itself the trust story: the `execute` bodies live
  in the user's tree, auditable, unlike black-box npm tools.
- **Graduation criteria**: promote beyond experiment when a mainstream agent
  actually calls WebMCP tools (Gemini-in-Chrome is announced, unshipped) or
  the API exits origin trial; drop it without ceremony if the trial dies.

### 6. A2UI renderer: watch, then spike

Google's A2UI (declarative component-tree generative UI, rendered from a
trusted catalog, carried over A2A and AG-UI) names web components as a render
target and has no shipped web renderer. The §4 manifest is the prerequisite;
a renderer mapping A2UI JSON onto the `ui-*` catalog is a natural, bounded
spike **after** the spec reaches 1.0 or a concrete consumer appears. Not
before — v0.9 churn on a Google timeline is not where a small project spends.

### 7. Adapters for reach: AG-UI (and replay) folds

- **AG-UI fold** (`lib/agui-session.ts` + a hand-rolled SSE client, no SDK):
  maps `TEXT_MESSAGE_*` → message chunks, `REASONING_*` → thought entries,
  `TOOL_CALL_START/ARGS/END/RESULT` → tool-call upserts,
  `RUN_*`/`STEP_*` → turn boundaries, `STATE_SNAPSHOT`/`STATE_DELTA`
  (RFC 6902) → a shared-state signal beside the transcript, unrecognized
  events → `unknown` entries. This buys rendering for every AG-UI-integrated
  framework (LangGraph, CrewAI, ADK, Mastra, Pydantic AI…) for the cost of
  one fold, hedges the single-vendor risk by never importing their client,
  and would be the first web-component AG-UI client anywhere.
- **Replay adapters**: recorded-session formats are not converging (Claude
  Code JSONL, Codex, Gemini all differ). A Claude Code JSONL → entry-model
  adapter powers docs demos, session viewers, and the benchmark page, and is
  the second proof that the §1 seam is real.
- The AI SDK stream protocol is deliberately **not** adopted in this batch:
  it is the most React-served market and the least differentiated; revisit
  only on demand.

### 8. Proof surfaces: published measurements

Claims in this ADR become numbers on nisli.dev, reproducibly:

- **Streaming benchmark**: a transcript under sustained token streaming with
  live tool-call cards — frame timings and long tasks, nisli's per-token
  single-text-node updates vs the React kits' re-render path, methodology
  published.
- **Payload comparison**: total bytes for an equivalent MCP Apps widget
  (nisli emit vs the official React starter), updated in CI so the number is
  never stale marketing.

## Boundaries

- **No React copilot competition.** assistant-ui and CopilotKit own surface
  1 in React; nisli competes where they structurally cannot (surface 2,
  framework-agnostic embedding, single-file artifacts).
- **No protocol becomes the identity.** ACP is the flagship, not the brand;
  every protocol touches the tree only through one copied adapter file.
- **No runtime dependencies, no hosted service, no closed bundles.** The
  ChatKit model (prebuilt widget, vendor backend) is the anti-pattern of
  everything §0022 stands for.
- **No auto-registered agent tools.** Machine legibility is declarative and
  curated; components never call `document.modelContext` by themselves.
- **No monolithic `<nisli-chat>`.** Composition of owned primitives is the
  differentiator the survey literature says is missing; a config-object
  widget is deep-chat's dead end.

## Sequencing

Proposed batches, each landing green through the usual worklist mechanics:

1. **AUI-1 — Seam + first fold**: extract `lib/transcript.ts`, AG-UI fold +
   SSE client, Claude Code JSONL replay adapter, www replay demo switched to
   the adapter path. Proves §1 with two non-ACP producers.
2. **AUI-2 — ACP depth**: v2 dual-mode reducer against published schemas,
   transport seam, terminal output, elicitation, modes + slash commands in
   `acp-chat`; submit to the ACP clients page.
3. **AUI-3 — MCP Apps target**: `lib/app-bridge.ts`, `@nisli/ssg`
   `buildAppResource()` with size budget, starter template, demo app in the
   ChatGPT/Claude directories, upstream ext-apps example PR.
4. **AUI-4 — Legibility + distribution**: registry `manifest.json` + CI
   drift guard, nisli.dev `llms.txt`, published skill, shadcn-namespace
   investigation.
5. **AUI-5 — Experiments (gated)**: WebMCP adapter behind §5's graduation
   criteria; A2UI spike behind §6's; streaming benchmark + payload pages.

AUI-1/2/3 are the priority order; 4 is cheap and parallel; 5 is
opportunistic.

## Consequences

**Positive.** Nisli stops being "another component library that also has a
chat" and occupies the quadrant no one holds: protocol-plural,
provider-neutral, copy-in-owned agent UI that runs in any framework and
*inside* the agent hosts themselves. Each pillar reinforces the others: the
manifest powers WebMCP and A2UI; the entry model powers ACP, AG-UI, and
replays; the SSG emit powers MCP Apps and the benchmark pages; ACP cards
hosting MCP Apps resources composes two pillars into a demo nobody else can
ship from one registry.

**Negative / risks, owned.**

- *Churn tax*: ACP v2 is a draft, MCP Apps moved twice this year, AG-UI is
  pre-1.0, WebMCP renamed thrice. Mitigation is structural (one adapter file
  per protocol, structural types, unknown-variant rendering) — the cost is
  real but bounded and already survived once (ACP 0.4→1.3).
- *Spread-thin risk*: five pillars is a program, not a batch. Mitigation:
  the sequencing section is the commitment; experiments are explicitly
  gated; nothing in §5/§6 blocks §2/§3.
- *React gravity in Apps SDK*: OpenAI ships React components and models
  emit React by default. The counter is the measured artifact (§8) and
  review-friendliness, not ideology.
- *A fast follower*: CopilotKit went React→Angular→Slack in a year and could
  ship custom elements; Zed's clients page lists an early "ACP Components"
  entry. The moat is fidelity depth (diffs, terminals, permissions,
  elicitation), the zero-dependency copy-in model they can't adopt without
  abandoning their runtime, and moving first on the official-starter slots.

## Alternatives considered

- **Adopt AG-UI as the core protocol.** Largest framework-side funnel, but
  single-vendor, pre-1.0, and it makes nisli a client of someone else's
  standard on the surface React already owns. Taken as one fold instead.
- **Lead with WebMCP ("components as tools").** The most differentiated
  story and the emptiest lane — but zero shipping consumers makes it a
  marketing bet on someone else's roadmap. Taken as a gated experiment.
- **Stay a pure shadcn-parity library.** The generic-kit graveyard
  (deep-chat's obscurity, faded NLUX) shows framework-parity without new
  surface area loses to distribution. Rejected.
- **Ship a monolithic chat widget.** Fastest demo, dead end for the
  composable-primitives gap the market documents. Rejected.
- **Pick nothing and wait.** The official-starter and clients-page slots
  (ext-apps example, ACP listing, first WC AG-UI client) are first-mover
  assets that expire. Rejected.

## References

- Research basis (August 2026): [ACP](https://agentclientprotocol.com) ·
  [ACP v2 draft](https://agentclientprotocol.com/announcements/acp-v2-draft) ·
  [ACP registry](https://zed.dev/blog/acp-registry) ·
  [MCP Apps announcement](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) ·
  [SEP-1865](https://modelcontextprotocol.io/seps/1865-mcp-apps-interactive-user-interfaces-for-mcp) ·
  [ext-apps](https://github.com/modelcontextprotocol/ext-apps) ·
  [Apps SDK reference](https://developers.openai.com/apps-sdk/reference) ·
  [AG-UI docs](https://docs.ag-ui.com) ·
  [A2UI](https://a2ui.org) ·
  [WebMCP spec](https://webmachinelearning.github.io/webmcp/) ·
  [Chrome WebMCP origin trial](https://developer.chrome.com/blog/ai-webmcp-origin-trial) ·
  [shadcn CLI v4](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4)
- In-tree: `packages/ui/registry/default/lib/acp-protocol.ts` (structural
  wire types precedent), `lib/acp-session.ts` (entry model + pure fold),
  `packages/ui/NORTH-STAR.md`, ADR 0022 invariants.
