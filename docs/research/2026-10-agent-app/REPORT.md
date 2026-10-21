# A major leap for agents: remove application orchestration

**The strongest direction is an optional application layer centered on domain
operations and task sessions, built from today's core and engine.** An agent
would specify what the application can do and the domain rules for doing it;
Nisli would own the repeated presentation and execution machinery. Existing
components, signals, templates, skins, arbitrary TypeScript and backend choices
would remain available.

This is a larger authoring change than making a renderer marginally cheaper.
It is also only a research candidate. The evidence below establishes repeated
work, prior-art feasibility, a small mechanism proof and important limits. It
does not establish a productivity multiplier or prove a complete replacement
authoring model.

## 1. Start with work the current engine has not removed

The baseline is Ledger using current `@nisli/engine`, not an app written in raw
HTML. Source: `4afde49c728a330e10ce887a38b8013d63b58498`. The reproducible
[AST census](./experiments/corpus/RESULT.md) covers 10 production screen modules,
1,397 lines, excluding screen tests:

| Repeated surface | Count | Interpretation |
| --- | --- | --- |
| `Dialog` declarations | 7 | Several app-owned open/close and editing sessions |
| `Form` declarations | 10 | Inputs already semantic; ownership still connected by hand |
| `signal` declarations | 27 | Mixed session, filter and domain state; not all removable |
| `notify` / `confirm` calls | 23 / 6 | Repeated outcome/prompt wiring; messages and confirmation requirements are still authored policy |
| `flushNow` / `reloadFromServer` calls | 6 / 4 | Persistence barriers and server projection reconciliation |
| Explicit `.refetch()` callsites | 11 | All in Connections; query consistency is screen-authored |

These are syntax counts, not independent bugs or a LOC reduction forecast.

Concrete examples:

- [Budgets](../../../packages/ledger/src/screens/budgets.ts#L10),
  [Accounts](../../../packages/ledger/src/screens/accounts.ts#L14) and
  [Rules](../../../packages/ledger/src/screens/rules.ts#L13) separately maintain
  selected entities, open flags, opening counters, initial drafts, submit/cancel
  callbacks and success/close behavior.
- [TransactionDialog](../../../packages/ledger/src/screens/transaction-dialog.ts#L28)
  maps signed integer cents into a distinct editable draft, then maps back while
  preserving classification provenance. That is meaningful domain logic, not
  generic CRUD overhead.
- [Connections syncOne](../../../packages/ledger/src/screens/connections.ts#L38)
  flushes local edits, calls a server command, reloads the ledger, and refreshes
  two views even when an earlier phase fails. `syncAll` refreshes only on the
  success path. A universal success handler would change behavior.
- [Transactions](../../../packages/ledger/src/screens/transactions.ts#L33)
  connects URL-derived initial state, filter fields, filter predicates, sorting,
  a total, table columns and a row editor. Its URL initialization is intentionally
  one-shot, not live binding; a generic controller must preserve that choice.
- [Import](../../../packages/ledger/src/screens/import.ts#L40) owns file/mapping/
  preview stages and reset keys. [Connections](../../../packages/ledger/src/screens/connections.ts#L49)
  separately owns an external OAuth handoff and continuation.

The shared work is *coordinating a user task over inputs, effects and views*.
The framework currently understands individual blocks more deeply than it
understands the task connecting those blocks.

## 2. The main bet: an operation is the reusable application capability

An operation such as `reviewTransaction`, `saveBudget` or `syncConnection` should
be a first-class application capability. It should have an explicit input
contract, contextual preconditions, execution handler and completion/reconciliation
contract. Input presentation is a binding to that capability, not the capability
itself. This can be ordinary typed TypeScript; it does not require a mandatory
JSON language, database, statechart library or new component model.

The same operation could be consumed through an engine Form/Dialog, an inline
editor, fully custom components, a direct programmatic caller, and an explicitly
exposed agent tool. The application supplies domain logic once. Adapters own the
repeated submission, pending state and outcome lifecycle for each surface.

There is a concrete integration gap to solve before calling this complete:
current `FormProps`/`FormHandle` expose submission and reset, but no general
operation-error injection API (`packages/engine/src/blocks/form.ts:24`). A binding
must present authoritative field errors and general failures without cloning the
draft engine or converting every error into a notification. An optional API
addition or explicit presentation adapter needs its own behavior tests.

### What whole categories this could remove

| App work | What the layer would own | What remains authored |
| --- | --- | --- |
| Per-screen editor sessions | Fresh request identity, draft/open/close lifecycle, cancel and cleanup | Initial draft and input intent; any unusual editing behavior |
| Repeated mutation envelopes | Shared pending state, concurrency policy, typed errors and completion receipts | Actual side effect and whether success means local acceptance or remote confirmation |
| Separate UI/programmatic action paths | One validated execution contract with surface adapters | Actor/context, authoritative policy, which capabilities to expose |
| Screen-level save/reload/refetch sequencing | Declared barriers and affected view reconciliation, with explicit failure policy | Dependencies and server authority rules; these cannot be inferred from arbitrary functions |
| Duplicate transport/schema plumbing | Optional typed handler bindings and schema adapters | Trust-boundary validation and output projection; transport deployment remains explicit |

Simply packaging `onSelect` plus `busy` is not enough: engine already has that.
The payoff would require the operation to carry a useful contract across multiple
surfaces and the task runtime to own their shared lifecycle. A small coordinator
is only one component of that design.

### There is substantive authoritative prior art

[Ash generic actions](https://github.com/ash-project/ash/blob/main/documentation/topics/actions/generic-actions.md)
define inputs, validation and implementation; API integrations can use those
actions. [AshPhoenix](https://github.com/ash-project/ash_phoenix) builds forms over
resource actions.
[Ash AI's implementation](https://github.com/ash-project/ash_ai/blob/main/lib/ash_ai/tools.ex)
derives tool parameter schemas and delegates invocation to action execution.
Its [execution source](https://github.com/ash-project/ash_ai/blob/main/lib/ash_ai/tool/execution.ex)
passes actor/tenant context and validates allowed action inputs. These are
concrete examples of one domain capability serving several interfaces, not
evidence of a Nisli-specific productivity advantage.

[tRPC's validators](https://github.com/trpc/trpc/blob/main/www/docs/server/validators.md)
show input/output validation feeding inferred types. The
[Standard Schema spec](https://github.com/standard-schema/standard-schema)
provides an interoperable validation interface with distinct input/output types;
its JSON Schema capability is a separate interface. Nisli need not force a new
validator library or assume validation also describes UI. Schema transforms and
domain rules do not all have lossless JSON Schema projections.

This is not a novel invention. The interesting Nisli combination would be that
operation model with the engine's existing intent-driven presentation and current
core guarantees, available incrementally in a TypeScript app with its existing
backend. Ash is an architectural precedent, not a suggested dependency.

### Evidence from a bounded mechanism proof

The [56-line coordinator](./experiments/operation-coordinator/coordinator.ts)
uses existing core signals and explicit handler phases. Tests extract the actual
`syncOne` and `syncAll` closures from Connections and run them with traced
dependencies, then compare against coordinator bindings. All 15 checks pass:
12 success/failure cases plus local-completion, shared-session exclusion and
acknowledged-effect/read-back-failure cases.

The two handlers keep different refresh-on-failure policies. A local write is
not called remotely saved. If a write returns and read-back fails, the receipt
retains acknowledgement instead of inviting a blind write retry. If execution
throws, the outcome is unconfirmed: loss of a response does not prove that the
server did nothing.

This proves a narrow extraction can preserve dependency call traces. It does
not prove network timing equivalence, complete UI behavior, authorization,
cross-session deduplication, exactly-once execution or fewer agent repairs. The
prototype is not a proposed public API and intentionally contains no transport
or schema layer.

## 3. A critical negative result: a UI schema is not the operation contract

A tempting shortcut is to treat existing `Field<T>[]` as the complete input and
permission model, then expose every Form to machine callers. The
[falsification experiment](./experiments/form-as-operation/RESULT.md) rejects it.
It extracts the actual TransactionDialog/Budgets field declarations and uses the
existing pure draft implementation:

- A bank-owned amount marked `readOnly` can still be changed through headless
  `draft.set()` and submitted. That flag governs presentation, not authority.
- A numeric string can pass a money-field check while the submitted value
  remains a string. The normal UI has a separate value-normalization path.
- An unbounded money value of `Infinity` passes those field checks.
- The missing-required-fields control correctly fails.

Three of four strict assertions fail. This does not establish a server exploit:
the experiment bypasses UI controls and does not call Ledger's server, which has
its own validation and provider-fact protections. It establishes that the
proposed cross-surface contract needs proper parsing and policy.

Keep three separate meanings connected explicitly: **draft input**, **validated
command**, and **stored/read model**. TransactionDialog's cents/sign conversion
and provenance selection must survive. Some conversions are reversible; some
are contextual or lossy. [Zod codecs](https://github.com/colinhacks/zod/blob/main/packages/docs/content/codecs.mdx)
provide a useful precedent for explicit bidirectional conversions without
requiring every operation to be invertible. Do not generate editable fields
directly from a database record or silently discard this logic.

Client and server may share validation declarations, but the authoritative handler
must validate and apply policy at its own trust boundary. Server bindings and
private implementations stay outside browser bundles. A Form adapter does not
make a client predicate into server authorization.

"Once" therefore means one authoritative implementation of each domain rule,
not one object that magically supplies every kind of metadata. Generic Standard
Schema values do not reveal field structure. Reusing constraints in a generated
Form requires a schema-specific adapter or explicit semantic field binding. If
that binding repeats validators, defaults and conversion rules, the abstraction
has failed to remove the category of work it claims. This is an unresolved
prototype gate, not functionality provided by the coordinator experiment.

## 4. Supporting bet: shared views, without replacing persistence

An operation needs a stable read side. An optional headless view controller could
own standard filter/sort state, selection identity, result status, totals and
bindings to existing Form/Table/URL codecs. A typed projection could serve a
human table, export or agent query while preserving custom cell rendering.

There is concrete precedent:
[TanStack Table](https://github.com/TanStack/table) separates headless sorting,
filtering and selection from markup;
[React-admin's data provider](https://github.com/marmelab/react-admin/blob/master/docs/DataProviders.md)
separates resource UI from backend transport; and
[TanStack DB live queries](https://github.com/TanStack/db/blob/main/docs/guides/live-queries.md)
make derived collections reactive.

For Nisli, first build such a controller over current signals/query and existing
router codecs. Do not invent another router or require a client database. Display
`cell()` can return arbitrary components, so sorting/filtering cannot safely be
inferred from rendered output; comparable values and domain predicates remain
explicit. Preserve one-shot URL initialization where that is intended, rather
than silently turning filters into navigation state.

The broader collection/incremental-query adapter is a later optional path only if
profiles or repeated consumer needs justify it. Upstream speed claims are not
Nisli measurements. Local evidence for a generalized filtered view is weaker than
for task sessions: this corpus has one substantial generic filtered/sorted list.

Do not replace Ledger's 409 replay with a generic optimistic rollback. Its
[store](../../../packages/ledger/src/data/store.ts#L194) preserves bank-owned
observations while replaying only eligible owner edits; it also checks review
basis, avoids resurrecting provider-removed rows and has explicit durability
barriers. Those rules are load-bearing capabilities.

[TanStack DB's mutation documentation](https://github.com/TanStack/db/blob/main/docs/guides/mutations.md)
also makes settlement handler-defined: transaction completion means backend
confirmation only when the handler actually waited for it. That distinction is
the boundary a Nisli adapter must preserve. Sharing orchestration can remove
callsite glue; it cannot remove the application's consistency policy.

## 5. Supporting bet: task steps own async lifetime and handoff

Forms already own a draft; a task can own when that draft is collected, when an
async derivation is current, whether the task was cancelled, and what resumes
after an external interaction. An input request could use an ordinary engine
form or a custom component, returning a typed result to the authored task.

The [import lifetime experiment](./experiments/import-lifetime/RESULT.md)
extracts Ledger's actual `loadFile`, parser and mapping code. With slow file A
followed by fast file B, the current loader ends with stale A. Using the current
`resource()` with the same parser and mapping keeps B. The required stale-result
mechanism already exists in core; an app layer could make using it the default
for source-bound steps instead of asking every agent to remember the pattern.

This supports source-bound lifetimes, not a new general workflow engine. Complex
orchestration has a concrete [XState precedent](https://github.com/statelyai/xstate),
including [persisted machine snapshots](https://github.com/statelyai/xstate/blob/main/packages/core/src/StateMachine.ts).
However, arbitrary async closures and File objects do not constitute a durable
workflow protocol. An OAuth continuation needs an explicit serialized checkpoint
and provider handoff; an irreversible remote action needs a server receipt or
idempotency policy. [Temporal's TypeScript SDK](https://github.com/temporalio/sdk-typescript)
illustrates the infrastructure required for durable server execution. Do not
promise that durability from a browser signal helper.

Start with in-memory task sessions, supersession and cleanup using existing core.
Treat durable resumption as a separate decision, not a mandatory feature. Reads
can use latest-wins; writes need an explicit queue/exclusion/parallel policy.
Cancelling the view does not prove a remote command was cancelled.

## 6. What this would let an agent build

Consider a complete category-review task. The app declares the review queue and
its ordering, the allowed category operation, its contextual draft-to-command
mapping, and the existing domain handler that preserves bank facts/provenance.
The framework can then supply a review session over that queue: collect an input,
run the operation, reconcile affected views, preserve the selected identity or
advance deliberately, and return structured results. A custom transaction dialog
and a programmatic review caller use the same capability.

That could remove the second implementation of the task for agents and repeated
session/mutation/reconciliation code across entry points. It does not infer what
counts as reviewed, silently mark bank data editable, or decide whether category
review is appropriate. Domain rules and custom presentation remain authored.

The unit of reuse becomes a usable application capability plus optional
presentation, rather than just a button or field. This is the potential leap;
generated documentation is a consequence, not the product.

## 7. Preserve capabilities by construction and by tests

The experiment should be a sibling layer with explicit ownership. Keep core,
router and engine behavior unchanged. Current components and arbitrary custom
templates continue to work without registration. Existing operation functions
can be bound manually rather than rewritten in a DSL; Ash's
[manual action contract](https://github.com/ash-project/ash/blob/main/documentation/topics/actions/manual-actions.md)
is a useful precedent for keeping domain-specific implementation inside the
shared execution surface.

| Capability to retain | Required evidence for a real prototype |
| --- | --- |
| Conditional/dependent fields and owned/controlled drafts | Dynamic options and `when`, reopen/reset keys, live filters and file reset tests |
| Custom UI and arbitrary domain code | At least one custom form/step and non-CRUD operation through the same task contract |
| Bank data authority and conflict replay | Existing store/provider preservation tests unchanged; forged/stale operations rejected by authoritative handlers |
| Local/offline behavior | Separate local acknowledgement, remote acknowledgement and unknown outcome; existing retries still adapter-owned |
| Layout, focus, keyboard, axes and skins | Existing screen proofs plus real-browser interaction checks after integration |
| Native runtime and buildless component usage | No mandatory new dependency, compiler, server, or global operation registration in core |
| Typed routing and lifecycle | Use existing route codecs/contracts; explicit session disposal and external handoff checkpoints |

## 8. The next proof should be about agent work

Build three complete optional-path slices: Budget editing (simple), transaction
review (contextual permissions/provenance), and CSV import (file and derived
preview). Keep a custom rendering path and the original implementations runnable.
Freeze independent behavior assertions before writing the abstraction. Measure
shared-runtime/adapter code as well as app code; moving lines is not eliminating
decisions.

Then give the same agents comparable changes in old and new slices with matched
docs/tool access and repeated runs. Hold out at least one task and eventually a
second application. Count correct completion, omitted behaviors, repair attempts,
task-specific coordination decisions, and elapsed time/tokens. A user-visible
workflow is the unit, not a generated-file count. Treat a migration requiring
manual `open`, reset-key and refetch choreography at every callsite as failure of
the abstraction's thesis. A capability loss is a failure even when code shrinks.

The unchanged Ledger baseline passes **190 tests in 17 files, with no type
errors**. The coordinator passes **15 tests**. The two negative probes remain
strict and fail as recorded. No end-to-end new-layer UI integration or agent
evaluation has been run. The strongest supported decision is to investigate
this application-level contract with explicit preservation gates; there is no
evidence here for replacing core or promising an agent productivity multiplier.
