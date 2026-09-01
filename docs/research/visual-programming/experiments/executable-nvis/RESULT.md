# Executable `.nvis` — direct visual-program probe

**Date**: 2026-08-31

**Verdict: direct execution works for the minimal language skeleton. No UI code
generation is needed.**

The durable example lives at
[`examples/import-transactions`](../../examples/import-transactions/README.md).
The `.nvis` binary contains four observations, persistent identities,
width/state continuity, eight semantic ports, visual materials, repeated-row
binding, and edit history. The generic runtime decodes and evaluates it
directly.

## Command

```sh
node docs/research/visual-programming/examples/import-transactions/generate.mjs
node --test docs/research/visual-programming/examples/import-transactions/runtime.test.mjs
```

## Full output

```text
wrote 16054 bytes to /Users/goga/Documents/goga/nisli/docs/research/visual-programming/examples/import-transactions/import-transactions.nvis
TAP version 13
# Subtest: the file is an executable NVIS binary, not the construction fixture
ok 1 - the file is an executable NVIS binary, not the construction fixture
# Subtest: state selects observations while identity survives
ok 2 - state selects observations while identity survives
# Subtest: width evaluates topology directly without generating UI code
ok 3 - width evaluates topology directly without generating UI code
# Subtest: visual controls expose semantic ports to domain code
ok 4 - visual controls expose semantic ports to domain code
1..4
# tests 4
# suites 0
# pass 4
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

Browser inspection also passed at 736 and 360 CSS pixels with no horizontal
overflow or console/page errors:

```text
normal {"status":"populated@wide · wide topology · 32 live visual marks","canvas":[1024,720],"overflow":false}
narrow {"status":"populated@narrow · narrow topology · 29 live visual marks","canvas":[360,1010],"overflow":false}
interaction file semantic port activated
```

## Boundary

This proves that the visual object can be a directly interpreted program. It
does not yet prove the primary authoring claim: `paint-fixture.mjs` is a textual
stand-in for the missing visual editor. The next falsification must create and
revise the same object through look → paint → bind operations, without exposing
the binary records as authoring syntax.
