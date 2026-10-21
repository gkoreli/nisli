# Bet 03 — Source-bound steps and explicit handoffs

**Status:** supporting operation-session capability; general durable workflows
remain deferred.

**Category targeted:** forgetting stale-result suppression, resets, cancellation
and teardown while coordinating input/preview/commit tasks.

**Local evidence:** CSV import coordinates file, mapping and preview; bank linking
coordinates sessionStorage and an OAuth redirect. The isolated import probe runs
the actual `loadFile` closure: slow A overwrites fast B. The same parser/mapping
under current `resource()` keeps B. That is a concrete lifetime bug and an
already-existing solution, not a reason to replace core async primitives.

**Prior art:**
[XState actors](https://github.com/statelyai/xstate) and
[promise actor implementation](https://github.com/statelyai/xstate/blob/main/packages/core/src/actors/promise.ts)
show explicit async process lifetimes;
[Temporal's TypeScript SDK](https://github.com/temporalio/sdk-typescript)
illustrates that durable server execution needs more infrastructure than a
browser helper. Neither dependency is proposed for Nisli core.

**Shape:** tasks may request input from engine Forms or custom step renderers;
source-bound async derivations use existing resource semantics. In-memory session
identity owns draft resets and cleanup. External handoffs use explicit checkpoint
codecs and authoritative continuation handlers when needed. File selection may
require re-entry after a reload; do not promise serializable arbitrary closures.

**Preserve:** live mapping preview and conditional fields, custom file parsing,
OAuth provider semantics, explicit user cancel, retry policy, focus restoration,
and local/remote outcome distinctions. Latest-wins is suitable for derived reads,
not a universal rule for writes.

**Next acceptance:** a complete import task passes out-of-order input, cancellation,
file reset, custom preview and submit tests using existing resource; a separate
OAuth proof retains session and token authority. Do not expand to durable flows
until actual consumers require them.

**Kill:** the new abstraction is a second state machine authors must synchronize
with signals; cancellation means only hiding UI while falsely claiming write
rollback; or workflow machinery grows without reducing task-level decisions.
