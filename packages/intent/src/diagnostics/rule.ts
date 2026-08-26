/**
 * rule.ts — how a rule SPEAKS, what a rule IS, and which of two things it is.
 *
 * A rule is a composition, not a class: a code, a lens over the document, and a
 * body that turns observations into findings. There is no base class to extend
 * and no template method to override, because every rule differs in exactly one
 * place — the inference — and inheritance would put the only interesting line
 * of each file inside an override.
 *
 * What this removes, measured against the eleven hand-written rules it replaces:
 * the `findings: Finding[]` accumulator, the `return findings`, and the
 * five-field finding literal in which `code`, `severity` and `hint` were copied
 * from the registry entry every single time. Those three fields are properties
 * of the CODE, not of the finding, so they are applied once here. A rule that
 * wants to say something now writes one call with the two things only it knows:
 * who, and what.
 *
 * `undecidable()` is the other half of the contract and the reason this file is
 * not just a tidier constructor. A checker that cannot decide MUST say so rather
 * than pass — three of the four silent oracle bugs in the first run were a rule
 * quietly returning nothing when the geometry it needed was unavailable. Routing
 * that through one method means every such admission lands as N680 with the
 * asking rule named in it, instead of each rule inventing its own way to shrug.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * TWO CONSTRUCTORS, because there are two kinds of claim.
 * ══════════════════════════════════════════════════════════════════════════
 * `rule()` is for a claim about what the author WROTE. Its body gets a `Lens`,
 * which offers `declared()` and nothing else: no rectangle, no line count, no
 * resolved property. Three rules are this — the escape hatch, the vocabulary
 * check, and the competing-primaries check — and all three are true or false
 * whether or not the document ever rendered.
 *
 * `measuringRule()` is for a claim about what the browser DID. Its body gets a
 * `MeasuringLens`, whose `painted()` has already discharged the three
 * cross-cutting obligations: it drops what is not rendered, drops what an
 * escape forfeited, and reports N680 for what is present and cannot be
 * measured. Thirteen rules are this.
 *
 * WHY A CONSTRUCTOR AND NOT A GUARD, in this project's own evidence. The three
 * obligations used to be applied per rule by hand, so coverage tracked WHEN a
 * rule was written rather than WHAT it claimed: `measurable()` reached three of
 * eleven measuring rules, the escape exemption five of eleven, and the
 * injection harness then proved the cost by seeding real defects — NINE rules
 * reported a clean page over a defect that was present. The `Box`/`Bounds` type
 * split had already closed one instance of the same shape and left the
 * mechanism intact, and N715's own header records the lesson in a sentence
 * written one rule before the next recurrence: "a fix applied to one rule and
 * not to the rule beside it is its own defect class". Three times a note in a
 * header failed to stop it. Once a type did. So the obligation moves into the
 * constructor for the category, and the choice of constructor at the top of
 * each file IS the declared-versus-painted decision, made once, visibly,
 * instead of implicitly at every selector.
 */

import type { CodeEntry, Finding, Inspector, Rule } from '../contracts.js';
import { codeEntry } from './codes.js';
import type { Lens, MeasuringLens } from './observe.js';
import { measure, observe } from './observe.js';

/** The code every rule uses to admit it could not reach a verdict. */
const UNDECIDABLE = codeEntry('N680');

/** A rule's voice. Severity and hint come from the registry, never the caller. */
export interface Report {
  /** State this rule's finding about `subject`. */
  finding(subject: string, detail: string): void;
  /**
   * Admit that this rule could not decide about `subject`.
   *
   * Emits N680, not the rule's own code: "I could not measure this" is a
   * different claim from "this is broken", and collapsing them is how a checker
   * starts lying in both directions at once.
   */
  undecidable(subject: string, detail: string): void;
}

/** A rule's voice, bound to one code. The shared half of both constructors. */
function voice(entry: CodeEntry, findings: Finding[]): Report {
  return {
    finding(subject, detail) {
      findings.push({
        code: entry.code,
        severity: entry.severity,
        subject,
        detail,
        hint: entry.hint,
      });
    },
    undecidable(subject, detail) {
      findings.push({
        code: UNDECIDABLE.code,
        severity: UNDECIDABLE.severity,
        subject,
        detail: `${entry.code}: ${detail}`,
        hint: UNDECIDABLE.hint,
      });
    },
  };
}

/**
 * The composition both constructors share: a code, a findings buffer, and the
 * voice that fills it. Factored so the two cannot drift apart, which is the
 * defect class this whole file exists to remove.
 */
function composed<TNode>(
  code: string,
  see: (inspector: Inspector<TNode>, out: Report) => void,
): Rule<TNode> {
  const entry = codeEntry(code);
  return {
    code: entry.code,
    title: entry.title,
    run(inspector: Inspector<TNode>): readonly Finding[] {
      const findings: Finding[] = [];
      see(inspector, voice(entry, findings));
      return findings;
    },
  };
}

/**
 * Compose a rule whose claim is about a DECLARATION.
 *
 * The body receives a `Lens`, which offers `declared()` and nothing else. There
 * is no geometry on the far end of it — `Declaration` carries no box, no bounds,
 * no line count and no resolved property — so a rule composed this way cannot
 * measure anything, by accident or otherwise. If the claim needs a rectangle,
 * the claim is not a declaration claim and this is the wrong constructor; the
 * compiler says so at the first `box()`.
 */
export function rule<TNode>(
  code: string,
  body: (lens: Lens<TNode>, out: Report) => void,
): Rule<TNode> {
  return composed<TNode>(code, (inspector, out) => body(observe(inspector), out));
}

/**
 * Compose a rule whose claim is about PAINTED OUTPUT.
 *
 * The body receives a `MeasuringLens`, and choosing this constructor is what
 * discharges all three cross-cutting obligations: `painted()` yields only nodes
 * that render, are not inside a subtree the author took back, and whose
 * geometry means what it says — and it reports N680 through the `Report` below
 * for anything in the third category rather than dropping it. The rule cannot
 * opt out, because the obligations are not parameters and `measurable()` is not
 * on any type a rule can reach.
 *
 * The admission is wired to this rule's own voice, so an N680 raised by the
 * lens names the asking rule exactly as one raised by the body does. There is
 * no second way to admit and no way to measure without one.
 */
export function measuringRule<TNode>(
  code: string,
  body: (lens: MeasuringLens<TNode>, out: Report) => void,
): Rule<TNode> {
  return composed<TNode>(code, (inspector, out) => {
    measure(inspector, out.undecidable, (lens) => body(lens, out));
  });
}
