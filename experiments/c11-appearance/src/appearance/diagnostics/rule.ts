/**
 * rule.ts — how a rule SPEAKS, and what a rule IS.
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
 */

import type { Finding, Inspector, Rule } from '../contracts.js';
import { codeEntry } from './codes.js';
import type { Lens } from './observe.js';
import { observe } from './observe.js';

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

/**
 * Compose a rule from its code and its inference.
 *
 * The body receives a `Lens` rather than an `Inspector`, so a rule cannot reach
 * an unpainted node's geometry even by accident — the only selectors that yield
 * measurable observations are the painted ones.
 */
export function rule<TNode>(
  code: string,
  body: (lens: Lens<TNode>, out: Report) => void,
): Rule<TNode> {
  const entry = codeEntry(code);
  return {
    code: entry.code,
    title: entry.title,
    run(inspector: Inspector<TNode>): readonly Finding[] {
      const findings: Finding[] = [];
      const out: Report = {
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
      body(observe(inspector), out);
      return findings;
    },
  };
}
