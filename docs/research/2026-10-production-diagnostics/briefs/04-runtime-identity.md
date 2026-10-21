# Bet: optional diagnostics or multiple profile entries can share a runtime

**Verdict: mixed complete profiles are unsafe; late-loaded add-on deferred.**

The concrete mixed-entry test imports provide from the package root and inject
from the separately bundled native-production entry. A registered DI override is
lost in Chromium, Firefox and WebKit. Thus shipping separate artifacts does not
make them interchangeable within one application graph.

A positive native test maps the root once and has two modules import it. Function
identity and the DI override are shared in all three browsers, in both profiles.
The package and its examples must select one artifact per graph and use the root
specifier consistently. Avoid global singleton workarounds that could accidentally
join incompatible package versions or isolate boundaries.

A diagnostics-only add-on could avoid a second runtime, but would require hooks in
core and an activation policy before template parsing and effect/component
creation. Late activation cannot recover earlier authoring stacks. It also leaves
some hook/bookkeeping cost unless statically specialized. This is architectural
analysis, not an implemented negative experiment. It is deferred because the
profile approach already meets the demonstrated requirement without adding a
new initialization lifecycle.
