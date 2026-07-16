---
title: "0014. Duplicate each() Keys Corrupt Reconciliation"
date: 2026-07-16
status: open
---

# Duplicate each() keys corrupt reconciliation

## Problem

Duplicate keys create multiple wrappers initially, then reuse only the last
old entry while leaving earlier wrappers orphaned. Later updates retain stale
DOM and lose ownership of leaked entries.

## Evidence

- `packages/core/src/template.ts:910-971`
- `packages/core/src/each.test.ts:321-337` claims “last wins” but only asserts
  that something rendered.
- Reproduction: duplicate `A/B → C/D → E` leaves stale `A` in the DOM.

## Acceptance

- Duplicate keys are detected before reconciliation mutates existing entries.
- The framework emits an actionable diagnostic that keys must be unique.
- Existing DOM remains consistent after a duplicate update.
- A later corrected array recovers normally.
