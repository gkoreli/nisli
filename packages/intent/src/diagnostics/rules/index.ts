/**
 * rules/ — one rule per file, one file per diagnostic code.
 *
 * Every rule is a generic factory over `Inspector<TNode>`: no DOM access, no
 * imports beyond the contracts and the code registry. That is what makes a rule
 * testable with a fake inspector and eight lines of a test file, and it is why
 * adding a check costs one file rather than an argument.
 *
 * WHICH KIND OF CLAIM EACH ONE MAKES is answered by the first line of its body
 * and nowhere else: `rule()` for a claim about what the author WROTE,
 * `measuringRule()` for a claim about what the browser DID. There is
 * deliberately no table of the two categories here. A list beside the code goes
 * stale the moment somebody adds the seventeenth rule, and this repository has
 * already shipped a vacuous green from exactly that shape — two duplicated
 * hard-coded path lists that agreed with each other, so a new page made both
 * say false and the test passed while the feature shipped dead. The constructor
 * IS the category, it is one grep, and it cannot disagree with itself.
 */

export { clippedLossRule } from './clipped-loss.js';
export { competingPrimariesRule } from './competing-primaries.js';
export { contrastRule } from './contrast.js';
export { crushedRule } from './crushed.js';
export { directionalOverflowRule } from './directional-overflow.js';
export { escapedRule } from './escaped.js';
export { fitStateRule } from './fit-state.js';
export { hitTargetRule } from './hit-target.js';
export { multicolumnRule } from './multicolumn.js';
export { overlapRule } from './overlap.js';
export { reflowedRule } from './reflowed.js';
export { shreddedRule } from './shredded.js';
export { spentForNothingRule } from './spent-for-nothing.js';
export { truncationRule } from './truncation.js';
export { viewportRule } from './viewport.js';
export { vocabularyRule } from './vocabulary.js';
