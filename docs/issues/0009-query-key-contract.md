---
title: "0009. Query Keys Have an Unsafe Serialization Contract"
date: 2026-07-16
status: open
---

# Query keys have an unsafe serialization contract

## Problem

Query keys are typed as unrestricted `unknown[]` and serialized with raw
`JSON.stringify`. `undefined`, `NaN`, and `null` can collide; object insertion
order prevents semantic deduplication; `BigInt` and cycles throw. Invalidation
uses a second element-level stringify algorithm.

## Evidence

- `packages/core/src/query.ts:115-120`
- `packages/core/src/query.ts:146-150`

## Acceptance

- Export a supported `QueryKey` value contract.
- Use one canonical algorithm for storage, deduplication, and prefix matching.
- Canonicalize supported object keys or reject them explicitly.
- Unsupported values produce actionable errors.
- Tests cover reordered objects, nested keys, null/undefined policy, and
  unsupported values.
