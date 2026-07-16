---
title: "0002. True Reconnect Duplicates Rendered DOM"
date: 2026-07-16
status: resolved
---

# True reconnect duplicates rendered DOM

## Problem

A true disconnect disposes bindings but leaves the old mounted nodes in the
host. Reconnecting after teardown runs setup again and appends a second
subtree.

## Evidence

- `packages/core/src/component.ts:462-465`
- `packages/core/src/component.ts:491-514`
- `packages/core/src/component.test.ts:81-96` checks setup count but not DOM
  count.
- Reproduction: reconnect yields `<span>1</span><span>2</span>`.

## Acceptance

- True teardown clears the component-owned rendered subtree.
- A later reconnect produces exactly one fresh subtree.
- Same-tick move resilience remains unchanged.
- The reconnect test asserts node count and content, not only setup calls.

## Resolution

True teardown now disposes the current scope and replaces the rendered tree
before a later setup can append. `children()` returns projected light-DOM
ownership to the host during cleanup so reconnect and HMR preserve authored
content while still removing framework-owned output.
