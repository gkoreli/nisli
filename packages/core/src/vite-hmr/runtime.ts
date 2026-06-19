/**
 * vite-hmr/runtime.ts — Browser runtime for Nisli HMR under Vite (ADR 0110).
 *
 * DEV-ONLY. The Vite plugin (`./plugin.ts`) injects calls to these into each
 * component module:
 *  - `__register(tag, setup)` wraps `component()` so a re-evaluated module swaps
 *    its setup in the shared registry and queues an in-place re-mount.
 *  - `__drain()` is called from the module's `import.meta.hot.accept` hook to
 *    apply the queued re-mounts.
 *
 * Vite re-evaluates ONLY the changed module against a
 * STABLE framework module — so there is exactly one `@nisli/core` instance and
 * no lifecycle/reactive split-brain. This module just re-exports the
 * transport-agnostic registry core.
 */
export { __register, drainRemounts as __drain, pendingRemountCount, remount } from '../hmr/registry.js';
