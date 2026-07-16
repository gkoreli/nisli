---
title: "0016. Router Intercepts Same-Origin Links It Cannot Match"
date: 2026-07-16
status: open
---

# Router intercepts same-origin links it cannot match

## Problem

The document click handler intercepts every eligible same-origin anchor without
checking the route catalog. Links to unmatched documents, downloads without a
`download` attribute, or server-owned paths become SPA navigations that clear
the outlet.

## Evidence

- `packages/router/src/router.ts:398-407`

## Acceptance

- Intercept only URLs managed by the current router matcher.
- Preserve native navigation for unmatched same-origin URLs.
- Matched routes, redirects, and configured not-found behavior keep their
  documented semantics.
- Tests cover matched, unmatched HTML, and unmatched resource links.
