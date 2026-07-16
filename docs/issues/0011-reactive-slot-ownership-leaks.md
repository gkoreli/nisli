---
title: "0011. Reactive Slots Leak Nested Renderer Ownership"
date: 2026-07-16
status: resolved
---

# Reactive slots leak nested renderer ownership

## Problem

Reactive slot replacement disposes nested templates only on the next slot
value. Parent disposal does not dispose the currently mounted nested result.
Factory prop and host-class subscriptions are registered on the outer template,
so renderer swaps leave subscriptions writing to detached components.

## Evidence

- `packages/core/src/template.ts:329-370`
- `packages/core/src/template.ts:417-488`
- `packages/core/src/template.test.ts:321-334` has a cleanup comment without an
  assertion.

## Acceptance

- Each current reactive slot value owns its nested templates and factory
  subscriptions.
- Replacement disposes that ownership before removing nodes.
- Parent disposal disposes the currently mounted value.
- Repeated renderer swaps do not grow subscriptions or update detached
  components.
- Cover single and array factory values plus nested reactive templates.

## Resolution

Factory mounts now return a local disposer for prop and host-class
subscriptions. Reactive slots retain those disposers beside the current nodes
and nested templates, release them before every swap, and release the current
value when the outer template is disposed. Static factory slots attach the
same local disposer to their outer template lifetime.
