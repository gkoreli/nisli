---
title: "0018. SSG Top-Level Factories Mishandle Signal Inputs"
date: 2026-07-16
status: open
---

# SSG top-level factories mishandle signal inputs

## Problem

Top-level factory rendering passes signal objects directly into `_setProp` and
only applies host class when it is a plain string. Nested browser/template
factory mounting unwraps signal values. Static output therefore depends on
whether the same factory is top-level or nested.

## Evidence

- `packages/ssg/src/core-render.ts:32-39`
- `packages/ssg/src/core-render.ts:66-75`
- Browser parity path: `packages/core/src/template.ts:329-370`

## Acceptance

- Top-level factory props and host class unwrap current signal/computed values.
- Plain inputs remain unchanged.
- Tests prove top-level and nested equivalent static HTML for signal props and
  reactive host class.
