---
title: "0003. Throwing Computed Values Cannot Recover"
date: 2026-07-16
status: resolved
---

# Throwing computed values cannot recover

## Problem

When a computed function throws, its state remains `Dirty`. Later dependency
changes call `notify()`, which only propagates when the state is `Clean`, so
downstream effects are never scheduled again.

## Evidence

- `packages/core/src/signal.ts:203-240`
- Reproduction across source values `0 → 1 (throws) → 2` leaves the observing
  effect at `[0]`.

## Acceptance

- A failed computed read remains retryable.
- A later dependency change schedules downstream observers.
- Dynamic dependencies discovered before the throw remain sufficient to
  recover.
- Tests cover an effect observing a computed that throws temporarily, then
  succeeds.

## Resolution

Computed values now retain their thrown error while returning to a
notification-ready clean state. Reads keep rethrowing the cached error until a
tracked dependency changes; that change marks the computed dirty, propagates
to downstream observers, and retries normally.
