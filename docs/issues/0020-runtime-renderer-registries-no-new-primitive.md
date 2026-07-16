---
title: "0020. Runtime Renderer Registries Need No New Core Primitive"
date: 2026-07-16
status: wont-fix
---

# Runtime renderer registries need no new core primitive

## Disposition

Do not add a framework-level component or theme registry for runtime-defined
entity types.

## Rationale

Backlog-mcp ADR 0113 sends serializable, allowlisted presentation metadata, not
executable HTML, CSS, or component definitions. A reactive server registry is
ordinary application state (`signal`/`query` plus immutable replacement).
Known renderer families compose through `Map<string, (model) =>
TemplateResult>`, typed factory adapters, `computed()`, and `each()`.

`el(tag)` remains the escape hatch for runtime-chosen HTML/custom tag strings,
with intentional plain-attribute semantics. It must not become an untyped path
around factory props. CSS variables, semantic data attributes, and application
allowlists remain the correct theming boundary.

The reactive-slot ownership bug tracked in issue 0011 must be fixed so frequent
renderer swaps are actually leak-free; that is the core uplift required by the
consumer scenario.

## Reconsider when

- A second consumer demonstrates lifecycle or reconciliation behavior that
  cannot be expressed by renderer functions and existing slots; or
- Runtime component definitions must cross a serialization boundary, which
  would require a separate security and capability design.
