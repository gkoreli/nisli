---
title: "0012. Reactive Child Semantics Depend on the Initial Value"
date: 2026-07-16
status: resolved
---

# Reactive child semantics depend on the initial value

## Problem

A signal whose initial value is primitive is permanently bound as a text node.
Later `null`, `false`, `TemplateResult`, factory, or array values are stringified
instead of using the documented child-slot semantics.

## Evidence

- `packages/core/src/template.ts:382-403`
- `packages/core/src/template.ts:490-499`
- Reproduction: `'ready' → null` renders `"null"` and then a template renders
  `"[object Object]"`.

## Acceptance

- Reactive child signals support every documented child type across
  transitions, regardless of the initial value.
- Primitive-to-primitive updates keep the existing text-node fast path where
  possible.
- Tests cover primitive/null/template/factory/array transitions in both
  directions.

## Resolution

Every reactive child now owns one marker-bounded slot regardless of its first
value. The slot preserves a live text node across primitive-to-primitive
updates, but promotes and demotes cleanly between empty, template, factory, and
array values with the same ownership cleanup used by structured slots.
