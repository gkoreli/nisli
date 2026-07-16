---
title: "0006. Query Invalidation Does Not Revalidate Active Observers"
date: 2026-07-16
status: open
---

# Query invalidation does not revalidate active observers

## Problem

`QueryClient.invalidate()` only deletes cached entries. Active mounted queries
do not rerun unless their key or enabled signals change, despite the documented
refetch contract.

## Evidence

- `packages/core/src/query.ts:115-129`
- `packages/core/src/query.ts:279-287`
- `docs/adr/0001-web-component-framework.md` describes invalidation as
  triggering refetch for matching active queries.
- The current test at `packages/core/src/query.test.ts:231-242` checks deletion
  only.

## Acceptance

- Matching enabled active queries revalidate once after prefix invalidation.
- Nonmatching, disabled, and disposed queries do not refetch.
- Multiple observers of one key share one logical request.
- Registration follows reactive key changes and unregisters on disposal.
- `invalidate()` retains its cache-entry count return value.
