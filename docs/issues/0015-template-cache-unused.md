---
title: "0015. The Parsed-Template Cache Is Declared but Unused"
date: 2026-07-16
status: open
---

# The parsed-template cache is declared but unused

## Problem

`templateCache` is documented as caching parsed templates by
`TemplateStringsArray`, but every mount rebuilds the marker string, creates a
new `<template>`, and reparses `innerHTML`.

## Evidence

- `packages/core/src/template.ts:40-47`
- `packages/core/src/template.ts:135-164`
- `docs/adr/0016-reactive-slot-reconciliation.md` lists identity-keyed parsed
  template caching as an invariant.

## Acceptance

- Parse each tagged-template call site once and clone the cached fragment on
  later mounts.
- Cache ownership remains weak by `TemplateStringsArray`.
- Tests mount one call site repeatedly and observe one parse with equivalent
  DOM/bindings.
