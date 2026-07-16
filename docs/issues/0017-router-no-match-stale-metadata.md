---
title: "0017. Router No-Match Leaves Stale Managed Metadata"
date: 2026-07-16
status: resolved
---

# Router no-match leaves stale managed metadata

## Problem

When navigation produces no match, the router clears rendered content and
returns without resetting title, managed head elements, JSON-LD, `lang`, or
`dir`. Metadata from the prior route remains attached to an empty outlet.

## Evidence

- `packages/router/src/router.ts:289-296`
- Render failures already reset atomically at
  `packages/router/src/router.ts:316-322`.

## Acceptance

- No-match applies the same managed metadata reset as render failure.
- Connect-time title/lang/dir defaults are restored.
- Managed canonical, OpenGraph, alternates, and JSON-LD are removed.
- A navigation regression test covers the full reset.

## Resolution

A true no-match now clears the outlet and applies the same complete managed
metadata reset as a failed render. Connect-time title, `lang`, and `dir`
defaults return, and all router-owned head elements are removed.
