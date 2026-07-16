---
title: "0019. SSG Truncates the Shared Router Metadata Contract"
date: 2026-07-16
status: resolved
---

# SSG truncates the shared router metadata contract

## Problem

The SSG structural router type exposes only `title` and `meta`, while the
browser router supports canonical links, OpenGraph properties, alternates,
locale direction, and JSON-LD. This weakens the promise that one router owns
metadata across browser and static builds.

## Evidence

- `packages/ssg/src/build.ts:12-16`
- `packages/router/src/route.ts:43-63`

## Acceptance

- The dependency-neutral SSG structural metadata contract mirrors the complete
  router metadata surface.
- Static shell/page metadata can consume every field.
- Type proofs keep `@nisli/router` optional at runtime.
- Tests cover canonical, property metadata, alternates, lang/dir, and JSON-LD.

## Resolution

The dependency-neutral `StaticRouterMetadata` shape now mirrors the browser
router's complete metadata surface: title/name metadata, property metadata,
canonical and alternate links, document locale/direction, and keyed JSON-LD.
Router assignability remains a compile-time structural proof; SSG acquires no
runtime dependency on `@nisli/router`.
