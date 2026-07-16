---
title: "0013. Async Derivations Need a First-Class Resource Primitive"
date: 2026-07-16
status: open
---

# Async derivations need a first-class resource primitive

## Problem

Consumers hand-roll `effect() + signal` for local async derivations. The
backlog-mcp markdown renderer has no stale-result guard, rejection handling, or
disconnect invalidation, so an older parse can overwrite newer content and
outstanding work can write after teardown.

## Evidence

- `/Users/goga/Documents/goga/backlog-mcp/AGENTS.md` Viewer Architecture
- `/Users/goga/Documents/goga/backlog-mcp/docs/adr/0111-tsa-design-system-and-shiki-migration.md`
- `/Users/goga/Documents/goga/backlog-mcp/packages/viewer/components/md-block.ts:25-30`

## Acceptance

- Add a source/loader `resource()` primitive with `data`, `loading`/status,
  `error`, `refresh()`, and explicit `dispose()`.
- Only the synchronous source function is dependency-tracked.
- Source change, disable, refresh, and disposal invalidate prior generations.
- Loaders receive an `AbortSignal`; generation guards remain correct when abort
  is ignored.
- Component setup auto-disposes; standalone use can dispose explicitly.
- Export and document a markdown-style example in root/core guides and the
  framework skill.

## Rejected alternatives

- `computed(async ...)` breaks computed's synchronous lazy-value contract.
- `query()` adds global cache/invalidation policy to a local derivation.
- Async component setup violates Nisli's synchronous setup context.
