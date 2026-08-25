# Framework Issues

Evidence-backed framework findings from the 2026-07-16 architect sweep.
Issue numbers are stable identifiers; implementation priority is independent
of numbering.

| Issue | Status | Priority |
| --- | --- | --- |
| [0001 — HMR remount is defeated by deferred teardown](./0001-core-hmr-remount-deferred-teardown.md) | resolved | P0 |
| [0002 — True reconnect duplicates rendered DOM](./0002-core-reconnect-duplicates-dom.md) | resolved | P0 |
| [0003 — Throwing computed values cannot recover](./0003-computed-errors-do-not-recover.md) | resolved | P0 |
| [0004 — Signal subscriptions over-notify](./0004-signal-subscribe-over-notifies.md) | resolved | P1 |
| [0005 — Query deduplicates attempts instead of logical requests](./0005-query-logical-request-coordination.md) | open | P0 |
| [0006 — Query invalidation does not revalidate active observers](./0006-query-invalidation-revalidates-active.md) | open | P0 |
| [0007 — Query disable/cache transitions leave stale state](./0007-query-disabled-cache-state-transitions.md) | open | P0 |
| [0008 — Synchronous query fetcher throws stall loading](./0008-query-sync-fetcher-stalls.md) | open | P0 |
| [0009 — Query keys have an unsafe serialization contract](./0009-query-key-contract.md) | open | P2 |
| [0010 — Failed component setup leaks partial resources](./0010-component-setup-failure-leaks.md) | resolved | P0 |
| [0011 — Reactive slots leak nested renderer ownership](./0011-reactive-slot-ownership-leaks.md) | resolved | P0 |
| [0012 — Reactive child semantics depend on the initial value](./0012-reactive-slot-type-transitions.md) | resolved | P1 |
| [0013 — Async derivations need a first-class resource primitive](./0013-resource-async-derivations.md) | resolved | P1 |
| [0014 — Duplicate each() keys corrupt reconciliation](./0014-each-duplicate-keys-corrupt.md) | resolved | P1 |
| [0015 — The parsed-template cache is declared but unused](./0015-template-cache-unused.md) | open | P2 |
| [0016 — Router intercepts same-origin links it cannot match](./0016-router-unmatched-link-interception.md) | resolved | P1 |
| [0017 — Router no-match leaves stale managed metadata](./0017-router-no-match-stale-metadata.md) | resolved | P1 |
| [0018 — SSG top-level factories mishandle signal inputs](./0018-ssg-top-level-factory-signals.md) | resolved | P1 |
| [0019 — SSG truncates the shared router metadata contract](./0019-ssg-router-metadata-truncation.md) | resolved | P1 |
| [0020 — No new runtime renderer-registry primitive](./0020-runtime-renderer-registries-no-new-primitive.md) | wont-fix | disposition |
| [0021 — `each()` is the only template consumer that rejects factory results](./0021-each-rejects-factory-results.md) | open | P1 |
