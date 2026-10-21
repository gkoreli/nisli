# Bet: publisher-owned profiles meet both native-browser and production goals

**Verdict: recommended; prototype passes targeted gates.**

One source emits a standard NODE_ENV bundler artifact and two native-browser
artifacts. In the packed consumer, esbuild and Vite remove template audit code
without a custom Nisli define. The native dev and production artifacts run exactly
the same uncompiled JavaScript counter via an import map in three browsers.

Development remains loud by default. Production cannot re-enable removed
instrumentation, while safety checks and lifecycle/async error reporting survive.
That runtime-override restriction is an explicit compatibility change. Source
guards and artifact generation should land together with its migration guidance.

The current prototype is deliberately not promoted into source: generated null
fields and warning bookkeeping still need cleanup, its rewrite is not typechecked
as shipping source, and packaging declarations/HMR/SSG integration still need
production-quality validation. The full existing development test suite passes
against both generated development forms.

See [REPORT.md](../REPORT.md) for the final artifact-selection contract and
[RESULT.md](../experiments/bundle-contract/RESULT.md) for commands and complete logs.
