---
title: "0005. Query Deduplicates Attempts Instead of Logical Requests"
date: 2026-07-16
status: open
---

# Query deduplicates attempts instead of logical requests

## Problem

`QueryClient.inFlight` stores one raw fetch attempt. A retry replaces that
promise, while same-key joiners await only the original attempt. Joiners can
fail while the originating query retries successfully. An in-flight
`refetch()` can also supersede the origin's cache commit and callbacks.

## Evidence

- `packages/core/src/query.ts:70-106`
- `packages/core/src/query.ts:218-268`
- `packages/core/src/query.test.ts:359-388` checks fetch count/data but not
  retry, cache, or callback coordination.

## Acceptance

- One per-key logical request owns the complete retry sequence and cache
  commit.
- All same-key observers await the same final result.
- Each observer's success/error callback runs exactly once for its current
  generation.
- In-flight manual refetch remains deduplicated and still populates cache.
- Terminal requests are always removed from `inFlight`.
