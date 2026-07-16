---
title: "0001. HMR Remount Is Defeated by Deferred Teardown"
date: 2026-07-16
status: resolved
---

# HMR remount is defeated by deferred teardown

## Problem

`remount()` calls `disconnectedCallback()`, clears the host, and immediately
calls `connectedCallback()`. Component teardown is deferred by one microtask,
so `_mounted` is still `true` and the reconnect exits early. The edited live
component is left empty.

## Evidence

- `packages/core/src/hmr/registry.ts:122-133`
- `packages/core/src/component.ts:420-422`
- `packages/core/src/component.ts:491-514`

## Acceptance

- HMR synchronously disposes the old component scope before reconnecting.
- The same host instance renders the new setup exactly once.
- Old effects, subscriptions, mount cleanup, and nested custom elements are
  disposed before the new setup runs.
- A direct `remount(tag)` regression test verifies non-empty replacement DOM.

## Resolution

Framework components now expose an internal synchronous `_remount()` hook that
tears down the old scope, clears component-owned DOM, and reconnects the same
host. The HMR registry prefers that hook over the legacy lifecycle emulation.
