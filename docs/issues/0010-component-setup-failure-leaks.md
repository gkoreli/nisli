---
title: "0010. Failed Component Setup Leaks Partial Resources"
date: 2026-07-16
status: resolved
---

# Failed component setup leaks partial resources

## Problem

Effects and cleanup registered before setup throws remain active behind the
error fallback. If `onError` returns a `TemplateResult`, it is mounted without
being retained, so its bindings cannot be disposed on disconnect.

## Evidence

- `packages/core/src/component.ts:450-485`
- Reproduction: an effect registered before a thrown setup error continues to
  run when its source changes.

## Acceptance

- Setup failure immediately disposes every partial setup resource.
- Any partially mounted main template is disposed and removed.
- A `TemplateResult` error fallback is retained and disposed on disconnect.
- Tests cover effect-before-throw and a reactive custom fallback.

## Resolution

The error boundary now disposes the partial main template and component host
scope before rendering fallback content. Template fallbacks are retained as
owned component state and disposed during normal teardown.
