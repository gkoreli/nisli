# Bet 05 — An optional WebMCP adapter over shared actions

**Revised verdict:** defer until a concrete operator task needs it. An optional
experimental adapter is possible; no core requirement or product win is proven.

**Evidence:** current
[WebMCP explainer](https://github.com/webmachinelearning/webmcp) uses
`document.modelContext.registerTool`. Its
[implementation status](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md)
records origin trials and implementation work rather than universal deployment.
The [form proposal](https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md)
still leaves schema synthesis and response behavior unsettled.

**Proposal:** a domain action's description, input contract and execution closure
back both UI and tool invocation. Adapt Form intent where practical; revalidate
conditional presence and dependent choices at invocation time. Keep explicit
handling of validation, pending state, completion, authorization and user review
in the common action path. Feature-detect support. Register on mount and remove
on real cleanup without re-registering on ordinary moves.

**Acceptance:** identical results and errors via UI and tool; absent WebMCP has no
effect on ordinary interaction; stale inputs, double invocation, cancellation,
disconnect/reconnect and sensitive action review preserve the same contracts.
Test the deployed upstream API rather than past sketches. Keep the adapter out
of core's mandatory dependency and byte budgets.

**Kill condition:** UI and tools develop separate validators/state/authorization,
or a declarative proposal is treated as a stable cross-browser API. Metadata
describes capability; it does not authorize calling it.
