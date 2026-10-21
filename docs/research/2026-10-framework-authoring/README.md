# Framework authoring — October 2026

Scope correction: work on Nisli's programming model and runtime contracts,
not business tasks, CRUD or application workflow layers. Source audited:
`4afde49c728a330e10ce887a38b8013d63b58498`, core 0.56.0.

Read [REPORT.md](./REPORT.md). These are bounded framework experiments, not
ratified APIs or a claim that a major productivity gain has been achieved.

Latest: [native runtime findings](./NATIVE-FINDINGS.md), using frozen follow-up
source `1d055cabdffbea8ff8d82cbfd88a6081882ca8b2` to avoid concurrent edits.

| Bet | Current status | Preservation requirement |
| --- | --- | --- |
| [Reactive template expressions](./briefs/reactive-expressions.md) | Withdrawn as a product direction: the prototype's 7 passing checks do not justify different compiled/buildless semantics | [Browser-native authoring tenet](../../TENETS.md#browser-native-authoring) |
| [Lifetime ownership](./briefs/ownership.md) | Research prototype: 5 checks pass over existing effects | Current standalone lifetimes retained; explicit detachment; no conflation with dependency tracking or app DI |
| [Native template semantics](./NATIVE-FINDINGS.md) | Research adapters: 11 behavior checks + 5 refinement checks pass; 2 original falsification assertions remain failed; 19 browser checks pass in each of 3 engines; N202 warning remains in refined unit output | [Browser-native authoring tenet](../../TENETS.md#browser-native-authoring); identity/reset and full integration still unresolved |

Evidence:

- [Expression lowering command/output](./experiments/reactive-expressions/RESULT.md)
- [Ownership command/output](./experiments/ownership/RESULT.md)
- [Unchanged core baseline and research typecheck](./validation.md): 465 tests
  passed in the earlier investigation; earlier prototype sources typechecked.
- [Native runtime commands and full results](./experiments/native-runtime/RESULT.md),
  including intentional failures and browser module hashes.
- [Authoritative sources](./sources.json) and [self-review](./reviews/self-review.md)

This research program does not modify production runtime code, public APIs,
package manifests or dependencies; other concurrent work may change the shared
checkout. [Framework tenets](../../TENETS.md) is the canonical design
reference; ADR 0030, both READMEs, AGENTS.md and the framework skill link to it.
Experiments live here and are not workspace packages. Focus/selection evidence
is limited to the named native-runtime fixtures. No remote CI, performance,
agent-productivity, complete integration or full compiler claim is made.
