# Bet: runtime detection can solve the complete issue

**Verdict: rejected as a complete solution.**

A direct `process.env.NODE_ENV` read inside the environment probe makes ordinary
esbuild production bundles silent while preserving a fallback for raw browsers.
However, the full counter still retains 2,806 bytes from template-audit. Returning
literal false from isDev also retains that module. The independent audit override,
unconditional audit entry calls, argument evaluation and top-level allocations
remain relevant.

The [optimizer probe](../experiments/bundle-contract/optimizer-results.json) also
shows a safe `typeof process` fallback retaining its sentinel in production, and
an imported immutable constant retaining a sentinel function after linking. Local
static guards remove it. This supports work-site static boundaries, not a claim
that arbitrary imported constants are never optimizable.

A consumer-defined Nisli boolean can drive those static boundaries, but still
requires package source and allocation refactoring. The custom define does not
itself fix the design. Prefer the ordinary NODE_ENV convention in the bundler
artifact, with publisher-resolved native artifacts, so normal production builds
do not depend on remembering a library-specific flag.
