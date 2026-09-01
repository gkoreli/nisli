# Adversarial review — Bet 01

## Strongest objection

This is a screenshot-to-code demo wearing the language of visual programming.
The generator's inaccessible latent is not a project artifact, four frames are
not a responsive function, and a coding agent manually interpreting pixels is
not a defined compiler.

## Falsification criteria

The experiment must report the bet as only partial even if its tests pass,
unless all of these are available:

1. persistent generator state saved with the project;
2. local visual editing with unaffected-region preservation;
3. coherent sampling at a width absent from the original artifact;
4. state generation that preserves contract-locked behavior;
5. reproducible compilation independent of a conversational agent's hidden
   context.

The current built-in image generator exposes none of those guarantees. The
expected verdict is therefore predetermined for the representation but not for
the usefulness of the workflow.

## Additional traps

- A four-panel image can fake consistency because all panels are generated in
  one canvas; it does not prove a shared latent can be called separately.
- Accurate labels do not imply correct control semantics or accessibility.
- Engine proof establishes fit, naming, and reachability of emitted code; it
  does not establish visual similarity to the source.
- If the compiler silently drops unrepresentable visual behavior, a passing
  typecheck conceals information loss.

## Required verdict wording

“The demonstrator passes; the proposed source representation remains
falsified.” Anything stronger outruns the evidence.
