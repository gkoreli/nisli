---
title: "0007. Query Disable and Cache-Hit Transitions Leave Stale State"
date: 2026-07-16
status: open
---

# Query disable and cache-hit transitions leave stale state

## Problem

Disabling a query returns before advancing its generation or clearing loading,
so an old request can still commit and a hanging request leaves the disabled
query loading forever. Switching from an in-flight key to a fresh cached key
sets data but does not clear loading or stale errors.

## Evidence

- `packages/core/src/query.ts:199-216`
- Reproductions:
  - disabling during flight still accepts the late result;
  - pending key `a → cached key b` leaves `loading=true` permanently.

## Acceptance

- Disabling immediately makes the query non-loading and supersedes prior local
  writes.
- A fresh cache hit sets data, clears loading, and clears stale error state.
- Deferred tests cover both transitions and prove the superseded request
  cannot mutate current state.
