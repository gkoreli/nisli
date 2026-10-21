# Bet 02 — Shared read models and headless view controllers

**Status:** supporting candidate; evidence weaker than for operations. No new
database, cache engine or replacement persistence protocol is recommended.

**Category targeted:** manual standard filter/sort/selection wiring and repeating
query reconciliation at every mutation callsite. Domain predicates and refresh
dependencies still need explicit definitions.

**Local evidence:** Transactions connects initial URL filters, Form fields,
predicate/sort logic, totals, table state and row editing. Account offers another
projection of the same transactions. Connections holds all 11 explicit refetch
calls in the census; this is concentrated evidence, not widespread independent
duplication across ten screens. Current router already has typed codecs.

**Prior art:**
[TanStack Table](https://github.com/TanStack/table) for a headless controller,
[React-admin providers](https://github.com/marmelab/react-admin/blob/master/docs/DataProviders.md)
for backend seams, and
[TanStack DB live queries](https://github.com/TanStack/db/blob/main/docs/guides/live-queries.md)
for optional reactive collection views. Upstream performance claims are not local
measurements or evidence that Nisli needs these dependencies.

**Shape:** an opt-in controller over existing signals/query and router contracts;
standard filtering/sorting can be derived from explicit comparable accessors,
while custom components remain valid cell content. A data adapter can later offer
incremental results. Rendering and persistence policies stay separate.

**Preserve:** one-shot URL initialization where intended, custom sort keys,
classification provenance, keyed selection, offline/local acknowledgement, 409
owner-overlay replay, authoritative bank observations and no resurrection of
provider-removed rows. A generic optimistic rollback cannot replace these rules.

**Next acceptance:** Transactions and Account share an operation/view model without
losing their distinct projection, navigation and review behaviors; mutation effects
reconcile subscribed views with failure policies explicit. Demonstrate a second
consumer before generalizing a filter/query language.

**Kill:** a new query DSL merely relocates existing predicates; forms/tables lose
customization; persistence is rewritten to obtain a UI abstraction; or explicit
dependencies are falsely advertised as inferred from arbitrary callbacks.
