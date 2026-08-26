/**
 * rules/ — one rule per file, one file per diagnostic code.
 *
 * Every rule is a generic factory over `Inspector<TNode>`: no DOM access, no
 * imports beyond the contracts and the code registry. That is what makes a rule
 * testable with a fake inspector and eight lines of a test file, and it is why
 * adding a check costs one file rather than an argument.
 */

export { contrastRule } from './contrast.js';
export { crushedRule } from './crushed.js';
export { escapedRule } from './escaped.js';
export { fitStateRule } from './fit-state.js';
export { hitTargetRule } from './hit-target.js';
export { overlapRule } from './overlap.js';
export { shreddedRule } from './shredded.js';
export { truncationRule } from './truncation.js';
export { viewportRule } from './viewport.js';
export { vocabularyRule } from './vocabulary.js';
