# Adversarial self-review

This was performed by the same investigator; no independent reviewer or agent
evaluation was used.

1. **Is the negative result really a broken instrument?** Initial harness attempts
   had a CommonJS import mistake and macOS sandbox launch failures. Neither is
   framework evidence. The final run launches all three engines, logs versions,
   records exact DOM and compares native controls. Order and inverse rotation
   checks pass, making the move counter meaningful. The full final output is in
   RESULT. Assertions were not weakened.
2. **Does wrapper removal automatically solve native composition?** No. A custom
   component's own host can still violate a native parent-child contract. Multi-
   root ranges, replacement and ownership need a design; removing wrappers in
   isolation would regress existing stability.
3. **Does `table.rows === 0` prove missing pixels or broken screen readers?** No.
   It proves a native DOM API difference. The report makes no screenshot or AT
   claim. The list check proves direct-child mismatch only.
4. **Does 99 moves prove 99× slowness?** No. This is a deterministic operation
   count. Browser layout/paint and application work determine elapsed benefit.
5. **Is binding metadata a guaranteed speedup?** No. DOM cloning or upgrade may
   dominate. Lit itself still walks cloned nodes. The proposed direct-path
   optimization is a Nisli hypothesis, and marker elimination is not required.
6. **Does Nisli lack a verifier?** No. Engine has one today, with an evidence
   presence check. Generalizing core/registry checks should reuse it. This
   investigation did not run engine verify or claim all-engine UI coverage.
7. **Can one schema describe everything?** No. Static types, JSON Schema, runtime
   validators, semantic naming and authorization overlap but differ. The goal is
   shared declarations and executable action paths, not dishonest lossless
   serialization claims.
8. **Are platform proposals shipping guarantees?** No. TC39 Signals is Stage 1;
   WebMCP and its declarative form surface evolve. Native overlay parity and
   per-feature support require new browser tests. Upstream file blob IDs and the
   retrieval date make this report's source basis auditable.
9. **Were recommendations derived from successful implementations?** Only the
   current defects and move counts are browser-measured. Candidate fixes,
   performance gains, agent outcomes and code deletion remain unmeasured. The
   source was left unchanged, so the core suite's 465 passes are baseline
   evidence, not fix validation.

Before implementation: independently review the rendering-region ownership
contract and manifest/state API; turn measured problems into permanent tests;
then require relevant local gates and remote CI under repository policy.
