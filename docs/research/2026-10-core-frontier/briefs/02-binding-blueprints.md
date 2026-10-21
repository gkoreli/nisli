# Bet 02 — Cache binding discovery

**Revised verdict:** hold pending representative application profiling. No Nisli
timing comparison was run, and repeated scanning has not been shown to dominate.

**Evidence:** `template.ts:226` caches parsed templates, while `:397`, `:425`,
`:451`, `:458` repeat clone traversal, child-array copying and attribute discovery.
[Lit design](https://github.com/lit/lit/blob/main/dev-docs/design/how-lit-html-works.md)
caches part metadata; its actual clone path still uses TreeWalker. Its optional
[compiler](https://github.com/lit/lit/blob/main/packages/labs/compiler/README.md)
is an architectural precedent, not a transferable performance result.

**Experiment:** compile metadata from the browser-parsed template once. First
avoid repeated marker/name parsing; separately compare direct node paths with
TreeWalker. Resolve every binding target before changes shift sibling positions.
Retain comment boundaries for dynamic ownership. This narrows ADR 0014 rather than
assuming marker elimination is necessary for speed.

**Acceptance:** compare current core with candidate on static-heavy and
binding-heavy templates, native tables, SVG, raw-text cases, events/modifiers,
mixed attributes, classes, refs, nested factories, projection, disposal and
untrusted-HTML guards. Report first mount, warm mount, allocations, retained heap,
compressed bytes and browser layout/paint. Keep no-build authoring.

**Kill condition:** clone/layout/upgrade dominates or modest mount gains cost
material bundle size, correctness, or maintenance. Do not create another HTML
parser to calculate paths from strings. A build-time fast path remains optional
and should follow a successful runtime representation.
