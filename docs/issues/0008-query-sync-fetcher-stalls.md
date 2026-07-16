---
title: "0008. Synchronous Query Fetcher Throws Stall Loading"
date: 2026-07-16
status: open
---

# Synchronous query fetcher throws stall loading

## Problem

The fetcher is invoked outside the retry `try` block. A synchronous throw
rejects `doFetch()`, whose caller swallows the rejection, leaving
`loading=true`, `error=null`, and no retry or callback.

## Evidence

- `packages/core/src/query.ts:240-286`
- Reproduction with a typed fetcher that throws before returning a promise
  yields `{ loading: true, error: null }`.

## Acceptance

- Synchronous throws follow the same retry and terminal-error path as rejected
  promises.
- Loading always settles.
- `onError` receives the normalized terminal error once.
- Tests cover retry success and terminal synchronous failure.
