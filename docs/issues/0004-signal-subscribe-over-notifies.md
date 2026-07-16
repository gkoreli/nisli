---
title: "0004. Signal Subscriptions Over-Notify"
date: 2026-07-16
status: open
---

# Signal subscriptions over-notify

## Problem

`subscribe()` calls the callback explicitly and then creates an immediately
running effect, producing two initial notifications. Because the callback
runs inside that effect, any other signals it reads become accidental
dependencies and retrigger the subscription.

## Evidence

- `packages/core/src/signal.ts:140-147`
- `packages/core/src/signal.ts:243-248`
- `packages/core/src/signal.test.ts:65-73` codifies the duplicate call instead
  of the intended singular immediate notification.

## Acceptance

- Writable and computed subscriptions notify exactly once initially.
- Later notifications occur only when the subscribed signal changes.
- Signals read inside the callback do not become dependencies.
- Existing unsubscribe and component auto-disposal behavior remains intact.
