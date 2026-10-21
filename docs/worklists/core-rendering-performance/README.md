# Core rendering performance: preservation and cross-validation

Updated October 21, 2026 Pacific. This is the local backlog and evidence ledger
for the three optimizations developed with the Nisli article. Article publication
and core integration are separate operations.

## Recovery and version boundaries

- Original hardened implementation: local branch `codex/core-rendering-performance`,
  commit `f40a217c905caee243fb44e4e19a1f2627b93a60`, based on core 0.56.0.
- Its full patch, thirty samples per timing case, source/harness hashes, repaired
  regressions, and bundle audit are preserved in the
  [public release review](https://github.com/gkoreli/blog/tree/main/packages/blog/drafts/research/nisli-framework/release).
- The original local 0.56.1 version proposal is obsolete: 0.57.0 has since shipped.
  Do not cherry-pick its package version or claim its +455 gzip bytes applies to
  the released 0.57.0 artifact.
- Current-main port: local branch `codex/core-rendering-crosscheck`, based on
  `4fa6360`. The [archived runtime/test patch](candidate-current-main.patch)
  reconstructs it against that base. Apply in an isolated worktree with
  `git apply docs/worklists/core-rendering-performance/candidate-current-main.patch`.
  Do not apply it on top of a landed subset without reconciling that subset.
- The port retains 0.57.0's production diagnostics gate. Legacy proposed ADR 0048
  collides with current main's accepted production-artifact ADR 0048; do not
  overwrite the accepted ADR with that historical proposal.

## Backlog

| Work | Status | Next bounded action |
|---|---|---|
| Skip copying/sorting zero or one pending effect | Queue-only subset validated locally; integration pending | Observe main CI after integrating; retain queueMicrotask |
| Cache binding locations and resolve with TreeWalker | Preserved candidate | Rebase separately, measure first-use/retained metadata and repeated native mounts, review callback-driven structural mutation boundaries |
| Reused Promise scheduler | Held: known behavior difference | Retain queueMicrotask unless exception timing is deliberately accepted or a reporting path preserves the contract across supported hosts |
| Complete binding-instruction cache / subtree fallback | Proposed only | Profile separately; these were never implemented by the saved location cache |

## October 21 current-main cross-check

The full port passes all 476 core tests and 2,349 workspace tests, root typecheck,
and the isolated root build. The existing move proof passes in Chromium, Firefox,
and WebKit with its documented native/fallback differences. These are local
checks, not main CI, npm publication, heap measurements, or new timing results.

Run `node docs/worklists/core-rendering-performance/crosscheck.mjs` from a clean
isolated worktree containing the full port, after a frozen pnpm install. It
archives baseline `4fa6360`, bundles the actual baseline and candidate sources in
production mode, and serves both from the fixture's own HTTP origin. Playwright
engines are installed separately. The runner writes
[crosscheck-results.json](crosscheck-results.json).

In each of Chromium 149, Firefox 151, and WebKit 26.5:

- 100 deterministic seeds × 50 writes exercise conditional computed dependencies,
  cleanup, disposal, cascades, explicit flushes, and async coalescing. The complete
  recorded traces match the baseline; the result records their SHA-256.
- Twelve repeated mounts × ten updates check table/SVG parser structure, static
  ancestors, mixed attributes, events, and cleanup. Results match the baseline.
- Normal Promise/queueMicrotask FIFO ordering matches.
- A deliberately throwing diagnostic transport exposes a real difference:
  baseline reports the uncaught error before the following queued callbacks;
  the Promise bridge reports it after them. This reproduces in all three engines.
  No unhandled rejection replaces the error. The full patch therefore does not
  satisfy a claim of complete behavioral equivalence and is not eligible for a
  blanket behavior-preserving merge.

Fixture corrections preserve the original assertions: an initial FIFO probe
failed on the baseline because preceding explicit flushes left already-enqueued
empty flush jobs; the runner now drains that prior phase before the probe.
WebKit masked errors from an opaque about:blank script as `Script error.` with a
null error object; a minimal native probe confirmed that host behavior. Serving
scripts from the page's own HTTP origin exposes the real error in all engines.
Neither correction discards graph cases or changes expected production behavior.

The full candidate is saved independently before evaluating the queue-only
subset. No new framework release is implied by this backlog.

## Queue-only integration

The local full candidate is preserved at `f671dcd` on
`codex/core-rendering-crosscheck`. The integration branch
`codex/core-rendering-queue-only` takes only the empty/single-effect fast path.
The template cache, resolved Promise, error bridge, old package bump, and proposed
ADR are excluded. Main's package version remains 0.57.0; the changelog marks the
change Unreleased. This is code integration, not a new npm release.

The ordering argument is bounded and mechanical. For zero members, the original
copy/sort/loop runs no effect. For one member E, sorting produces [E]; the old
code clears the set and runs E if alive. The fast path also clears the set before
running E, and runEffect begins with the same disposed check. Writes made by E
therefore populate a later pass in both implementations. Multiple-member logic
and the queueMicrotask scheduling/error path remain unchanged.

`node docs/worklists/core-rendering-performance/crosscheck.mjs --expect-equivalent`
checks this subset against the same pinned baseline and writes
[queue-only-results.json](queue-only-results.json). Unlike full-candidate mode,
it requires the exceptional trace to equal the baseline as well as the graph,
rendering, cleanup, and normal FIFO traces. All three engines pass. These bounded
checks support the stated invariants; they do not prove arbitrary programs or
claim a new application speedup. The earlier full-port local gates used Node 24;
the final integration gates use the repository's pinned Node 22 toolchain.
