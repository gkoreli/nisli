# Framework Architecture Decision Records

ADRs for the `nisli` reactive web component library (`packages/core/`).

These ADRs were originally authored while Nisli lived inside `backlog-mcp`.
They moved with the framework when `@nisli/core` became a standalone package.

## ADRs

- [0001. Web Component Framework: Reactive Base Class with Signals and DI](./0001-web-component-framework.md) - Proposed - 2026-02-07
- [0002. Implementation Notes: Phase 1 Insights and Adjacent Proposals](./0002-implementation-notes.md) - Active - 2026-02-09
- [0003. Migration Gaps, Framework Debt, and Component Follow-Up Tracker](./0003-migration-gaps-and-debt-tracker.md) - Active - 2026-02-09
- [0004. Framework Resilience Gaps — Pre-Implementation Review](./0004-framework-resilience-gaps.md) - Proposed - 2026-02-08
- [0005. Props vs Attributes Auto-Resolution Gap](./0005-props-vs-attributes-auto-resolution.md) - Proposed - 2026-02-08
- [0006. Framework Review — Gap Resolution and Invariant Codification](./0006-framework-review-gap-resolution.md) - Accepted - 2026-02-09
- [0007a. Shared Reactive Services Replace expose() + Reactive List Rendering](./0007-shared-services-and-each.md) - Accepted - 2026-02-09
- [0007b. Template Engine Bug: class Attribute Overwrites class:name Directives](./0007-class-attribute-classList-conflict.md) - Accepted - 2026-02-09
- [0008. Effect Isolation and Loop Detection — Defense-in-Depth](./0008-effect-scheduling-and-batching-gaps.md) - Open - 2026-02-09
- [0008.1. Mount-Time Dependency Leak — Reactive Slot Tears Down Live DOM](./0008.1-mount-time-dependency-leak.md) - Resolved - 2026-06-18
- [0012. Migration Phase 14 — resource-viewer, activity-panel, Final Migration](./0012-migration-phase-14-final.md) - Active - 2026-02-11
- [0015. Eliminate explicit batch() — automatic signal coalescing](./0015-eliminate-batch-automatic-coalescing.md) - Accepted - 2026-02-11
- [0017. Framework Package Extraction — Standalone Reactive Web Component Library](./0017-framework-package-extraction.md) - Accepted - 2026-02-24
- [0018. Server-Side Rendering — Full SSR Pipeline for `@nisli/core`](./0018-server-side-rendering-renderToString.md) - Proposed - 2026-03-05
- [0019. Minimal Runtime and Native Platform Alignment](./0019-minimal-runtime-and-native-platform-alignment.md) - Proposed - 2026-04-11
- [0020. Static Rendering Template Engine](./0020-static-rendering-template-engine.md) - Superseded - 2026-04-11
- [0020.1. Static Site Generation Build Toolkit](./0020.1-static-publication-components-and-attributes.md) - Proposed - 2026-04-19
- [0020.2. SSG Blog Adoption And Publication Primitives](./0020.2-ssg-blog-adoption-and-publication-primitives.md) - Proposed - 2026-04-19
- [0021. Dev-Only HMR — esbuild Plugin with Component Re-Mount](./0021-dev-hmr-esbuild-plugin.md) - Proposed - 2026-06-18
- [0022. Nisli UI Component Library — `@nisli/ui`, Source Copy-In Distribution](./0022-nisli-ui-component-library.md) - Accepted - 2026-07-11
- [0023. Move-Resilient Component Lifecycle — Deferred Disconnect Teardown](./0023-move-resilient-component-lifecycle.md) - Accepted - 2026-07-11
- [0024. nisli Website — `packages/www`, Full-Stack Dogfood](./0024-showcase-site.md) - Accepted - 2026-07-11
- [0025. Core Proposals Surfaced by `@nisli/ui` — Gap & Ergonomics Tracker](./0025-core-proposals-from-ui.md) - Open - 2026-07-11
- [0026. Typed Application Router — Shared Browser, Vite, and SSG Routes](./0026-typed-application-router.md) - Accepted - 2026-07-11
- [0028. Local Async Derivations with `resource()`](./0028-local-async-resource.md) - Accepted - 2026-07-16
- [0029. Agent-Native UI — Neutral Transcript Core, Agent-Host Widgets, and Machine-Legible Components](./0029-agent-native-ui-strategy.md) - Proposed - 2026-08-09
- [0030. Agent-Native Authoring — The Framework Written, Verified, and Debugged by Agents](./0030-agent-native-authoring.md) - Proposed - 2026-08-09
- [0030.1. Agent-Native Authoring — Gap Audit and Work Plan](./0030.1-agent-native-gap-audit.md) - Proposed - 2026-08-09
- [0030.2. Agent-Native Core Ergonomics — Primitive Audit, Certified Invariants, and Sidestep Decisions](./0030.2-agent-native-core-ergonomics.md) - Proposed - 2026-08-09
- [0031. Atomic DOM Moves — `moveBefore()` Grounded in the Spec, the Engines, and Measurement](./0031-atomic-dom-moves.md) - Proposed - 2026-08-25
- [0032. Derived Appearance — A Fifth Package for Intent-Declared UI](./0032-derived-appearance-package.md) - Withdrawn - 2026-08-27
- [0033. Oracle Soundness — How the Checker Earns the Right to Be Believed](./0033-oracle-soundness.md) - Withdrawn - 2026-08-27
- [0034. `@nisli/engine` — Typed Blocks Decided by an Engine](./0034-engine-typed-blocks-decided-by-an-engine.md) - Accepted - 2026-08-29
- [0035. Engine Appearance Layer — Visual-less Core, Skins, Parts and Axes](./0035-engine-appearance-layer.md) - Accepted, amended 2026-08-30 (contrast held by construction) - 2026-08-29
- [0036. Ledger — System of Record and Security Posture](./0036-ledger-system-of-record-and-security-posture.md) - Accepted - 2026-08-29
- [0037. `Form` — The Intent-Capture Domain](./0037-engine-form-intent-capture-domain.md) - Accepted - 2026-08-29
- [0038. Engine Block Kernel and the Space Domain](./0038-engine-block-kernel-and-space-domain.md) - Accepted - 2026-08-29
- [0039. Ledger Bank Connectivity — Connections, Provider Boundary, and Projections](./0039-ledger-bank-connectivity-domain.md) - Accepted - 2026-08-29
- [0040. Engine Overlay Domain — Layers, One Stack, Native Inert](./0040-engine-overlay-domain.md) - Accepted - 2026-08-29
- [0041. Engine Proof Domain — Claims, a Calibrated Estimator, and Runtime Evidence](./0041-engine-proof-domain.md) - Accepted - 2026-08-30
- [0042. Engine Reachability — Every Decision Reachable by Keyboard and AT](./0042-engine-reachability.md) - Accepted - 2026-08-30
