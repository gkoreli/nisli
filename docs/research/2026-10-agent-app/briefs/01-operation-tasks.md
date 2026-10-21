# Bet 01 — Operations with optional task presentations

**Status:** strongest candidate for a capability-preserving research prototype.
No public API, package or productivity win is established.

**Whole category targeted:** repeated editor sessions, mutation envelopes and
separate human/programmatic paths for the same domain capability. Merely wrapping
an action callback would not satisfy this bet.

**Local evidence:** Budgets/Accounts/Rules maintain editing/open/reset state;
TransactionDialog maps a distinct draft to a provenance-aware command;
Connections repeatedly coordinates save barriers, commands, read-back and queries.
The census counts 7 Dialog and 10 Form declarations, with 27 mixed-purpose
signals. These counts are not removable-line estimates.

**Prior art:**
[Ash actions](https://github.com/ash-project/ash/blob/main/documentation/topics/actions/generic-actions.md),
[AshPhoenix forms](https://github.com/ash-project/ash_phoenix),
[Ash AI tool execution](https://github.com/ash-project/ash_ai/blob/main/lib/ash_ai/tool/execution.ex),
[Standard Schema](https://github.com/standard-schema/standard-schema) and
[tRPC validation](https://github.com/trpc/trpc/blob/main/www/docs/server/validators.md).
These establish reusable contracts across interfaces, not Nisli superiority.

**Experiment completed:** the 56-line coordinator preserves actual `syncOne` and
`syncAll` dependency traces in 12 cases; 15 checks pass overall. It has no UI,
authorization, schema or network layer. Form-as-operation is separately falsified:
readOnly is presentation and successful draft checks do not normalize arbitrary
machine input.

**Shape:** explicit validated input and context, domain handler, honest completion
receipt, per-operation concurrency and reconciliation policy; optional task
presentation requests bind existing Form/Dialog or custom components. Plain
functions can be manually bound. Client/server trust boundaries remain distinct.

**Preserve:** arbitrary TypeScript and components, conditional forms, owned and
controlled drafts, local/offline writes, server-owned facts, custom rendering and
typed routing. No mandatory RPC backend or replacement signal runtime.

**Next acceptance:** integrate simple Budget editing, contextual transaction
review and a file/preview task without changing their independent behavior
contracts. UI and programmatic calls must share domain handling. Include failed
read-back after acknowledged writes and ambiguous responses. Keep missing
capabilities as failing tests, never hide them behind generic CRUD.

Two unresolved gates: current Form has no general external field-error injection
surface, and generic Standard Schema does not expose UI field structure. A
presentation/schema adapter must solve those without cloning the draft engine
or repeating authoritative validators, defaults and conversions.

**Kill:** schema/metadata maintained twice; each caller still hand-wires editor
state/refetch; new task definitions cost as many decisions as old code; or a
required UI/domain capability disappears. Agent task gains require separate,
matched evaluation; the passing mechanism checks do not demonstrate them.
