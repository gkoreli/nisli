---
title: "0002. True Reconnect Duplicates Rendered DOM"
date: 2026-07-16
status: open
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
