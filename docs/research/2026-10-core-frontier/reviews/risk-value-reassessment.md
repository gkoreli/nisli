# Reassessment — measured differences versus investment value

Maintainer feedback: the proposed wins appear small relative to the risk of
breaking existing capabilities. That criticism changes the recommendation, not
the observed probe results.

## Where the original ranking was wrong

The report established that a synthetic rotation issues excess moves and that
specific native structures differ from unwrapped controls. It did not establish
frequency, visible impact, affected consumer requirements, maintenance burden, or
the cost of the replacement. Ranking the larger rendering-region change first
was therefore unsupported.

`each-item` is a deliberate stability mechanism: one node stays associated with a
key while its reactive contents change. Atomic movement of that one subtree is
simple. Multi-root and empty ranges complicate bounds, reordering and teardown;
moving several nodes individually does not promise group atomicity. Custom
component hosts remain even if the list wrapper disappears. Semantic advantages
do not make those capabilities free.

The probe's 14 failures are correlated checks across three browsers, not 14
independent product defects. `ul > li` failing is not proof of an unusable list.
The table and fieldset checks establish genuine native behavior differences, but
their scope is narrower than a case for replacing general composition.

## Revised decisions

| Candidate | What is missing | Decision |
| --- | --- | --- |
| Wrapper-free rendering regions | Real consumer need plus a capability-preserving ownership design | Withdraw priority; defer replacement |
| Fewer keyed moves | Representative reorder frequency and end-to-end timing | Keep as a small optional optimization candidate |
| Binding blueprint | Profile showing repeated discovery matters in real screens | Hold |
| Component schema/state migration | Reduced authoring effort measured against migration and semantic risk | No migration recommendation |
| Native overlays | Needed behavior improvement and complete supported-contract parity | Defer |
| WebMCP | Concrete operator workflow and benefit over current interaction | Optional future extension |
| Reactive graph replacement | Application CPU/allocation bottleneck and equivalent semantics | Hold |

## A better research bar

There is no evidence here of a transformative core rewrite worth adopting.
Core may already be the appropriate substrate. "More native" and a shorter
implementation are means, not outcomes.

Separate two larger questions:

1. **Execution:** is a real application's input-to-paint, startup or memory cost
   dominated by something core can remove? Profile first, then compare an isolated
   candidate with the existing implementation under matching semantics. Keep
   original capabilities as explicit acceptance criteria. A new fast path must
   share the same semantics rather than introduce two independently maintained
   runtimes.
2. **Authoring:** can agents complete substantially more ambitious real UI tasks
   with fewer decisions and repairs? The baseline is today's engine and its
   verification, not hand-written raw DOM. Examine repeated app-level work before
   adding vocabulary or instrumentation. Test an optional abstraction on complete
   tasks and prove meaningful gains in correct completion, attempts and time
   before making it the framework's new authoring model.

The prior [nextgen audit](../../nextgen/AUDIT-2026-08-27.md) already warned that
building a vocabulary and checker without measuring engineering velocity missed
the intended goal. Repeating that pattern with more metadata or another CLI
would not answer this feedback.

No new architecture is selected by this reassessment. The useful deliverables
are the compatibility evidence, the rejected ranking, and a higher acceptance
bar for the next investigation. Production source remains unchanged.
